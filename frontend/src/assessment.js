// 心理顾问 · 测评页业务模块
// 2026-09-10 T3 立 · Phase 1 #4 '测评页' 业务模块层
// 0 依赖 · 纯 ES Module · 直接消费 backend FastAPI 5 端点
//
// 视图:
//   renderList(root)              测评列表(选量表入口)
//   renderAssessment(root, code)  答题页(读单量表完整内容,提交后算分)
//   renderResult(root, payload)   结果页(总分 + 解读 + 非诊断免责声明)
//
// 数据约定:
//   API_BASE 默认 http://127.0.0.1:8000(backend/README.md 启动端口)
//   量表 items[].id 必填,scoring.options[] 必含 value+label
//   评分 method='sum' 简单求和;interpretation[].range=[min,max] 闭区间

import { escapeHtml, navigate } from "./router.js";

export const API_BASE =
  (typeof window !== "undefined" && window.__PSY_API_BASE__) ||
  "http://127.0.0.1:8000";

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

async function fetchJson(path) {
  const r = await fetch(API_BASE + path, { headers: { Accept: "application/json" } });
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} ${r.statusText} on ${path}`);
  }
  return r.json();
}

function findBand(interpretation, total) {
  if (!Array.isArray(interpretation)) return null;
  for (const b of interpretation) {
    const [lo, hi] = b.range || [];
    if (typeof lo === "number" && typeof hi === "number" && total >= lo && total <= hi) {
      return b;
    }
  }
  return null;
}

function calcScore(method, values) {
  // 当前 backend 5 量表均为 sum,留 method 字段便于未来加权
  if (method === "sum" || !method) {
    return values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  }
  return null;
}

// ---------------------------------------------------------------------------
// 视图 1:测评列表
// ---------------------------------------------------------------------------

export async function renderList(root) {
  root.innerHTML = `<p class="psy-loading">正在拉取 5 量表…</p>`;
  const data = await fetchJson("/api/scales");
  // backend 0908 T3 实际响应: { total, ready, pending, categories, items: [...] }
  const scales = data.items || data.scales || [];
  if (!scales.length) {
    root.innerHTML = `<p class="psy-error">后端未返回任何量表,先确认 backend 是否启动</p>`;
    return;
  }

  const cards = scales
    .map(
      (s) => `
      <article class="psy-card" data-code="${escapeHtml(s.code)}">
        <header>
          <h3>${escapeHtml(s.name)} <small>${escapeHtml(s.name_en || "")}</small></h3>
          <span class="psy-tag">${escapeHtml(s.category || "未分类")}</span>
        </header>
        <p class="psy-meta">
          ${s.items_count || "?"} 题 · 用时约 ${s.duration_min || "?"} 分钟
          ${s.has_crisis_flag ? "· <span class='psy-warn'>含危机提示</span>" : ""}
        </p>
        <button class="psy-btn" data-action="start" data-code="${escapeHtml(s.code)}">
          开始测评
        </button>
      </article>`
    )
    .join("");

  root.innerHTML = `
    <section class="psy-assess-list">
      <h2>选择测评量表</h2>
      <p class="psy-hint">所有量表均为<strong>非诊断性</strong>自评工具,结果仅供个人参考。</p>
      <div class="psy-grid">${cards}</div>
    </section>
  `;

  root.querySelectorAll("button[data-action='start']").forEach((btn) => {
    btn.addEventListener("click", () => navigate(`/scales/${btn.dataset.code}`));
  });
}

// ---------------------------------------------------------------------------
// 视图 2:答题页
// ---------------------------------------------------------------------------

export async function renderAssessment(root, code) {
  root.innerHTML = `<p class="psy-loading">正在加载 ${escapeHtml(code)} 量表…</p>`;
  let scale;
  try {
    scale = await fetchJson(`/api/scales/${encodeURIComponent(code)}`);
  } catch (err) {
    root.innerHTML = `<p class="psy-error">量表加载失败:${escapeHtml(String(err))}</p>
      <p><a href="#/scales">← 返回列表</a></p>`;
    return;
  }

  const items = Array.isArray(scale.items) ? scale.items : [];
  const scoring = scale.scoring || { options: [] };
  const options = Array.isArray(scoring.options) ? scoring.options : [];

  if (!items.length || !options.length) {
    root.innerHTML = `<p class="psy-error">量表 ${escapeHtml(code)} 数据不完整(items/options 缺失)</p>
      <p><a href="#/scales">← 返回列表</a></p>`;
    return;
  }

  const optionsHtml = options
    .map(
      (o) =>
        `<label class="psy-opt">
          <input type="radio" name="opt" value="${escapeHtml(String(o.value))}" required />
          <span>${escapeHtml(o.label || String(o.value))}</span>
        </label>`
    )
    .join("");

  const itemsHtml = items
    .map(
      (it) => `
      <li class="psy-item" data-id="${escapeHtml(String(it.id))}">
        <span class="psy-qid">Q${escapeHtml(String(it.id))}.</span>
        <span class="psy-qtext">${escapeHtml(it.text || "")}</span>
        <div class="psy-opts">${optionsHtml}</div>
      </li>`
    )
    .join("");

  root.innerHTML = `
    <section class="psy-assess-form">
      <p><a href="#/scales">← 返回列表</a></p>
      <h2>${escapeHtml(scale.name || code)} <small>${escapeHtml(scale.name_en || "")}</small></h2>
      <p class="psy-hint">${escapeHtml(scale.intro || "请根据过去两周的真实感受作答")}</p>
      <form id="psy-assess-form">
        <ol class="psy-items">${itemsHtml}</ol>
        <div class="psy-actions">
          <button type="submit" class="psy-btn psy-btn-primary">提交并查看结果</button>
        </div>
      </form>
    </section>
  `;

  const form = root.querySelector("#psy-assess-form");
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const formData = new FormData(form);
    const values = items.map((it) => {
      const v = formData.get(`opt-${it.id}`);
      // FormData 取的是 form 内同 name 的列表,这里因为每个 item 独立 wrapper,
      // 改用 querySelectorAll 拿每个 item 选中值
      return null;
    });

    // 重新按 DOM 取每个 item 的选中值
    const picked = items.map((it) => {
      const checked = form.querySelector(
        `li[data-id='${CSS.escape(String(it.id))}'] input[type=radio]:checked`
      );
      return checked ? Number(checked.value) : NaN;
    });

    if (picked.some((v) => !Number.isFinite(v))) {
      root.querySelector(".psy-actions").insertAdjacentHTML(
        "beforeend",
        '<p class="psy-error">请回答全部题目后再提交。</p>'
      );
      return;
    }

    const total = calcScore(scoring.method, picked);
    const band = findBand(scale.interpretation, total);
    renderResult(root, { scale, picked, total, band });
  });
}

// ---------------------------------------------------------------------------
// 视图 3:结果页
// ---------------------------------------------------------------------------

function renderResult(root, { scale, picked, total, band }) {
  const scoreMax = (scale.scoring && scale.scoring.range && scale.scoring.range[1]) || null;
  const disclaimer =
    scale.disclaimer ||
    "本量表为筛查与症状严重度评估工具,不是诊断工具。分数解读仅供个人参考,不能替代专业精神科/心理科医生的诊断与治疗方案。如持续困扰请寻求专业帮助。";

  const bandHtml = band
    ? `
      <div class="psy-band" style="border-left:6px solid ${escapeHtml(band.color || "#888")}">
        <h3>严重度:${escapeHtml(band.severity || "未分级")}
          <small>(${band.range ? band.range.join(" – ") : "?"} 分)</small>
        </h3>
        <p>${escapeHtml(band.description || "")}</p>
        ${band.recommendation ? `<p><strong>建议:</strong>${escapeHtml(band.recommendation)}</p>` : ""}
      </div>`
    : `<div class="psy-band"><h3>无匹配分级</h3><p>总分 ${total},未匹配到标准分级,可能超出常规量表范围。</p></div>`;

  const breakdownHtml = (scale.items || [])
    .map(
      (it, i) =>
        `<li>Q${escapeHtml(String(it.id))}. ${escapeHtml(it.text || "")} — <strong>${picked[i]}</strong></li>`
    )
    .join("");

  const crisisHtml = scale.red_flags
    ? `<div class="psy-warn-box">
        <h4>⚠ 危机提示</h4>
        <p>${escapeHtml(scale.red_flags)}</p>
        <p>如您或身边人正在经历紧急心理危机,请立即拨打 24 小时心理援助热线:<strong>400-161-9995</strong>(北京心理危机研究与干预中心)或就近精神专科医院。</p>
      </div>`
    : "";

  root.innerHTML = `
    <section class="psy-assess-result">
      <p><a href="#/scales">← 返回列表</a> · <a href="#" id="psy-retry">重新作答</a></p>
      <h2>${escapeHtml(scale.name || scale.code)} · 测评结果</h2>
      <p class="psy-score">总分:<strong>${total}</strong>${
        scoreMax !== null ? ` / ${scoreMax}` : ""
      }</p>
      ${bandHtml}
      ${crisisHtml}
      <details>
        <summary>查看逐题得分(${picked.length} 题)</summary>
        <ol class="psy-breakdown">${breakdownHtml}</ol>
      </details>
      <p class="psy-disclaimer">${escapeHtml(disclaimer)}</p>
    </section>
  `;

  root.querySelector("#psy-retry").addEventListener("click", (ev) => {
    ev.preventDefault();
    navigate(`/scales/${scale.code}`);
  });
}
