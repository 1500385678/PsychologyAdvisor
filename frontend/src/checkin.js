// 心理顾问 · 情绪打卡页业务模块
// 2026-09-11 T3 立 · Phase 1 #2 "情绪打卡页"(滑动条 + 标签 + 文字)
// 2026-09-15 T3 接入 Phase 1 #6 '危机检测埋点'(替换 0911 起的 inline warn-box,升级为多级严重程度 + 资源弹窗)
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
import { attachCrisisMonitor } from "./crisis_monitor.js";

// ---------------------------------------------------------------------------
// 数据源(相对路径:index.html 同级 + frontend/ + data/)
// ---------------------------------------------------------------------------

const MOOD_TAGS_URL = "../data/mood_tags.json";
const CRISIS_KW_URL = "../data/crisis_keywords.json"; // 0915 T3 起保留 url 引用(供外部模块调用),本文件不再直接 fetch
const STORAGE_KEY = "psy_checkin_logs_v1";

// ---------------------------------------------------------------------------
// 状态(in-memory cache · 单页会话内复用)
// ---------------------------------------------------------------------------

let _moodTagsCache = null;
// _crisisKwCache 已废弃(0915 T3):危机检测下沉到 crisis_monitor.js 统一处理(attachCrisisMonitor 内部缓存),
// checkin.js 仅在 attachCrisisMonitor 返回值上读 signal 字段写入 log.crisis_signal。

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

// loadCrisisKeywords 已废弃(0915 T3):保留为 no-op 占位避免外部破坏,crisis_monitor.js 自管缓存。
async function loadCrisisKeywords() {
  return null;
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

// 0911 旧的 extractCriticalTerms / matchCrisis / renderCrisisAlert 已废弃(0915 T3):
// 危机检测下沉到 crisis_monitor.js 统一处理(attachCrisisMonitor + openCrisisModal),
// checkin.js 不再直接实现 critical 词条匹配 / inline warn-box。
// 历史实现见 git log e85ef88(0912 T3)及之前。

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

  // 文字输入 + 计数器 + 危机检测(0915 T3 · crisis_monitor.js 接管)
  //   - 旧实现(0911):inline warn-box 仅 critical 子串匹配,见 git log e85ef88 之前
  //   - 新实现(0915):attachCrisisMonitor 接管,多级严重程度 + 否定窗口 + 共病升级 + 资源弹窗
  //   - 本文件保留 crisis_signal 字段供提交时记录,值由 monitor 的 onChange 同步
  const noteEl = root.querySelector("#psy-note");
  const noteCount = root.querySelector("#psy-note-count");
  const crisisAlert = root.querySelector("#psy-crisis-alert");
  let lastSeverity = null; // 记录最近一次命中严重程度(供提交写入 log)
  let monitor = null;
  try {
    monitor = attachCrisisMonitor(noteEl, {
      container: crisisAlert,
      autoOpen: true, // critical 命中自动弹窗(其余级别显示浮动指示器,用户点击或触发后弹)
      onChange: (result) => {
        lastSeverity = result.severity;
        // 同步到 crisisAlert.dataset.signal(用于表单提交时记录)
        // 状态机: none / low / medium / high / critical / critical_upgraded
        crisisAlert.dataset.signal = result.severity
          ? `${result.severity}${result.upgraded ? "_upgraded" : ""}`
          : "none";
      },
    });
  } catch (e) {
    console.error("[checkin] attachCrisisMonitor 失败,降级为无监测", e);
  }

  noteEl.addEventListener("input", () => {
    noteCount.textContent = String((noteEl.value || "").length);
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
      // 危机检测标记(0915 T3:由 crisis_monitor 写入;仅用于观察,不入决策;
      // per pairing_rules.crisis_keywords_boundary)。状态:none / low / medium / high / critical [/ _upgraded]
      crisis_signal: crisisAlert.dataset.signal || "none",
      // 命中词条(0915 T3 新增 · 仅记录供回溯,不参与任何决策)
      crisis_hits: monitor && monitor.getLastResult ? (monitor.getLastResult().hits || []).map((h) => ({
        term: h.term,
        severity: h.severity,
        category: h.category,
      })) : [],
    };
    const all = loadLogs();
    all.push(log);
    saveLogs(all);
    // 卸载监测器(下次进入重新挂)
    if (monitor && monitor.detach) monitor.detach();
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
