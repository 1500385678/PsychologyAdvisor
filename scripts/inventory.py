#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
inventory.py · Phase 0 资产清单生成器(0906 T3)

功能
----
扫 data/ 目录,把 5 量表 + 1 量表索引 + 10 概念分类 + 1 概念 schema +
3 顶层资产(mood_tags / crisis_keywords / resources)共 20 个 JSON
的元信息汇成一张清单,输出到 stdout(默认 markdown 表格)或文件。

设计目标
--------
- 简洁:只读顶层 metadata,不解码具体 items
- 一致:沿用 md_to_json.py 的 timezone(CST)/ exit code / [ok] 打印风格
- 可入库:Phase 1 路由 loader 复用本输出(读 _index.json + 4 资产 JSON)
- 可被人类读:默认 markdown 表格,便于 02:30 巡检 / 飞书日报粘贴
- 可被程序消费:--format json 输出结构化数据

数据资产(0906 02:30 盘点)
------------------------
- data/scales/_index.json v0.1.7(5 ready + 0 pending + 3 关联)
- data/scales/{phq9,gad7,pss,isi,psqi}.json 5 量表全 ready
- data/concepts/{01-10}-*.json 10 分类,共 223 概念草稿
- data/concepts/_schema.json 0.1.0 schema 草案
- data/mood_tags.json v0.1.0(60 标签 / 2 效价 11 子类)
- data/crisis_keywords.json v0.1.0(89 词条 / 6 大类 / 4 severity)
- data/resources.json v0.1.0(40 资源 / 7 议题 6 形式 / 6 条 24h 热线)

用法
----
    # 表格输出到 stdout(默认)
    python3 scripts/inventory.py

    # JSON 输出到 stdout
    python3 scripts/inventory.py --format json

    # 表格输出到文件(README 引用 / 飞书日报粘贴)
    python3 scripts/inventory.py -o docs/data_inventory.md

退出码
------
    0  全部 ok
    1  有资产读取失败(部分或全部)
    2  参数错误
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# 中国标准时间(UTC+8),与张勇工作台约定一致
CST = timezone(timedelta(hours=8))

# 仓库根:本文件在 scripts/ 下,根 = 父目录
REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"

# 顶层 3 个独立资产:(kind, file_path, count_dotted, version_dotted, date_dotted)
# count 字段在 stats 子字典下(mood_tags.total_tags / crisis_keywords.total_keywords / resources.total_resources)
TOP_LEVEL: list[tuple[str, str, str, str, str]] = [
    ("mood_tags",       "mood_tags.json",       "stats.total_tags",       "version",    "updated_at"),
    ("crisis_keywords", "crisis_keywords.json", "stats.total_keywords",   "version",    "updated_at"),
    ("resources",       "resources.json",       "stats.total_resources",  "version",    "updated_at"),
]

# scales/ 目录特殊:5 量表 + _index.json(共 6 文件)
SCALES_DIR = DATA_DIR / "scales"

# concepts/ 目录特殊:10 分类 + _schema.json(共 11 文件)
CONCEPTS_DIR = DATA_DIR / "concepts"


def jload(path: Path) -> dict | None:
    """读 JSON,失败返回 None 并打印 [fail] 日志到 stderr。"""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        rel = path.relative_to(REPO_ROOT) if path.is_absolute() else path
        print(f"[fail] 解析 {rel}: {type(e).__name__}: {e}", file=sys.stderr)
        return None


def get(d: dict, dotted: str):
    """支持 'stats.ready' / 'items_count' 等点路径取值。"""
    cur: object = d
    for part in dotted.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def collect() -> list[dict]:
    """扫 3 类资产,返回 list of record(每条含 kind / file / status / 可选 version / count / size)。"""
    records: list[dict] = []

    # 1) 顶层 3 个独立资产 JSON
    for kind, rel, count_field, ver_field, date_field in TOP_LEVEL:
        p = DATA_DIR / rel
        if not p.exists():
            records.append({"kind": kind, "file": rel, "status": "missing"})
            continue
        d = jload(p)
        if d is None:
            records.append({"kind": kind, "file": rel, "status": "parse_error", "size_bytes": p.stat().st_size})
            continue
        records.append({
            "kind": kind,
            "file": rel,
            "version": d.get(ver_field, "-"),
            "updated_at": d.get(date_field, "-"),
            "count": get(d, count_field),
            "size_bytes": p.stat().st_size,
            "status": "ok",
        })

    # 2) scales/ 目录:5 量表 + _index.json
    if SCALES_DIR.is_dir():
        for p in sorted(SCALES_DIR.glob("*.json")):
            rel = f"scales/{p.name}"
            d = jload(p)
            if d is None:
                records.append({"kind": "scale", "file": rel, "status": "parse_error", "size_bytes": p.stat().st_size})
                continue
            if p.name == "_index.json":
                kind = "scales_index"
                # _index.json 用 stats.ready 字段表达就绪量表数
                count = get(d, "stats.ready")
                version = d.get("version", "-")
                date = d.get("updated_at", "-")
            else:
                kind = "scale"
                # 单量表 version 在 metadata.version / count = len(items) / date = metadata.created_at
                meta = d.get("metadata", {}) or {}
                version = meta.get("version", "-")
                count = len(d.get("items", [])) or None
                date = meta.get("created_at", "-")
            records.append({
                "kind": kind,
                "file": rel,
                "code": d.get("code", "-"),
                "version": version,
                "updated_at": date,
                "count": count,
                "size_bytes": p.stat().st_size,
                "status": "ok",
            })
    else:
        records.append({"kind": "scales_dir", "file": "scales/", "status": "missing"})

    # 3) concepts/ 目录:10 分类 + _schema.json
    if CONCEPTS_DIR.is_dir():
        for p in sorted(CONCEPTS_DIR.glob("*.json")):
            rel = f"concepts/{p.name}"
            d = jload(p)
            if d is None:
                records.append({"kind": "concept", "file": rel, "status": "parse_error", "size_bytes": p.stat().st_size})
                continue
            if p.name == "_schema.json":
                records.append({
                    "kind": "concept_schema",
                    "file": rel,
                    "version": d.get("version", "-"),
                    "size_bytes": p.stat().st_size,
                    "status": "ok",
                })
            else:
                records.append({
                    "kind": "concept",
                    "file": rel,
                    "category": d.get("category", "-"),
                    "count": d.get("concept_count", 0),
                    "size_bytes": p.stat().st_size,
                    "status": "ok",
                })
    else:
        records.append({"kind": "concepts_dir", "file": "concepts/", "status": "missing"})

    return records


def render_table(records: list[dict], now: datetime) -> str:
    """渲染成 markdown 表格 + 汇总段。"""
    L: list[str] = []
    L.append("# PsychologyAdvisor · Phase 0 资产清单\n")
    L.append(f"> 导出时间:{now.isoformat(timespec='seconds')} (CST)  ")
    L.append(f"> 仓库根:`{REPO_ROOT.name}` · 数据根:`data/`\n")
    L.append("| Kind | File | Version | Updated | Count | Size |")
    L.append("|------|------|---------|---------|-------|------|")
    for r in records:
        ver = r.get("version", "-") or "-"
        date = r.get("updated_at", "-") or "-"
        # 截断 ISO datetime 到日期
        if isinstance(date, str) and "T" in date:
            date = date.split("T")[0]
        cnt = r.get("count")
        cnt_s = str(cnt) if cnt not in (None, 0) else "-"
        size = r.get("size_bytes")
        size_s = f"{size/1024:.1f}K" if size else "-"
        L.append(f"| {r.get('kind', '')} | `{r.get('file', '')}` | {ver} | {date} | {cnt_s} | {size_s} |")

    ok = [r for r in records if r.get("status") == "ok"]
    L.append("\n## 汇总\n")
    L.append(f"- 资产文件总数(ok):**{len(ok)}**")
    L.append(f"- 资产总大小:**{sum(r.get('size_bytes', 0) for r in ok) / 1024:.1f} KB**")

    def one(kind: str) -> dict | None:
        for r in ok:
            if r.get("kind") == kind:
                return r
        return None

    if (m := one("mood_tags")):
        L.append(f"- 情绪标签(mood_tags):**{m.get('count')} 条**(version {m.get('version')})")
    if (c := one("crisis_keywords")):
        L.append(f"- 危机关键词(crisis_keywords):**{c.get('count')} 词**(version {c.get('version')})")
    if (r := one("resources")):
        L.append(f"- 资源导航(resources):**{r.get('count')} 条**(version {r.get('version')})")
    if (si := one("scales_index")):
        L.append(f"- 量表就绪(scales_index):**{si.get('count')}/5**(version {si.get('version')})")
    concept_total = sum(r.get("count", 0) for r in ok if r.get("kind") == "concept")
    concept_files = sum(1 for r in ok if r.get("kind") == "concept")
    if concept_total:
        L.append(f"- 概念草稿(concepts):**{concept_total} 条** / {concept_files} 个分类文件(精选 50+ 待续)")

    L.append("\n## Phase 0 进度对账\n")
    L.append("- [x] 5/5 量表骨架(0901 闭环,PHQ-9 / GAD-7 / PSS / ISI / PSQI)")
    L.append("- [x] 60 情绪标签字典(0904 T3,v0.1.0)")
    L.append("- [x] 89 危机关键词表(0903 T3,v0.1.0)")
    L.append("- [x] 40 资源导航(0905 T3,v0.1.0)")
    L.append("- [x] 223 概念草稿(0824 T5,精选 50+ 待续)")
    L.append("- [ ] Phase 1 启动(Web 骨架 + 测评页 + 危机埋点 + 飞书 OAuth 等 8 项,0906 deadline)")
    return "\n".join(L) + "\n"


def render_json(records: list[dict], now: datetime) -> str:
    """渲染成 JSON(供 Phase 1 路由 loader 复用)。"""
    return json.dumps({
        "generated_at": now.isoformat(timespec="seconds"),
        "data_dir": "data",
        "repo": REPO_ROOT.name,
        "summary": {
            "total_files": len(records),
            "ok_files": sum(1 for r in records if r.get("status") == "ok"),
            "total_size_bytes": sum(r.get("size_bytes", 0) for r in records),
        },
        "assets": records,
    }, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Phase 0 资产清单生成器(0906 T3)"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["table", "json"],
        default="table",
        help="输出格式,默认 table(markdown)",
    )
    parser.add_argument(
        "--out", "-o",
        default=None,
        help="输出文件路径,省略则写 stdout",
    )
    args = parser.parse_args()

    if not DATA_DIR.is_dir():
        print(f"[error] 数据目录不存在: {DATA_DIR}", file=sys.stderr)
        return 2

    now = datetime.now(tz=CST)
    records = collect()
    fail = sum(1 for r in records if r.get("status") != "ok")
    text = render_json(records, now) if args.format == "json" else render_table(records, now)

    if args.out:
        out_path = Path(args.out).expanduser().resolve()
        # 防止误写到仓库根外:若 out 是相对路径,锚到 REPO_ROOT
        if not out_path.is_absolute():
            out_path = (REPO_ROOT / args.out).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(text, encoding="utf-8")
        print(f"[ok]  写出 {len(records)} 条资产(失败 {fail})→ {out_path}", file=sys.stderr)
    else:
        sys.stdout.write(text)

    print(
        f"== 汇总 ==  ok: {len(records) - fail}  fail: {fail}  total: {len(records)}"
        f"  · CST {now.isoformat(timespec='seconds')}",
        file=sys.stderr,
    )
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
