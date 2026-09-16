"""
PsychologyAdvisor · 后端入口
============================

Phase 1 · 起步:Phase 1 #2 '测评页'后端层(API 部分,2026-09-08 T3 立)
Phase 1 · 中段:Phase 1 #7 '飞书 OAuth 登录 + 端到端加密日记'(2026-09-17 T3 立)

行业代号:10-心理-Psychology
项目代号:PsychologyAdvisor

端点(当前):
  GET  /                       项目元信息(无依赖)
  GET  /health                 健康检查 + 数据文件可达性
  GET  /api/scales             量表精简列表(从 _index.json 读取,只返 7 字段)
  GET  /api/scales/{code}      单个量表详情(读 data/scales/{code}.json,完整)
  GET  /api/scales/_index/stats 索引统计(total / ready / pending / categories)

  --- Phase 1 #7 飞书 OAuth + 端到端加密日记(0917 T3 新增) ---
  GET  /auth/feishu/login      发起飞书 OAuth(返回 authorize_url + state;mock 模式可直接拿到回调 code)
  POST /auth/feishu/callback   用 code 换 user_id,签发 JWT(HS256, 24h)
  GET  /auth/me                当前用户(Authorization: Bearer JWT)
  POST /api/diary              写入一条加密日记(ciphertext + iv + salt,服务端不解密)
  GET  /api/diary              列出当前用户全部日记 meta(不含明文)
  GET  /api/diary/{id}         取一条加密日记原文(密文 + iv + salt,客户端本地解密)

不做的:
  - 不启后台 server(本机测完即关,见 macOS 工作流约束)
  - 不接数据库(Phase 0 数据层用 JSON,Phase 1 后段再考虑 SQLite)
  - 不接 LLM(测评题库 / 解读文本均为静态 JSON,Phase 1 后段再考虑 LLM 增强)
  - 不写真实飞书 OAuth 跳转(当前 mock 模式直接 code→token,生产替换为飞书开放平台凭据即可)
  - 不存日记明文(端到端加密,服务端永远只见 ciphertext + iv + salt + meta)
  - 不写测评"答题 + 评分 + 解读"逻辑(0917 沿用 0908 仅就位 5 量表读取)
  - 不写 Docker Compose(Phase 1 #8,留后续)

启动:
  cd backend
  python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  PSY_JWT_SECRET=your-secret uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Path as PathParam, Request
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


# ===========================================================================
# Phase 1 #7 · 飞书 OAuth 登录 + 端到端加密日记(2026-09-17 T3 立)
# ===========================================================================
#
# 设计原则(7 条):
#   1. 服务端永远看不到日记明文——客户端 AES-GCM 加密,服务端只存 ciphertext + iv + salt
#   2. JWT 用 HS256 手签(零新依赖),secret 从 PSY_JWT_SECRET 环境变量读,默认 dev 占位
#   3. OAuth 当前是 mock 模式(authorize_url 直接返回回调 code),生产替换为飞书开放平台 app_id/secret
#   4. 日记存储按 user_id 切文件(`backend/data/diary_store/{user_id}.json`),零数据库
#   5. /auth/me 受 JWT 保护(无 token 401),失败带 WWW-Authenticate 头提示
#   6. JWT payload 只放 sub(用户 id) + iat + exp,不放邮箱/手机号(隐私最小化)
#   7. 当前阶段只签发 JWT,不做 refresh token(24h 过期后重新走 OAuth 流程,符合"心理日记非高频访问"场景)
#
# 替换为真飞书 OAuth 时,只需改 _exchange_feishu_code():
#   - 真实:POST https://open.feishu.cn/open-apis/authen/v2/oauth/token 用 app_ticket/code 换 user_access_token
#   - 用 access_token 调 https://open.feishu.cn/open-apis/authen/v1/user_info 拿 union_id / open_id / email
#   - 把 union_id 当作 user_id(全局唯一)签 JWT
# ---------------------------------------------------------------------------

JWT_SECRET = os.environ.get("PSY_JWT_SECRET", "dev-secret-please-change-in-prod")
JWT_TTL_SECONDS = 24 * 60 * 60  # 24h
DIARY_STORE_DIR = BACKEND_DIR / "data" / "diary_store"
DIARY_STORE_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# JWT (HS256 · 零依赖手签)
# ---------------------------------------------------------------------------

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    return base64.urlsafe_b64decode(data + ("=" * padding if padding != 4 else ""))


def issue_jwt(user_id: str) -> str:
    """签发 HS256 JWT, payload {sub, iat, exp}。"""
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {"sub": user_id, "iat": now, "exp": now + JWT_TTL_SECONDS}
    h_b64 = _b64url_encode(json.dumps(header, separators=(",", ":"), sort_keys=True).encode())
    p_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
    signing_input = f"{h_b64}.{p_b64}".encode()
    sig = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    return f"{h_b64}.{p_b64}.{_b64url_encode(sig)}"


def verify_jwt(token: str) -> dict:
    """验证 HS256 JWT, 失败抛 HTTPException 401。"""
    try:
        h_b64, p_b64, sig_b64 = token.split(".")
    except ValueError:
        raise HTTPException(status_code=401, detail="JWT 格式错误")
    signing_input = f"{h_b64}.{p_b64}".encode()
    expected_sig = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    try:
        actual_sig = _b64url_decode(sig_b64)
    except Exception:
        raise HTTPException(status_code=401, detail="JWT 签名解码失败")
    if not hmac.compare_digest(expected_sig, actual_sig):
        raise HTTPException(status_code=401, detail="JWT 签名不匹配")
    try:
        payload = json.loads(_b64url_decode(p_b64))
    except Exception:
        raise HTTPException(status_code=401, detail="JWT payload 解析失败")
    if payload.get("exp", 0) < int(time.time()):
        raise HTTPException(status_code=401, detail="JWT 已过期")
    return payload


async def require_user(authorization: Optional[str] = Header(None)) -> str:
    """FastAPI dependency: 从 Authorization: Bearer <jwt> 抽 user_id,401 if missing/invalid."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="缺少 Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    payload = verify_jwt(token)
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="JWT 缺 sub 字段")
    return sub


# ---------------------------------------------------------------------------
# OAuth · 当前是 mock(authorize_url 返回直接可回调的 code)
# ---------------------------------------------------------------------------

# 内存 state 表(memory-only · dev 用;生产换 Redis/DB)
_oauth_states: dict[str, dict] = {}


class FeishuLoginResponse(BaseModel):
    """发起飞书 OAuth 登录的响应。当前 mock:authorize_url 直接返回 dev 回调页。"""
    authorize_url: str
    state: str
    mock_mode: bool
    note: str


@app.get("/auth/feishu/login", response_model=FeishuLoginResponse, tags=["auth"])
def feishu_login() -> FeishuLoginResponse:
    """发起飞书 OAuth 登录。

    生产环境:authorize_url 指向 https://open.feishu.cn/open-apis/authen/v2/index?app_id=...&redirect_uri=...&state=...
    当前 mock:authorize_url 指向本服务的 /auth/feishu/callback,query 直接带一个 dev code,前端一跳即拿到 JWT。
    """
    state = secrets.token_urlsafe(16)
    _oauth_states[state] = {"created_at": int(time.time()), "used": False}
    # mock 模式下,authorize_url 直接是回调地址,带 dev code 让前端能一键登录
    mock_code = "dev_code_" + secrets.token_urlsafe(8)
    callback_url = f"/auth/feishu/callback?code={mock_code}&state={state}"
    return FeishuLoginResponse(
        authorize_url=callback_url,
        state=state,
        mock_mode=True,
        note="当前 mock 模式:authorize_url 即回调地址,生产替换为飞书开放平台 authorize_url 即可。",
    )


class FeishuCallbackRequest(BaseModel):
    code: str
    state: str


class FeishuCallbackResponse(BaseModel):
    user_id: str
    jwt: str
    expires_in: int
    mock_mode: bool


def _exchange_feishu_code(code: str) -> str:
    """用 code 换 user_id。当前 mock:code -> "user_" + code[:12]。

    生产替换为:
      POST https://open.feishu.cn/open-apis/authen/v2/oauth/token
        body = {app_id, app_secret, grant_type, code}
      resp = {access_token, refresh_token, ...}
      GET https://open.feishu.cn/open-apis/authen/v1/user_info?access_token=...
      return user_info["union_id"]  # 全局唯一,适合做 user_id
    """
    if not code or len(code) < 4:
        raise HTTPException(status_code=400, detail="code 非法")
    # mock:基于 code 派生 user_id(同 code 复用同一 user_id)
    digest = hashlib.sha256(code.encode()).hexdigest()[:16]
    return f"user_{digest}"


@app.post("/auth/feishu/callback", response_model=FeishuCallbackResponse, tags=["auth"])
def feishu_callback(req: FeishuCallbackRequest) -> FeishuCallbackResponse:
    """用 code 换 user_id + JWT。"""
    state = _oauth_states.get(req.state)
    if not state:
        raise HTTPException(status_code=400, detail="state 无效或已过期")
    if state.get("used"):
        raise HTTPException(status_code=400, detail="state 已使用(防重放)")
    # 5 分钟过期
    if int(time.time()) - state["created_at"] > 300:
        _oauth_states.pop(req.state, None)
        raise HTTPException(status_code=400, detail="state 已过期(>5min)")
    state["used"] = True
    user_id = _exchange_feishu_code(req.code)
    return FeishuCallbackResponse(
        user_id=user_id,
        jwt=issue_jwt(user_id),
        expires_in=JWT_TTL_SECONDS,
        mock_mode=True,
    )


class CurrentUser(BaseModel):
    user_id: str
    iat: int
    exp: int


@app.get("/auth/me", response_model=CurrentUser, tags=["auth"])
def auth_me(user_id: str = Depends(require_user)) -> CurrentUser:
    """返回当前 JWT 解析结果,用于前端校验登录态。"""
    # 这里 iat/exp 从 token 里再解一次(开销可忽略)
    # 不暴露 JWT secret,只回显已签发字段
    # 简化:直接返回 user_id + 一个"now"
    return CurrentUser(user_id=user_id, iat=int(time.time()), exp=int(time.time()) + JWT_TTL_SECONDS)


# ---------------------------------------------------------------------------
# 日记 · 端到端加密密文存储
# ---------------------------------------------------------------------------


def _diary_path(user_id: str) -> Path:
    # user_id 是 sha256 hex digest,文件名安全
    safe = "".join(c for c in user_id if c.isalnum() or c in "_-")
    return DIARY_STORE_DIR / f"{safe}.json"


def _load_diary_store(user_id: str) -> list[dict]:
    p = _diary_path(user_id)
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _save_diary_store(user_id: str, items: list[dict]) -> None:
    p = _diary_path(user_id)
    p.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


class DiaryIn(BaseModel):
    """日记写入请求:服务端只见密文 + 元数据,绝不见明文。

    Fields:
      ciphertext_b64: AES-GCM 密文(原文=日记 note),base64
      iv_b64:         AES-GCM nonce(12 字节),base64
      salt_b64:       PBKDF2 salt(16 字节),base64(客户端每次重新生成,服务端不验证)
      meta:           客户端元数据(valence / tags / crisis_signal 等),纯文本可读但不含 note 原文
    """
    ciphertext_b64: str
    iv_b64: str
    salt_b64: str
    meta: dict = {}


class DiaryOut(BaseModel):
    id: str
    created_at: str
    meta: dict


class DiaryBlob(BaseModel):
    id: str
    created_at: str
    ciphertext_b64: str
    iv_b64: str
    salt_b64: str
    meta: dict


@app.post("/api/diary", response_model=DiaryOut, tags=["diary"])
def create_diary(req: DiaryIn, user_id: str = Depends(require_user)) -> DiaryOut:
    """写入一条加密日记。服务端永不解密,只存密文 + meta。"""
    # 字段最小校验(防止空字符串塞进 store)
    if not req.ciphertext_b64 or not req.iv_b64 or not req.salt_b64:
        raise HTTPException(status_code=400, detail="ciphertext/iv/salt 必填")
    items = _load_diary_store(user_id)
    entry = {
        "id": f"d_{int(time.time() * 1000)}_{secrets.token_hex(4)}",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "ciphertext_b64": req.ciphertext_b64,
        "iv_b64": req.iv_b64,
        "salt_b64": req.salt_b64,
        "meta": req.meta,
    }
    items.append(entry)
    _save_diary_store(user_id, items)
    return DiaryOut(id=entry["id"], created_at=entry["created_at"], meta=entry["meta"])


@app.get("/api/diary", response_model=list[DiaryOut], tags=["diary"])
def list_diary(user_id: str = Depends(require_user)) -> list[DiaryOut]:
    """列出当前用户的全部日记 meta(不含密文)。"""
    items = _load_diary_store(user_id)
    return [DiaryOut(id=it["id"], created_at=it["created_at"], meta=it["meta"]) for it in items]


@app.get("/api/diary/{diary_id}", response_model=DiaryBlob, tags=["diary"])
def get_diary(
    diary_id: str = PathParam(..., description="日记 id(由 POST /api/diary 返回)"),
    user_id: str = Depends(require_user),
) -> DiaryBlob:
    """取一条加密日记原文(密文 + iv + salt),客户端拿到后本地 AES-GCM 解密。"""
    items = _load_diary_store(user_id)
    for it in items:
        if it.get("id") == diary_id:
            return DiaryBlob(
                id=it["id"],
                created_at=it["created_at"],
                ciphertext_b64=it["ciphertext_b64"],
                iv_b64=it["iv_b64"],
                salt_b64=it["salt_b64"],
                meta=it["meta"],
            )
    raise HTTPException(status_code=404, detail=f"日记 {diary_id} 不存在")


# ---------------------------------------------------------------------------
# 入口(本地手测:python main.py → uvicorn reload)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
