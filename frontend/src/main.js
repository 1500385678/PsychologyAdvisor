// 心理顾问 · Web App 前端入口
// 2026-09-09 T3 立 · 2026-09-10 T3 接入测评业务模块 · 2026-09-11 T3 接入情绪打卡业务模块
// 2026-09-12 T3 接入情绪日历视图业务模块 · 2026-09-14 T3 接入科普文章页业务模块
// 2026-09-15 T3 接入危机检测埋点业务模块(checkin.js 文字框接入 attachCrisisMonitor,4 级严重程度 + 资源弹窗)
// 当前轮 0 依赖 · 纯 ES Module · 不引 React/Vue
//
// 路由表(由 router.js 注册):
//   #/articles               科普列表(Phase 1 #5 · 0914)
//   #/articles?cat=XX         科普列表(锚定到指定分类,0914)
//   #/articles/{id}           概念详情(Phase 1 #5 · 0914)
//   #/scales                 测评列表(Phase 1 #4 · 0910)
//   #/scales/{code}          答题 + 结果(Phase 1 #4 · 0910)
//   #/checkin                情绪打卡首页(Phase 1 #2 · 0911)
//   #/checkin/new            打卡表单(Phase 1 #2 · 0911,文字框 0915 起挂危机检测)
//   #/checkin/saved          打卡完成确认(Phase 1 #2 · 0911)
//   #/calendar               情绪日历 30 天视图(Phase 1 #3 · 0912)
//   #/calendar/day/{date}    某日打卡详情(Phase 1 #3 · 0912)
//
// 跨模块组件(由具体业务视图挂载,本文件不直接路由):
//   crisis_monitor.js         attachCrisisMonitor + openCrisisModal(Phase 1 #6 · 0915)
//
//   - checkin.js:打卡文字框挂 attachCrisisMonitor,critical 命中自动弹资源窗(24h snooze 可选)
//   - 危机资源弹窗由 crisis_monitor.openCrisisModal 触发,内含 hotlines_zh_cn + resources.json 危机匹配项

import { startRouter, route, navigate } from "./router.js";
import {
  renderList,
  renderAssessment,
  API_BASE,
} from "./assessment.js";
import {
  renderCheckinHome,
  renderCheckin,
  renderSaved,
} from "./checkin.js";
import {
  renderCalendar,
  renderDayDetail,
} from "./calendar.js";
import {
  renderArticlesList,
  renderArticleDetail,
} from "./articles.js";

const meta = {
  project: "PsychologyAdvisor",
  industry: "10-心理-Psychology",
  phase: "Phase 1 · 测评页(0910) + 情绪打卡页(0911) + 情绪日历(0912) + 科普文章页(0914) + 危机检测埋点(0915)",
  buildAt: "2026-09-15",
  scope: "skeleton + 测评页(Phase 1 #4) + 情绪打卡页(Phase 1 #2) + 情绪日历(Phase 1 #3) + 科普文章页(Phase 1 #5) + 危机检测埋点(Phase 1 #6 · 跨模块组件)",
  apiBase: API_BASE,
};

console.log("[PsychologyAdvisor/frontend] booted", meta);

// 暴露到 window 便于手动验证 / dev console 检查
if (typeof window !== "undefined") {
  window.__PSY_FRONTEND__ = meta;
  window.__PSY_NAV__ = navigate;
}

// 注册路由
// 科普文章(0914 T3 立):列表 + 详情;列表 ?cat=XX 滚到对应分类
route("/articles", () => renderArticlesList(document.getElementById("view")));
route("/articles/:id", ({ id }) =>
  renderArticleDetail(document.getElementById("view"), id)
);
route("/scales", () => renderList(document.getElementById("view")));
route("/scales/:code", ({ code }) =>
  renderAssessment(document.getElementById("view"), code)
);
route("/checkin", () => renderCheckinHome(document.getElementById("view")));
route("/checkin/new", () => renderCheckin(document.getElementById("view")));
route("/checkin/saved", () => renderSaved(document.getElementById("view")));
route("/calendar", () => renderCalendar(document.getElementById("view")));
route("/calendar/day/:date", ({ date }) =>
  renderDayDetail(document.getElementById("view"), date)
);

// 顶部 nav 链接点击处理(让浏览器原生跳转 + 路由接管)
document.addEventListener("DOMContentLoaded", () => {
  startRouter(document.getElementById("view"));
});
// 如果 DOM 已经就绪(模块脚本默认 defer),立即启动
if (document.readyState !== "loading") {
  startRouter(document.getElementById("view"));
}
