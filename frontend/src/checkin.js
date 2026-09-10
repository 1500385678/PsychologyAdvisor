// 心理顾问 · 情绪打卡页业务模块
// 2026-09-11 T3 立 · Phase 1 #2 "情绪打卡页"(滑动条 + 标签 + 文字)
// 0 依赖 · 纯 ES Module · 数据源: data/mood_tags.json(Phase 0 资产 · 11 子类 / 60 标签)
//
// 视图:
//   renderCheckin(root)        打卡表单(滑动条 + 标签选择 + 文字输入 + 提交)
//   renderRecent(root)         最近 7 天打卡记录(从 localStorage 读)
//   renderCheckinHome(root)    打卡首页入口(快捷打卡 + 最近 7 天摘要)
//
// 数据约定(per data/mood_tags.json pairing_rules):
//   - tags: 最多 3 个(pairs.tag_combination_max)
//   - note: 自由文本 ≤ 200 字(pairs.mood_log_data_shape + W36 计划注)
//   - 持久化: localStorage(无后端依赖,后续可加 POST /api/checkin)
//   - 危机检测: 仅作用于 note 输入框,不作用于 tag 选择(pairs.crisis_keywords_boundary)
//
// UI 映射(per intensity_levels):
//   1_mild   → 浅色 chip
//   2_medium → 中色 chip
//   3_strong → 深色 chip
//   滑动条 1-5(0=未选,1=很差,5=很好);1-2 偏负向,3 中性,4-5 偏正向

import { escapeHtml, navigate } from "./router.js";

// ---------------------------------------------------------------------------
// 数据源(相对路径:index.html 同级 + frontend/ + data/)
// ---------------------------------------------------------------------------

const MOOD_TAGS_URL = "../data/mood_tags.json";
const CRISIS_KW_URL = "../data/crisis_keywords.json";
const STORAGE_KEY = "psy_checkin_logs_v1";

// ---------------------------------------------------------------------------
// 状态(in-memory cache · 单页会话内复用)
// ---------------------------------------------------------------------------

let _moodTagsCache = null;
let _crisisKwCache = null;

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

async function fetchJson(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText} on ${url}`);
  return r.json();
}

async function loadMoodTags() {
  if (_moodTagsCache) return _moodTagsCache;
  const data = await fetchJson(MOOD_TAGS_URL);
  _moodTagsCache = data;
  return data;
}

async function loadCrisisKeywords() {
  if (_crisisKwCache) return _crisisKwCache;
  const data = await fetchJson(CRISIS_KW_URL);
  _crisisKwCache = data;
  return data;
}

function loadLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveLogs(logs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    // quota 或隐私模式失败,降级为本次会话内存
    console.warn("[checkin] localStorage 保存失败", e);
  }
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 从 crisis_keywords 抽取 critical 词条(打包为 Set 用于 O(1) 匹配)
function extractCriticalTerms(crisisData) {
  const set = new Set();
  for (const cat of crisisData.keyword_categories || []) {
    for (const kw of cat.keywords || []) {
      if (kw.severity === "critical" && kw.term) {
        set.add(String(kw.term).toLowerCase());
      }
    }
  }
  return set;
}

// 简单子串匹配;返回命中的 critical 词
function matchCrisis(text, criticalSet) {
  if (!text || !criticalSet || !criticalSet.size) return null;
  const lower = text.toLowerCase();
  for (const term of criticalSet) {
    if (lower.includes(term)) return term;
  }
  return null;
}

// 强度 → 颜色深度(per intensity_levels.ui_color_depth)
function intensityColor(intensity, valence) {
  const depth =
    intensity === "3_strong" ? "#0d9488" : intensity === "2_medium" ? "#5eead4" : "#a7f3d0";
  // 负向用偏冷的灰蓝色
  if (valence === "negative") {
    return intensity === "3_strong" ? "#0f766e" : intensity === "2_medium" ? "#14b8a6" : "#5eead4";
  }
  return depth;
}

// 滑动条值 → 文本
function valenceLabel(v) {
  if (!v) return "未选";
  return ["", "很差", "较差", "一般", "较好", "很好"][v] || "未选";
}

// 滑动条值 → 推断 valence(用于 chip 视觉提示)
function inferValence(v) {
  if (!v) return null;
  if (v <= 2) return "negative";
  if (v >= 4) return "positive";
  return "neutral";
}

// ---------------------------------------------------------------------------
// 视图 1:打卡首页入口
// ---------------------------------------------------------------------------

export async function renderCheckinHome(root) {
  root.innerHTML = `<p class="psy-loading">正在加载打卡入口…</p>`;
  const tags = await loadMoodTags();
  const logs = loadLogs();
  const last7 = logs.slice(-7).reverse();

  const last7Html = last7.length
    ? last7
        .map((log) => {
          const tagChips = (log.tags || [])
            .map(
              (t) =>
                `<span class="psy-chip" style="background:${intensityColor(
                  t.intensity,
                  t.valence
                )}">${escapeHtml(t.term)}</span>`
            )
            .join("");
          return `<li class="psy-log-item">
              <span class="psy-log-date">${escapeHtml(log.date)}</span>
              <span class="psy-log-valence">${escapeHtml(valenceLabel(log.valence))}</span>
              <span class="psy-log-tags">${tagChips || '<em class="psy-muted">无标签</em>'}</span>
            </li>`;
        })
        .join("")
    : `<li class="psy-muted">还没有打卡记录,从今天开始吧 🌱</li>`;

  root.innerHTML = `
    <section class="psy-checkin-home">
      <h2>情绪打卡</h2>
      <p class="psy-hint">每日 1 分钟,记录此刻的感受。情绪命名 ≠ 危机信号,这里只做记录。</p>
      <div class="psy-actions">
        <button id="psy-go-checkin" class="psy-btn psy-btn-primary">+ 立即打卡</button>
        <a href="#/scales" class="psy-btn">去做测评</a>
      </div>
      <h3>最近 7 天(${last7.length} 条)</h3>
      <ul class="psy-log-list">${last7Html}</ul>
      <p class="psy-meta">${tags.stats.total_tags} 标签可选 · ${tags.tag_categories.length} 子分类</p>
    </section>
  `;

  root.querySelector("#psy-go-checkin").addEventListener("click", () => {
    navigate("/checkin/new");
  });
}

// ---------------------------------------------------------------------------
// 视图 2:打卡表单(滑动条 + 标签选择 + 文字输入 + 提交)
// ---------------------------------------------------------------------------

export async function renderCheckin(root) {
  root.innerHTML = `<p class="psy-loading">正在加载打卡表单…</p>`;
  const tags = await loadMoodTags();
  await loadCrisisKeywords(); // 预热缓存(让危机检测可用)

  // 按 valence 分组,便于 UI 分类展示
  const catsByValence = { positive: [], negative: [] };
  for (const cat of tags.tag_categories) {
    (catsByValence[cat.valence] = catsByValence[cat.valence] || []).push(cat);
  }

  const renderTagGroups = (valenceKey, label, color) => {
    const cats = catsByValence[valenceKey] || [];
    return `
      <fieldset class="psy-tag-group" data-valence="${valenceKey}">
        <legend style="color:${color}">${label}</legend>
        ${cats
          .map(
            (cat) => `
          <div class="psy-cat-block">
            <h4>${escapeHtml(cat.name)} <small>${escapeHtml(cat.description || "")}</small></h4>
            <div class="psy-tag-list">
              ${(cat.tags || [])
                .map(
                  (t) => `<button type="button"
                      class="psy-tag-chip"
                      data-valence="${escapeHtml(cat.valence)}"
                      data-cat="${escapeHtml(cat.id)}"
                      data-term="${escapeHtml(t.term)}"
                      data-intensity="${escapeHtml(t.intensity)}"
                      style="--chip-bg:${intensityColor(t.intensity, cat.valence)}">
                    ${escapeHtml(t.term)} <small>${escapeHtml(t.intensity.replace("1_", "").replace("_", "·"))}</small>
                  </button>`
                )
                .join("")}
            </div>
          </div>`
          )
          .join("")}
      </fieldset>
    `;
  };

  root.innerHTML = `
    <section class="psy-checkin-form">
      <p><a href="#/checkin">← 返回打卡首页</a></p>
      <h2>今日打卡</h2>
      <p class="psy-hint">日期:<strong>${escapeHtml(todayStr())}</strong>(每次打卡会自动记录时间)</p>

      <form id="psy-checkin-form">
        <!-- 1. 滑动条 -->
        <div class="psy-field">
          <label for="psy-valence"><strong>此刻感受</strong>(1=很差,5=很好)</label>
          <div class="psy-slider-row">
            <input type="range" id="psy-valence" name="valence" min="1" max="5" step="1" value="3" />
            <span id="psy-valence-label" class="psy-valence-label">一般</span>
          </div>
        </div>

        <!-- 2. 标签选择 -->
        <div class="psy-field">
          <label><strong>情绪标签</strong>(最多 3 个 · 当前已选 <span id="psy-tag-count">0</span> 个)</label>
          ${renderTagGroups("positive", "🌿 积极情绪", "#0d9488")}
          ${renderTagGroups("negative", "🌧 消极情绪", "#0f766e")}
        </div>

        <!-- 3. 文字输入(危机检测仅作用于本输入框) -->
        <div class="psy-field">
          <label for="psy-note"><strong>想说的话</strong>(可选 · ≤ 200 字)</label>
          <textarea id="psy-note" name="note" maxlength="200" rows="4"
            placeholder="今天发生了什么?尝试用一两句话描述…"></textarea>
          <div class="psy-counter"><span id="psy-note-count">0</span> / 200</div>
          <div id="psy-crisis-alert"></div>
        </div>

        <div class="psy-actions">
          <button type="submit" class="psy-btn psy-btn-primary">完成打卡</button>
          <a href="#/checkin" class="psy-btn">取消</a>
        </div>
      </form>
    </section>
  `;

  // ---- 行为绑定 ----
  const valenceInput = root.querySelector("#psy-valence");
  const valenceLabel = root.querySelector("#psy-valence-label");
  valenceInput.addEventListener("input", () => {
    valenceLabel.textContent = valenceLabelText(valenceInput.value);
  });
  valenceLabel.textContent = valenceLabelText(valenceInput.value);

  // 标签选择(toggle · 最多 3)
  const selectedTags = new Set();
  root.querySelectorAll(".psy-tag-chip").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const key = btn.dataset.term;
      if (selectedTags.has(key)) {
        selectedTags.delete(key);
        btn.classList.remove("psy-tag-chip-on");
      } else {
        if (selectedTags.size >= 3) {
          flashCountHint("已达上限 3 个,请先取消再选");
          return;
        }
        selectedTags.add(key);
        btn.classList.add("psy-tag-chip-on");
      }
      root.querySelector("#psy-tag-count").textContent = String(selectedTags.size);
    });
  });

  // 文字输入 + 计数器 + 危机检测
  const noteEl = root.querySelector("#psy-note");
  const noteCount = root.querySelector("#psy-note-count");
  const crisisAlert = root.querySelector("#psy-crisis-alert");
  noteEl.addEventListener("input", () => {
    const txt = noteEl.value || "";
    noteCount.textContent = String(txt.length);
    // 危机关键词监测(critical only · 仅作用于本输入框)
    if (txt.length > 0 && _crisisKwCache) {
      const terms = extractCriticalTerms(_crisisKwCache);
      const hit = matchCrisis(txt, terms);
      renderCrisisAlert(crisisAlert, hit);
    } else {
      renderCrisisAlert(crisisAlert, null);
    }
  });

  // 提交
  const form = root.querySelector("#psy-checkin-form");
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const valence = Number(valenceInput.value);
    const tagsArr = Array.from(selectedTags).map((term) => {
      const btn = root.querySelector(`.psy-tag-chip[data-term="${CSS.escape(term)}"]`);
      return {
        term,
        valence: btn ? btn.dataset.valence : inferValence(valence),
        category_id: btn ? btn.dataset.cat : null,
        intensity: btn ? btn.dataset.intensity : "1_mild",
      };
    });
    const note = (noteEl.value || "").trim();

    if (!Number.isFinite(valence) || valence < 1 || valence > 5) {
      flashCountHint("请先选择感受(滑动条)");
      return;
    }

    const log = {
      id: `log_${Date.now()}`,
      date: todayStr(),
      timestamp: new Date().toISOString(),
      valence,
      valence_label: valenceLabel(valence),
      tags: tagsArr,
      note,
      // 危机检测标记(仅用于观察,不入决策;per pairing_rules.crisis_keywords_boundary)
      crisis_signal: crisisAlert.dataset.signal || "none",
    };
    const all = loadLogs();
    all.push(log);
    saveLogs(all);
    navigate("/checkin/saved");
  });
}

function valenceLabelText(v) {
  const n = Number(v);
  return [null, "很差", "较差", "一般", "较好", "很好"][n] || "一般";
}

function flashCountHint(msg) {
  const el = document.getElementById("psy-tag-count");
  if (!el) return;
  const old = el.textContent;
  el.textContent = msg;
  el.style.color = "var(--psy-warn)";
  setTimeout(() => {
    el.textContent = old;
    el.style.color = "";
  }, 1500);
}

function renderCrisisAlert(host, hitTerm) {
  if (!host) return;
  if (hitTerm) {
    host.dataset.signal = "critical_hit";
    host.innerHTML = `
      <div class="psy-warn-box">
        <h4>⚠ 检测到可能需要支持的表达</h4>
        <p>你刚刚写下的内容,可能与较强烈的情绪相关。如果此刻感到很痛苦或想结束,请记得你不是一个人。</p>
        <p><strong>24 小时心理援助热线</strong>:400-161-9995(北京心理危机研究与干预中心,全国)</p>
        <p class="psy-muted">(本提示仅基于关键词简单匹配,非诊断,可在继续编辑时自动消失。)</p>
      </div>
    `;
  } else {
    host.dataset.signal = "none";
    host.innerHTML = "";
  }
}

// ---------------------------------------------------------------------------
// 视图 3:打卡完成页
// ---------------------------------------------------------------------------

export function renderSaved(root) {
  root.innerHTML = `
    <section class="psy-checkin-saved">
      <h2>✅ 已记录</h2>
      <p>今天的情绪已经记下,记得 <a href="#/checkin">看看最近 7 天</a> 自己的趋势。</p>
      <div class="psy-actions">
        <a href="#/checkin" class="psy-btn">返回打卡首页</a>
        <a href="#/checkin/new" class="psy-btn psy-btn-primary">再打一次卡</a>
        <a href="#/scales" class="psy-btn">去做测评</a>
      </div>
    </section>
  `;
}
