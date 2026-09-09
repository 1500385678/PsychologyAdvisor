// 心理顾问 · Web App 前端入口
// 2026-09-09 T3 立 · 2026-09-10 T3 接入测评业务模块
// 当前轮 0 依赖 · 纯 ES Module · 不引 React/Vue
//
// 路由表(由 router.js 注册):
//   #/scales           测评列表(Phase 1 #4)
//   #/scales/{code}    答题 + 结果(Phase 1 #4)

import { startRouter, route, navigate } from "./router.js";
import {
  renderList,
  renderAssessment,
  API_BASE,
} from "./assessment.js";

const meta = {
  project: "PsychologyAdvisor",
  industry: "10-心理-Psychology",
  phase: "Phase 1 · 测评页业务模块(0910 T3 立)",
  buildAt: "2026-09-10",
  scope: "skeleton + 测评页(Phase 1 #4)",
  apiBase: API_BASE,
};

console.log("[PsychologyAdvisor/frontend] booted", meta);

// 暴露到 window 便于手动验证 / dev console 检查
if (typeof window !== "undefined") {
  window.__PSY_FRONTEND__ = meta;
  window.__PSY_NAV__ = navigate;
}

// 注册路由
route("/scales", (params) => renderList(document.getElementById("view")));
route("/scales/:code", ({ code }) =>
  renderAssessment(document.getElementById("view"), code)
);

// 顶部 nav 链接点击处理(让浏览器原生跳转 + 路由接管)
document.addEventListener("DOMContentLoaded", () => {
  startRouter(document.getElementById("view"));
});
// 如果 DOM 已经就绪(模块脚本默认 defer),立即启动
if (document.readyState !== "loading") {
  startRouter(document.getElementById("view"));
}
