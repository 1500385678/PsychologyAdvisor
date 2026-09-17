# PsychologyAdvisor

> 10-心理-Psychology 行业 Web 项目 · 项目代号 PsychologyAdvisor · 内部代号 10-心理
> Phase 0 资产层 **100% ready** 🎉(0905 T3 闭环)· Phase 1 代码层 0906 内必须启动

---

## 一、现状速览(2026-09-06)

| 维度 | 状态 | 备注 |
|------|------|------|
| **Phase 0 资产层** | 🟢 **100% ready** | 5 量表 + 60 情绪 + 89 危机 + 40 资源 + 223 概念 = 20 JSON / 194.7 KB |
| **Phase 1 代码层** | 🔴 **0/8,0906 deadline** | Web 骨架 + 测评页 + 危机埋点 + 飞书 OAuth 等 8 项仍 0 动 |
| **数据根** | `data/` | 5 量表 + 1 索引 + 10 概念分类 + 1 schema + 3 顶层资产 JSON |
| **脚本工具** | `scripts/` | `md_to_json.py`(0824)+ `inventory.py`(0906,资产清单生成器) |
| **巡检日志** | `.Log/` | 0825~0906 共 11 份(0830 设计性废弃,见变更记录) |
| **架构文档** | `心理顾问开发架构与计划.md` | 详版(§1-§10,0826 入档) |
| **总计划** | `项目开发计划.md` | Phase 0/1/2/3/4 + 变更记录 |

---

## 二、仓库拓扑

```
PsychologyWeb/
├── README.md                          ← 本文件(0906 实质化,从 3 行 stub 升级)
├── 项目开发计划.md                     ← 总计划 + 变更记录(0906 T3 加条目)
├── 心理顾问开发架构与计划.md            ← 详版架构(0826 入档,§1-§10)
├── data/                              ← 全部结构化资产(20 JSON / 194.7 KB)
│   ├── scales/                        ← 5 量表 + _index.json(v0.1.7)
│   │   ├── _index.json                ← 5 ready + 0 pending + 3 关联
│   │   ├── phq9.json (9 题,0826)
│   │   ├── gad7.json (7 题,0828)
│   │   ├── pss.json  (10 题,0829)
│   │   ├── isi.json  (7 题,0831)
│   │   └── psqi.json (19 题,0901)
│   ├── concepts/                      ← 10 分类 + _schema.json(223 草稿)
│   │   ├── _schema.json (0.1.0)
│   │   ├── 01-心理学理论.json  (17)
│   │   ├── 02-认知心理学.json  (22)
│   │   ├── 03-发展心理学.json  (24)
│   │   ├── 04-社会心理学.json  (19)
│   │   ├── 05-临床心理学.json  (20)
│   │   ├── 06-人格心理学.json  (23)
│   │   ├── 07-积极心理学.json  (22)
│   │   ├── 08-心理治疗方法.json (21)
│   │   ├── 09-心理测量.json    (23)
│   │   └── 10-心理学大师.json  (32)
│   ├── mood_tags.json                 ← 60 标签 v0.1.0(0904)
│   ├── crisis_keywords.json           ← 89 词 v0.1.0(0903)
│   └── resources.json                 ← 40 资源 v0.1.0(0905)
├── scripts/                           ← 工具脚本
│   ├── md_to_json.py                  ← 概念解析骨架(0824)
│   └── inventory.py                   ← 资产清单生成器(0906 T3 🆕)
├── docs/                              ← 文档(0825 至今空,Phase 1 内补)
└── .Log/                              ← 巡检日志(0825~0906 共 11 份,0830 缺)
```

---

## 三、一键导出资产清单

```bash
# 表格输出到 stdout(默认)
python3 scripts/inventory.py

# JSON 输出到 stdout
python3 scripts/inventory.py --format json

# 表格输出到文件(可贴飞书日报 / 写 docs/)
python3 scripts/inventory.py -o docs/data_inventory.md
```

最近一次运行(2026-09-06 03:32 CST)输出:
- 资产文件总数(ok):**20** · 资产总大小:**194.7 KB**
- 情绪标签(mood_tags):**60 条**(v0.1.0)
- 危机关键词(crisis_keywords):**89 词**(v0.1.0)
- 资源导航(resources):**40 条**(v0.1.0)
- 量表就绪(scales_index):**5/5**(v0.1.7)
- 概念草稿(concepts):**223 条** / 10 个分类文件(精选 50+ 待续)

---

## 四、数据层 → Phase 1 路由映射

| 数据资产 | Phase 1 消费者 | 路由占位 |
|----------|----------------|----------|
| `data/scales/_index.json` | 测评页选量表下拉 | `/test` |
| `data/scales/{phq9,gad7,pss,isi,psqi}.json` | 答题 → 分数 → 解读 | `/test/{code}` |
| `data/mood_tags.json` | 情绪打卡页标签选择器(2 效价 × 11 子类 × 3 强度) | `/mood` |
| `data/crisis_keywords.json` | 危机检测埋点(6 类 × 4 severity × 5 热线) | `/crisis`(服务端守门) |
| `data/resources.json` | 资源卡推荐(7 议题 × 6 形式) | `/resource` |
| `data/concepts/*.json` | 科普文章页卡片化(10 分类) | `/learn` |
| `data/concepts/_schema.json` | 概念元信息标准 | (Phase 1 元数据) |

**Phase 1 8 项 0 动清单**(0906 内必须启动):Web App 骨架 / 情绪打卡页 / 情绪日历视图 / 测评页 / 科普文章页 / 危机检测埋点 / 飞书 OAuth / Docker Compose。

---

## 五、哲学

> **温和、稳定、不评判。** 工具帮不上忙时,把人推向专业资源——这是底线。

非诊断定位 + 严格合规(无资质诊断可能违规)+ 危机安全网(关键词高敏 + 直接推热线)+ 端到端加密(用户日记)+ 不做广告变现。

---

## 六、一键启动(Docker Compose · 0918 T3 新增)

> Phase 1 #8 · Docker Compose 一键启动 · 跨 backend + frontend + 服务依赖三层桥梁

### 0. 前置条件

- Docker Desktop 或 Docker Engine(>= 24.x)
- 复制环境变量模板并生成强 secret:

```bash
cp .env.example .env
python3 -c "import secrets;print(secrets.token_urlsafe(32))"   # 把输出粘贴到 .env 的 PSY_JWT_SECRET=
```

### 1. 一键启动

```bash
# 在仓库根 /Users/aaron/Mac/Consultant/10-心理-Psychology/_PsychologyLib/PsychologyWeb/
docker compose up -d --build
# 等待 ~30s(backend 健康检查 + frontend nginx 就绪)
docker compose ps                                       # 应见 backend=healthy / frontend=healthy
docker compose logs -f                                  # 实时日志
```

启动后:

- 浏览器打开 **http://127.0.0.1:8080** ← frontend nginx(默认端口)
- 页面入口:测评(`/scales`)/ 情绪打卡(`/checkin`)/ 情绪日历(`/calendar`)/ 科普(`/articles`)/ 登录(`/login`)
- 后端 API 由 frontend nginx 反代,前端不需感知 backend 端口
- Swagger UI:**http://127.0.0.1:8080/docs**
- 健康检查:**http://127.0.0.1:8080/health**

### 2. 常用运维

```bash
docker compose ps                    # 服务状态
docker compose logs -f backend       # 后端日志
docker compose logs -f frontend      # 前端 nginx 日志
docker compose restart backend       # 重启后端(代码改完镜像重建后可做)
docker compose exec backend sh       # 进后端容器调试
docker compose down                  # 停止(保留 volume psy-diary-store)
docker compose down -v               # 停止并删除 volume(慎用,会丢日记密文)
```

### 3. 架构

```
host:8080
    ↓
┌─────────────────────────────┐
│ frontend (nginx:1.27-alpine)│  ← 静态文件 + 反代 /api/* /auth/* /docs /health
│ 容器内 8080                  │
└─────────────────────────────┘
    │ psy-net bridge
    ↓ proxy_pass http://backend:8000
┌─────────────────────────────┐
│ backend (python:3.11-slim)  │  ← FastAPI + uvicorn(11 端点)
│ 容器内 8000,不对外暴露         │
│ 写 volume psy-diary-store     │  ← 日记密文持久化
└─────────────────────────────┘
```

详见 `docker-compose.yml` / `backend/Dockerfile` / `frontend/Dockerfile` / `frontend/nginx.conf`。

### 4. 关键设计选择(5 条)

1. **frontend 不引 Node 构建** —— 纯 ES Module 静态文件,0 依赖,Docker 镜像 = nginx + COPY,构建 < 5s
2. **backend 不引数据库** —— Phase 0 JSON 数据由 docker COPY 进镜像只读;日记密文用命名 volume 持久化
3. **nginx 反代所有后端路径** —— `/api/*` + `/auth/*` + `/openapi.json` + `/docs` + `/health`,前端无需感知 backend 端口
4. **backend 仅暴露 docker 网络,不对外** —— 单机起步,避免 8000 端口被外部直接访问
5. **环境变量注入而非 baked** —— `PSY_JWT_SECRET` 从 `.env` 读入,不写进镜像层

---

## 七、变更记录(本文件)

- **2026-09-06 T3** README 实质化 + 新增 `scripts/inventory.py` 资产清单生成器
  - **新增** `scripts/inventory.py`(~290 行,0906 T3):扫 `data/` 下 20 JSON 汇成清单,支持 `--format table|json` + `-o` 写文件,默认 markdown 表格便于飞书日报粘贴;字段路径已适配:顶层 3 资产用 `stats.total_tags/total_keywords/total_resources`,单量表用 `metadata.version` + `len(items)` + `metadata.created_at`,索引用 `stats.ready`
  - **重写** `README.md`:从 3 行 stub(`# PsychologyAdvisor` + 2 行说明,0825 至今 13 日)→ 完整介绍(§1 现状速览 / §2 仓库拓扑 / §3 一键导出 / §4 数据→路由映射 / §5 哲学 / §6 变更记录)
  - **目的**:① 解决 `docs/` 与 README 同时空的根因(连续 13 日 stub 终结);② Phase 0 资产层 100% ready 后,让数据层成果可被一键导出 + 复用,服务 Phase 1 路由 loader;③ 与 0906 巡检 §不做什么 段"0906 Vite 骨架 commit 时一起写更连贯"对照——本轮不启动 Vite 骨架,但 README 实质化先于骨架完成,巡检时工具已就位
  - **未动**:`项目开发计划.md` 主文件(本轮 T3 任务**仅在 §变更记录 加 1 条**,见该文件);docs/(0825 至今空,P2);frontend/ / backend/ / package.json(0906 P-1 内启动);4 资产 JSON(0903~0905 已 ready,0906 内不重写)
  - 校验:`python3 scripts/inventory.py` 退出 0,20 文件全 ok,汇总指标 = 巡检报告 §一(60/89/40/5/223 全对)
- **2026-08-25 T5** 清理 `README.md` git merge 冲突,取 GitHub 端版本(只剩 3 行 stub `# PsychologyAdvisor` + 2 行说明)

> 详细变更记录见 `项目开发计划.md` 末尾"## 变更记录"段(0824 ~ 0905 共 12 条,0906 T3 条目待加)。

## 附录 · 关联文档

- `项目开发计划.md` — 总计划 + 变更记录(0824 ~ 至今)
- `心理顾问开发架构与计划.md` — 详版架构(0826 入档,§1-§10)
- `backend/README.md` — 后端细节(FastAPI 11 端点 / JWT / E2E 加密)
- `frontend/README.md` — 前端细节(0 依赖 / hash 路由 / 10 文件 / 3290 行)
- `docker-compose.yml` — Docker 一键启动编排(本轮新增)
- `backend/Dockerfile` — 后端镜像构建(本轮新增)
- `frontend/Dockerfile` — 前端 nginx 镜像构建(本轮新增)
- `frontend/nginx.conf` — 反代配置(本轮新增)
- `.env.example` — 环境变量模板(本轮新增)

---

> 自动更新 SOP:巡检 02:30 触发 → 读 `.Log/` 末尾 §五"建议下一步" P0 排序 → 1 段代码 / 1 个 README 章节 / 1 个配置 等微变更 → 更新总计划 checkbox / 变更记录 → git push Gitee + GitHub。
