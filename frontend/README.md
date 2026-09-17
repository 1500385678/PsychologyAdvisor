# PsychologyAdvisor · Frontend

> Phase 1 · 骨架(0909 T3 立) + 测评页(0910 T3 立) + 情绪打卡页(0911 T3 立) + 情绪日历视图(0912 T3 立) + 科普文章页(0914 T3 立) + 危机检测埋点(0915 T3 立) + 飞书 OAuth + 端到端加密(0917 T3 立)
> 行业代号:10-心理-Psychology
> 项目代号:**PsychologyAdvisor**(与 `项目开发计划.md` / GitHub / Gitee 仓库名一致)
> 对应后端:`backend/`(0908 T3 立 FastAPI 5 端点 + 0917 T3 立 OAuth/JWT/日记 6 端点 = 11 端点)

## 一、当前范围

0917 T3 在 0915 危机检测埋点基础上**新增飞书 OAuth + 端到端加密业务模块**(Phase 1 #7),并把 0911 起的纯 localStorage 打卡存储升级为"登录态下加密远端存 + 离线降级 localStorage"。当前范围:

- ✅ 测评页(Phase 1 #4 · 0910 T3 立):选量表 → 答题 → 算分 → 解读(非诊断性)
- ✅ 情绪打卡页(Phase 1 #2 · 0911 T3 立,0915 T3 升级危机监测,0917 T3 升级加密远端存):滑动条(1-5)+ 标签选择(≤3,11 子类 60 标签)+ 文字输入(≤200 字)+ 最近 7 天回顾(localStorage 持久化,登录态下额外加密远端存)+ note 框挂 `attachCrisisMonitor` 4 级严重程度监测(critical 命中自动弹资源窗)
- ✅ 情绪日历视图(Phase 1 #3 · 0912 T3 立):30 天窗口(月度切换 / SVG 折线 / 5×6 日色块 / 标签云 / 区间统计)+ 某日详情(支持一天多次打卡,localStorage 共用 key 与 checkin.js 实时同步)
- ✅ 科普文章页(Phase 1 #5 · 0914 T3 立):10 分类卡片网格 + 全部/收藏双 tab + 标题/定义搜索 + 概念卡片网格 + 收藏按钮 + 详情页 markdown 渲染正文 + 同分类上一篇/下一篇 + 同分类侧栏 8 条 + 24h 热线免责声明(数据源 `../data/concepts/*.json` 10 文件并发 fetch + `localStorage.psy_articles_favorites_v1` Set 持久化收藏 id,内存缓存免二次 fetch)
- ✅ 危机检测埋点(Phase 1 #6 · 0915 T3 立 · 跨模块组件):`attachCrisisMonitor(inputEl, opts)` 通用监测器 + `openCrisisModal(severity, hits)` 资源弹窗;4 级严重程度(critical/high/medium/low,per `data/crisis_keywords.json` severity_levels)+ 否定窗口(6 字符,per matching_rules.negation_words)+ 共病升级(cat_suicidal_ideation + cat_hopelessness high 同时出现 → 整体 critical,per matching_rules.co_occurrence_upgrade)+ 键盘节流(>240 keystrokes/min 静默,per matching_rules.max_keystrokes_per_minute)+ 性能预算(<50ms/扫,per matching_rules.performance_budget_ms)+ debounce 800ms(per matching_rules.debounce_ms)+ 24h snooze(localStorage `psy_crisis_snooze_v1` 同 severity 不再主动弹)+ 资源弹窗内含 hotlines_zh_cn + resources.json 危机匹配项 + 5 类 UI 控件(浮动指示器 / 输入框边框色 / 命中词 chips / 弹窗 / 24h 热线 tel 链接);checkin.js 0915 起调用
- ✅ 飞书 OAuth + 端到端加密(Phase 1 #7 · 0917 T3 立 · 跨 backend + frontend):`auth.js` OAuth 流程 + JWT 状态 + subscribe 广播 + 401 自动登出(memory-only secret + localStorage `psy_jwt_v1` / `psy_user_v1` 持久化)+ `crypto.js` Web Crypto API AES-GCM 256 + PBKDF2-SHA256-200k 派生(明文仅在浏览器内存,服务端永不见)+ `login_view.js` 飞书登录页 + passphrase 输入(modal 模式一键登录,生产替换为真飞书 OAuth 跳转)+ checkin.js 登录态下提交时用 passphrase + AES-GCM 加密 note → POST `/api/diary`(密文 + iv + salt + meta,失败降级 localStorage + remote_status 标注);JWT HS256 零依赖手签(`/auth/me` 校验 + 401 自动登出);真飞书模式:`#/auth/callback?jwt=...&user_id=...` 由后端 302 落地,前端解析 + 持久化
- ✅ 简易 hash 路由(`#/scales`、`#/scales/{code}` 0910 立;`#/checkin`、`#/checkin/new`、`#/checkin/saved` 0911 立;`#/calendar`、`#/calendar/day/{date}` 0912 立;`#/articles`、`#/articles/{id}`、`#/articles?cat=XX` 0914 立;`#/login`、`#/auth/callback` 0917 立;`?anchor=YYYY-MM-DD` query string 0912 立;0 依赖)
- ✅ 与后端 FastAPI 11 端点真实联调(`/api/scales`、`/api/scales/{code}` 0910 T3 起;`/auth/feishu/login`、`/auth/feishu/callback`、`/auth/me`、`/api/diary`、`/api/diary/{id}` 0917 T3 起)
- ✅ 测评结果展示:总分 + severity band(按 interpretation[].range 匹配)+ 推荐建议
- ✅ 危机提示:有 `red_flags` 的量表显示 24h 热线(400-161-9995)
- ✅ 非诊断免责声明(每个量表自带 disclaimer + 科普详情页统一展示 + 危机弹窗统一展示,前端统一展示)
- ✅ 30 天 SVG 折线(0 依赖手写,viewBox 600×120 + 网格 + 5 档色点 + hover title,0912 T3 立)
- ✅ 0 依赖 markdown 渲染器(`**bold**` / `*italic*` / \`code\` / `<p>` / `<ul>` / `<ol>` / `<table>` 6 类语法,0914 T3 立,自写 ~50 行)
- ✅ 0 依赖 JWT HS256 手签(`hmac`+`hashlib`+`base64` stdlib 三件套,无 python-jose / pyjwt 依赖,backend 0917 T3 立)

当前**不包含**(本轮 0917 内未做,留后续 commit):

- React / Vue / 任何框架(继续纯 vanilla ES Module,0917 内不引)
- 图表库(Chart.js / D3 / Recharts,0912 用手写 SVG 折线,0917 无图表)
- markdown 库(marked / markdown-it / showdown,0914 自写 0 依赖渲染器,0917 不引)
- 真飞书 OAuth 跳转(0917 是 mock 模式,生产替换 `backend/main.py` `_exchange_feishu_code` 即可)
- Refresh token(JWT 24h 过期重新走 OAuth,符合日记低频访问场景)
- Docker Compose(Phase 1 #8,✅ 0918 T3 立,见 §三 3.2 + 根 README §六)
- 状态管理(无 Pinia / Redux / Zustand)
- 构建工具(无 Vite / Webpack,纯浏览器 ES Module 加载)
- 打包 / 压缩 / Tree Shaking
- 打卡数据后端全文搜索/趋势聚合(目前只能 GET 单条,列表只返 meta)
- 科普数据后端持久化(当前 localStorage 收藏 + data/concepts 静态 JSON)
- 危机监测后端上报(当前纯前端监测 + 资源弹窗,后端不做危机检测)

## 二、目录结构

```
frontend/
├── README.md         本文件
├── package.json      npm scripts 占位(dev 启 http.server 5173,无依赖)
├── index.html        骨架 + 测评 + 打卡 + 日历 + 科普 + 危机弹窗 + 登录 CSS + 顶部 nav(科普 / 测评 / 情绪打卡 / 情绪日历 / 登录)
└── src/
    ├── main.js       入口(注册路由 + 启动 + 暴露 window.__PSY_FRONTEND__,0915 头部注释增危机检测模块,0917 增 auth/crypto + 启动时 refreshMe)
    ├── router.js     简易 hash 路由(0 依赖,0910 T3 立 · 0912 T3 增 query string 支持)
    ├── assessment.js 测评页业务模块(列表 / 答题 / 结果 3 视图,0910 T3 立 · 导出 API_BASE 供 auth.js 复用)
    ├── checkin.js    情绪打卡页业务模块(首页 / 表单 / 完成,0911 T3 立 · 0915 T3 接入 attachCrisisMonitor · 0917 T3 登录态下加密远端存)
    ├── calendar.js   情绪日历视图业务模块(30 天日历 / 某日详情,0912 T3 立)
    ├── articles.js   科普文章页业务模块(列表 / 详情 / 搜索 / 收藏,0914 T3 立)
    ├── crisis_monitor.js  危机检测埋点业务模块(attachCrisisMonitor + openCrisisModal,0915 T3 立 · 跨模块组件)
    ├── auth.js       飞书 OAuth + JWT 状态(0917 T3 立 · 跨模块组件,getJwt/isLoggedIn/subscribe/loginWithFeishu/completeOAuthFromQuery/logout/authedFetch/refreshMe)
    ├── crypto.js     Web Crypto AES-GCM 256 + PBKDF2(0917 T3 立 · 跨模块组件,encryptString/decryptString/fingerprint)
    └── login_view.js 登录页视图(0917 T3 立,renderLogin:已登录态展示 user_id + 登出 / 未登录态展示飞书登录按钮 + passphrase 输入提示)
```

## 三、本地启动

### 3.1 方式 A:Python http.server(开发热重载)

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

### 3.2 方式 B:Docker Compose(0918 T3 新增 · 推荐)

```bash
# 仓库根 /Users/aaron/Mac/Consultant/10-心理-Psychology/_PsychologyLib/PsychologyWeb/
cp .env.example .env
python3 -c "import secrets;print(secrets.token_urlsafe(32))"   # 粘贴到 .env 的 PSY_JWT_SECRET=
docker compose up -d --build
# 浏览器打开 http://127.0.0.1:8080
# Swagger UI:http://127.0.0.1:8080/docs
```

镜像细节见 `frontend/Dockerfile`(nginx:1.27-alpine + COPY index.html/src/,构建 < 5s)+ `frontend/nginx.conf`(反代 /api/* /auth/* /docs /health 给 backend:8000);顶层编排见 `docker-compose.yml`。

**方式 A vs B 选择**:

- 开发热重载代码 / 改 CSS:用方式 A(`uvicorn --reload` + `python3 -m http.server`)
- 单机起步演示 / 给非开发者看:用方式 B(`docker compose up -d --build`)
- 生产部署(Phase 2+):沿用方式 B,只需换 .env 的 PSY_JWT_SECRET

启动后预期:

- 页面标题:**心理顾问 · Web App**
- 顶部 nav:科普入口(`#/articles`)+ 情绪打卡入口(`#/checkin`)+ 情绪日历入口(`#/calendar`)+ 测评入口(`#/scales`)
- 测评列表:5 张卡片(PHQ-9 / GAD-7 / PSS / ISI / PSQI),含分类 tag + 题数 + 用时
- 答题页:逐题 + 0/1/2/3 单选(每题必答),提交后跳转结果页
- 结果页:总分 + severity band(色块边)+ 推荐建议 + 危机提示(若有)+ 逐题得分详情 + 非诊断免责
- 打卡首页:最近 7 天摘要(日期 + 感受 + 标签 chips)+ "+ 立即打卡" 按钮
- 打卡表单:滑动条(1-5)+ 60 标签(分 11 子类 / 积极-消极)+ 文字输入(≤200 字)+ 计数器;note 输入框旁挂**危机检测指示器**(4 级严重程度:critical 红 / high 橙 / medium 琥珀 / low 中性),critical 命中自动弹资源窗(含 hotlines + 推荐资源);中/低严重程度显示输入框边框色 + 浮动小图标(点击图标打开资源窗);非诊断免责声明 + 24h 热线(per crisis_keywords matching_rules + resources.json)
- 打卡完成:跳 `#/checkin/saved` 确认页(localStorage 写入,含 `crisis_signal` 字段 + `crisis_hits` 词条列表,仅记录不入决策)
- 情绪日历:30 天窗口(月度切换按钮 + 30 天 SVG 折线 + 5×6 日色块 + 标签云 + 区间统计);点击日格进入某日详情(`#/calendar/day/YYYY-MM-DD`)
- 某日详情:列出该日所有打卡记录(支持一天多次打卡,每条含时间 + 感受 + 标签 chips + 备注)
- 科普列表:10 分类卡片网格(🧠 心理学理论 / 💭 认知 / 🌱 发展 / 👥 社会 / 🩺 临床 / 🎭 人格 / 🌟 积极 / 🛠️ 治疗 / 📏 测量 / 👤 大师)+ 全部/收藏 双 tab + 标题/定义搜索框 + 概念卡片网格(标题 + 分类 tag + 章节 + first_definition + 收藏按钮)
- 科普详情:点击卡片标题进入(`#/articles/{id}`,如 `#/articles/07-001`),含面包屑 + 标题 + 分类 tag + first_definition + 收藏按钮 + raw 字段 markdown 渲染正文(支持 `**bold**` / `*italic*` / \`code\` / 列表 / 表格 6 类语法)+ 同分类上一篇/下一篇 + 同分类侧栏 8 条 + 24h 热线免责声明
- Console:`[PsychologyAdvisor/frontend] booted {project, industry, phase, buildAt, scope, apiBase}`
- 全局对象:`window.__PSY_FRONTEND__` / `window.__PSY_NAV__` 可在 DevTools 读出
- localStorage keys:`psy_checkin_logs_v1`(打卡数据本地持久化,跨会话保留;checkin.js 写入,calendar.js 只读)+ `psy_articles_favorites_v1`(科普收藏 id 集合 Set,articles.js 读写)+ `psy_crisis_snooze_v1`({severity, until},crisis_monitor.js 写;24h 内同 severity 不再主动弹资源窗,可被用户主动点指示器再次打开)+ `psy_jwt_v1` + `psy_user_v1`(0917 T3 立,auth.js 写;JWT 24h 有效 + user_id/登录时间;登出立即清;刷新页面后由 main.js refreshMe 校验)

## 四、与后端的边界

`backend/`(0908 T3 立 5 端点 + 0917 T3 立 6 端点 = 11 端点)提供 API,**前端消费 8 个**:

- ✅ `GET /api/scales` → 测评列表卡片(消费,0910 T3 起)
- ✅ `GET /api/scales/{code}` → 答题页 + 结果页(消费,0910 T3 起)
- ✅ `GET /auth/feishu/login` → 飞书 OAuth 发起(消费,0917 T3 起,auth.js)
- ✅ `POST /auth/feishu/callback` → code 换 JWT(消费,0917 T3 起,auth.js · mock 模式 fetch)
- ✅ `GET /auth/me` → JWT 校验(消费,0917 T3 起,main.js 启动 + auth.js refreshMe)
- ✅ `POST /api/diary` → 写入加密日记(消费,0917 T3 起,checkin.js 登录态下)
- ✅ `GET /api/diary/{id}` → 取加密日记密文(消费,0917 T3 起,日记详情页待 Phase 2)
- ✅ `GET /api/diary` → 列日记 meta(消费,0917 T3 起,日记列表页待 Phase 2)
- ⏸ `GET /` / `GET /health` / `GET /api/scales/_index/stats` → 当前轮未消费,留后续

API_BASE 默认 `http://127.0.0.1:8000`,可通过 `window.__PSY_API_BASE__` 覆盖。

**CORS**:backend 默认允许跨域(0908 T3 起),若 CORS 报错请先确认 `backend/main.py` 启动时 `--port 8000` 正确。

**鉴权**:0917 T3 起 `Authorization: Bearer <jwt>` 头由 auth.js.authedFetch 自动注入,401 自动登出;密码学层面 AES-GCM 256 + PBKDF2-SHA256-200k,服务端绝不见明文 passphrase;JWT HS256 secret 由 `PSY_JWT_SECRET` 环境变量控制,默认 dev 占位(生产必须改)。

## 五、变更记录

- **2026-09-18 T3** Phase 1 #8 'Docker Compose 一键启动' · 跨 backend + frontend + 服务依赖三层落地
  - **新增 2 文件**:`frontend/Dockerfile`(nginx:1.27-alpine 基础,EXPOSE 8080 + HEALTHCHECK wget /,CMD 用 nginx 默认前台启动)+ `frontend/nginx.conf`(try_files 兜底 hash 路由 / 反代 `/api/*` + `/auth/*` + `/openapi.json` + `/docs` + `/health` 给 backend:8000 / gzip + Cache-Control)
  - **新增 3 仓库根文件**:`docker-compose.yml`(2 service + 1 network + 1 volume,命名 volume `psy-diary-store` 持久化)+ `.env.example`(PSY_JWT_SECRET 模板 + 生成命令注释)+ `.dockerignore`(build 上下文忽略 .git / .Log / __pycache__ / *.md 文档 / diary_store)
  - **更新 1 文件**:`.gitignore` 加 `.env` 不入库
  - **就位 Phase 1 checkbox 中 #8 'Docker Compose 一键启动'**:可勾 `项目开发计划.md` §六 #254,本轮勾选
  - **业务规则**(5 条):① frontend 不引 Node 构建 = nginx + COPY 静态文件,镜像构建 < 5s ② backend 不引数据库 = Phase 0 JSON 由 docker COPY 只读,日记密文用命名 volume 持久化 ③ nginx 反代所有后端路径(`/api/*` + `/auth/*` + `/openapi.json` + `/docs` + `/health`),前端不感知 backend 端口 ④ backend 仅暴露 docker 网络 8000 不对外(单机起步) ⑤ 环境变量从 `.env` 注入,`PSY_JWT_SECRET` 强校验 `:?` 启动时缺则失败
  - **关键设计选择 4 条**:① **nginx 而非 caddy / traefik** —— 主流 LTS,配置直白,0909-0917 起的 0 依赖原则一致 ② **healthcheck 用 wget** —— nginx:alpine 自带,无需额外装 curl ③ **try_files 兜底 index.html** —— hash 路由由前端 router.js 接管,nginx 层只需把不存在的路径兜回 ④ **gzip + Cache-Control** —— 静态资源 1h,index.html 不缓存便于迭代
  - **校验**(macOS 工作流约束"测完即关",**未实际跑 docker compose up --build**,仅就位 Dockerfile + compose + nginx 配置):① nginx.conf proxy_pass URL 拼写(后端无尾斜杠避免路径污染)② nginx.conf try_files 顺序(文件 → 目录 → 兜底 index.html)③ Dockerfile EXPOSE 与 compose ports 对齐(8080:8080)④ backend Dockerfile HEALTHCHECK 探 `/health` 而不是 `/`(避免 root 重定向浪费)
  - **不动** `frontend/index.html` / `frontend/src/`(0918 不在业务代码范围,纯配置层)/ `backend/main.py` / `data/`(Phase 0 100% ready 不重写,build 时 COPY 进 backend 镜像)/ `docs/`(0825 至今 26 日空,0927 前 MVP 验收时一起补)/ §六 #247/#248/#249/#250/#251/#252/#253 已勾 7 项(避免 1 commit 勾 2 项反模式)
  - **关键里程碑**:① 0825 立项以来 Phase 1 代码层 7 动 → 8 动就位 = **8/8 = 100% 🎉** ② Phase 1 checkbox 7/8 → **8/8 (87.5% → 100%) MVP Phase 1 全勾闭环** ③ 单机起步:docker compose up -d --build 即可获得完整可演示 demo ④ 距 MVP ~0928 剩 9 天 buffer(联调 8 项 + 收尾 + docs/ 补 README + 架构图 + W39 周报)
  - 配套更新 §一 当前范围("不包含"段删 Docker Compose 一条,改为 §三 3.2 新方式)、§三 本地启动(分 3.1 直接 Python + 3.2 Docker Compose 双方式 + A/B 选择建议 3 条)、§五 变更记录(本条新增)

- **2026-09-17 T3** Phase 1 #7 '飞书 OAuth 登录 + 端到端加密(用户日记)' · 跨 backend + frontend 双层落地
  - **新增 3 文件**:`src/auth.js` ~200 行(OAuth 流程 + JWT 状态 + subscribe 广播 + 401 自动登出 + authedFetch 自动注入 Bearer · 跨模块组件)+ `src/crypto.js` ~150 行(Web Crypto AES-GCM 256 + PBKDF2-SHA256-200k + fingerprint · 跨模块组件)+ `src/login_view.js` ~115 行(已登录态展示 user_id + 登出 / 未登录态飞书一键登录按钮 + passphrase 输入提示)
  - **改写 3 文件**:`src/main.js`(0915 T3 95 行 → 0917 T3 149 行,头部注释增 auth/crypto + Phase 1 #7 + 启动时 refreshMe + authSubscribe 同步顶部 nav 登录态 + 新增 2 路由 `#/login` / `#/auth/callback`)+ `src/checkin.js`(0915 T3 390 行 → 0917 T3 468 行,头部注释增 OAuth+E2E 段,登录态下表单头部增 passphrase input,提交时 async — 始终写 localStorage,登录态 + 输入 passphrase 时额外用 crypto.encryptString 加密 → POST `/api/diary` 写入,失败降级 localStorage + `log.remote_status` 标注 remote ok / remote skip / remote fail)+ `index.html`(顶部 tag 加入"OAuth+E2E + 0917" + description meta 同步 + 新增 1 nav 入口"登录" + 1 span 登录态指示 + 登录页 CSS 30+ 行:`.psy-login` / `.psy-login code` / `.psy-login input[type=password]` / `.psy-auth-status` + `.psy-auth-status a/small`)
  - **就位 Phase 1 checkbox 中 #7 '飞书 OAuth 登录 + 端到端加密'**:可勾 `项目开发计划.md` §六 #253,本轮勾选
  - **业务规则**(7 条):① JWT 只存 localStorage(`psy_jwt_v1` + `psy_user_v1`),24h 过期,refresh 重走 OAuth ② mock 模式:authorize_url 直接返回本服务回调地址,前端 fetch `/auth/feishu/callback` 拿到 JWT(生产替换 `backend/main.py` `_exchange_feishu_code` 为飞书 `oauth/token` + `authen/v1/user_info` 即可,前端无需改) ③ passphrase 仅活在 DOM(单次加解密),刷新页面后需重新输入才能解密历史日记 ④ AES-GCM 256 + PBKDF2-SHA256-200k,salt 16 字节每次重新生成,iv 12 字节每次重新生成 ⑤ 服务端永不见 plaintext / passphrase / 派生 key,只存 ciphertext + iv + salt + meta ⑥ 用户隔离:服务端 `diary_store/{user_id}.json` 按 JWT.sub 切文件,跨用户不可见 ⑦ 未登录态 / 未输入 passphrase / 远端失败 → 降级 localStorage,不阻塞打卡体验
  - **关键设计选择**(6 条):① **0 依赖 OAuth 客户端** —— 不引 oauth-client / openid-client 等库,自写 fetch + localStorage + subscribe,~200 行覆盖登录态 + 401 自动登出 + 真飞书模式重定向 ② **Web Crypto API 而非 libsodium** —— 浏览器原生 `crypto.subtle.encrypt` / `deriveKey`,0 字节额外依赖,所有主流浏览器(Chrome/Firefox/Safari/Edge)均支持 ③ **passphrase 不存任何地方** —— 不写 localStorage / sessionStorage / IndexedDB,刷新即丢,避免 XSS 后泄漏;生产应引导用户用密码管理器存 ④ **本地始终缓存** —— localStorage 始终写,即使加密远端存成功也保留本地副本,实现"离线缓存 + 远端备份"双轨;Phase 2 可加日历页合并远端列表 ⑤ **JWT HS256 零依赖手签** —— 后端用 stdlib `hmac`+`hashlib`+`base64` 三件套,`requirements.txt` 不增项;前端用 `atob`/`btoa` 解码 base64,不依赖 js-base64 ⑥ **subscribe 模式广播登录态** —— auth.js 暴露 `subscribe(fn)`,main.js 监听刷新顶部 nav,业务视图按需 `isLoggedIn()` 判断;不引事件总线 / MobX / Zustand
  - **不动** `backend/`(0917 同期在 backend/ 立 6 端点,本 README §一/§二/§三/§四/§五 同步;详见 backend/README.md §一/§六)/ `data/`(Phase 0 100% ready,0917 不重写)/ `docs/`(0825 至今 24 日空,0917 仍 P2 观察)/ §六 #247/#248/#249/#250/#251/#252 已勾 6 项(避免 1 commit 勾 2 项反模式)/ §六 #254 Docker Compose(留 0918+ MVP 收尾)
  - **关键里程碑**:① 0825 立项以来业务模块层 5 动 → 6 动(测评页 + 情绪打卡页 + 情绪日历 + 科普文章页 + 危机检测埋点 + OAuth+E2E)② Phase 1 checkbox 6/8 → **7/8(87.5%)** 🎉 0825 立项以来首次破 80% 进度,距 8/8 = 100% 仅剩 1 项(Docker Compose)③ 内部 demo 首次具备"用户登录 + 加密同步"双能力:`uvicorn main:app --port 8000` + `python3 -m http.server 5173` 双进程启动后,浏览器 `#/login` 一键 mock 登录 → `#/checkin/new` 输入 passphrase + note → 提交 → 后端 `backend/data/diary_store/{user_id}.json` 写入 ciphertext + iv + salt(plaintext 永不落地) = **6 业务模块 + 11 端点 + 4 资产 + 4 持久化键 + 2 跨模块组件 + 1 加密体系** 全跑通 ④ 距 MVP ~0928 剩 11 天,剩余 1 项 checkbox(Docker Compose)11 天内必落地 = 1 项/11 日,节奏极宽松
  - **未启动** §六 #254 Docker Compose 一键启动(留 0918+,MVP 收尾)/ §六 #5 真实飞书 OAuth(留 Phase 2)/ `docs/` 24 日空(留 0918+ 业务模块再就位时一起补)/ 日记列表/详情前端 UI(后端 API 已就位,前端列表/详情页留 Phase 2)
  - 配套更新 §一 当前范围(新增"飞书 OAuth + 端到端加密"段 + 调整"不包含"段删 OAuth / 鉴权 / 打卡后端持久化 3 条)、§二 目录结构(新增 `auth.js` / `crypto.js` / `login_view.js` 3 行 + main.js / checkin.js / index.html 行更新)、§三 启动预期(localStorage keys 增 `psy_jwt_v1` + `psy_user_v1` 2 行)、§四 与后端的边界(消费 5 端点 → 消费 8 端点 + 新增鉴权段)

- **2026-09-15 T3** Phase 1 #6 '危机检测埋点' 业务模块 · frontend 落地
  - **新增 1 文件**:`src/crisis_monitor.js` ~440 行(`attachCrisisMonitor` 通用监测器 + `openCrisisModal` 资源弹窗 + 1 flattenTerms + 1 scanText + 1 isNegated + 1 loadSnooze/saveSnooze + 1 buildModalHtml,0 依赖,跨模块组件)
  - **改写 3 文件**:`src/checkin.js`(0911 T3 ~412 行 → 0915 T3 ~390 行;note 输入框由 inline warn-box 升级为 `attachCrisisMonitor`,多级严重程度 + 资源弹窗;旧 `extractCriticalTerms` / `matchCrisis` / `renderCrisisAlert` 删除,`loadCrisisKeywords` 改为 no-op 占位;提交时新增 `crisis_hits` 词条列表字段)+ `src/main.js`(0914 T3 77 行 → 0915 T3 95 行,头部注释增 crisis_monitor 路由注释段 + meta 同步刷新 phase/buildAt 加入"危机检测埋点(0915)" + scope 加入"危机检测埋点(Phase 1 #6 · 跨模块组件)")+ `index.html`(顶部 tag 加入"危机检测 + 0915"+ description meta 同步刷新 + 新增 crisis 弹窗 CSS 110+ 行:`.psy-cm-indicator` 浮动指示器 / `.psy-cm-dot` 红点 / `.psy-cm-dot-text` 命中数 / `.psy-cm-input-warn` 输入框警示态 / `.psy-cm-modal-mask` 全屏 mask / `.psy-cm-modal` 弹窗主体 / `.psy-cm-modal-head` 头部 / `.psy-cm-close` 关闭按钮 / `.psy-cm-modal-body` 内容 / `.psy-cm-opening` 开场白 / `.psy-cm-hits` 命中词 chips / `.psy-cm-hit` / `.psy-cm-hotlines` / `.psy-cm-hotline` / `.psy-cm-phone` / `.psy-cm-meta` / `.psy-cm-note` / `.psy-cm-resources` / `.psy-cm-resource` / `.psy-cm-link` / `.psy-cm-disclaimer` 免责声明 / `.psy-cm-modal-foot` 底部按钮组 / `.psy-cm-btn` / `.psy-cm-btn-secondary` / `.psy-cm-btn-primary`)
  - **就位 Phase 1 checkbox 中 #6 '危机检测埋点'**:可勾 `项目开发计划.md` §六 #252,本轮勾选
  - 业务规则:① **多级严重程度**:critical/high/medium/low(per `severity_levels`,颜色 critical=#b91c1c / high=#c2410c / medium=#a16207 / low=#4b5563)② **否定窗口**:hit 词前 6 字符内出现"不是/不会/别/没有/不"任一 → 视为否定不计入(per `matching_rules.negation_window_chars` + `negation_words`)③ **共病升级**:同输入同时含 cat_suicidal_ideation 任一词 + cat_hopelessness 任一 high 词 → 整体升级 critical(per `matching_rules.co_occurrence_upgrade`)④ **键盘节流**:>240 keystrokes/min 静默监测(per `matching_rules.max_keystrokes_per_minute`)⑤ **debounce 800ms**(per `matching_rules.debounce_ms`)⑥ **性能预算**:单次扫描 <50ms 警告(per `matching_rules.performance_budget_ms`)⑦ **24h snooze**:`localStorage.psy_crisis_snooze_v1` 记录{severity, until},同 severity 不再主动弹,可被用户点指示器再次打开⑧ **资源弹窗**:内含 hotlines_zh_cn 完整 6 条 24h 热线 + resources.json 危机/抑郁/焦虑/自杀/咨询 匹配项 + 命中词 chips + 4 级文案 + 非诊断免责声明⑨ **checkin.js log 扩展**:提交时同步写入 `crisis_signal`(none/low/medium/high/critical[/ _upgraded]) + `crisis_hits` 词条列表(仅记录不入决策,per `pairing_rules.crisis_keywords_boundary`)
  - **关键设计选择**:① **跨模块组件** —— 不挂路由表,而是 export `attachCrisisMonitor` / `openCrisisModal` 让任意业务视图按需挂(0915 T3 checkin.js 接入;后续可挂 articles.js 搜索框 / 自有表单等)② **0 依赖** —— 弹窗手写 CSS,无第三方 UI 库;资源数据从 Phase 0 `data/crisis_keywords.json` + `data/resources.json` 并发 fetch,内存缓存免二次请求③ **挂载即用** —— `attachCrisisMonitor` 返回 `{detach, getLastResult, openModal}`,视图卸载时主动 `detach()` 避免监听器泄漏;同时不影响危机弹窗的全局可用性(独立 `openCrisisModal` 可手动调用)④ **隐私优先** —— 24h snooze 仅写 localStorage,不上报;所有监测在前端,无后端依赖;`crisis_signal` / `crisis_hits` 仅写入本地 log,不入决策树⑤ **否定 + 升级双保险** —— "不会想死"这种否定语境会被正确识别(0911 简单 substring 会误报);共病升级自动给出更高级别的资源
  - **不动** `backend/`(0915 不在 backend 范围,纯前端模块)/ `data/`(Phase 0 100% ready,0915 不重写)/ `docs/`(0825 至今 22 日空,0915 仍 P2 观察)/ §六 #247/#248/#249/#250/#251 已勾 5 项(避免 1 commit 勾 2 项反模式)/ §六 #253 飞书 OAuth / #254 Docker Compose 2 项(留 0916+)
  - **落地 0914 巡检 §三 P-0 #1 优先级建议"T3 推科普文章页或危机检测埋点任 1"后 0914 巡检 §三 P-1 #1 建议"0915-0917 凑足 6/8 + 7/8"**:本轮选**危机检测埋点**,理由 ① 0914 T3 已先推科普文章页,本轮凑足第 6 项 checkbox ② 危机检测埋点为 checkin.js 的"放大版",主要工作量在监测器 + 资源弹窗(数据已有 Phase 0 crisis_keywords.json + resources.json,0 数据准备成本)③ 0 后端依赖(与 0911/0912/0914 决策一致)④ 落地后 Phase 1 6/8 = 75%
  - **关键里程碑**:① 0825 立项以来业务模块层 5 动 → 6 动(测评页 + 情绪打卡页 + 情绪日历 + 科普文章页 + 危机检测埋点)② Phase 1 checkbox 5/8 → 6/8(整体进度 62.5% → 75%)③ 内部 demo 首次具备"用户可点的 5 个业务模块 + 1 个跨模块组件":浏览器 `#/scales` 5 量表任一 / `#/checkin` 1-5 滑动 + 60 标签 + 危机监测(4 级严重程度 + 资源弹窗 + 24h snooze)/ `#/calendar` 30 天 SVG 折线 + 5x6 日色块 + 标签云 / `#/articles` 10 分类 223 概念 + 搜索 + 收藏 + 详情 markdown 渲染 = **5 业务模块 + 5 端点 + 4 资产 + 3 持久化键 + 1 跨模块组件** 全跑通④ 距 MVP ~0928 剩 13 天,剩余 2 项 checkbox(飞书 OAuth / Docker Compose)需落地 + 联调 + 收尾 + W39 周报
  - **未启动** §六 #253 飞书 OAuth 登录 + 端到端加密(留 0916+ 0915 巡检 §三 P-1 #1 建议)/ §六 #254 Docker Compose 一键启动(留 0917+ MVP 收尾)/ `docs/` 22 日空(留 0916+ 业务模块再就位时一起补)
  - 配套更新 §一 当前范围(新增"危机检测埋点" + 删除原"0911 打卡文字框已有 preview")、§二 目录结构(新增 `crisis_monitor.js` 行 + checkin.js 行更新 + index.html 注释更新)、§三 启动预期(打卡表单描述升级 + localStorage keys 增 `psy_crisis_snooze_v1`)

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
