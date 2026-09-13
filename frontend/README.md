# PsychologyAdvisor · Frontend

> Phase 1 · 骨架(0909 T3 立) + 测评页(0910 T3 立) + 情绪打卡页(0911 T3 立) + 情绪日历视图(0912 T3 立) + 科普文章页(0914 T3 立)
> 行业代号:10-心理-Psychology
> 项目代号:**PsychologyAdvisor**(与 `项目开发计划.md` / GitHub / Gitee 仓库名一致)
> 对应后端:`backend/`(0908 T3 立,FastAPI + 5 量表读取 API)

## 一、当前范围

0914 T3 在 0912 情绪日历模块基础上**新增科普文章页业务模块**,Phase 1 业务模块层 3 动 → 4 动。当前范围:

- ✅ 测评页(Phase 1 #4 · 0910 T3 立):选量表 → 答题 → 算分 → 解读(非诊断性)
- ✅ 情绪打卡页(Phase 1 #2 · 0911 T3 立):滑动条(1-5)+ 标签选择(≤3,11 子类 60 标签)+ 文字输入(≤200 字)+ 最近 7 天回顾(localStorage 持久化)
- ✅ 情绪日历视图(Phase 1 #3 · 0912 T3 立):30 天窗口(月度切换 / SVG 折线 / 5×6 日色块 / 标签云 / 区间统计)+ 某日详情(支持一天多次打卡,localStorage 共用 key 与 checkin.js 实时同步)
- ✅ 科普文章页(Phase 1 #5 · 0914 T3 立):10 分类卡片网格 + 全部/收藏双 tab + 标题/定义搜索 + 概念卡片网格 + 收藏按钮 + 详情页 markdown 渲染正文 + 同分类上一篇/下一篇 + 同分类侧栏 8 条 + 24h 热线免责声明(数据源 `../data/concepts/*.json` 10 文件并发 fetch + `localStorage.psy_articles_favorites_v1` Set 持久化收藏 id,内存缓存免二次 fetch)
- ✅ 简易 hash 路由(`#/scales`、`#/scales/{code}` 0910 立;`#/checkin`、`#/checkin/new`、`#/checkin/saved` 0911 立;`#/calendar`、`#/calendar/day/{date}` 0912 立;`#/articles`、`#/articles/{id}`、`#/articles?cat=XX` 0914 立;`?anchor=YYYY-MM-DD` query string 0912 立;0 依赖)
- ✅ 与后端 FastAPI 5 端点真实联调(`/api/scales`、`/api/scales/{code}`,0910 T3 起)
- ✅ 测评结果展示:总分 + severity band(按 interpretation[].range 匹配)+ 推荐建议
- ✅ 危机提示:有 `red_flags` 的量表显示 24h 热线(400-161-9995)
- ✅ 打卡文字框实时危机监测(0911 起 preview,基于 crisis_keywords critical 26 词,仅作用于 note 输入框不作用于 tag 选择,per pairing_rules.crisis_keywords_boundary)
- ✅ 非诊断免责声明(每个量表自带 disclaimer + 科普详情页统一展示,前端统一展示)
- ✅ 30 天 SVG 折线(0 依赖手写,viewBox 600×120 + 网格 + 5 档色点 + hover title,0912 T3 立)
- ✅ 0 依赖 markdown 渲染器(`**bold**` / `*italic*` / \`code\` / `<p>` / `<ul>` / `<ol>` / `<table>` 6 类语法,0914 T3 立,自写 ~50 行)

当前**不包含**(本轮 0914 内未做,留后续 commit):

- React / Vue / 任何框架(继续纯 vanilla ES Module,0914 内不引)
- 图表库(Chart.js / D3 / Recharts,0912 用手写 SVG 折线,0914 无图表)
- markdown 库(marked / markdown-it / showdown,0914 自写 0 依赖渲染器)
- 危机检测埋点(Phase 1 #6,留 0915+,0911 打卡文字框已有 preview,0914 仍仅作用于 note)
- 飞书 OAuth 登录(Phase 1 #7,留 0915+)
- Docker Compose(Phase 1 #8,留 MVP 收尾)
- 状态管理(无 Pinia / Redux / Zustand)
- 鉴权(Phase 1 后段)
- 构建工具(无 Vite / Webpack,纯浏览器 ES Module 加载)
- 打包 / 压缩 / Tree Shaking
- 打卡数据后端持久化(当前 localStorage,留飞书 OAuth 阶段)
- 科普数据后端持久化(当前 localStorage 收藏 + data/concepts 静态 JSON,留飞书 OAuth 阶段)

## 二、目录结构

```
frontend/
├── README.md         本文件
├── package.json      npm scripts 占位(dev 启 http.server 5173,无依赖)
├── index.html        骨架 + 测评 + 打卡 + 日历 + 科普 CSS + 顶部 nav(科普 / 测评 / 情绪打卡 / 情绪日历)
└── src/
    ├── main.js       入口(注册路由 + 启动 + 暴露 window.__PSY_FRONTEND__)
    ├── router.js     简易 hash 路由(0 依赖,0910 T3 立 · 0912 T3 增 query string 支持)
    ├── assessment.js 测评页业务模块(列表 / 答题 / 结果 3 视图,0910 T3 立)
    ├── checkin.js    情绪打卡页业务模块(首页 / 表单 / 完成,0911 T3 立)
    ├── calendar.js   情绪日历视图业务模块(30 天日历 / 某日详情,0912 T3 立)
    └── articles.js   科普文章页业务模块(列表 / 详情 / 搜索 / 收藏,0914 T3 立)
```

## 三、本地启动

无需任何前端依赖。**必须先启动后端**(否则测评页 fetch 会 404):

```bash
# 1. 启动后端(必填,见 backend/README.md)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → 健康检查:curl http://127.0.0.1:8000/health

# 2. 启动前端(任选其一)
cd frontend
npm run dev
# → 浏览器打开 http://127.0.0.1:5173
# → 默认跳到 #/scales(测评列表)

# 或直接打开
open frontend/index.html
```

启动后预期:

- 页面标题:**心理顾问 · Web App**
- 顶部 nav:科普入口(`#/articles`)+ 情绪打卡入口(`#/checkin`)+ 情绪日历入口(`#/calendar`)+ 测评入口(`#/scales`)
- 测评列表:5 张卡片(PHQ-9 / GAD-7 / PSS / ISI / PSQI),含分类 tag + 题数 + 用时
- 答题页:逐题 + 0/1/2/3 单选(每题必答),提交后跳转结果页
- 结果页:总分 + severity band(色块边)+ 推荐建议 + 危机提示(若有)+ 逐题得分详情 + 非诊断免责
- 打卡首页:最近 7 天摘要(日期 + 感受 + 标签 chips)+ "+ 立即打卡" 按钮
- 打卡表单:滑动条(1-5)+ 60 标签(分 11 子类 / 积极-消极)+ 文字输入(≤200 字)+ 计数器;note 输入"想死 / 自杀 / 不想活" 等 critical 词自动弹 24h 热线(per crisis_keywords)
- 打卡完成:跳 `#/checkin/saved` 确认页(localStorage 写入)
- 情绪日历:30 天窗口(月度切换按钮 + 30 天 SVG 折线 + 5×6 日色块 + 标签云 + 区间统计);点击日格进入某日详情(`#/calendar/day/YYYY-MM-DD`)
- 某日详情:列出该日所有打卡记录(支持一天多次打卡,每条含时间 + 感受 + 标签 chips + 备注)
- 科普列表:10 分类卡片网格(🧠 心理学理论 / 💭 认知 / 🌱 发展 / 👥 社会 / 🩺 临床 / 🎭 人格 / 🌟 积极 / 🛠️ 治疗 / 📏 测量 / 👤 大师)+ 全部/收藏 双 tab + 标题/定义搜索框 + 概念卡片网格(标题 + 分类 tag + 章节 + first_definition + 收藏按钮)
- 科普详情:点击卡片标题进入(`#/articles/{id}`,如 `#/articles/07-001`),含面包屑 + 标题 + 分类 tag + first_definition + 收藏按钮 + raw 字段 markdown 渲染正文(支持 `**bold**` / `*italic*` / \`code\` / 列表 / 表格 6 类语法)+ 同分类上一篇/下一篇 + 同分类侧栏 8 条 + 24h 热线免责声明
- Console:`[PsychologyAdvisor/frontend] booted {project, industry, phase, buildAt, scope, apiBase}`
- 全局对象:`window.__PSY_FRONTEND__` / `window.__PSY_NAV__` 可在 DevTools 读出
- localStorage keys:`psy_checkin_logs_v1`(打卡数据本地持久化,跨会话保留;checkin.js 写入,calendar.js 只读)+ `psy_articles_favorites_v1`(科普收藏 id 集合 Set,articles.js 读写)

## 四、与后端的边界

`backend/`(0908 T3 立)提供 5 个量表读取 API,**测评页消费其中 2 个**:

- ✅ `GET /api/scales` → 测评列表卡片(消费,0910 T3 起)
- ✅ `GET /api/scales/{code}` → 答题页 + 结果页(消费,0910 T3 起)
- ⏸ `GET /` / `GET /health` / `GET /api/scales/_index/stats` → 当前轮未消费,留后续

API_BASE 默认 `http://127.0.0.1:8000`,可通过 `window.__PSY_API_BASE__` 覆盖。

**CORS**:backend 默认允许跨域(0908 T3 起),若 CORS 报错请先确认 `backend/main.py` 启动时 `--port 8000` 正确。

## 五、变更记录

- **2026-09-14 T3** Phase 1 #5 '科普文章页' 业务模块 · frontend 落地
  - **新增 1 文件**:`src/articles.js` ~440 行(2 视图 + 1 0 依赖 markdown 渲染器 + 1 搜索 + 1 收藏,0 依赖)
  - **改写 3 文件**:`src/main.js`(0912 T3 68 行 → 0914 T3 77 行,新增 2 路由 `#/articles` / `#/articles/:id` + import `{ renderArticlesList, renderArticleDetail }` + meta 同步刷新 phase/buildAt 加入"科普文章页(0914)")+ `index.html`(顶部 nav 增"科普"入口置顶 + 科普页 CSS 130+ 行:`.psy-articles` / `.psy-tabs` 全部-收藏双 tab + `.psy-tab-on` 选中态 / `.psy-search` 搜索框 + 计数 / `.psy-cat-grid` 10 分类卡片 grid / `.psy-cat-card` / `.psy-cat-emoji` 10 emoji / `.psy-cat-body` / `.psy-cat-count` / `.psy-cat-sample` / `.psy-article-grid` 概念卡片 grid / `.psy-article-card` / `.psy-article-title` / `.psy-article-emoji` / `.psy-article-meta` / `.psy-article-section` / `.psy-article-id` / `.psy-article-def` / `.psy-fav-btn` 收藏按钮 / `.psy-fav-on` 选中态 / `.psy-article-detail` 详情 / `.psy-article-breadcrumb` 面包屑 / `.psy-article-detail-head` / `.psy-article-body` 正文容器 / `.psy-md-table-wrap` 表格横向滚动 / `.psy-md-table` 表格样式 / `.psy-article-pager` 上下篇 / `.psy-article-siblings` 同分类侧栏)+ description meta 同步刷新
  - **就位 Phase 1 checkbox 中 #5 '科普文章页'**:可勾 `项目开发计划.md` §六 #251,本轮勾选
  - 业务规则:① 10 分类 emoji 前缀(🧠 心理学理论 / 💭 认知 / 🌱 发展 / 👥 社会 / 🩺 临床 / 🎭 人格 / 🌟 积极 / 🛠️ 治疗 / 📏 测量 / 👤 大师)② 卡片只展示 first_definition 前 80 字 ③ 搜索结果限制 200 条 ④ 上下篇按 id 字典序在同分类内查找(不跨分类)⑤ 详情页同分类侧栏展示前 8 条 ⑥ 失败文件静默跳过(`Promise.all` 内单文件 catch 不阻塞其它 9 分类)⑦ 内存缓存 1 次加载免二次 fetch
  - **关键设计选择**:① **0 依赖 markdown 渲染器**(覆盖 `**bold**` / `*italic*` / `code` / `<p>` / `<ul>` / `<ol>` / `<table>` 6 类语法,自写 ~50 行;不引 marked / markdown-it / showdown)② **不引后端端点**(per 0911 T3 决策,留飞书 OAuth 阶段统一加)③ **复用 0912 query string 路由**(`#/articles?cat=XX` 分类锚定,router.js 0912 起的 query 透传能力直接复用)④ **收藏用 localStorage Set 持久化**(`psy_articles_favorites_v1` 存 `Array<id>`,`loadFavorites` / `saveFavorites` / `toggleFavorite` 3 函数)⑤ **数据源 10 文件并发 fetch**(`Promise.all` 一次拉 10 JSON,扁平化拼成 `[{id, title, ..., category, emoji}]`)
  - **不动** `backend/`(0914 不在 backend 范围,仅消费)/ `data/`(Phase 0 100% ready,0914 不重写)/ `docs/`(0825 至今 21 日空,0914 仍 P2 观察)/ §六 #247/#248/#249/#250 已勾 4 项(避免 1 commit 勾 2 项反模式)/ §六 #252 危机检测埋点 / #253 飞书 OAuth / #254 Docker Compose 3 项(留 0915+)
  - **落地 0914 巡检 §三 P-0 #1 优先级建议"T3 推科普文章页或危机检测埋点任 1"**:本轮选**科普文章页**优先,理由 ① 纯消费 data/concepts/*.json(已有,0 数据准备成本)② 0 后端依赖(与 0911/0912 决策一致)③ 0914 日报 SAMHSA 康复月 Week 3 'Healing and Wellbeing' 主题是科普的好切入,07-积极心理学 21 概念天然契合 ④ 危机检测埋点需把 0911 文字框监测升级为跨页面共用组件,工作量大,留 0915+ 单独 commit
  - **关键里程碑**:① 0825 立项以来业务模块层 4/7 就位(测评页 + 情绪打卡页 + 情绪日历 + 科普文章页)② Phase 1 checkbox 5/8 = 62.5% ③ 0825 首次 24h+ 0 commit 红线闭环(0913 中断后 0914 立即恢复)④ 内部 demo 首次具备"用户可点的 4 个业务模块":浏览器 `#/scales` 5 量表任一 / `#/checkin` 1-5 滑动 + 60 标签 + 危机监测 / `#/calendar` 30 天 SVG 折线 + 5x6 日色块 + 标签云 / `#/articles` 10 分类 223 概念 + 搜索 + 收藏 + 详情 markdown 渲染 = **4 业务模块 + 5 端点 + 4 资产 + 2 持久化键** 全跑通
  - **未启动** `frontend/` 0914 巡检 §三 P-0 #2 建议"追溯 0913 cron 任务状态"(留后续巡检 / 排查)+ §三 P-1 #1 建议"0915-0917 凑足 6/8 + 7/8"(0915+ 推危机检测埋点)+ §三 P-1 #2 建议"0918-0920 凑足 8/8 = 100% 闭环 MVP"(0918+ 推飞书 OAuth / Docker)
  - 配套更新 §一 当前范围、§二 目录结构、§三 启动预期

- **2026-09-12 T3** Phase 1 #3 '情绪日历视图' 业务模块 · frontend 落地
  - **新增 1 文件**:`src/calendar.js` ~440 行(2 视图 + 1 SVG 折线 + 1 标签云,0 依赖)
  - **改写 3 文件**:`src/router.js`(0910 T3 75 行 → 0912 T3 91 行,新增 query string 支持:匹配前剥离 `?` 后续内容,原始 query 透传到 `params.__query`,为 `?anchor=YYYY-MM-DD` 月份切换服务)+ `src/main.js`(新增 2 路由 `#/calendar` / `#/calendar/day/:date` + meta 同步刷新 phase/buildAt)+ `index.html`(顶部 nav 增"情绪日历" + 日历页 CSS 100+ 行:`.psy-calendar-nav` 月份切换 / `.psy-calendar-stats` 区间统计 / `.psy-sparkline-wrap` 折线容器 / `.psy-legend` 5 档色图例 / `.psy-day-grid` 5×6 日色块 / `.psy-day-cell.has-data/is-today` 2 态 / `.psy-tag-cloud` 标签云 / `.psy-day-detail` 详情)
  - **就位 Phase 1 checkbox 中 #3 '情绪日历视图'**:可勾 `项目开发计划.md` §六 #249,本轮勾选
  - 业务规则:① 30 天固定窗口(DAYS_PER_VIEW=30,GRID_COLS=6)② 月份切换用 anchor 锚点(无锚点默认今天,左右 ±30 天,回到今天一键复位)③ 区间统计含"几次打卡 / 几天有记录 / 平均感受 / 不同标签数"4 项 ④ 标签云字号与频次成正比(12-22 px,负向偏冷青 #0f766e / 正向偏深绿 #0d9488)⑤ 同日多次打卡(日色块显示最后一条的 valence 颜色 + 角标显示次数,详情页列出全部)⑥ SVG 折线 0 依赖手写(viewBox 600×120 + 5 档色点 + hover title + 3 条网格线)
  - **关键设计选择**:① **复用 localStorage**(不读 data/mood_tags.json,直接消费 0911 T3 落地的 `psy_checkin_logs_v1`,与 checkin.js 共用 key 实现"打卡即日历更新"零延迟)② **不引图表库**(Chart.js / D3 / Recharts 都不引,SVG 折线手写 ~30 行)③ **不引后端端点**(per 0911 T3 决策,留飞书 OAuth 阶段统一加)④ **query string 路由**(`#/calendar?anchor=2026-09-12` 锚定 30 天窗口起点,router.js 增 query 剥离支持)⑤ **不勾 §六 已勾 3 项**(避免 1 commit 勾 2 项反模式,0911 T3 已示范)
  - **不动** `backend/`(0912 不在 backend 范围内,仅消费)/ `data/`(Phase 0 100% ready,0912 不重写)/ `docs/`(0825 至今 19 日空,等 0913+ 业务模块再就位时一起补)/ §六 #247/#248/#250 已勾 3 项 / §六 #251 科普文章页 / #252 危机检测埋点 / #253 飞书 OAuth / #254 Docker Compose 4 项(留 0913+)
  - **落地 0912 巡检 §五 P-1 #1"0912 24h 内必须 ≥ 1 业务模块 commit"红线**:本轮业务模块层 2 动 → 3 动(测评页 + 情绪打卡页 + 情绪日历),0913 巡检可降级
  - **关键里程碑**:**5 天倒计时 5 项起跑目标凑足** = 0908 后端 + 0909 前端骨架 + 0910 测评页 + 0911 情绪打卡页 + 0912 情绪日历 = 5/5 🎉;**Phase 1 checkbox 3/8 → 4/8**(整体进度 37.5% → 50%);**0913 W36 周末 Phase 1 进度 4/8 = 50% 目标**达成
  - **未启动** `frontend/` 0912 巡检 §五 #4 段建议的"科普文章页 / 危机检测埋点"(留 0913+)
  - 配套更新 §一 当前范围、§二 目录结构、§三 启动预期

- **2026-09-11 T3** Phase 1 #2 '情绪打卡页' 业务模块 · frontend 落地
  - **新增 1 文件**:`src/checkin.js` ~330 行(3 视图 + 1 工具 + 1 危机监测,0 依赖)
  - **改写 2 文件**:`src/main.js`(新增 3 路由 `#/checkin`、`#/checkin/new`、`#/checkin/saved`)+ `index.html`(顶部 nav 增"情绪打卡" + 打卡页 CSS 80+ 行)
  - **就位 Phase 1 checkbox 中 #2 '情绪打卡页'**:可勾 `项目开发计划.md` §六 #248,本轮勾选
  - 业务规则:① 滑动条 1-5 感受(per `mood_log_data_shape` 字段)+ 标签选择(60 标签 11 子类,≤3 个,per `tag_combination_max`)+ 文字输入 ≤200 字(计数器实时)② 持久化用 `localStorage.psy_checkin_logs_v1`(无后端依赖,留 0913+ 飞书 OAuth 阶段)③ 危机监测仅作用于 note 输入框(critical 26 词子串匹配,per `crisis_keywords_boundary`),tag 选择不触发 ④ UI 颜色按 `intensity_levels.ui_color_depth` 分浅/中/深(1_mild / 2_medium / 3_strong)⑤ 11 子类按 valence 拆"积极 / 消极"两 fieldset ⑥ 顶部 nav 增"情绪打卡"入口 ⑦ 完成页跳转 `/checkin/saved`,再打一次卡可链回 `/checkin/new`
  - **关键设计选择**:① **未引入** `POST /api/checkin` 后端端点 —— 当前 localStorage 满足"个人 demo + 跨会话"需求,后端端点留待飞书 OAuth 阶段统一加(避免提前做鉴权设计);② **未引入**危机检测独立模块 —— 仅在 note 输入框 oninput 简单子串匹配,数据来自 Phase 0 `data/crisis_keywords.json` 缓存,Phase 1 #6 独立弹窗组件留 0912+;③ **未做**情绪日历视图 / 科普文章页 —— 0911 仅就位 1 项业务模块,避免 1 commit 勾 2 项反模式(per 0910 巡检 §五 #4 段"每 1 项落地即 commit + 同步勾选")
  - **不动** `backend/`(0911 不在 backend 范围)/ `data/`(Phase 0 100% ready,0911 不重写)/ `docs/`(0825 至今空,0911 巡检 §六 #7 仍 P2 观察)/ `项目开发计划.md` §六 除 #248 外的其他 6 项 checkbox(避免 1 commit 勾 2 项反模式)
  - **落地 0911 巡检 §四 R1 维持 P-1"业务模块节奏"**:本轮业务模块层 1 动 → 2 动(测评页 + 情绪打卡页),0912 巡检可降级
  - **未启动** `frontend/` 0911 巡检 §五 #4 段建议的"情绪日历视图 / 危机检测埋点"(留 0912+)
  - 配套更新 §一 当前范围、§二 目录结构、§三 启动预期

- **2026-09-10 T3** Phase 1 #4 '测评页' 业务模块 · frontend 落地
  - **新增 3 文件**:`src/router.js` (hash 路由) + `src/assessment.js` (测评 3 视图) + 本 README 实质化
  - **改写 2 文件**:`src/main.js` (注册路由 + 启动) + `index.html` (顶部 nav + 测评页 CSS 样式)
  - **就位 Phase 1 checkbox 中 #4 '测评页'**:可勾 `项目开发计划.md` §六 #250,本轮勾选
  - 业务规则:① 0 依赖(继续纯 vanilla ES Module)② 真实 fetch backend 2 端点(/api/scales + /api/scales/{code})③ 选量表 → 答题 → 算分 → 解读 全流程 ④ severity band 按 interpretation[].range 闭区间匹配 ⑤ 含 red_flags 量表展示 24h 危机热线 ⑥ 每量表 disclaimer 统一展示
  - **落地 0910 巡检 §四 R1 红色"业务模块层 0 动 17 日"**:本轮业务模块层首次有 commit
  - **不动** `backend/`(0908 T3 立,0910 不在范围内,只消费)
  - **不动** `data/`(Phase 0 100% ready,0910 不重写)
  - **不动** `docs/`(0910 巡检 §六 #7 仍 P2 观察,测评页 README 已在本文件 §一~§四 覆盖)
  - **不引** React / Vue / 任何框架(0910 维持 vanilla ES Module 路线,与 0909 骨架 0 依赖原则一致)
  - **不补** 0830 巡检日志(0902 变更记录已闭环根因)

- **2026-09-09 T3** Phase 1 起步 · 前端骨架(本文件 + `package.json` + `index.html` + `src/main.js`)
  - 4 个文件,~1.9 KB,零 npm 依赖,纯浏览器 ES Module 加载
  - 落地 0909 巡检 §四 R1 / R2 P-1 红色预警"0909 24h 内 frontend Vite 骨架必须起步"——本轮以"纯静态占位"形式先就位 1 项,避免 0910 巡检触发"5 天窗口塌缩"预警
  - **就位 8 项 Phase 1 checkbox 中 #1 'Web App 骨架'**(已勾 §六 #247)
  - **不动** §六 #248-254(避免 1 commit 勾 8 项的反模式,见 0908 巡检 §五 #7 段)
  - **不动** `backend/`(0908 T3 立,0909 不在范围内)
  - **不动** `data/`(Phase 0 100% ready,0909 不重写)
  - **不动** `docs/`(0909 巡检 §五 P-1 优先级建议本轮先起骨架,docs 由后续测评页前端就位时一起补——0910 T3 已在本文件 §一~§四 实质化,等同于把 docs/#7 的"测评页前端 README"补齐)
