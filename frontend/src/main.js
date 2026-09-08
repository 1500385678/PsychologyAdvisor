// 心理顾问 · Web App 前端入口占位
// 2026-09-09 T3 立 · Phase 1 起步
// 当前轮不实现任何业务模块(首页 / 情绪日历 / 测评 / 科普 / 危机检测 / 飞书 OAuth),仅占位入口

const meta = {
  project: "PsychologyAdvisor",
  industry: "10-心理-Psychology",
  phase: "Phase 1 · 起步",
  buildAt: "2026-09-09",
  scope: "skeleton-only",
};

console.log("[PsychologyAdvisor/frontend] booted", meta);

// 暴露到 window 便于手动验证
if (typeof window !== "undefined") {
  window.__PSY_FRONTEND__ = meta;
}
