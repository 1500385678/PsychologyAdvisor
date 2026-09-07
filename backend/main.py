"""
PsychologyAdvisor · 后端入口
============================

Phase 1 · 起步:Phase 1 #2 '测评页'后端层(API 部分,2026-09-08 T3 立)

行业代号:10-心理-Psychology
项目代号:PsychologyAdvisor

端点(当前):
  GET  /                       项目元信息(无依赖)
  GET  /health                 健康检查 + 数据文件可达性
  GET  /api/scales             量表精简列表(从 _index.json 读取,只返 7 字段)
  GET  /api/scales/{code}      单个量表详情(读 data/scales/{code}.json,完整)
  GET  /api/scales/_index/stats 索引统计(total / ready / pending / categories)

不做的:
  - 不启后台 server(本机测完即关,见 macOS 工作流约束)
  - 不接数据库(Phase 0 数据层用 JSON,Phase 1 后段再考虑 SQLite)
  - 不接 LLM(测评题库 / 解读文本均为静态 JSON,Phase 1 后段再考虑 LLM 增强)
  - 不写鉴权(Phase 1 后段接飞书 OAuth)
  - 不写测评"答题 + 评分 + 解读"逻辑(本轮仅就位 5 量表读取 + 元信息)
  - 不写情绪打卡 / 危机检测 / 科普路由(Phase 1 后续 7 项,本轮仅就位 1 项后端层)

启动:
  cd backend
  python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Path as PathParam
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# 路径与常量
# ---------------------------------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
DEFAULT_INDEX_PATH = PROJECT_ROOT / "data" / "scales" / "_index.json"
SCALES_DIR = PROJECT_ROOT / "data" / "scales"

PROJECT_META = {
    "name": "PsychologyAdvisor",
    "name_cn": "心理顾问",
    "industry_code": "10-心理-Psychology",
    "version": "0.1.0",
    "phase": "Phase 1 · 起步(0908 T3,本轮仅就位 5 量表 + 索引 API)",
    "owner": "张勇",
}

# 列表接口精简字段(避免单条量表 items 数组污染列表响应)
SCALE_LIST_FIELDS = (
    "code",
    "name",
    "name_en",
    "category",
    "items_count",
    "score_range",
    "severity_bands",
    "has_crisis_flag",
    "duration_min",
    "status",
    "file",
)

# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------


class ProjectMeta(BaseModel):
    name: str
    name_cn: str
    industry_code: str
    version: str
    phase: str
    owner: str


class HealthResponse(BaseModel):
    status: str
    index_loaded: bool
    index_path: str
    index_version: Optional[str] = None
    index_updated_at: Optional[str] = None


class ScaleSummary(BaseModel):
    code: str
    name: str
    name_en: str
    category: str
    items_count: int
    score_range: str
    severity_bands: int
    has_crisis_flag: bool
    duration_min: int
    status: str
    file: str


class ScaleListResponse(BaseModel):
    total: int
    ready: int
    pending: int
    categories: list[str]
    items: list[ScaleSummary]


class IndexStats(BaseModel):
    version: str
    updated_at: str
    total_scales: int
    ready: int
    pending: int
    categories: list[str]
    related_refs: dict[str, str]


# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------


def load_index(path: Optional[Path] = None) -> dict:
    """读取 data/scales/_index.json,缺失/解析失败抛 HTTPException。"""
    p = path or DEFAULT_INDEX_PATH
    if not p.exists():
        raise HTTPException(
            status_code=503,
            detail=f"_index.json 缺失: {p}",
        )
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"_index.json 解析失败: {e}",
        ) from e


def load_scale(code: str) -> dict:
    """读取 data/scales/{code}.json(单量表完整内容:items / scoring / bands / flag)。

    不读 _index.json 的 file 字段是为了避免在 file 字段错配时掩盖问题——这里直接按 code 拼路径。
    """
    p = SCALES_DIR / f"{code.lower()}.json"
    if not p.exists():
        raise HTTPException(
            status_code=404,
            detail=f"量表 {code} 不存在(期望路径: {p})",
        )
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"{code}.json 解析失败: {e}",
        ) from e


def to_summary(scale: dict) -> ScaleSummary:
    """从 _index.json 的单条 scale 字典挑 7+ 字段(SCALE_LIST_FIELDS)成 ScaleSummary。"""
    return ScaleSummary(**{k: scale[k] for k in SCALE_LIST_FIELDS})


# ---------------------------------------------------------------------------
# 应用
# ---------------------------------------------------------------------------

app = FastAPI(
    title=PROJECT_META["name"],
    description=PROJECT_META["name_cn"] + " · 后端 API",
    version=PROJECT_META["version"],
)


@app.get("/", response_model=ProjectMeta, tags=["meta"])
def root() -> ProjectMeta:
    """项目元信息(无依赖,不读 JSON)。"""
    return ProjectMeta(**PROJECT_META)


@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health() -> HealthResponse:
    """健康检查 + _index.json 可达性 + version / updated_at 摘要。"""
    p = DEFAULT_INDEX_PATH
    if not p.exists():
        return HealthResponse(
            status="degraded",
            index_loaded=False,
            index_path=str(p),
        )
    try:
        idx = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return HealthResponse(
            status="degraded",
            index_loaded=False,
            index_path=str(p),
        )
    return HealthResponse(
        status="ok",
        index_loaded=True,
        index_path=str(p),
        index_version=idx.get("version"),
        index_updated_at=idx.get("updated_at"),
    )


@app.get("/api/scales", response_model=ScaleListResponse, tags=["scales"])
def list_scales() -> ScaleListResponse:
    """量表精简列表(从 _index.json 读取,只返 11 字段,无 items / scoring / bands)。

    用于前端测评页"选量表"列表。完整量表用 /api/scales/{code} 单独取。
    """
    idx = load_index()
    scales = idx.get("scales", [])
    stats = idx.get("stats", {})
    return ScaleListResponse(
        total=stats.get("total_scales", len(scales)),
        ready=stats.get("ready", 0),
        pending=stats.get("pending", 0),
        categories=stats.get("categories", []),
        items=[to_summary(s) for s in scales],
    )


@app.get("/api/scales/_index/stats", response_model=IndexStats, tags=["scales"])
def index_stats() -> IndexStats:
    """_index.json 顶层统计 + related 引用清单。

    用于 /health 之外的"数据层就绪度"展示,与 scripts/inventory.py 输出互补。
    """
    idx = load_index()
    stats = idx.get("stats", {})
    related = idx.get("related", {})
    return IndexStats(
        version=idx.get("version", "unknown"),
        updated_at=idx.get("updated_at", "unknown"),
        total_scales=stats.get("total_scales", 0),
        ready=stats.get("ready", 0),
        pending=stats.get("pending", 0),
        categories=stats.get("categories", []),
        related_refs=related,
    )


@app.get("/api/scales/{code}", tags=["scales"])
def get_scale(
    code: str = PathParam(
        ...,
        description="量表代码(大小写不敏感),例如 PHQ9 / GAD7 / PSS / ISI / PSQI",
        examples=["PHQ9", "GAD7"],
    ),
) -> dict:
    """单个量表完整内容(items / scoring / bands / flag 全量)。

    不限定 status = ready 也能取(便于前端在 pending 状态下预览骨架),但 404 时给清晰报错。
    """
    scale = load_scale(code)
    return scale


# ---------------------------------------------------------------------------
# 入口(本地手测:python main.py → uvicorn reload)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
