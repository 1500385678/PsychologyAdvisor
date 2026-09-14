// 心理顾问 · 危机检测埋点业务模块
// 2026-09-15 T3 立 · Phase 1 #6 "危机检测埋点"(输入框实时监测 + 资源弹窗)
// 0 依赖 · 纯 ES Module · 数据源: data/crisis_keywords.json(Phase 0 #3 资产,0903 T3 闭环,89 词 / 6 类 / 4 严重程度)
//                  data/resources.json(Phase 0 #5 资产,0905 T3 闭环,40 条 / 7 议题 / 6 形式)
//
// 视图:
//   attachCrisisMonitor(inputEl, opts)   通用监测器 · 挂到任意 input/textarea
//   openCrisisModal(severity, hits)      资源弹窗(可独立调用,内置 hotlines + 资源导航)
//
// 设计原则(per data/crisis_keywords.json matching_rules):
//   - 实时监测:input 事件 + debounce 800ms(matching_rules.debounce_ms)
//   - 4 级严重程度:critical / high / medium / low(severity_levels 字段)
//   - 大小写不敏感(matching_rules.case_sensitive = false)
//   - 子串匹配(matching_rules.whole_word = false)
//   - 否定窗口 6 字符:hit 词前 6 字符内出现"不是/不会/别/没有/不"则视为否定(matching_rules.negation_window_chars + negation_words)
//   - 共病升级:同输入同时出现 cat_suicidal_ideation 任一词 + cat_hopelessness 任一 high 词 → 整体升级为 critical(matching_rules.co_occurrence_upgrade)
//   - 键盘节流:>240 keystrokes/minute 静默(matching_rules.max_keystrokes_per_minute)
//   - 性能预算:单次检测 <50ms(matching_rules.performance_budget_ms)
//
// 集成点(0915 T3):
//   - checkin.js 笔记输入框:替换 0911 起的 inline warn-box(critical 26 词简单匹配),升级为多级严重程度 + 资源弹窗
//   - main.js boot log 阶段头:在 phase/buildAt/scope 同步刷新
//
// 与其他模块的协作边界:
//   - 仅读:  data/crisis_keywords.json(主)+ data/resources.json(辅,弹窗推荐资源)
//   - 仅写:  localStorage.psy_crisis_snooze_v1({ severity, until })  · 24h 内同 severity 不再主动弹窗
//   - 不写:  data/(Phase 0 100% ready,0915 不重写)
//   - 不引:  backend/(0915 不在 backend 范围,纯前端模块)

import { escapeHtml } from "./router.js";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const CRISIS_KW_URL = "../data/crisis_keywords.json";
const RESOURCES_URL = "../data/resources.json";
const SNOOZE_KEY = "psy_crisis_snooze_v1";
const SNOOZE_HOURS = 24;

// 严重程度排序(critical > high > medium > low),用于共病升级时取最大值
const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

// 严重程度 → UI 配色(per design_principles · calm tone,critical 仍用警示红但不刺眼)
const SEV_COLOR = {
  critical: "#b91c1c", // 警示红
  high: "#c2410c",     // 深橙
  medium: "#a16207",   // 琥珀
  low: "#4b5563",      // 中性
};

// 严重程度 → 文案(per response_templates)
const SEV_TITLE = {
  critical: "检测到需要支持的内容",
  high: "检测到可能需要支持的内容",
  medium: "情绪信号提示",
  low: "提示",
};

// ---------------------------------------------------------------------------
// 数据(in-memory cache · 单页会话内复用)
// ---------------------------------------------------------------------------

let _crisisCache = null;
let _resourcesCache = null;

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

async function fetchJson(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText} on ${url}`);
  return r.json();
}

async function loadCrisis() {
  if (_crisisCache) return _crisisCache;
  _crisisCache = await fetchJson(CRISIS_KW_URL);
  return _crisisCache;
}

async function loadResources() {
  if (_resourcesCache) return _resourcesCache;
  _resourcesCache = await fetchJson(RESOURCES_URL);
  return _resourcesCache;
}

// 展平危机词条为 [{term, severity, category_id, category_name, recommended_action}]
function flattenTerms(crisisData) {
  const out = [];
  for (const cat of crisisData.keyword_categories || []) {
    for (const kw of cat.keywords || []) {
      if (kw.term && kw.severity) {
        out.push({
          term: String(kw.term).toLowerCase(),
          severity: kw.severity,
          category_id: cat.category_id || "",
          category_name: cat.name || "",
          recommended_action: kw.recommended_action || "",
        });
      }
    }
  }
  return out;
}

// 读取 matching_rules(允许字段缺失时 fallback 到默认)
function getRules(crisisData) {
  const r = crisisData.matching_rules || {};
  return {
    negation_window_chars: typeof r.negation_window_chars === "number" ? r.negation_window_chars : 6,
    negation_words: Array.isArray(r.negation_words) ? r.negation_words : ["不是", "不会", "别", "没有", "不"],
    context_window_chars: typeof r.context_window_chars === "number" ? r.context_window_chars : 50,
    co_occurrence_upgrade: typeof r.co_occurrence_upgrade === "string",
    debounce_ms: typeof r.debounce_ms === "number" ? r.debounce_ms : 800,
    max_keystrokes_per_minute: typeof r.max_keystrokes_per_minute === "number" ? r.max_keystrokes_per_minute : 240,
  };
}

// 检测是否被否定窗口"消解":hit 词前 negation_window_chars 内出现 negation_words 任一
function isNegated(text, idx, rules) {
  const start = Math.max(0, idx - rules.negation_window_chars);
  const before = text.slice(start, idx);
  return rules.negation_words.some((w) => before.includes(w));
}

// 单输入扫描:返回 { severity, hits: [{term, category, severity}], upgraded }
//   - hits 仅包含未被否定消解的词
//   - severity = hits 中最大 severity
//   - 若同输入同时含 cat_suicidal_ideation + cat_hopelessness 任一 high 词,升级为 critical
function scanText(text, terms, rules) {
  if (!text) return { severity: null, hits: [], upgraded: false };
  const lower = text.toLowerCase();
  const hits = [];
  // 已去重:同 term 只取首个 index
  const seen = new Set();
  for (const t of terms) {
    if (seen.has(t.term)) continue;
    let from = 0;
    while (true) {
      const idx = lower.indexOf(t.term, from);
      if (idx < 0) break;
      if (!isNegated(text, idx, rules)) {
        hits.push({
          term: t.term,
          severity: t.severity,
          category: t.category_name,
          category_id: t.category_id,
          index: idx,
        });
        seen.add(t.term);
        break; // 同 term 多次出现只算 1 次
      }
      from = idx + t.term.length;
    }
  }
  if (hits.length === 0) return { severity: null, hits: [], upgraded: false };
  // 最大 severity
  let maxSev = "low";
  for (const h of hits) {
    if (SEV_RANK[h.severity] > SEV_RANK[maxSev]) maxSev = h.severity;
  }
  // 共病升级:cat_suicidal_ideation + cat_hopelessness 任一 high → critical
  let upgraded = false;
  if (rules.co_occurrence_upgrade && maxSev !== "critical") {
    const hasSuicidal = hits.some((h) => h.category_id === "cat_suicidal_ideation");
    const hasHopelessHigh = hits.some(
      (h) => h.category_id === "cat_hopelessness" && h.severity === "high"
    );
    if (hasSuicidal && hasHopelessHigh) {
      maxSev = "critical";
      upgraded = true;
    }
  }
  return { severity: maxSev, hits, upgraded };
}

// ---------------------------------------------------------------------------
// Snooze(24h 内同 severity 不再主动弹窗 · per user privacy)
// ---------------------------------------------------------------------------

function loadSnooze() {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.until || !obj.severity) return null;
    if (Date.now() > obj.until) {
      localStorage.removeItem(SNOOZE_KEY);
      return null;
    }
    return obj;
  } catch (e) {
    return null;
  }
}

function saveSnooze(severity) {
  try {
    localStorage.setItem(
      SNOOZE_KEY,
      JSON.stringify({
        severity,
        until: Date.now() + SNOOZE_HOURS * 60 * 60 * 1000,
        createdAt: Date.now(),
      })
    );
  } catch (e) {
    console.warn("[crisis_monitor] snooze 保存失败", e);
  }
}

// ---------------------------------------------------------------------------
// Modal(资源弹窗)
// ---------------------------------------------------------------------------

function buildModalHtml(severity, hits, hotlines, crisisResources) {
  const sev = severity || "low";
  const color = SEV_COLOR[sev] || SEV_COLOR.low;
  const title = SEV_TITLE[sev] || "提示";

  // 命中词条展示(每词一 chip)
  const hitsHtml = hits && hits.length
    ? `<div class="psy-cm-hits">
        ${hits
          .map(
            (h) =>
              `<span class="psy-cm-hit" style="border-color:${escapeHtml(
                SEV_COLOR[h.severity] || color
              )}">${escapeHtml(h.term)}<small>${escapeHtml(h.category || "")}</small></span>`
          )
          .join("")}
      </div>`
    : "";

  // 24h 热线(从 crisis_keywords.hotlines_zh_cn 取)
  const hotlinesHtml = (hotlines || [])
    .map(
      (h) => `
      <li class="psy-cm-hotline">
        <strong>${escapeHtml(h.name || "")}</strong>
        <a class="psy-cm-phone" href="tel:${escapeHtml(h.phone || "")}">${escapeHtml(h.phone || "")}</a>
        <div class="psy-cm-meta">
          <span>${escapeHtml(h.hours || "")}</span>
          <span>${escapeHtml(h.coverage || "")}</span>
          <span>${escapeHtml(h.language || "")}</span>
        </div>
        ${h.note ? `<p class="psy-cm-note">${escapeHtml(h.note)}</p>` : ""}
      </li>`
    )
    .join("");

  // 资源推荐(从 resources.json 中匹配相关议题,优先 危机 / 抑郁 / 焦虑 / 自杀 / 心理援助)
  const resourceHtml = (crisisResources || [])
    .slice(0, 6)
    .map(
      (r) => `
      <li class="psy-cm-resource">
        <strong>${escapeHtml(r.title || "")}</strong>
        <div class="psy-cm-meta">
          <span>${escapeHtml(r.format || "")}</span>
          ${r.author ? `<span>· ${escapeHtml(r.author)}</span>` : ""}
        </div>
        ${r.url ? `<a class="psy-cm-link" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">前往 →</a>` : ""}
      </li>`
    )
    .join("");

  // 开场白(per response_templates · 内置 fallback)
  const opening = {
    critical:
      "你刚刚写下的内容,可能与较强烈的情绪相关。如果此刻感到很痛苦或想要结束,请记得你不是一个人。下面是 24 小时可用的支持资源。",
    high:
      "你写下的内容里有一些信号,可能反映了当下不容易的状态。如果你需要支持,这里有一些随时可用的资源。",
    medium:
      "注意到你的文字里有一些情绪信号。情绪命名是好事,但如果你感到持续困扰,可以看看下面的资源。",
    low: "如果你需要支持,下面是一些随时可用的资源。",
  }[sev];

  return `
    <div class="psy-cm-modal-mask" data-psy-cm-modal>
      <div class="psy-cm-modal" role="dialog" aria-modal="true" aria-labelledby="psy-cm-title" style="--psy-cm-color:${color}">
        <header class="psy-cm-modal-head">
          <h3 id="psy-cm-title" style="color:${color}">${escapeHtml(title)}</h3>
          <button type="button" class="psy-cm-close" aria-label="关闭">×</button>
        </header>
        <div class="psy-cm-modal-body">
          <p class="psy-cm-opening">${escapeHtml(opening)}</p>
          ${hitsHtml}
          <h4 style="color:${color}">📞 24 小时心理援助热线</h4>
          <ul class="psy-cm-hotlines">${hotlinesHtml || '<li class="psy-muted">(未配置)</li>'}</ul>
          ${
            resourceHtml
              ? `<h4 style="color:${color}">📚 推荐资源</h4><ul class="psy-cm-resources">${resourceHtml}</ul>`
              : ""
          }
          <p class="psy-cm-disclaimer">本提示仅基于关键词简单匹配,非诊断,不替代专业评估。如果你或身边的人正在经历紧急情况,请直接拨打 120 或前往最近的医院。</p>
        </div>
        <footer class="psy-cm-modal-foot">
          <button type="button" class="psy-cm-btn psy-cm-btn-secondary" data-psy-cm-action="snooze">${SNOOZE_HOURS}h 内不再提示</button>
          <button type="button" class="psy-cm-btn psy-cm-btn-primary" data-psy-cm-action="dismiss">我知道了,关闭</button>
        </footer>
      </div>
    </div>
  `;
}

// 弹出资源弹窗 · severity 可独立传(critical/high/medium/low),hits 可选
export async function openCrisisModal(severity, hits) {
  const sev = severity || "medium";
  // 关闭已有
  document.querySelectorAll("[data-psy-cm-modal]").forEach((el) => el.remove());

  const [crisisData, resourcesData] = await Promise.all([
    loadCrisis(),
    loadResources().catch(() => null),
  ]);

  // 资源:匹配议题(优先 crisis / depression / anxiety / suicide / counseling)
  const crisisResources = [];
  if (resourcesData && Array.isArray(resourcesData.resources)) {
    const want = new Set([
      "crisis", "depression", "anxiety", "suicide", "counseling",
      "危机", "抑郁", "焦虑", "自杀", "心理援助",
    ]);
    for (const r of resourcesData.resources) {
      const tags = (r.topics || []).concat([r.title || "", r.subtitle || ""]);
      if (tags.some((t) => want.has(String(t).toLowerCase()))) {
        crisisResources.push(r);
      }
      if (crisisResources.length >= 8) break;
    }
  }

  const host = document.createElement("div");
  host.innerHTML = buildModalHtml(sev, hits || [], crisisData.hotlines_zh_cn || [], crisisResources);
  document.body.appendChild(host.firstElementChild);
  const modal = document.querySelector("[data-psy-cm-modal]");
  if (!modal) return;

  const close = () => {
    modal.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (ev) => {
    if (ev.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);

  modal.querySelector(".psy-cm-close").addEventListener("click", close);
  modal.querySelectorAll("[data-psy-cm-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.psyCmAction;
      if (action === "snooze") {
        saveSnooze(sev);
      }
      close();
    });
  });
  // 点击 mask 关闭
  modal.addEventListener("click", (ev) => {
    if (ev.target === modal) close();
  });
}

// ---------------------------------------------------------------------------
// attachCrisisMonitor · 通用监测器
// ---------------------------------------------------------------------------

/**
 * 挂接危机监测器到任意 input/textarea
 * @param {HTMLInputElement|HTMLTextAreaElement} inputEl
 * @param {object} opts
 *   - container: HTMLElement     // 提示渲染容器(可选,默认 body 末尾)
 *   - onChange: (result) => void  // 命中状态变化回调({severity, hits, upgraded})
 *   - autoOpen: boolean           // critical 命中时是否自动弹窗(默认 true)
 *   - indicatorBefore: boolean    // 浮动指示图标位置(默认 false,放 input 之后)
 * @returns {{ detach(): void, getLastResult(): object, openModal(): void }}
 */
export function attachCrisisMonitor(inputEl, opts = {}) {
  if (!inputEl || !(inputEl instanceof HTMLInputElement || inputEl instanceof HTMLTextAreaElement)) {
    throw new Error("[crisis_monitor] inputEl 必须是 input 或 textarea");
  }
  const o = {
    container: opts.container || null,
    onChange: typeof opts.onChange === "function" ? opts.onChange : null,
    autoOpen: opts.autoOpen !== false,
    indicatorBefore: opts.indicatorBefore === true,
  };

  let lastResult = { severity: null, hits: [], upgraded: false };
  let terms = [];
  let rules = null;
  let debounceTimer = null;
  let keystrokes = []; // 时间戳数组(1 分钟内)
  let destroyed = false;

  // 浮动指示器
  const indicator = document.createElement("button");
  indicator.type = "button";
  indicator.className = "psy-cm-indicator";
  indicator.setAttribute("aria-label", "危机检测指示");
  indicator.style.display = "none";
  indicator.innerHTML = `<span class="psy-cm-dot"></span><span class="psy-cm-dot-text">0</span>`;
  indicator.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (lastResult.severity) openCrisisModal(lastResult.severity, lastResult.hits);
  });

  // 插入到 inputEl 之后(默认)或之前
  if (inputEl.parentNode) {
    if (o.indicatorBefore && inputEl.previousSibling) {
      inputEl.parentNode.insertBefore(indicator, inputEl);
    } else {
      inputEl.parentNode.insertBefore(indicator, inputEl.nextSibling);
    }
  }

  // 检测函数
  function performScan() {
    if (destroyed) return;
    const text = inputEl.value || "";
    if (!text.trim()) {
      lastResult = { severity: null, hits: [], upgraded: false };
      renderIndicator(null);
      if (o.onChange) o.onChange(lastResult);
      return;
    }
    const t0 = performance.now();
    const r = scanText(text, terms, rules);
    const dt = performance.now() - t0;
    if (dt > 50) {
      console.warn(`[crisis_monitor] 单次扫描 ${dt.toFixed(1)}ms 超出预算 50ms`);
    }
    lastResult = r;

    // 键盘节流:> 240 keystrokes/minute 静默(per matching_rules)
    const now = Date.now();
    keystrokes = keystrokes.filter((t) => now - t < 60_000);
    if (keystrokes.length > rules.max_keystrokes_per_minute) {
      indicator.style.display = "none";
      return;
    }

    renderIndicator(r);

    // critical 命中时自动弹窗(若未在 24h snooze)
    if (r.severity === "critical" && o.autoOpen) {
      const snooze = loadSnooze();
      if (!snooze || snooze.severity !== "critical") {
        openCrisisModal(r.severity, r.hits);
      }
    }
    if (o.onChange) o.onChange(r);
  }

  // 渲染指示器 + 输入框边框色
  function renderIndicator(r) {
    if (!r || !r.severity) {
      indicator.style.display = "none";
      inputEl.classList.remove("psy-cm-input-warn");
      return;
    }
    const color = SEV_COLOR[r.severity] || SEV_COLOR.low;
    indicator.style.display = "";
    indicator.style.borderColor = color;
    indicator.style.color = color;
    indicator.querySelector(".psy-cm-dot").style.background = color;
    indicator.querySelector(".psy-cm-dot-text").textContent = String(r.hits.length);
    indicator.title = `${SEV_TITLE[r.severity] || "提示"} · ${r.hits.length} 个关键词`;
    inputEl.classList.add("psy-cm-input-warn");
    inputEl.style.borderColor = color;
  }

  // 初始化:加载数据
  loadCrisis().then((data) => {
    if (destroyed) return;
    terms = flattenTerms(data);
    rules = getRules(data);
    performScan();
  }).catch((err) => {
    console.error("[crisis_monitor] 数据加载失败", err);
  });

  // 监听 input
  const onInput = () => {
    keystrokes.push(Date.now());
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(performScan, 800); // matching_rules.debounce_ms
  };
  inputEl.addEventListener("input", onInput);

  // destroy
  function detach() {
    destroyed = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    inputEl.removeEventListener("input", onInput);
    inputEl.classList.remove("psy-cm-input-warn");
    inputEl.style.borderColor = "";
    if (indicator.parentNode) indicator.parentNode.removeChild(indicator);
  }

  return {
    detach,
    getLastResult: () => lastResult,
    openModal: () => {
      if (lastResult.severity) openCrisisModal(lastResult.severity, lastResult.hits);
    },
  };
}