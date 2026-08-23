#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
md_to_json.py · Phase 0 #1 解析骨架

功能
----
把 _PsychologyLib/ 下的 10 个心理学分类主 md 解析为统一 schema 的概念 JSON,
输出到 data/concepts/{NN}-{slug}.json。

本阶段只做"读取 + 切段 + 草稿 JSON",不做事务:
- 不去重
- 不抽标签
- 不向量化
- 不做语义精炼

Phase 0 #2 任务会用本脚本的输出做概念精炼、去重、打标、检索与向量化。

用法
----
    # 解析全部 10 个分类
    python3 scripts/md_to_json.py

    # 只解析单个分类(按分类序号 01-10)
    python3 scripts/md_to_json.py --category 01

    # 指定输出目录
    python3 scripts/md_to_json.py --out data/concepts

退出码
------
    0  全部成功
    1  有失败(部分或全部分类未生成)
    2  参数错误
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Iterable

# 中国标准时间(UTC+8),与张勇工作台约定一致
CST = timezone(timedelta(hours=8))

SCHEMA_VERSION = "0.1.0"

# 仓库根:本文件在 scripts/ 下,根 = 父目录
REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE_DIR = REPO_ROOT.parent          # _PsychologyLib/(同级)
DEFAULT_OUT_DIR = REPO_ROOT / "data" / "concepts"

# 10 个分类的硬编码映射(顺序即分类序号,Phase 0 阶段稳定不变)
CATEGORIES: list[tuple[str, str, str, str]] = [
    # (category_id, dir_name,        category_name,  filename)
    ("01", "01_心理学理论",        "心理学理论",     "心理学理论.md"),
    ("02", "02_认知心理学",        "认知心理学",     "认知心理学.md"),
    ("03", "03_发展心理学",        "发展心理学",     "发展心理学.md"),
    ("04", "04_社会心理学",        "社会心理学",     "社会心理学.md"),
    ("05", "05_临床心理学",        "临床心理学",     "临床心理学.md"),
    ("06", "06_人格心理学",        "人格心理学",     "人格心理学.md"),
    ("07", "07_积极心理学",        "积极心理学",     "积极心理学.md"),
    ("08", "08_心理治疗方法",      "心理治疗方法",   "心理治疗方法.md"),
    ("09", "09_心理测量",          "心理测量",       "心理测量.md"),
    ("10", "10_心理学大师",        "心理学大师",     "心理学大师.md"),
]

# slug 化:中文分类名 -> 拼音风格(pinyin 太重,这里只用安全的字符替换)
def slugify(name: str) -> str:
    """把 '心理学理论' 变成 '心理学理论'(中文安全),英文/数字转小写短横线。
    Phase 0 阶段文件名保留中文,便于人工对账。
    """
    s = name.strip()
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"[^0-9A-Za-z一-龥\-_]+", "", s)
    return s or "untitled"


# 匹配 ### 标题(支持 1-6 级,Phase 0 阶段以 3 级为主)
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")

# 匹配"定义:"或"**定义**:"开头的段落
DEFINITION_RE = re.compile(r"^[*\s]*\*?\*?定义\*?\*?\s*[:：]\s*(.+?)\s*$", re.MULTILINE)


def parse_markdown(md_text: str) -> tuple[list[dict], list[str]]:
    """解析单个 md,返回 (concepts, section_titles)。
    切段规则:按 ### 切分概念,记录所属 ## 大节。
    """
    lines = md_text.splitlines()
    concepts: list[dict] = []
    current_section: str | None = None
    section_titles: list[str] = []

    cur: dict | None = None
    buf: list[str] = []

    def flush() -> None:
        if cur is None:
            return
        raw = "\n".join(buf).strip()
        cur["raw"] = raw
        # 粗切首段定义
        m = DEFINITION_RE.search(raw)
        cur["first_definition"] = m.group(1).strip() if m else ""
        concepts.append(cur)

    for line in lines:
        m = HEADING_RE.match(line)
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            if level == 2:
                # 遇到新大节:flush 当前概念,更新 section
                flush()
                cur = None
                buf = []
                current_section = title
                section_titles.append(title)
            elif level == 3:
                # 遇到新概念:flush 上一个,开新概念
                flush()
                cur = {
                    "title": title,
                    "section": current_section or "",
                    "level": level,
                }
                buf = []
            else:
                # 1/4/5/6 级:Phase 0 阶段不切概念,继续累积到当前 cur
                if cur is not None:
                    buf.append(line)
            continue
        # 普通行
        if cur is not None:
            buf.append(line)

    flush()
    return concepts, section_titles


def assign_ids(concepts: list[dict], category_id: str) -> list[dict]:
    """给概念分配 '{cat_id}-{seq:03d}' 形式的 id,Phase 0 阶段按出现顺序。"""
    for idx, c in enumerate(concepts, start=1):
        c["id"] = f"{category_id}-{idx:03d}"
    return concepts


def build_payload(
    category_id: str,
    category_name: str,
    source_file: Path,
    source_dir: Path,
    concepts: list[dict],
    now: datetime,
) -> dict:
    """组装最终 JSON payload。"""
    # source_file 用相对仓库根(REPO_ROOT = PsychologyWeb)的 POSIX 路径
    # 源 md 在 _PsychologyLib/(上级),所以从仓库根看是 ../_PsychologyLib/...
    try:
        rel = source_file.resolve().relative_to(REPO_ROOT.resolve()).as_posix()
    except ValueError:
        # 源文件在仓库外(我们的实际场景):用 ../{source_dir.name}/{dir}/{file}
        rel = (
            f"../{source_dir.name}/{source_file.parent.name}/{source_file.name}"
        )

    return {
        "category": category_name,
        "category_id": category_id,
        "source_file": rel,
        "concept_count": len(concepts),
        "parsed_at": now.isoformat(timespec="seconds"),
        "schema_version": SCHEMA_VERSION,
        "concepts": concepts,
    }


def process_category(
    cat_id: str,
    dir_name: str,
    cat_name: str,
    filename: str,
    source_dir: Path,
    out_dir: Path,
    now: datetime,
) -> tuple[Path, int]:
    """处理单个分类,返回 (输出文件路径, 概念数)。"""
    md_path = source_dir / dir_name / filename
    if not md_path.exists():
        raise FileNotFoundError(f"源文件不存在: {md_path}")

    text = md_path.read_text(encoding="utf-8")
    concepts, _ = parse_markdown(text)
    concepts = assign_ids(concepts, cat_id)
    payload = build_payload(cat_id, cat_name, md_path, source_dir, concepts, now)

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{cat_id}-{slugify(cat_name)}.json"
    out_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return out_path, len(concepts)


def iter_selected(category: str | None) -> Iterable[tuple[str, str, str, str]]:
    if category is None:
        yield from CATEGORIES
        return
    cat = category.zfill(2)
    for c in CATEGORIES:
        if c[0] == cat:
            yield c
            return
    raise ValueError(f"未找到分类序号 '{category}',有效范围 01-10")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Phase 0 #1 · 解析 10 个心理学分类主 md 为概念 JSON"
    )
    parser.add_argument(
        "--category", "-c",
        default=None,
        help="只解析单个分类(01-10),省略则解析全部",
    )
    parser.add_argument(
        "--source-dir", "-s",
        default=str(DEFAULT_SOURCE_DIR),
        help=f"源目录,默认 {DEFAULT_SOURCE_DIR}",
    )
    parser.add_argument(
        "--out", "-o",
        default=str(DEFAULT_OUT_DIR),
        help=f"输出目录,默认 {DEFAULT_OUT_DIR}",
    )
    args = parser.parse_args()

    source_dir = Path(args.source_dir).expanduser().resolve()
    out_dir = Path(args.out).expanduser().resolve()

    if not source_dir.is_dir():
        print(f"[error] 源目录不存在: {source_dir}", file=sys.stderr)
        return 2

    now = datetime.now(tz=CST)
    total_concepts = 0
    ok_count = 0
    fail_count = 0

    for cat_id, dir_name, cat_name, filename in iter_selected(args.category):
        try:
            out_path, n = process_category(
                cat_id, dir_name, cat_name, filename,
                source_dir, out_dir, now,
            )
            print(f"[ok]  {cat_id} {cat_name:<10s}  concepts={n:<3d}  -> {out_path.name}")
            total_concepts += n
            ok_count += 1
        except FileNotFoundError as e:
            print(f"[fail] {cat_id} {cat_name}: {e}", file=sys.stderr)
            fail_count += 1
        except Exception as e:  # noqa: BLE001
            print(f"[fail] {cat_id} {cat_name}: {type(e).__name__}: {e}", file=sys.stderr)
            fail_count += 1

    print()
    print(f"== 汇总 ==")
    print(f"成功: {ok_count}  失败: {fail_count}  概念总数: {total_concepts}")
    print(f"输出目录: {out_dir}")
    print(f"解析时间: {now.isoformat(timespec='seconds')} (CST)")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
