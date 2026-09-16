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

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export PSY_JWT_SECRET="$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')"   # 0917 新增,签 JWT 用
uvicorn main:app --reload --port 8000
```

启动后访问:

- 元信息:`http://127.0.0.1:8000/`
- 健康检查:`http://127.0.0.1:8000/health`
- 量表列表:`http://127.0.0.1:8000/api/scales`
- 单个量表(示例 PHQ-9):`http://127.0.0.1:8000/api/scales/PHQ9`
- 索引统计:`http://127.0.0.1:8000/api/scales/_index/stats`
- **发起登录(mock):`http://127.0.0.1:8000/auth/feishu/login` → 拿到 authorize_url,浏览器跳一下即拿到 JWT**
- **Swagger UI:`http://127.0.0.1:8000/docs`**(0917 起 /auth/* /api/diary 都在文档里)

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
