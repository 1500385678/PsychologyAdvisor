// 心理顾问 · 情绪日历视图业务模块
// 2026-09-12 T3 立 · Phase 1 #3 "情绪日历视图"(日色块 / 30天折线 / 标签云)
// 0 依赖 · 纯 ES Module · 数据源: localStorage.psy_checkin_logs_v1(与 checkin.js 共用 key · 无后端)
//
// 视图:
//   renderCalendar(root)         30 天日历主视图(5×6 日色块 + 30天 SVG 折线 + 标签云 + 月份切换)
//   renderDayDetail(root, date)  某日详情(当天所有打卡记录列表,支持一天多次打卡)
//
// 视觉规则:
//   - 日色块: 按当日 valence(取当天最后一条)1-5 染 5 档色,负向冷青 / 中性灰 / 正向绿
//   - 30 天折线: 纯 SVG viewBox 600×120,无依赖图表库
//   - 标签云: 最近 30 天所有 tag 按频次排序,字号 12-22 px
//   - 月份切换: 左右箭头 ±30 天,标题"2026-09-12 → 2026-10-11"
//
// 与 checkin.js 的协作边界:
//   - 仅读取: localStorage(同 key,跨视图共享)
//   - 不写: 不修改 localStorage(写入仍走 checkin.js 提交)
//   - 不引: data/ 资产(纯消费 localStorage,避免重读 mood_tags.json)

import { escapeHtml, navigate } from "./router.js";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const STORAGE_KEY = "psy_checkin_logs_v1"; // 与 checkin.js 保持一致
const DAYS_PER_VIEW = 30; // 一次看 30 天
const GRID_COLS = 6; // 5×6 = 30 网格
const VALENCE_COLORS = {
  1: "#0f766e", // 很差 - 深青
  2: "#14b8a6", // 较差 - 中青
  3: "#9ca3af", // 一般 - 中性灰
  4: "#5eead4", // 较好 - 浅绿青
  5: "#0d9488", // 很好 - 深绿
};
const VALENCE_LABELS = {
  1: "很差",
  2: "较差",
  3: "一般",
  4: "较好",
  5: "很好",
};

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

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

function pad2(n) {
  return String(n).padStart(2, "0");
}

// ISO yyyy-mm-dd · 用本地时区(避免 toISOString 的 UTC 偏移陷阱)
function toIso(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 当前锚点(从 URL hash 读 ?anchor= 或默认今天)
function getAnchorFromHash() {
  const m = window.location.hash.match(/[?&]anchor=(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return toIso(new Date());
}

function parseIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// 起止 30 天列表(从 anchor 往前数 29 天 + anchor = 30 天)
function buildRange(anchorIso) {
  const anchor = parseIso(anchorIso);
  const days = [];
  for (let i = DAYS_PER_VIEW - 1; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    days.push(toIso(d));
  }
  return days;
}

// 上一锚 / 下一锚(各推 30 天)
function shiftAnchor(anchorIso, deltaDays) {
  const d = parseIso(anchorIso);
  d.setDate(d.getDate() + deltaDays);
  return toIso(d);
}

// 把 logs 按 date 分桶;同一天多条取最后一条作为"当日代表"(用于日色块 + 折线)
function bucketByDate(logs) {
  const byDate = new Map();
  for (const log of logs) {
    if (!log || !log.date) continue;
    const list = byDate.get(log.date) || [];
    list.push(log);
    byDate.set(log.date, list);
  }
  return byDate;
}

function lastOfDay(bucket) {
  if (!bucket || !bucket.length) return null;
  return bucket[bucket.length - 1];
}

function avgValence(bucket) {
  if (!bucket || !bucket.length) return null;
  const sum = bucket.reduce((a, l) => a + (Number(l.valence) || 0), 0);
  return sum / bucket.length;
}

// 最近 30 天 tag 频次统计
function tagFrequency(logs, rangeDays) {
  const rangeSet = new Set(rangeDays);
  const freq = new Map();
  for (const log of logs) {
    if (!rangeSet.has(log.date)) continue;
    for (const t of log.tags || []) {
      if (!t.term) continue;
      const key = t.term;
      const cur = freq.get(key) || { term: key, count: 0, intensity: t.intensity, valence: t.valence };
      cur.count += 1;
      freq.set(key, cur);
    }
  }
  return Array.from(freq.values()).sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// SVG 30 天折线(0 依赖图表)
// ---------------------------------------------------------------------------

function buildSparkline(rangeDays, byDate) {
  const W = 600;
  const H = 120;
  const padX = 8;
  const padY = 12;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  // 1-5 → y(高 = 5, 低 = 1) 反转
  const yFor = (v) => padY + innerH - ((v - 1) / 4) * innerH;
  const xFor = (i) => padX + (i / (rangeDays.length - 1)) * innerW;

  // 取点:有数据的日子画点 + 连线
  const points = rangeDays
    .map((iso, i) => {
      const bucket = byDate.get(iso);
      const rep = lastOfDay(bucket);
      return rep ? { x: xFor(i), y: yFor(rep.valence), v: rep.valence, iso } : null;
    })
    .filter(Boolean);

  // 多边形路径
  const linePath =
    points.length >= 2
      ? `M ${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")}`
      : "";

  // 网格横线(v=1, 3, 5 三条)
  const gridLines = [1, 3, 5]
    .map(
      (v) =>
        `<line x1="${padX}" y1="${yFor(v).toFixed(1)}" x2="${(W - padX).toFixed(1)}" y2="${yFor(v).toFixed(1)}" stroke="#e5e7eb" stroke-dasharray="2 4" />`
    )
    .join("");

  // 纵轴标签
  const yLabels = [1, 3, 5]
    .map(
      (v) =>
        `<text x="${padX - 2}" y="${(yFor(v) + 3).toFixed(1)}" font-size="10" fill="#9ca3af" text-anchor="end">${v}</text>`
    )
    .join("");

  // 点 + 标签
  const dots = points
    .map(
      (p) =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${VALENCE_COLORS[p.v]}" stroke="#fff" stroke-width="1.5"><title>${p.iso} · ${VALENCE_LABELS[p.v]}</title></circle>`
    )
    .join("");

  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="psy-sparkline" aria-label="30 天情绪折线">
      ${gridLines}
      ${yLabels}
      ${linePath ? `<path d="${linePath}" fill="none" stroke="#0d9488" stroke-width="1.5" />` : ""}
      ${dots}
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// 视图 1:30 天日历主视图
// ---------------------------------------------------------------------------

export async function renderCalendar(root) {
  root.innerHTML = `<p class="psy-loading">正在加载情绪日历…</p>`;

  const logs = loadLogs();
  const anchorIso = getAnchorFromHash();
  const rangeDays = buildRange(anchorIso);
  const byDate = bucketByDate(logs);
  const rangeSet = new Set(rangeDays);

  // 区间内日志
  const inRangeReal = logs.filter((l) => rangeSet.has(l.date));

  // 日色块(30 个)
  const cellHtml = rangeDays
    .map((iso) => {
      const bucket = byDate.get(iso);
      const rep = lastOfDay(bucket);
      const avg = avgValence(bucket);
      const v = rep ? rep.valence : null;
      const fill = v ? VALENCE_COLORS[v] : "transparent";
      const border = bucket && bucket.length ? "1px solid " + fill : "1px dashed #d1d5db";
      const isToday = iso === toIso(new Date());
      const dayNum = parseInt(iso.split("-")[2], 10);
      return `
        <a href="#/calendar/day/${iso}" class="psy-day-cell ${rep ? "has-data" : ""} ${isToday ? "is-today" : ""}"
           style="--cell-fill:${fill}; border:${border};" title="${iso}${rep ? " · " + VALENCE_LABELS[rep.valence] + (bucket.length > 1 ? " · " + bucket.length + " 条" : "") : " · 无打卡"}">
          <span class="psy-day-num">${dayNum}</span>
          ${bucket && bucket.length > 1 ? `<span class="psy-day-count">${bucket.length}</span>` : ""}
          ${avg && bucket && bucket.length > 1 ? `<span class="psy-day-avg">均 ${avg.toFixed(1)}</span>` : ""}
        </a>
      `;
    })
    .join("");

  // 30 天折线
  const sparkline = buildSparkline(rangeDays, byDate);

  // 标签云(频次前 20)
  const tags = tagFrequency(inRangeReal, rangeDays).slice(0, 20);
  const maxCount = tags.length ? tags[0].count : 1;
  const tagCloudHtml = tags.length
    ? tags
        .map((t) => {
          const size = 12 + (t.count / maxCount) * 10; // 12-22 px
          const color = t.valence === "negative" ? "#0f766e" : t.valence === "positive" ? "#0d9488" : "#6b7280";
          return `<span class="psy-tag-cloud-item" style="font-size:${size.toFixed(1)}px; color:${color};" title="${escapeHtml(t.term)} · ${t.count} 次">${escapeHtml(t.term)} <small>${t.count}</small></span>`;
        })
        .join("")
    : `<p class="psy-muted">最近 30 天还没有任何标签,先去 <a href="#/checkin/new">打个卡</a> 吧 🌱</p>`;

  // 区间统计
  const totalLogs = inRangeReal.length;
  const activeDays = inRangeReal.length
    ? new Set(inRangeReal.map((l) => l.date)).size
    : 0;
  const avgV = inRangeReal.length
    ? (
        inRangeReal.reduce((a, l) => a + (Number(l.valence) || 0), 0) / inRangeReal.length
      ).toFixed(2)
    : "—";

  // 标题 + 月份切换
  const prevIso = shiftAnchor(anchorIso, -DAYS_PER_VIEW);
  const nextIso = shiftAnchor(anchorIso, DAYS_PER_VIEW);
  const firstDay = rangeDays[0];
  const lastDay = rangeDays[rangeDays.length - 1];

  root.innerHTML = `
    <section class="psy-calendar">
      <div class="psy-calendar-head">
        <h2>情绪日历</h2>
        <p class="psy-hint">滑动条 + 日色块 + 标签云,从 30 天尺度看自己的情绪轮廓。</p>
        <div class="psy-calendar-nav">
          <a href="#/calendar?anchor=${prevIso}" class="psy-btn">← 前 30 天</a>
          <span class="psy-calendar-title">${firstDay} → ${lastDay}</span>
          <a href="#/calendar?anchor=${nextIso}" class="psy-btn">后 30 天 →</a>
          <a href="#/calendar" class="psy-btn">回到今天</a>
        </div>
      </div>

      <div class="psy-calendar-stats">
        <span><strong>${totalLogs}</strong> 次打卡</span>
        <span><strong>${activeDays}</strong> 天有记录 / ${DAYS_PER_VIEW} 天</span>
        <span>平均感受 <strong>${avgV}</strong> / 5</span>
        <span>共 <strong>${tags.length}</strong> 个不同标签</span>
      </div>

      <h3>30 天折线</h3>
      <div class="psy-sparkline-wrap">${sparkline}</div>
      <div class="psy-legend">
        ${[1, 2, 3, 4, 5]
          .map((v) => `<span class="psy-legend-item"><span class="psy-legend-dot" style="background:${VALENCE_COLORS[v]}"></span>${v} ${VALENCE_LABELS[v]}</span>`)
          .join("")}
      </div>

      <h3>日色块(点击查看某天详情)</h3>
      <div class="psy-day-grid">${cellHtml}</div>

      <h3>最近 30 天 · 标签云</h3>
      <div class="psy-tag-cloud">${tagCloudHtml}</div>

      <p class="psy-actions">
        <a href="#/checkin" class="psy-btn">返回打卡首页</a>
        <a href="#/checkin/new" class="psy-btn psy-btn-primary">+ 立即打卡</a>
        <a href="#/scales" class="psy-btn">去做测评</a>
      </p>
      <p class="psy-meta">数据来自 localStorage.psy_checkin_logs_v1 · 区间长度 ${DAYS_PER_VIEW} 天 · ${inRangeReal.length === logs.length ? "" : `总记录 ${logs.length} 条,区间内 ${inRangeReal.length} 条`}</p>
    </section>
  `;
}

// ---------------------------------------------------------------------------
// 视图 2:某日详情
// ---------------------------------------------------------------------------

export function renderDayDetail(root, dateIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso || "")) {
    root.innerHTML = `<p class="psy-error">无效的日期:${escapeHtml(String(dateIso))}</p><p><a href="#/calendar">返回日历</a></p>`;
    return;
  }

  const logs = loadLogs().filter((l) => l.date === dateIso);

  const listHtml = logs.length
    ? logs
        .map((log) => {
          const time = log.timestamp
            ? new Date(log.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
            : "—";
          const tagChips = (log.tags || [])
            .map(
              (t) =>
                `<span class="psy-chip" style="background:${VALENCE_COLORS[t.valence === "negative" ? 1 : t.valence === "positive" ? 5 : 3]}">${escapeHtml(t.term)}</span>`
            )
            .join("");
          return `<li class="psy-log-item">
              <span class="psy-log-date">${escapeHtml(time)}</span>
              <span class="psy-log-valence">${escapeHtml(VALENCE_LABELS[log.valence] || String(log.valence))}</span>
              <span class="psy-log-tags">${tagChips || '<em class="psy-muted">无标签</em>'}</span>
              <span class="psy-log-note">${escapeHtml(log.note || "")}</span>
            </li>`;
        })
        .join("")
    : `<li class="psy-muted">这一天还没有打卡记录,<a href="#/checkin/new">立即补一条</a> 🌱</li>`;

  root.innerHTML = `
    <section class="psy-day-detail">
      <p><a href="#/calendar">← 返回情绪日历</a></p>
      <h2>${escapeHtml(dateIso)} · 打卡详情</h2>
      <p class="psy-hint">点击日历上的某一天查看该日的所有打卡记录(一天可多次打卡,0911 T3 起支持)。</p>
      <ul class="psy-log-list">${listHtml}</ul>
      <p class="psy-actions">
        <a href="#/checkin/new" class="psy-btn psy-btn-primary">+ 当天补打卡</a>
        <a href="#/calendar" class="psy-btn">返回日历</a>
      </p>
    </section>
  `;
}
