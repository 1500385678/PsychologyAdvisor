# PsychologyAdvisor · Backend

> Phase 1 · 起步:Phase 1 #2 '测评页'后端层(2026-09-08 T3 立)
> 行业代号:10-心理-Psychology
> 项目代号:**PsychologyAdvisor**(与 `项目开发计划.md` / GitHub / Gitee 仓库名一致)

## 一、当前范围

W36 Day 2(0908)仅交付 FastAPI 最小骨架 + 5 量表读取 API,**不包含**:

- 测评"答题 + 评分 + 解读"业务逻辑(本轮仅就位 5 量表 + 索引读取,业务层由 Phase 1 后续 commit 补)
- 情绪打卡 / 日历视图 / 危机检测 / 科普 / 资源路由(Phase 1 后续 7 项)
- 数据库接入(Phase 0 数据层用 JSON,Phase 1 后段再考虑 SQLite)
- LLM(题库 / 解读为静态 JSON,Phase 1 后段再考虑 LLM 增强)
- 鉴权(Phase 1 后段接飞书 OAuth)
- 前端页面骨架(独立 `frontend/` 目录,W36 内 W2-W5 窗口补)

## 二、目录结构

```
backend/
├── README.md            本文件
├── requirements.txt     FastAPI + uvicorn + pydantic
└── main.py              FastAPI app 入口 + 5 个端点
```

## 三、端点清单

| 方法 | 路径 | 说明 | 标签 |
|------|------|------|------|
| GET | `/` | 项目元信息(无依赖) | meta |
| GET | `/health` | 健康检查 + `_index.json` 可达性 + version / updated_at 摘要 | meta |
| GET | `/api/scales` | 量表精简列表(从 `_index.json` 读取,11 字段,无 items) | scales |
| GET | `/api/scales/{code}` | 单个量表完整内容(items / scoring / bands / flag 全量) | scales |
| GET | `/api/scales/_index/stats` | `_index.json` 顶层统计 + `related` 引用清单 | scales |
| GET | `/docs` | FastAPI 自动生成的 Swagger UI(开发态) | docs |
| GET | `/openapi.json` | OpenAPI schema(前端 codegen 用) | docs |

## 四、本地启动

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

启动后访问:

- 元信息:`http://127.0.0.1:8000/`
- 健康检查:`http://127.0.0.1:8000/health`
- 量表列表:`http://127.0.0.1:8000/api/scales`
- 单个量表(示例 PHQ-9):`http://127.0.0.1:8000/api/scales/PHQ9`
- 索引统计:`http://127.0.0.1:8000/api/scales/_index/stats`
- Swagger UI:`http://127.0.0.1:8000/docs`

## 五、变更记录

- **2026-09-08 T3** Phase 1 起步 · 后端骨架(本文件 + `main.py` + `requirements.txt`)
  - 5 端点:`/` `/health` `/api/scales` `/api/scales/{code}` `/api/scales/_index/stats`
  - 数据源:`data/scales/_index.json` v0.1.7 + `data/scales/{phq9,gad7,pss,isi,psqi}.json` 5 量表
  - 配套:Phase 1 #2 '测评页'后端层就位,前端 React 路由待 W36 窗口(0913 前)补
  - 不勾 Phase 1 #2 checkbox 整项(避免 1 项拆分 commit);在 `项目开发计划.md` §变更记录 加本条
  - 不写 `frontend/`(独立 commit)、不写 `docs/`(等测评页前端就位时一起补,见 0908 巡检 §五 P-1)
