// 心理顾问 · 科普文章页业务模块
// 2026-09-14 T3 立 · Phase 1 #5 "科普文章页"(卡片阅读 + 分类导航 + 收藏)
// 0 依赖 · 纯 ES Module · 数据源: data/concepts/*.json(10 分类,共 223 概念,Phase 0 #1 资产)
//
// 视图:
//   renderArticlesList(root)        科普列表(10 分类卡片 + 概念数 + 搜索 + 收藏 tab)
//   renderArticleDetail(root, id)   概念详情(标题 + 分类 + 章节 + 正文 + 收藏按钮 + 上下篇)
//
// 设计原则:
//   - 只读 data/concepts/*.json,纯消费,不动 data/
//   - 不引后端端点(Phase 0 1/1 已 ready,0914 不在 backend 范围)
//   - 不引 React/Markdown 库(0 依赖);正文 raw 字段含 markdown 表格,用轻量规则渲染
//   - 收藏用 localStorage.psy_articles_favorites_v1(per-key set,跨会话持久)
//   - 搜索:标题 + first_definition 子串匹配(中文 1-gram 太细,直接 includes)
//
// 与其他模块的协作边界:
//   - 仅读:  data/concepts/*.json(10 文件并发 fetch)
//   - 仅写:  localStorage.psy_articles_favorites_v1(Set<id>)
//   - 不引:  backend/main.py(0914 不在 backend 范围)

import { escapeHtml, navigate } from "./router.js";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const CONCEPT_FILES = [
  { id: "01", file: "01-心理学理论.json",      category: "心理学理论",       emoji: "🧠" },
  { id: "02", file: "02-认知心理学.json",      category: "认知心理学",       emoji: "💭" },
  { id: "03", file: "03-发展心理学.json",      category: "发展心理学",       emoji: "🌱" },
  { id: "04", file: "04-社会心理学.json",      category: "社会心理学",       emoji: "👥" },
  { id: "05", file: "05-临床心理学.json",      category: "临床心理学",       emoji: "🩺" },
  { id: "06", file: "06-人格心理学.json",      category: "人格心理学",       emoji: "🎭" },
  { id: "07", file: "07-积极心理学.json",      category: "积极心理学",       emoji: "🌟" },
  { id: "08", file: "08-心理治疗方法.json",    category: "心理治疗方法",     emoji: "🛠️" },
  { id: "09", file: "09-心理测量.json",        category: "心理测量",         emoji: "📏" },
  { id: "10", file: "10-心理学大师.json",      category: "心理学大师",       emoji: "👤" },
];

// 相对 index.html 路径(0911 T3 checkin.js 同样用 ../data/...)
const DATA_BASE = "../data/concepts/";

const FAVORITES_KEY = "psy_articles_favorites_v1";

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

async function fetchJson(path) {
  const r = await fetch(path, { headers: { Accept: "application/json" } });
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} ${r.statusText} on ${path}`);
  }
  return r.json();
}

// 轻量 markdown 渲染(只覆盖 data/concepts/*.json 实际用到的语法)
//   - **bold** / *italic*  →  <strong>/<em>
//   - 段落 (空行分隔)       →  <p>
//   - 表格 (| col | col |\n|---|---|)  →  <table>
//   - 列表 (- / 1.)        →  <ul>/<ol>
//   - 单行 # 标题           →  不出现(data/concepts 是 段落+表格,无 # 标题)
// 不引第三方,保持 0 依赖
function renderMarkdown(md) {
  if (!md) return "";
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 表格检测:当前行含 | 且下一行是分隔行(---)
    if (line.trim().startsWith("|") && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const headerCells = splitTableRow(line);
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        body.push(splitTableRow(lines[i]));
        i++;
      }
      out.push(renderTable(headerCells, body));
      continue;
    }
    // 列表
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ""));
        i++;
      }
      out.push("<ul>" + items.map((it) => "<li>" + inlineMd(it) + "</li>").join("") + "</ul>");
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push("<ol>" + items.map((it) => "<li>" + inlineMd(it) + "</li>").join("") + "</ol>");
      continue;
    }
    // 空行
    if (line.trim() === "") {
      i++;
      continue;
    }
    // 段落(累积到下一个空行/表格/列表)
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("|") &&
      !/^\s*-\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push("<p>" + inlineMd(buf.join(" ")) + "</p>");
  }
  return out.join("\n");
}

function inlineMd(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function renderTable(headerCells, bodyRows) {
  const thead = "<thead><tr>" + headerCells.map((c) => "<th>" + inlineMd(c) + "</th>").join("") + "</tr></thead>";
  const tbody =
    "<tbody>" +
    bodyRows
      .map((r) => "<tr>" + r.map((c) => "<td>" + inlineMd(c) + "</td>").join("") + "</tr>")
      .join("") +
    "</tbody>";
  return '<div class="psy-md-table-wrap"><table class="psy-md-table">' + thead + tbody + "</table></div>";
}

// 收藏(Set 持久化)
function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

function saveFavorites(set) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    /* localStorage 可能被禁用,静默失败 */
  }
}

function toggleFavorite(id) {
  const set = loadFavorites();
  if (set.has(id)) set.delete(id);
  else set.add(id);
  saveFavorites(set);
  return set;
}

// 一次加载所有 10 分类概念(并发)
let _conceptsCache = null;
async function loadAllConcepts() {
  if (_conceptsCache) return _conceptsCache;
  const results = await Promise.all(
    CONCEPT_FILES.map((meta) =>
      fetchJson(DATA_BASE + meta.file)
        .then((d) => ({ meta, data: d }))
        .catch((err) => ({ meta, error: err }))
    )
  );
  // 拼成扁平的 [{id, title, section, raw, first_definition, category, category_id, emoji, ...}, ...]
  const flat = [];
  for (const r of results) {
    if (r.error) continue; // 单文件失败不阻塞其它分类
    const { meta, data } = r;
    for (const c of data.concepts || []) {
      flat.push({
        id: c.id,
        title: c.title,
        section: c.section,
        level: c.level,
        raw: c.raw || "",
        first_definition: c.first_definition || "",
        category: meta.category,
        category_id: meta.id,
        emoji: meta.emoji,
      });
    }
  }
  _conceptsCache = flat;
  return flat;
}

function buildIndex(flat) {
  const byId = new Map();
  const byCategory = new Map();
  for (const c of flat) {
    byId.set(c.id, c);
    const list = byCategory.get(c.category_id) || [];
    list.push(c);
    byCategory.set(c.category_id, list);
  }
  return { byId, byCategory };
}

// 搜索:title + first_definition 子串匹配
function searchConcepts(flat, query) {
  const q = (query || "").trim();
  if (!q) return flat;
  const needle = q.toLowerCase();
  return flat.filter((c) => {
    if ((c.title || "").toLowerCase().includes(needle)) return true;
    if ((c.first_definition || "").toLowerCase().includes(needle)) return true;
    return false;
  });
}

// 取同一分类内"上一篇/下一篇"(按 id 排序)
function findNeighbors(flat, currentId) {
  const current = flat.find((c) => c.id === currentId);
  if (!current) return { prev: null, next: null };
  const sameCat = flat
    .filter((c) => c.category_id === current.category_id)
    .sort((a, b) => a.id.localeCompare(b.id));
  const idx = sameCat.findIndex((c) => c.id === currentId);
  return {
    prev: idx > 0 ? sameCat[idx - 1] : null,
    next: idx < sameCat.length - 1 ? sameCat[idx + 1] : null,
    sameCat,
  };
}

// 高亮匹配子串(列表卡片用)
function highlight(text, query) {
  if (!text || !query) return escapeHtml(text || "");
  const q = query.trim();
  if (!q) return escapeHtml(text);
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return escapeHtml(text);
  const before = text.slice(0, idx);
  const hit = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return escapeHtml(before) + "<mark>" + escapeHtml(hit) + "</mark>" + escapeHtml(after);
}

// ---------------------------------------------------------------------------
// 视图 1:科普列表
// ---------------------------------------------------------------------------

export async function renderArticlesList(root) {
  root.innerHTML = `<p class="psy-loading">正在加载 10 分类 · 223 概念…</p>`;
  let flat;
  try {
    flat = await loadAllConcepts();
  } catch (err) {
    root.innerHTML = `<p class="psy-error">加载失败:${escapeHtml(String(err))}</p>`;
    return;
  }
  const { byCategory } = buildIndex(flat);
  const favorites = loadFavorites();

  // URL ?tab=favorites 仅前端状态,query 由 router 透传
  const qIdx = (root.dataset && root.dataset.query) || "";
  let activeQuery = "";
  let activeTab = "all"; // all | favorites

  const catList = CONCEPT_FILES.map((meta) => {
    const list = byCategory.get(meta.id) || [];
    return { ...meta, count: list.length };
  });

  function paint() {
    const filtered = activeTab === "favorites"
      ? flat.filter((c) => favorites.has(c.id))
      : searchConcepts(flat, activeQuery);
    const totalCount = filtered.length;
    const favCount = flat.filter((c) => favorites.has(c.id)).length;

    const catCards = catList
      .map((c) => {
        const sample = (byCategory.get(c.id) || [])[0];
        const sampleTitle = sample ? sample.title : "(暂无)";
        return `
          <a class="psy-cat-card" href="#/articles?cat=${c.id}">
            <div class="psy-cat-emoji">${escapeHtml(c.emoji)}</div>
            <div class="psy-cat-body">
              <h3>${escapeHtml(c.category)} <span class="psy-cat-count">${c.count} 概念</span></h3>
              <p class="psy-cat-sample">首篇:${escapeHtml(sampleTitle)}</p>
            </div>
          </a>
        `;
      })
      .join("");

    const cards = filtered
      .slice(0, 200) // 限制渲染数量,防止搜索结果过大
      .map((c) => {
        const isFav = favorites.has(c.id);
        return `
          <div class="psy-article-card" data-id="${escapeHtml(c.id)}">
            <a class="psy-article-title" href="#/articles/${encodeURIComponent(c.id)}">
              <span class="psy-article-emoji">${escapeHtml(c.emoji)}</span>
              ${highlight(c.title, activeQuery)}
            </a>
            <p class="psy-article-meta">
              <span class="psy-tag">${escapeHtml(c.category)}</span>
              <span class="psy-article-section">${escapeHtml(c.section || "—")}</span>
            </p>
            <p class="psy-article-def">${highlight((c.first_definition || "").slice(0, 80), activeQuery)}</p>
            <button class="psy-fav-btn ${isFav ? "psy-fav-on" : ""}" data-fav="${escapeHtml(c.id)}" type="button">
              ${isFav ? "★ 已收藏" : "☆ 收藏"}
            </button>
          </div>
        `;
      })
      .join("");

    const trimmed = filtered.length > 200
      ? `<p class="psy-hint">结果过多,仅显示前 200 条,请细化搜索关键词。</p>`
      : "";

    root.innerHTML = `
      <div class="psy-articles">
        <div class="psy-articles-head">
          <h2>科普文章</h2>
          <span class="psy-tag">Phase 1 #5 · 0914 T3 立</span>
        </div>
        <p class="psy-hint">
          数据源:Phase 0 #1 <code>data/concepts/</code>(10 分类 · ${flat.length} 概念,只读)。
          点击分类卡片浏览,或用搜索 / 收藏 tab 快速定位。
        </p>

        <div class="psy-tabs">
          <button class="psy-tab ${activeTab === "all" ? "psy-tab-on" : ""}" data-tab="all" type="button">
            全部 (${flat.length})
          </button>
          <button class="psy-tab ${activeTab === "favorites" ? "psy-tab-on" : ""}" data-tab="favorites" type="button">
            收藏 (${favCount})
          </button>
        </div>

        <div class="psy-search">
          <input id="psy-article-search" type="search" placeholder="搜索标题或定义…(中文也支持)"
            value="${escapeHtml(activeQuery)}" autocomplete="off" />
          <span class="psy-hint" id="psy-article-count">${totalCount} 条结果</span>
        </div>

        ${activeTab === "all" ? `<div class="psy-cat-grid">${catCards}</div>` : ""}

        <h3 class="psy-list-title">
          ${activeTab === "favorites" ? "我收藏的" : activeQuery ? "搜索结果" : "全部文章"}
        </h3>
        ${cards ? `<div class="psy-article-grid">${cards}</div>` : `<p class="psy-hint">${
          activeTab === "favorites" ? "还没有收藏,去全部 tab 点 ★ 吧~" : "没找到结果,试试别的关键词。"
        }</p>`}
        ${trimmed}
      </div>
    `;

    // 绑定 tab 切换
    root.querySelectorAll(".psy-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        paint();
        // 焦点回到搜索框(列表重新渲染后)
        const ipt = root.querySelector("#psy-article-search");
        if (ipt) ipt.focus();
      });
    });

    // 绑定搜索
    const ipt = root.querySelector("#psy-article-search");
    if (ipt) {
      ipt.addEventListener("input", (e) => {
        activeQuery = e.target.value;
        paint();
        const ipt2 = root.querySelector("#psy-article-search");
        if (ipt2) {
          ipt2.focus();
          // 恢复光标位置到末尾
          const v = ipt2.value;
          ipt2.setSelectionRange(v.length, v.length);
        }
      });
    }

    // 绑定收藏按钮
    root.querySelectorAll("[data-fav]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(btn.dataset.fav);
        paint();
      });
    });
  }

  paint();
}

// 接受 URL ?cat=XX 时只展开某一分类(简单分流,内部仍调 paint)
export async function renderArticlesCategory(root, categoryId) {
  // 委托给列表视图,只滚到对应分类
  await renderArticlesList(root);
  setTimeout(() => {
    const el = root.querySelector(`[data-cat-id="${categoryId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);
}

// ---------------------------------------------------------------------------
// 视图 2:概念详情
// ---------------------------------------------------------------------------

export async function renderArticleDetail(root, conceptId) {
  root.innerHTML = `<p class="psy-loading">正在加载概念 ${escapeHtml(conceptId)}…</p>`;
  let flat;
  try {
    flat = await loadAllConcepts();
  } catch (err) {
    root.innerHTML = `<p class="psy-error">加载失败:${escapeHtml(String(err))}</p>`;
    return;
  }
  const { byId } = buildIndex(flat);
  const concept = byId.get(conceptId);
  if (!concept) {
    root.innerHTML = `
      <div class="psy-article-detail">
        <p class="psy-error">找不到概念 <code>${escapeHtml(conceptId)}</code></p>
        <p><a href="#/articles" class="psy-btn">← 返回科普列表</a></p>
      </div>
    `;
    return;
  }

  const { prev, next, sameCat } = findNeighbors(flat, conceptId);
  const favorites = loadFavorites();
  const isFav = favorites.has(conceptId);
  const bodyHtml = renderMarkdown(concept.raw || "");
  // 同一分类其它概念(最多 8 条作侧栏)
  const siblings = (sameCat || []).filter((c) => c.id !== conceptId).slice(0, 8);

  root.innerHTML = `
    <article class="psy-article-detail">
      <header class="psy-article-detail-head">
        <p class="psy-article-breadcrumb">
          <a href="#/articles">科普</a> ›
          <a href="#/articles?cat=${escapeHtml(concept.category_id)}">${escapeHtml(concept.category)}</a>
        </p>
        <h2>${escapeHtml(concept.emoji)} ${escapeHtml(concept.title)}</h2>
        <p class="psy-article-meta">
          <span class="psy-tag">${escapeHtml(concept.category)}</span>
          <span class="psy-article-section">${escapeHtml(concept.section || "—")}</span>
          <span class="psy-article-id"><code>${escapeHtml(concept.id)}</code></span>
        </p>
        <p class="psy-article-def">${escapeHtml(concept.first_definition || "")}</p>
        <div class="psy-actions">
          <button id="psy-fav-toggle" class="psy-btn ${isFav ? "psy-btn-primary" : ""}" type="button">
            ${isFav ? "★ 已收藏" : "☆ 收藏"}
          </button>
          <a class="psy-btn" href="#/articles">← 返回列表</a>
        </div>
      </header>

      <hr/>

      <section class="psy-article-body">
        ${bodyHtml || `<p class="psy-hint">该概念暂未提供详细正文,只有首句定义。</p>`}
      </section>

      <hr/>

      <nav class="psy-article-pager">
        ${prev
          ? `<a class="psy-btn" href="#/articles/${encodeURIComponent(prev.id)}">← ${escapeHtml(prev.title)}</a>`
          : `<span class="psy-btn" style="opacity:.5;cursor:default;">已是本分类首篇</span>`}
        ${next
          ? `<a class="psy-btn" href="#/articles/${encodeURIComponent(next.id)}">${escapeHtml(next.title)} →</a>`
          : `<span class="psy-btn" style="opacity:.5;cursor:default;">已是本分类末篇</span>`}
      </nav>

      ${siblings.length
        ? `<aside class="psy-article-siblings">
            <h3>同分类( ${escapeHtml(concept.category)} )其它概念</h3>
            <ul>
              ${siblings
                .map(
                  (s) => `<li><a href="#/articles/${encodeURIComponent(s.id)}">${escapeHtml(s.title)}</a></li>`
                )
                .join("")}
            </ul>
          </aside>`
        : ""}

      <details class="psy-disclaimer">
        <summary>免责声明</summary>
        <p>本科普内容仅供学习与自助参考,不能替代专业诊断或治疗。如有持续困扰,请联系 <strong>北京心理危机研究与干预中心 400-161-9995</strong>(24h)或当地精神卫生机构。</p>
      </details>
    </article>
  `;

  const favBtn = root.querySelector("#psy-fav-toggle");
  if (favBtn) {
    favBtn.addEventListener("click", () => {
      toggleFavorite(conceptId);
      const nowFav = loadFavorites().has(conceptId);
      favBtn.textContent = nowFav ? "★ 已收藏" : "☆ 收藏";
      favBtn.classList.toggle("psy-btn-primary", nowFav);
    });
  }
}
