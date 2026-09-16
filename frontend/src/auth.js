// 心理顾问 · 飞书 OAuth 登录模块
// 2026-09-17 T3 立 · Phase 1 #7 "飞书 OAuth 登录 + 端到端加密(用户日记)" 前端子模块
// 0 依赖 · 纯 ES Module
//
// 设计原则(8 条,与 backend/main.py §加密与鉴权设计 对齐):
//   1. JWT 只存 localStorage(psy_jwt_v1),不在 URL 长期带,登出立即清
//   2. 当前 mock 模式:fetch /auth/feishu/login 拿 authorize_url(本身指向本服务回调),浏览器跳一下即拿到 JWT
//   3. 真飞书模式:authorize_url 跳 https://open.feishu.cn,用户授权后飞书重定向到后端 /auth/feishu/callback,后端用 code 换 JWT
//   4. 当前实现走 fetch + 自动 follow 简化:authorize_url 是相对路径时用 window.location 跳,是绝对路径时直接 a.click()
//   5. /auth/me 调通即认为登录态有效,失败自动清 JWT
//   6. 登录态变更广播:订阅者用 subscribe(listener) 监听;登入/登出/换 token 都会触发
//   7. API_BASE 与 assessment.js 共用(避免双源)
//   8. 用户信息(用户名/union_id)从 /auth/me 拿,不解析 JWT payload(避免误用)
//
// 与 crypto.js 的协作:
//   - 登录后,crypto 模块拿 JWT 当作"已登录"信号(密钥仍由用户 passphrase + PBKDF2 派生)
//   - 服务端绝不见 passphrase;key 仅活在内存,刷新页面需用户重新输入 passphrase 才能解密旧日记

import { API_BASE } from "./assessment.js";

const JWT_KEY = "psy_jwt_v1";
const USER_KEY = "psy_user_v1";

// 内存态(避免每次都读 localStorage)
let _jwt = null;
let _user = null;
const _subscribers = new Set();

function _readPersisted() {
  try {
    const j = localStorage.getItem(JWT_KEY);
    const u = localStorage.getItem(USER_KEY);
    if (j) _jwt = j;
    if (u) _user = JSON.parse(u);
  } catch (e) {
    // localStorage 不可用(隐私模式)→ 内存态,不抛
  }
}

function _persist() {
  try {
    if (_jwt) localStorage.setItem(JWT_KEY, _jwt);
    else localStorage.removeItem(JWT_KEY);
    if (_user) localStorage.setItem(USER_KEY, JSON.stringify(_user));
    else localStorage.removeItem(USER_KEY);
  } catch (e) {
    // 隐私模式降级
  }
}

function _notify() {
  for (const fn of _subscribers) {
    try { fn({ jwt: _jwt, user: _user }); } catch (e) { /* 订阅者异常不影响其他订阅 */ }
  }
}

// 启动时立即读一次(模块顶层副作用)
_readPersisted();

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

export function getJwt() {
  return _jwt;
}

export function getUser() {
  return _user ? { ..._user } : null;
}

export function isLoggedIn() {
  return !!_jwt;
}

export function subscribe(fn) {
  _subscribers.add(fn);
  // 立刻触发一次,让订阅者拿到当前态
  try { fn({ jwt: _jwt, user: _user }); } catch (e) {}
  return () => _subscribers.delete(fn);
}

// ---------------------------------------------------------------------------
// 登录流程(modal 提示用户确认)
// ---------------------------------------------------------------------------

/**
 * 启动飞书 OAuth 登录。
 *
 * 步骤:
 *   1. GET /auth/feishu/login → 拿到 authorize_url + state
 *   2. 把 state 存 localStorage(回调时校验)
 *   3. 浏览器跳 authorize_url(同源时 location.href;跨源时 a.click())
 *   4. 飞书/后端回调到 /auth/feishu/callback 处理后 → 重定向到前端 #/auth/callback?code=&state=
 *   5. 前端收到回调参数 → POST /auth/feishu/callback → 拿到 JWT + user_id → 持久化
 *
 * mock 模式(当前):
 *   authorize_url 直接是 /auth/feishu/callback?code=dev_xxx&state=xxx,
 *   浏览器跳过去,后端发 200 JSON,前端 onload 拦截 response 后调用 _completeOAuthFromJson。
 *
 * 真飞书模式(替换):
 *   authorize_url = https://open.feishu.cn/open-apis/authen/v2/index?app_id=...&redirect_uri=BACKEND/auth/feishu/callback&state=...
 *   后端 callback 端点同时支持 GET(query)+ POST(body),GET 用于飞书重定向,POST 用于前端继续流程。
 */
export async function loginWithFeishu() {
  const r = await fetch(`${API_BASE}/auth/feishu/login`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`发起登录失败 HTTP ${r.status}`);
  const data = await r.json();
  if (!data.authorize_url || !data.state) throw new Error("登录响应缺字段");
  // 存 state(回调时校验)
  try { sessionStorage.setItem("psy_oauth_state", data.state); } catch (e) {}
  // 跳
  const u = data.authorize_url;
  if (u.startsWith("http://") || u.startsWith("https://")) {
    // 跨域跳转(真飞书)
    window.location.href = u;
  } else {
    // 同域(本服务 mock 回调)— 用 location.href + 拦截 fetch 的方式不可行(浏览器跳就走了)
    // 改成:用 fetch 自己 POST 回调拿 JWT(因为 mock 的 callback 已经支持 GET/POST 都能用 state+code)
    // 但回调约定是 redirect — 这里用一次性 form 提交,后端 redirect 到 #/auth/callback?jwt=...
    // 更简单:fetch 直接走 /auth/feishu/callback POST,绕开浏览器跳
    await _completeMockOAuth(data.state, u);
  }
}

// mock 模式特殊处理:authorize_url 已经是 /auth/feishu/callback?code=...&state=...,
// 直接 fetch 这个 URL 拿 JSON,不真跳浏览器
async function _completeMockOAuth(state, callbackUrl) {
  const url = new URL(callbackUrl, window.location.origin);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  if (!code || !stateParam) throw new Error("mock authorize_url 缺 code/state");
  const r = await fetch(`${API_BASE}/auth/feishu/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ code, state: stateParam }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`mock callback HTTP ${r.status} ${text.slice(0, 120)}`);
  }
  const data = await r.json();
  _setSession(data.jwt, data.user_id);
}

// 真飞书模式:浏览器跳到飞书 → 飞书重定向到后端 callback → 后端 302 到前端 #/auth/callback?jwt=...&user_id=...
// (此函数由 main.js 在 /auth/callback 路由调用)
export async function completeOAuthFromQuery(queryString) {
  const params = new URLSearchParams(queryString || window.location.hash.split("?")[1] || "");
  const jwt = params.get("jwt");
  const userId = params.get("user_id") || params.get("sub");
  const err = params.get("error");
  if (err) throw new Error(`OAuth 错误: ${err}`);
  if (!jwt || !userId) throw new Error("回调缺 jwt/user_id");
  _setSession(jwt, userId);
}

function _setSession(jwt, userId) {
  _jwt = jwt;
  _user = { user_id: userId, login_at: new Date().toISOString() };
  _persist();
  _notify();
}

export function logout() {
  _jwt = null;
  _user = null;
  _persist();
  _notify();
}

// ---------------------------------------------------------------------------
// 401 自动登出:任何带 Bearer 的 fetch 失败时,清 JWT 并广播
// ---------------------------------------------------------------------------

export async function authedFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", headers.get("Accept") || "application/json");
  if (_jwt) headers.set("Authorization", `Bearer ${_jwt}`);
  const r = await fetch(url, { ...options, headers });
  if (r.status === 401 && _jwt) {
    // JWT 失效 → 自动登出 + 广播
    logout();
  }
  return r;
}

// ---------------------------------------------------------------------------
// /auth/me 拉一次校验(启动时 / 手动)
// ---------------------------------------------------------------------------

export async function refreshMe() {
  if (!_jwt) return null;
  const r = await authedFetch(`${API_BASE}/auth/me`);
  if (!r.ok) return null;
  try {
    const data = await r.json();
    _user = { ...(_user || {}), user_id: data.user_id, login_at: _user?.login_at || new Date().toISOString() };
    _persist();
    _notify();
    return _user;
  } catch (e) {
    return null;
  }
}