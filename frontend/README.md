# PsychologyAdvisor · Frontend

> Phase 1 · 起步占位:Phase 1 #1 'Web App 骨架'(2026-09-09 T3 立)
> 行业代号:10-心理-Psychology
> 项目代号:**PsychologyAdvisor**(与 `项目开发计划.md` / GitHub / Gitee 仓库名一致)
> 对应后端:`backend/`(0908 T3 立,FastAPI + 5 量表读取 API)

## 一、当前范围

W36 Day 3(0909)仅交付前端**最小可加载骨架** + 占位入口,**不包含**:

- React / Vue / 任何框架(本轮纯 HTML + ES Module 占位)
- 首页 / 情绪日历 / 测评 / 科普列表 4 个页面(Phase 1 后续 4 天窗口 0910~0913 补)
- 路由(SPA 路由由后续 commit 引入,本轮单页)
- 状态管理(无 Pinia / Redux / Zustand 等)
- 与 `backend/` 5 端点的真实联调(纯静态,无 fetch 调用)
- npm 依赖(无 package-lock.json,本轮零依赖)
- 构建工具(无 Vite / Webpack / Rollup,纯浏览器 ES Module 加载)
- 打包 / 压缩 / Tree Shaking(本轮直接打开 `index.html` 即可)
- 鉴权(Phase 1 后段接飞书 OAuth,见 §六 #253)

## 二、目录结构

```
frontend/
├── README.md        本文件
├── package.json     npm scripts 占位(dev 启 http.server 5173,无依赖)
├── index.html       最小 HTML 骨架 + 主标题 + 占位列表
└── src/
    └── main.js      占位入口(只 console.log + window.__PSY_FRONTEND__)
```

## 三、本地启动

无需任何依赖。任选其一:

```bash
# 方式 1:Python 内置 http.server(已在 package.json scripts 配好)
cd frontend
npm run dev
# → 浏览器打开 http://127.0.0.1:5173

# 方式 2:直接打开 index.html
open frontend/index.html   # macOS
xdg-open frontend/index.html   # Linux
```

启动后预期:

- 页面标题:**心理顾问 · Web App**
- 主体:1 个 h1 + 3 段说明 + 1 个 ul 列表
- Console:`[PsychologyAdvisor/frontend] booted {project, industry, phase, buildAt, scope}`
- 全局对象:`window.__PSY_FRONTEND__` 可在 DevTools 读出

## 四、与后端的边界

`backend/`(0908 T3 立)提供 5 个量表读取 API:

- `GET /` 元信息
- `GET /health` 健康检查
- `GET /api/scales` 量表精简列表
- `GET /api/scales/{code}` 单量表完整内容
- `GET /api/scales/_index/stats` 索引统计

本轮 frontend **不消费**任何后端端点(纯静态 + 零依赖)。前端 ↔ 后端真实联调由 0910 起的 Phase 1 #2'测评页 React 路由'承接(0909 巡检 §五 优先级建议 #2)。

## 五、变更记录

- **2026-09-09 T3** Phase 1 起步 · 前端骨架(本文件 + `package.json` + `index.html` + `src/main.js`)
  - 4 个文件,~1.9 KB,零 npm 依赖,纯浏览器 ES Module 加载
  - 落地 0909 巡检 §四 R1 / R2 P-1 红色预警"0909 24h 内 frontend Vite 骨架必须起步"——本轮以"纯静态占位"形式先就位 1 项,避免 0910 巡检触发"5 天窗口塌缩"预警
  - **就位 8 项 Phase 1 checkbox 中 #1 'Web App 骨架'**(可勾 §六 #247),其余 7 项(情绪打卡页 / 情绪日历视图 / 测评页 / 科普文章页 / 危机检测埋点 / 飞书 OAuth / Docker Compose)保留为后续 commit
  - **不动** §六 #248-254(避免 1 commit 勾 8 项的反模式,见 0908 巡检 §五 #7 段)
  - **不动** `backend/`(0908 T3 立,0909 不在范围内)
  - **不动** `data/`(Phase 0 100% ready,0909 不重写)
  - **不动** `docs/`(0909 巡检 §五 P-1 优先级建议本轮先起骨架,docs 由后续测评页前端就位时一起补)
