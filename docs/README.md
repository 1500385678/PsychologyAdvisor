# PsychologyAdvisor · 项目文档导航

> 行业:10-心理-Psychology · 项目代号 PsychologyAdvisor
> 文档建立:2026-09-19(0825 立项以来首次建立,补 docs/ 26 日空档)
> 适用:MVP 验收(~0928)前内部 reviewer / 新成员快速 onboarding

---

## 一、文档总览

`docs/` 是项目级文档导航,**不替代**仓库根的架构文档与计划文档。本目录只承担"入口 + 索引"角色,避免根目录文档膨胀。

### 1.1 根目录文档(主入口)

| 文件 | 角色 | 行数 |
|------|------|------|
| `README.md` | 项目门面:现状速览 + 仓库拓扑 + Docker Compose 启动 + 架构图 | 208 |
| `项目开发计划.md` | 总计划:Phase 0~4 + 风险 + 变更记录 | — |
| `心理顾问开发架构与计划.md` | 详版架构:§1-§10,0826 入档 | — |

### 1.2 子项目文档

| 文件 | 角色 |
|------|------|
| `backend/README.md` | 后端 FastAPI 服务文档(11 端点 + Docker 部署) |
| `frontend/README.md` | 前端静态站点文档(纯 JS / 0 依赖 / nginx 反代) |
| `frontend/Dockerfile` + `nginx.conf` | 前端镜像构建 + 反代配置 |
| `backend/Dockerfile` | 后端镜像构建 |

### 1.3 数据资产(`data/`)

| 资产 | 文件 | 版本 | 用途 |
|------|------|------|------|
| 5 量表 | `data/scales/*.json` | v0.1.7 | PHQ-9 / GAD-7 / PSS / ISI / PSQI 测评 |
| 223 概念 | `data/concepts/01-10_*.json` | _schema 0.1.0 | 科普文章 + 量表解读 |
| 60 情绪标签 | `data/mood_tags.json` | v0.1.0 | 情绪打卡页标签云 |
| 89 危机词 | `data/crisis_keywords.json` | v0.1.0 | 危机检测埋点 |
| 40 资源 | `data/resources.json` | v0.1.0 | 危机弹窗资源导航 |

---

## 二、MVP 验收清单(~0928)

### 2.1 Phase 1 业务模块(8/8 ✅)

| # | 模块 | 文件 | 状态 |
|---|------|------|------|
| 1 | Web App 骨架 | `frontend/` | ✅ 0909 T3 |
| 2 | 情绪打卡页 | `frontend/src/checkin.js` | ✅ 0911 T3 |
| 3 | 情绪日历 | `frontend/src/calendar.js` | ✅ 0912 T3 |
| 4 | 测评页 | `frontend/src/{router,assessment}.js` | ✅ 0910 T3 |
| 5 | 科普文章页 | `frontend/src/articles.js` | ✅ 0914 T3 |
| 6 | 危机检测埋点 | `frontend/src/crisis_monitor.js` | ✅ 0915 T3 |
| 7 | 飞书 OAuth + 端到端加密 | `backend/main.py` + `frontend/src/{auth,crypto,login_view}.js` | ✅ 0917 T3 |
| 8 | Docker Compose 一键启动 | `docker-compose.yml` + `backend/Dockerfile` + `frontend/Dockerfile` + `frontend/nginx.conf` | ✅ 0918 T3 |

### 2.2 验收时 reviewer 重点关注

1. **隐私合规**:用户日记端到端加密(AES-GCM 256 + PBKDF2-SHA256-200k),服务端永不见明文
2. **危机响应**:4 级 severity + 否定窗口 + 共病升级 + 24h snooze
3. **专业边界**:所有测评结果附"非诊断性"免责语,严重者必推就医
4. **一键启动**:`docker compose up -d` 后 `http://localhost:8080` 可访问,后端 `/health` 返回 200

---

## 三、新成员 onboarding 路径

```
1. 读 README.md(208 行,5 分钟)
2. 读 心理顾问开发架构与计划.md(详版架构,0826 入档,15 分钟)
3. 读 项目开发计划.md §六 Phase 1(8/8 checkbox,5 分钟)
4. 看 .Log/ 末位巡检报告(0919 = 巡检-心理-20260919.md,15 分钟)
5. cd backend && python -m uvicorn backend.main:app --reload(本地起后端)
6. cd frontend && python3 -m http.server 8080(本地起前端)
7. 浏览器打开 http://localhost:8080 体验
```

---

## 四、变更记录

- **2026-09-19** 首次建立 `docs/` 目录(0825 立项以来连续 26 日空档,MVP 验收前补齐):本 README.md 作为导航索引,内容覆盖文档总览 + MVP 验收清单 + onboarding 路径,简洁可入库。