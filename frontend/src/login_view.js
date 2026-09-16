// 心理顾问 · 登录页视图
// 2026-09-17 T3 立 · Phase 1 #7 "飞书 OAuth + 端到端加密"前端视图子模块
// 0 依赖 · 纯 ES Module
//
// 设计原则(6 条):
//   1. 单一职责:本文件只负责登录 UI 渲染 + 飞书 OAuth 触发 + passphrase 收集
//   2. passphrase 仅活在内存(单次加解密);不写 localStorage / sessionStorage
//   3. 登录成功后:跳到 /checkin(让用户立刻看到"今天打卡可加密"的入口)
//   4. 已登录态直接展示 user_id + 登出按钮(避免重复登录)
//   5. 错误处理:网络/服务错误用顶部红色提示条(不阻塞表单)
//   6. 隐私最小化:登录页顶部说清"日记端到端加密,服务端不见明文,passphrase 不上传"
//
// 与 auth.js / crypto.js 协作:
//   - 点击"飞书登录" → auth.js.loginWithFeishu()(mock 模式 fetch 回调)
//   - passphrase 收集在另一个 field(不立刻提交,等下次打卡时用 crypto.encryptString)
//   - 登录态变化由 main.js authSubscribe 监听并刷 nav,本视图也可单独刷

import { isLoggedIn, getUser, loginWithFeishu, logout } from "./auth.js";

export function renderLogin(root) {
  // 已登录态
  if (isLoggedIn()) {
    const user = getUser();
    root.innerHTML = `
      <section class="psy-login">
        <h2>已登录</h2>
        <p class="psy-hint">用户 ID:<code>${escapeHtml(user?.user_id || "")}</code></p>
        <p class="psy-hint">登录时间:<small>${escapeHtml(user?.login_at || "")}</small></p>
        <div class="psy-disclaimer">
          <strong>隐私说明</strong>:你的日记采用端到端加密(AES-GCM 256 + PBKDF2),服务端永远只见密文,不接触明文与 passphrase。
          passphrase 仅在你本地浏览器内存,刷新页面后需重新输入才能解密历史日记。
        </div>
        <div class="psy-actions">
          <button id="psy-logout" class="psy-btn">登出</button>
          <a href="#/checkin" class="psy-btn psy-btn-primary">去打卡</a>
        </div>
      </section>
    `;
    const btn = root.querySelector("#psy-logout");
    if (btn) btn.addEventListener("click", () => {
      logout();
      // 强制刷新当前视图
      import("./router.js").then((m) => m.navigate("/login"));
    });
    return;
  }

  // 未登录态:飞书 OAuth(modal 引导) + passphrase 字段(下次打卡时用)
  root.innerHTML = `
    <section class="psy-login">
      <h2>登录心理顾问</h2>
      <p class="psy-hint">登录后,你的情绪日记可以<strong>端到端加密</strong>同步到服务端(本地浏览器密钥,服务端不见明文)。</p>

      <div class="psy-disclaimer">
        <strong>隐私说明</strong>:<br>
        · <strong>端到端加密</strong>:日记内容用你本地 passphrase 通过 PBKDF2 + AES-GCM 加密,服务端只存密文。<br>
        · <strong>passphrase 不上传</strong>:仅在你本地浏览器内存,刷新页面后需重新输入才能解密历史日记。<br>
        · <strong>飞书登录仅用于身份</strong>:拿 JWT 鉴权,不与日记内容关联(服务端无法解密你的日记)。
      </div>

      <div id="psy-login-error" class="psy-warn-box" hidden></div>

      <div class="psy-field">
        <button id="psy-feishu-login" class="psy-btn psy-btn-primary">使用飞书登录(mock)</button>
        <small class="psy-muted">当前 mock 模式一键登录,生产替换为真飞书 OAuth 跳转。</small>
      </div>

      <h3>为日记设置 passphrase(本地加密密钥)</h3>
      <p class="psy-hint">下面这个 passphrase 仅在你本地浏览器内存,用于加密你的日记。请记住它,刷新页面后需重新输入。</p>
      <div class="psy-field">
        <label for="psy-passphrase">passphrase</label>
        <input id="psy-passphrase" type="password" placeholder="至少 1 个字符(生产建议 ≥ 8)" autocomplete="off" />
        <small class="psy-muted">仅本次会话有效,关闭页面即清除。</small>
      </div>

      <p class="psy-hint">
        <a href="#/articles">← 先看看科普</a> ·
        <a href="#/scales">先做测评</a>
      </p>
    </section>
  `;

  const btn = root.querySelector("#psy-feishu-login");
  const err = root.querySelector("#psy-login-error");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "登录中…";
    err.hidden = true;
    try {
      await loginWithFeishu();
      // loginWithFeishu 成功后已经 navigate 到 /checkin(modal 模式下)
      // 真飞书模式:跳到飞书,后面由 /auth/callback 接管
    } catch (e) {
      err.hidden = false;
      err.textContent = "登录失败:" + (e.message || String(e));
      btn.disabled = false;
      btn.textContent = "使用飞书登录(mock)";
    }
  });

  // passphrase 收集:不主动 submit,只在下一次打卡(checkin.js)时读取 input value
  // 不存任何地方,只在 DOM 内短暂存在
  const passphraseInput = root.querySelector("#psy-passphrase");
  passphraseInput.addEventListener("input", () => {
    // 仅用于 UX:字数提示(可选)
    // 不存值,避免页面刷新后被复用
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}