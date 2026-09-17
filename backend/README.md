# PsychologyAdvisor · Backend

> Phase 1 · 起步:Phase 1 #2 '测评页'后端层(2026-09-08 T3 立)
> Phase 1 · 中段:Phase 1 #7 '飞书 OAuth + 端到端加密日记'(2026-09-17 T3 立)
> 行业代号:10-心理-Psychology
> 项目代号:**PsychologyAdvisor**(与 `项目开发计划.md` / GitHub / Gitee 仓库名一致)

## 一、当前范围

W36 Day 2(0908)交付 FastAPI 最小骨架 + 5 量表读取 API;
W38 Day 3(0917)Phase 1 #7 新增飞书 OAuth + JWT + 端到端加密日记 6 个端点 + JWT HS256 手签(零新依赖)。
**不包含**:

- 测评"答题 + 评分 + 解读"业务逻辑(沿用 0908:仅就位 5 量表读取)
- 情绪打卡 / 日历视图 / 危机检测 / 科普路由后端(纯前端 + localStorage / 静态 JSON,后端无需)
- 数据库接入(用户日记密文按 user_id 切文件 `backend/data/diary_store/{user_id}.json`,零数据库)
- LLM(题库 / 解读为静态 JSON,Phase 1 后段再考虑 LLM 增强)
- 真飞书 OAuth 跳转(当前 mock 模式直接 code→token,生产替换 `_exchange_feishu_code` 即可)
- Docker Compose(Phase 1 #8,留后续)
- Refresh token(24h JWT 过期后重新走 OAuth,符合日记低频访问场景)

## 二、目录结构

```
backend/
├── README.md            本文件
├── requirements.txt     FastAPI + uvicorn + pydantic(0917 未新增依赖)
├── main.py              FastAPI app 入口(0908: 5 端点;0917: +6 端点 = 11 端点)
└── data/
    └── diary_store/     运行时生成(0917 起,gitignore)— 按 user_id 切 JSON 文件存日记密文
```

## 三、端点清单

| 方法 | 路径 | 说明 | 标签 | 引入轮次 |
|------|------|------|------|----------|
| GET | `/` | 项目元信息(无依赖) | meta | 0908 |
| GET | `/health` | 健康检查 + `_index.json` 可达性 + version / updated_at 摘要 | meta | 0908 |
| GET | `/api/scales` | 量表精简列表(从 `_index.json` 读取,11 字段,无 items) | scales | 0908 |
| GET | `/api/scales/{code}` | 单个量表完整内容(items / scoring / bands / flag 全量) | scales | 0908 |
| GET | `/api/scales/_index/stats` | `_index.json` 顶层统计 + `related` 引用清单 | scales | 0908 |
| GET | `/docs` | FastAPI 自动生成的 Swagger UI(开发态) | docs | 0908 |
| GET | `/openapi.json` | OpenAPI schema(前端 codegen 用) | docs | 0908 |
| **GET** | **`/auth/feishu/login`** | **发起飞书 OAuth(返回 authorize_url + state;mock 模式直接拿到回调 code)** | **auth** | **0917** |
| **POST** | **`/auth/feishu/callback`** | **用 code 换 user_id,签发 JWT(HS256, 24h)** | **auth** | **0917** |
| **GET** | **`/auth/me`** | **当前用户(Authorization: Bearer JWT)** | **auth** | **0917** |
| **POST** | **`/api/diary`** | **写入一条加密日记(ciphertext + iv + salt,服务端不解密)** | **diary** | **0917** |
| **GET** | **`/api/diary`** | **列出当前用户全部日记 meta(不含明文)** | **diary** | **0917** |
| **GET** | **`/api/diary/{id}`** | **取一条加密日记原文(密文 + iv + salt,客户端本地解密)** | **diary** | **0917** |

## 四、本地启动

### 4.1 方式 A:直接 Python(开发热重载)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export PSY_JWT_SECRET="$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')"   # 0917 新增,签 JWT 用
uvicorn main:app --reload --port 8000
```

### 4.2 方式 B:Docker Compose(0918 T3 新增 · 跨 backend + frontend)

```bash
# 仓库根 /Users/aaron/Mac/Consultant/10-心理-Psychology/_PsychologyLib/PsychologyWeb/
cp .env.example .env
python3 -c "import secrets;print(secrets.token_urlsafe(32))"   # 粘贴到 .env 的 PSY_JWT_SECRET=
docker compose up -d --build
# 启动后:http://127.0.0.1:8080(前端 nginx,反代 /api/* /auth/* 给 backend:8000)
# Swagger UI:http://127.0.0.1:8080/docs
```

镜像细节见 `backend/Dockerfile`(python:3.11-slim + uvicorn,容器内 8000,日记持久化用命名 volume `psy-diary-store`);顶层编排见 `docker-compose.yml`。

启动后访问(任一方式):

- 元信息:`http://127.0.0.1:8000/`(直接 Python)/ `http://127.0.0.1:8080/`(Docker 经 nginx 反代)
- 健康检查:`http://127.0.0.1:8000/health` / `http://127.0.0.1:8080/health`
- 量表列表:`http://127.0.0.1:8000/api/scales` / `http://127.0.0.1:8080/api/scales`
- 单个量表(示例 PHQ-9):`http://127.0.0.1:8000/api/scales/PHQ9`
- 索引统计:`http://127.0.0.1:8000/api/scales/_index/stats`
- **发起登录(mock):`http://127.0.0.1:8000/auth/feishu/login` → 拿到 authorize_url,浏览器跳一下即拿到 JWT**
- **Swagger UI:`http://127.0.0.1:8000/docs`** / `http://127.0.0.1:8080/docs`(0917 起 /auth/* /api/diary 都在文档里)

## 五、加密与鉴权设计(0917 新增)

| 层 | 方案 | 说明 |
|----|------|------|
| **JWT 签发** | HS256 手签,零依赖 | `hmac`+`hashlib`+`base64` 三件套实现,`PSY_JWT_SECRET` 环境变量读 secret,默认 dev 占位 |
| **JWT payload** | `{sub, iat, exp}` | 只放用户 id + 时间戳,不放邮箱/手机号(隐私最小化) |
| **JWT TTL** | 24h | 无 refresh,过期重新走 OAuth(日记低频访问场景) |
| **OAuth 流程** | 当前 mock,生产 1 处替换 | `_exchange_feishu_code(code)` 内部改为飞书 `oauth/token` + `authen/v1/user_info` 即可 |
| **state 防重放** | 内存 dict + used flag | 5min 过期,mock 模式够用;生产换 Redis |
| **日记加密** | AES-GCM 256(客户端) | 服务端只见 ciphertext + iv + salt,**绝不接触明文** |
| **日记存储** | 文件 per user | `backend/data/diary_store/{user_id}.json`,零数据库 |
| **日记字段** | ciphertext_b64 + iv_b64 + salt_b64 + meta | meta 仅含 valence/tags/crisis_signal(可读),不含 note 原文 |

## 六、变更记录

- **2026-09-18 T3** Phase 1 #8 Docker Compose 一键启动(后端层)
  - **新增** `backend/Dockerfile`:python:3.11-slim 基础镜像,先 COPY requirements 单独 layer 利用 Docker 缓存(变更频率低),再 COPY main.py + 项目根 data/(scales/concepts/crisis_keywords/mood_tags/resources),HEALTHCHECK 探 `/health`,CMD uvicorn 启动并启用 `--proxy-headers`(经 nginx 反代后保留 X-Forwarded-*)
  - **新增** `docker-compose.yml`:2 service + 1 network + 1 volume,backend 容器内 8000 不对外暴露,仅 frontend nginx 反代可达;frontend 暴露 host:8080 → container:8080;依赖 `service_healthy` 等后端就绪后才起前端;命名 volume `psy-diary-store` 持久化用户日记密文
  - **新增** `.env.example`:env 文件模板,PSY_JWT_SECRET 占位 + 生成命令注释;`.env` 已 `.gitignore`(见根 .gitignore)
  - **新增** `.dockerignore`:build 上下文忽略 .git / .Log / __pycache__ / .venv / *.md 文档(README 由 frontend Dockerfile 单独 COPY) / backend/data/diary_store/ 等
  - **更新** `.gitignore`:加 `.env` 不入库(0918 起)
  - **更新** 根 `README.md` §六 新增"Docker Compose 一键启动"章节 + §附录 关联文档 9 项
  - **更新** 本 README §四 分 4.1 直接 Python + 4.2 Docker Compose 双方式
  - **就位 Phase 1 checkbox 中 #8 'Docker Compose 一键启动'**:可勾 `项目开发计划.md` §六 #254,本轮勾选
  - **关键设计选择 5 条**(详见根 README §六 #4):① frontend 0 依赖 = 镜像 = nginx + COPY,构建 < 5s ② backend 不引数据库,Phase 0 JSON 由 docker COPY 只读 ③ nginx 反代 /api/* /auth/* /docs /health,前端无需感知 backend 端口 ④ backend 仅暴露 docker 网络 8000,不对外 ⑤ 环境变量从 .env 注入不 baked 进镜像
  - **校验**(macOS 工作流约束"测完即关",**未实际跑 docker compose up --build**,仅就位 Dockerfile + compose + nginx 配置):① `docker compose config` 语法 / service 引用 / 网络 / volume 解析 ② Dockerfile 多 COPY 路径确认(backend/data 在 build 时 COPY,运行时不挂载覆盖,避免误删仓库数据)③ env `PSY_JWT_SECRET:?...` 强校验,启动时若 .env 缺失该变量直接失败 ④ 日记持久化用命名 volume 而非 bind mount(避免 macOS 权限 / 路径漂移问题)
  - **不动** `backend/main.py`(0918 不在业务范围,纯配置层)/ `data/`(Phase 0 100% ready 不重写,build 时 COPY 进 backend 镜像)/ `docs/`(0825 至今 26 日空,0927 前 MVP 验收时一起补)/ §六 #247/#248/#249/#250/#251/#252/#253 已勾 7 项(避免 1 commit 勾 2 项反模式)
  - **关键里程碑**:① 0825 立项以来 Phase 1 代码层 7 动 → 8 动就位 = **8/8 = 100% 🎉** ② Phase 1 checkbox 7/8 → **8/8 (87.5% → 100%) MVP Phase 1 全勾闭环** ③ 单机起步:docker compose up -d --build 即可获得完整可演示 demo(frontend:8080 → backend:8000 反代 + 日记密文持久化),生产部署只需换 .env 的 PSY_JWT_SECRET 即可 ④ 距 MVP ~0928 剩 9 天 buffer(联调 8 项 + 收尾 + docs/ 补 README + 架构图 + W39 周报)

- **2026-09-17 T3** Phase 1 #7 飞书 OAuth 登录 + 端到端加密日记(后端层):
  - 6 端点:`GET /auth/feishu/login` `POST /auth/feishu/callback` `GET /auth/me` `POST /api/diary` `GET /api/diary` `GET /api/diary/{id}`
  - JWT HS256 手签(`hmac`+`hashlib`+`base64`,零新依赖),`PSY_JWT_SECRET` 环境变量读 secret
  - OAuth mock 模式:authorize_url 直接返回回调地址,前端一键拿到 JWT(生产替换 `_exchange_feishu_code` 即可接真飞书)
  - 日记密文存储:`backend/data/diary_store/{user_id}.json`(gitignore),服务端只见 ciphertext/iv/salt/meta
  - 配套:`项目开发计划.md` §六 #253 翻勾(本轮单项);本 README §一/§二/§三/§四/§五 5 段同步
  - 不写 Docker Compose(Phase 1 #8,留后续)
- **2026-09-08 T3** Phase 1 起步 · 后端骨架(本文件 + `main.py` + `requirements.txt`)
  - 5 端点:`/` `/health` `/api/scales` `/api/scales/{code}` `/api/scales/_index/stats`
  - 数据源:`data/scales/_index.json` v0.1.7 + `data/scales/{phq9,gad7,pss,isi,psqi}.json` 5 量表
  - 配套:Phase 1 #2 '测评页'后端层就位,前端 React 路由待 W36 窗口(0913 前)补
  - 不勾 Phase 1 #2 checkbox 整项(避免 1 项拆分 commit);在 `项目开发计划.md` §变更记录 加本条
  - 不写 `frontend/`(独立 commit)、不写 `docs/`(等测评页前端就位时一起补,见 0908 巡检 §五 P-1)
