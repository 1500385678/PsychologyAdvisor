# PsychologyAdvisor · 系统架构

> 行业:10-心理-Psychology · 项目代号 PsychologyAdvisor
> 文档建立:2026-09-20(0920 T3,补 `docs/` 第 2 文件;`docs/README.md` 0919 T3 已建导航)
> 适用:MVP 验收(~0928)前 reviewer / 新成员理解"项目由哪几层、怎么连、为什么这样连"
> 角色:**架构详解**,不替代根 `README.md`(门面 + 一键启动)、`项目开发计划.md`(进度 + 风险)、`心理顾问开发架构与计划.md`(0826 入档的愿景详版)、`docs/README.md`(导航索引)

---

## 一、TL;DR —— 三层架构图

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       心理顾问 PsychologyAdvisor                            │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │           运维层 (Operations · Phase 1 #8 落地)                      │  │
│  │                                                                      │  │
│  │   host:8080 ──► nginx:1.27-alpine (frontend 容器)                    │  │
│  │                  │  反代 /api/* /auth/* /docs /health                │  │
│  │                  ▼                                                    │  │
│  │               FastAPI + uvicorn (backend 容器,仅 docker 网内)         │  │
│  │                  │  命名 volume psy-diary-store ← 日记密文            │  │
│  │                  │  .env 注入 PSY_JWT_SECRET(不 baked 进镜像)        │  │
│  │                                                                      │  │
│  │   文件:`docker-compose.yml` + `backend/Dockerfile` + `frontend/Dockerfile`  │
│  │        + `frontend/nginx.conf` + `.env.example` + `.dockerignore`    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                  ▲                                          │
│                                  │ HTTPS(JSON)/JWT                           │
│  ┌───────────────────────────────┴──────────────────────────────────────┐  │
│  │           业务层 (Application · Phase 1 #1-#7 落地)                  │  │
│  │                                                                      │  │
│  │   frontend 静态站点(纯 ES Module,0 依赖)                              │  │
│  │     ├─ 测评页(`assessment.js`) 选量表 → 答题 → 分数 → 解读           │  │
│  │     ├─ 情绪打卡页(`checkin.js`) 滑动条 + 标签 + 文字 ≤200           │  │
│  │     ├─ 情绪日历(`calendar.js`) 日色块 + 30 天折线 + 标签云          │  │
│  │     ├─ 科普文章页(`articles.js`) 卡片 + 分类 + 收藏                 │  │
│  │     ├─ 危机检测(`crisis_monitor.js`) 4 级 severity + 资源弹窗       │  │
│  │     └─ 登录(`auth.js` + `crypto.js` + `login_view.js`)              │  │
│  │         OAuth mock + Web Crypto(AES-GCM 256 + PBKDF2-SHA256-200k)  │  │
│  │                                                                      │  │
│  │   backend FastAPI 服务(零新依赖 · stdlib only)                       │  │
│  │     └─ 11 端点:`/health` `/scales` `/scales/{id}` `/checkin`        │  │
│  │        `/articles` `/auth/feishu/login` `/auth/feishu/callback`    │  │
│  │        `/auth/me` `/api/diary` × 3 + JWT HS256 手签                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                  ▲                                          │
│                                  │ JSON 直读(Phase 0 资产 docker COPY)     │
│  ┌───────────────────────────────┴──────────────────────────────────────┐  │
│  │           数据层 (Data · Phase 0 100% 闭环)                          │  │
│  │                                                                      │  │
│  │   `data/scales/*.json`      5 量表(v0.1.7,0826~0901 陆续 ready)     │  │
│  │   `data/concepts/*.json`   223 概念(10 分类 + _schema 0.1.0)       │  │
│  │   `data/mood_tags.json`     60 标签(2 效价 × 11 子类 × 3 强度)     │  │
│  │   `data/crisis_keywords.json` 89 词(6 类 × 4 severity)              │  │
│  │   `data/resources.json`     40 资源(7 议题 × 6 形式)                │  │
│  │                                                                      │  │
│  │   文件:20 个 JSON,0905 闭环后 15+ 日 0 变更(纯数据资产不再触碰)     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

> 图与根 `README.md` §六.3 现有 nginx+backend 二层 ASCII 图的关系:**README §六.3** 展示容器视角(部署层),本图展示职责视角(数据/业务/运维),二者互补而非重复。

---

## 二、为什么是三层

### 2.1 三层职责

| 层 | 职责 | 不做什么 | 关键产物 |
|----|------|----------|----------|
| **数据层** | 提供静态知识资产,被业务层 JSON 直读 | 不知道任何端点 / 用户 / 加密 | 20 JSON 文件 |
| **业务层** | 提供 FastAPI 11 端点 + 前端 10 文件,实现"测/打/读/救"4 闭环 | 不知道容器怎么起 / 端口怎么映射 | backend/ + frontend/src/ |
| **运维层** | 提供 `docker compose up -d` 一键启动,解决"代码能跑但装不上"的最后一公里 | 不写业务逻辑 | docker-compose.yml + Dockerfile × 2 + nginx.conf + .env.example |

### 2.2 三层依赖方向(单向)

```
运维层 ──► 业务层 ──► 数据层
   (启动 / 反代)  (JSON 直读)
```

**禁止反向依赖**:① 数据层不能 import backend 任何模块(否则 JSON 不再是"纯资产"而变成"代码依赖")② 业务层不引 docker / nginx 配置(否则 backend/frontend 无法裸跑)③ 运维层不改业务逻辑(否则 docker 镜像需 rebuild 业务代码)。

### 2.3 为什么不是单体 / 不上数据库

0826 入档的详版 `心理顾问开发架构与计划.md` §四 提的 4 层(表现/API/服务/数据)与"PostgreSQL + Redis + 向量库"是远期目标(Phase 2-4 W10+),**MVP 阶段(0825~0928)** 选择的"三层 + JSON 直读 + 0 数据库"理由:

1. **数据是静态知识资产**(量表/概念/标签/词/资源),上线后几乎不写 —— JSON 直读比 SQLite+ORM 简单 10 倍
2. **日记密文唯一可变数据**走 docker 命名 volume(JSON 单文件 per user),无须建库
3. **零依赖栈**(backend stdlib only,frontend 0 依赖) → 镜像小、构建快、reviewer 一键启动
4. **跨层隔离 = 可换技术栈** —— Phase 2 想换 PostgreSQL,只动数据层,业务层 + 运维层不感知

---

## 三、数据流(用户操作 → 数据落地)

### 3.1 测评闭环(无登录)

```
浏览器 → GET /scales ──► backend ──► data/scales/_index.json
                                      (5 量表元信息)
浏览器 → GET /scales/{id} ──► backend ──► data/scales/{id}.json
                                          (单量表题项 + scoring + interpretation)
浏览器前端算分(assessment.js) ──► 显示"非诊断性"解读 + 资源卡
```

无写操作,纯读。

### 3.2 情绪打卡闭环(无登录 → localStorage)

```
浏览器 → POST /checkin(valence/tags/note) ──► backend ──► 日志/丢弃
                                       (Phase 1 #2 阶段)
浏览器前端 ──► localStorage['psy-checkins'](始终缓存,离线优先)
```

MVP 阶段 `/checkin` 仅记录日志(无数据库),**真正的日记持久化**是 0917 T3 #7 引入的 `/api/diary` 端点(下文 §3.4)。

### 3.3 危机检测闭环(无登录,实时前端)

```
浏览器输入框 → crisis_monitor.js 监听 ──► 子串匹配 data/crisis_keywords.json
                                              │
                            ┌──────────────────┴───────────────┐
                            ▼                                   ▼
                    severity=critical                    severity=high/medium/low
                    fullscreen_modal                     inline_suggestion
                    24h 热线 + 3 个资源                  柔和提示 + 资源卡
                            │
                            ▼
                    localStorage 记 trigger_keywords(脱敏)
                            + 24h snooze(同词不再弹)
```

危机检测**完全在浏览器内**(不调后端),避免把"用户写下"上传到服务端(隐私边界)。

### 3.4 日记闭环(登录 + 端到端加密)

```
浏览器 → GET /auth/feishu/login ──► backend 生成 state
浏览器 → 飞书 OAuth(mock 模式直接回调本服务)
浏览器 → POST /auth/feishu/callback(code, state) ──► backend 签 JWT(HS256)
浏览器 ──► 收到 JWT 存 localStorage('psy-jwt')

浏览器 → #/checkin/new 输入 passphrase + note
浏览器 crypto.js.encryptString(note, passphrase)
   ├─ PBKDF2-SHA256-200k 派生 key(16B salt 每次新生成)
   └─ AES-GCM 256 加密(12B iv 每次新生成)
       → {ciphertext, iv, salt}

浏览器 → POST /api/diary(JWT Bearer + 密文 + meta)
backend ──► require_user 鉴权 ──► backend/data/diary_store/{user_id}.json
                              (写 ciphertext + iv + salt + meta)
                              plaintext 永不落地
```

**关键边界**:服务端永远只见 ciphertext/iv/salt/meta,**passphrase 任何时刻都不离开浏览器**(不写 localStorage、不写 IndexedDB、不上传)。

---

## 四、组件依赖图(代码组织)

```
frontend/                          backend/
├── index.html        ──HTTPS──►   ├── main.py        (FastAPI 11 端点 + JWT + diary)
│                                    ├── requirements.txt (3 行,stdlib only)
├── src/                            └── Dockerfile
│   ├── main.js        (hash router)       ▲
│   │                                    │
│   ├── auth.js        ───────────────► /auth/* (OAuth + JWT)
│   ├── crypto.js      (Web Crypto 本地)
│   ├── login_view.js  ───────────────► /auth/feishu/login
│   │                                    │
│   ├── assessment.js  ───────────────► /scales /scales/{id}
│   ├── checkin.js     ───────────────► /checkin + /api/diary
│   ├── calendar.js    ───────────────► /checkin(列表)
│   ├── articles.js    ───────────────► /articles
│   └── crisis_monitor.js (本地,不调端点)
│                                        ▼
                                   data/*.json (JSON 直读,运行时从镜像内 COPY)
```

**关键设计原则**:

1. **frontend 0 依赖** —— 纯 ES Module,无 npm/webpack/vite,任何浏览器双击 `index.html` 也能跑(只是 hash 路由 + CORS 鉴权需要走 nginx 反代)
2. **backend 0 新依赖** —— `hmac` + `hashlib` + `base64` + `json` + `pathlib` stdlib 三件套手签 JWT 与写日记存储,`requirements.txt` 仅 fastapi/uvicorn/pydantic 三项
3. **数据层 JSON 不入 gitignore** —— 数据是资产不是配置,5 量表 + 223 概念 + 60 标签 + 89 词 + 40 资源全部入库
4. **日记密文入 gitignore** —— `backend/data/diary_store/` 用户隐私不进入版本控制,符合 0825 立项以来"配置 + 数据不入库"惯例
5. **组件命名按"页面/能力"** 而非"层/类" —— 避免引入 React/Vue 才需要的组件树心智负担

---

## 五、关键设计选择(8 条)

| # | 选择 | 理由 |
|---|------|------|
| 1 | **三层而非四层** | 详版 §四 的 4 层(表现/API/服务/数据)是 Phase 2-4 目标,MVP 简化为 3 层降低 review 门槛 |
| 2 | **JSON 直读,不上 SQLite** | 数据是静态知识资产,上线后几乎不写;SQLite 引入 ORM 学习成本 + 镜像膨胀 + 数据迁移复杂度 |
| 3 | **frontend 0 依赖** | 纯 ES Module + 0 npm,镜像 build < 5s,reviewer 双击 index.html 也能跑 |
| 4 | **backend 0 新依赖手签 JWT** | 用 stdlib `hmac`+`hashlib`+`base64` 三件套,`requirements.txt` 不增项;前端 `atob`/`btoa` 不依赖 js-base64 |
| 5 | **Web Crypto 而非 libsodium** | 浏览器原生 `crypto.subtle.encrypt`,0 字节额外依赖;libsodium 需 ~200KB wasm |
| 6 | **危机检测在浏览器内** | 不上传"用户写下"到服务端,符合"心理健康工具不能因为鉴权失败而阻断用户表达"的产品哲学 |
| 7 | **passphrase 不存任何地方** | 不写 localStorage/sessionStorage/IndexedDB,刷新即丢;服务端永不见 plaintext |
| 8 | **nginx 反代所有后端路径** | `/api/*` + `/auth/*` + `/docs` + `/health`,前端无需感知 backend 端口;backend 仅暴露 docker 网内,不对外 |

---

## 六、与根 README §六.3 的差异

| 视角 | 根 README §六.3 | 本文 §一 |
|------|----------------|----------|
| 维度 | 容器视角(部署层) | 职责视角(数据/业务/运维) |
| 节点 | nginx → backend | 三层各节点 |
| 重点 | 端口映射 + 数据卷 | 三层职责 + 依赖方向 |
| 适用 | 部署 reviewer | 架构 reviewer |

两者**互补**:根 README §六.3 答"怎么起",本文 §一 答"为什么这样起"。

---

## 七、关联文档

- 根 `README.md` —— 门面 + 一键启动(Docker Compose §六,0918 T3 写)
- 根 `项目开发计划.md` —— 总进度 + §六 Phase 1 8/8 checkbox + 风险段
- 根 `心理顾问开发架构与计划.md` —— 0826 入档详版(愿景 + 远期 4 层 + Phase 2-4 计划)
- `docs/README.md` —— `docs/` 导航索引(MVP 验收清单 + onboarding 7 步,0919 T3 写)
- `backend/README.md` —— 后端细节(FastAPI 11 端点 + JWT + E2E 加密,127 行)
- `frontend/README.md` —— 前端细节(纯 JS / 0 依赖 / nginx 反代 / 10 文件 / 234 行)

---

## 八、变更记录

- **2026-09-20 T3** 收尾期 #2 · `docs/architecture.md` 建立(基于 0920 巡检 §三 P-2 #1 "0920 T3 可选:补 docs/architecture.md 系统架构图"建议;0919 T3 docs/README.md 是导航索引,本文件是架构详解,与根 README §六.3 容器视角 ASCII 图互补,从数据/业务/运维三层职责视角展开):
  - **§一 TL;DR** 三层架构图 1 张(数据层 5 类 JSON 资产 + 业务层 frontend 7 组件 + backend 11 端点 + 运维层 Docker Compose 编排)
  - **§二 为什么三层** —— 三层职责表 + 依赖方向单向(运维→业务→数据)+ "为什么不是单体/不上数据库"4 条理由
  - **§三 数据流** —— 4 个用户操作闭环(测评 / 打卡 / 危机检测 / 日记加密),每条标"前端→后端→数据层"路径 + 关键边界(如"服务端永不见 plaintext")
  - **§四 组件依赖图** —— frontend 9 文件 + backend 3 文件 + 数据层 20 JSON 树状图 + 5 条命名/边界原则
  - **§五 关键设计选择** —— 8 条表格(3 层 / JSON 直读 / 0 依赖 / 手签 JWT / Web Crypto / 浏览器内危机检测 / passphrase 不存 / nginx 反代)
  - **§六 与 README §六.3 差异** —— 容器视角 vs 职责视角对照表
  - **§七 关联文档** —— 7 个关联文件路径 + 角色一行描述
  - **§八 变更记录** —— 仅 1 条(0920 T3 首次建立)
  - **关键边界**:不动 `backend/main.py` / `frontend/src/*` / `data/*.json`(0920 巡检 §五 "不做什么" 已固化为"纯收尾期不动业务代码")/ 不动根 `README.md`(持续 2 日,§六.3 ASCII 图不重叠,本图从职责视角扩展)/ 不动 `docs/README.md`(0919 T3 已固化)/ 不动 `项目开发计划.md` §六 checkbox(Phase 1 8/8 全勾,无未勾项需 commit 推进)/ 不动 `docker-compose.yml` / Dockerfile / nginx.conf(0918 T3 已固化)/ 不动 `心理顾问开发架构与计划.md` 详版(0826 入档,与本文件互补)
  - **结果**:`docs/` 1 文件 → 2 文件(README.md 导航 + architecture.md 架构,补 0825 立项以来 docs/ 1 文件深度不足);MVP 验收前置条件推进 1 项(0920 巡检 §三 P-2 #1 → P-1 #2 docs/ architecture.md 落地);MVP 验收前可继续补 `docs/deployment.md` 部署指南(0920 巡检 §三 P-1 #2 持续观察);总就位 10/10 → 10/10 持平(架构文档不在 §六 checkbox 8/8 范围内,但补了文档层深度)
  - **下一步**(per 0920 巡检 §三 P-1 #1):0921 T3 推 W39 周报 / 0922~0927 buffer 期(联调 + 续补 docs/deployment.md)