// 心理顾问 · 简易 hash 路由
// 2026-09-10 T3 立 · Phase 1 #4 '测评页' 前端路由层
// 2026-09-12 T3 增 query string 支持(为情绪日历的 ?anchor=YYYY-MM-DD 服务)
// 0 依赖 · 纯浏览器 ES Module · 配合 backend/ FastAPI 5 端点
//
// 路由表:
//   #/scales          → 测评列表(列出 5 量表,选 1 进入答题)
//   #/scales/{code}   → 答题页(读 /api/scales/{code} 完整内容)
//   #/calendar?anchor=YYYY-MM-DD  → 30 天情绪日历(0912 起支持 ?anchor 锚点)
//   #/calendar/day/{date}         → 某日打卡详情
//   默认 / 空 hash     → 重定向到 #/scales
//
// query string 处理:匹配前剥离 ? 之后内容,把原始 query 字符串透传到 params.__query,
// 视图层可自行 URLSearchParams 解析。

const routes = [];

export function route(pattern, handler) {
  // pattern: '/scales' | '/scales/:code'
  const keys = [];
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/\/+$/, "")
        .replace(/:([a-zA-Z_]+)/g, (_, k) => {
          keys.push(k);
          return "([^/]+)";
        }) +
      "/?$"
  );
  routes.push({ regex, keys, handler });
}

export function startRouter(rootEl) {
  const render = () => {
    const hash = window.location.hash || "#/scales";
    const rawPath = hash.replace(/^#/, "");
    // 剥离 query string(0912 起支持 ?anchor=YYYY-MM-DD 等)
    const qIdx = rawPath.indexOf("?");
    const path = qIdx >= 0 ? rawPath.slice(0, qIdx) : rawPath;
    const queryStr = qIdx >= 0 ? rawPath.slice(qIdx + 1) : "";
    for (const r of routes) {
      const m = path.match(r.regex);
      if (m) {
        const params = { __query: queryStr };
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        try {
          rootEl.innerHTML = '<p class="psy-loading">加载中…</p>';
          const out = r.handler(params);
          // 允许 handler 返回 Promise(异步渲染)
          if (out && typeof out.then === "function") {
            out.catch((err) => {
              rootEl.innerHTML = `<p class="psy-error">加载失败:${escapeHtml(String(err))}</p>`;
            });
          }
        } catch (err) {
          rootEl.innerHTML = `<p class="psy-error">渲染失败:${escapeHtml(String(err))}</p>`;
        }
        return;
      }
    }
    // 无匹配
    rootEl.innerHTML = `<p class="psy-error">未找到路由:${escapeHtml(path)}</p><p><a href="#/scales">返回测评列表</a></p>`;
  };

  window.addEventListener("hashchange", render);
  // 首次进入若 hash 为空,补默认
  if (!window.location.hash) {
    window.location.hash = "#/scales";
  }
  render();
}

export function navigate(path) {
  window.location.hash = path.startsWith("#") ? path : "#" + path;
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
