const $ = (s) => document.querySelector(s);
const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

const CAT_COLOR = {
  Comida: "#F59E0B",
  Transporte: "#3B82F6",
  Hogar: "#8B5CF6",
  Entretenimiento: "#EC4899",
  Salud: "#14B8A6",
  Ropa: "#6366F1",
  Servicios: "#0EA5E9",
  Suscripciones: "#EF4444",
  Salario: "#10B981",
  Otros: "#64748B",
  "Sin categoría": "#94A3B8",
};

const state = { summary: null, stats: null, txns: [], month: null };

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: "omit", ...opts });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function fmtMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
}

function catColor(cat) {
  return CAT_COLOR[cat] || CAT_COLOR.Otros;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function lightBg(hex) {
  return `${hex}1F`;
}

function countUp(el, value) {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (el) el.textContent = money.format(value);
    return;
  }
  const dur = 750;
  const start = performance.now();
  function frame(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = money.format(value * eased);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- esqueletos

function skeleton() {
  const txns = Array.from({ length: 5 }, (_, i) => `
    <div class="row" style="animation-delay:${i * 60}ms">
      <div class="sk icon"></div>
      <div class="body">
        <div class="sk h16 w70"></div>
        <div class="sk h12 w40" style="margin-top:7px"></div>
      </div>
      <div class="sk h16 w20"></div>
    </div>`).join("");

  $("#hero").innerHTML = `
    <div class="balance-card">
      <div class="sk h16 w30" style="background:rgba(255,255,255,.16)"></div>
      <div class="sk h40 w60" style="background:rgba(255,255,255,.22);margin:10px 0"></div>
      <div class="sk h16 w50" style="background:rgba(255,255,255,.16)"></div>
    </div>
    <div class="piggy-card">
      <div class="sk h20 w50"></div>
      <div class="sk h20 w90" style="margin-top:14px"></div>
    </div>`;

  $("#totals").innerHTML = `
    <div class="total"><div class="sk h16 w50"></div><div class="sk h24 w70" style="margin-top:6px"></div></div>
    <div class="total"><div class="sk h16 w50"></div><div class="sk h24 w70" style="margin-top:6px"></div></div>`;

  $("#txns").innerHTML = txns;
  $("#categories").innerHTML = `
    <div class="bar-row"><div class="sk h16 w40"></div><div class="sk h16 w70" style="margin-top:10px"></div></div>
    <div class="bar-row"><div class="sk h16 w60"></div><div class="sk h16 w50" style="margin-top:10px"></div></div>
    <div class="bar-row"><div class="sk h16 w30"></div><div class="sk h16 w80" style="margin-top:10px"></div></div>`;
  $("#trend").innerHTML = `<p class="empty">Cargando…</p>`;
  $("#subs").innerHTML = `<p class="empty">Cargando…</p>`;
}

// ---------------------------------------------------------------- render

function renderHero() {
  const { accounts, piggy_banks, allowance } = state.summary;
  const pocketName = allowance?.[0]?.account_name;
  const pocket =
    accounts.find((a) => a.name === pocketName) ||
    accounts.find((a) => a.type === "cash_pocket");

  const hero = $("#hero");
  hero.innerHTML = "";

  if (pocket) {
    const el = document.createElement("div");
    el.className = "balance-card rise";
    el.innerHTML = `
      <div class="label">${escapeHtml(pocket.name)}</div>
      <div class="amount">${money.format(0)}</div>
      <div class="tags">
        <span class="tag">Base ${money.format(allowance?.[0]?.base_amount ?? 0)}</span>
        <span class="tag">Se reinicia cada lunes</span>
      </div>`;
    hero.appendChild(el);
    countUp(el.querySelector(".amount"), Number(pocket.balance));
  }

  piggy_banks.forEach((p, i) => {
    const saved = Number(p.saved_amount);
    const target = Number(p.target_amount) || 1;
    const pct = Math.min(100, Math.round((saved / target) * 100));
    const el = document.createElement("div");
    el.className = "piggy-card rise";
    el.style.animationDelay = `${80 + i * 70}ms`;
    el.innerHTML = `
      <div class="piggy-top">
        <span class="name"><i class="d" style="background:var(--green)"></i>${escapeHtml(p.name)}</span>
        <span class="val"><b>${pct}%</b></span>
      </div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="piggy-foot">
        <span class="saved">${money.format(0)}</span>
        <span>Meta ${money.format(target)}</span>
      </div>`;
    hero.appendChild(el);
    countUp(el.querySelector(".saved"), saved);
  });
}

function renderTotals() {
  const t = state.stats?.totals || { income: 0, expense: 0 };
  $("#totals").innerHTML = `
    <div class="total rise">
      <div class="k"><span class="arr up">&uarr;</span> Ingresos</div>
      <div class="v">${money.format(0)}</div>
    </div>
    <div class="total expense rise" style="animation-delay:60ms">
      <div class="k"><span class="arr down">&darr;</span> Gastos</div>
      <div class="v">${money.format(0)}</div>
    </div>`;
  const vs = $("#totals").querySelectorAll(".v");
  countUp(vs[0], Number(t.income));
  countUp(vs[1], Number(t.expense));
}

function renderTxns() {
  const box = $("#txns");
  if (!state.txns.length) {
    box.innerHTML = `<p class="empty">Sin movimientos este mes.</p>`;
    return;
  }
  box.innerHTML = state.txns
    .map((t, i) => {
      const isIncome = t.tx_type === "income";
      const sign = isIncome ? "+" : t.tx_type === "expense" ? "&#8722;" : "";
      const cls = t.tx_type === "income" ? "income" : t.tx_type === "sweep" ? "sweep" : "expense";
      const title = t.concept || t.category || "Movimiento";
      const isSweep = t.tx_type === "sweep";
      const color = isSweep ? "#94A3B8" : catColor(t.category);
      const glyph = isSweep ? "&#8635;" : (t.category || "?").charAt(0).toUpperCase();
      return `<div class="row rise" style="animation-delay:${Math.min(i, 12) * 35}ms">
        <div class="dot" style="background:${lightBg(color)};color:${color}">${glyph}</div>
        <div class="body">
          <div class="title">${escapeHtml(title)}</div>
          <div class="meta">${fmtDate(t.created_at)} · ${escapeHtml(t.category || "—")} · ${escapeHtml(t.account)}</div>
        </div>
        <div class="amt ${cls}">${sign}${money.format(t.amount)}</div>
      </div>`;
    })
    .join("");
}

function renderCategories() {
  const box = $("#categories");
  const cats = state.stats?.by_category || [];
  if (!cats.length) {
    box.innerHTML = `<p class="empty">Sin gastos registrados este mes.</p>`;
    return;
  }
  const max = Math.max(...cats.map((c) => Number(c.total)));
  box.innerHTML = cats
    .map((c, i) => {
      const total = Number(c.total);
      const pct = Math.max(4, Math.round((total / max) * 100));
      const color = catColor(c.category);
      return `<div class="bar-row rise" style="animation-delay:${Math.min(i, 10) * 45}ms">
        <div class="bar-head">
          <span class="cat"><i class="d" style="background:${color}"></i>${escapeHtml(c.category)}</span>
          <span class="val">${money.format(total)}</span>
        </div>
        <div class="bar-track"><i style="width:${pct}%;background:${color}"></i></div>
      </div>`;
    })
    .join("");
}

function renderTrend() {
  const box = $("#trend");
  const trend = state.stats?.trend || [];
  if (!trend.length) {
    box.innerHTML = `<p class="empty">Aún no hay historial.</p>`;
    return;
  }

  const W = 600, H = 200, padX = 8, padTop = 14, padBottom = 18;
  const max = Math.max(1, ...trend.flatMap((m) => [Number(m.income), Number(m.expense)]));
  const innerH = H - padTop - padBottom;
  const n = trend.length;
  const y = (v) => padTop + innerH - (Number(v) / max) * innerH;
  const x = (i) => (n === 1 ? W / 2 : padX + i * ((W - padX * 2) / (n - 1)));

  const ptsInc = trend.map((m, i) => `${x(i).toFixed(1)},${y(m.income).toFixed(1)}`).join(" ");
  const ptsExp = trend.map((m, i) => `${x(i).toFixed(1)},${y(m.expense).toFixed(1)}`).join(" ");
  const baseline = H - padBottom;
  const areaInc = `M ${x(0).toFixed(1)} ${baseline} L ${ptsInc} L ${x(n - 1).toFixed(1)} ${baseline} Z`;
  const areaExp = `M ${x(0).toFixed(1)} ${baseline} L ${ptsExp} L ${x(n - 1).toFixed(1)} ${baseline} Z`;
  const grid = [0.25, 0.5, 0.75, 1]
    .map((k) => `M 0 ${(padTop + innerH * k).toFixed(1)} L ${W} ${(padTop + innerH * k).toFixed(1)}`)
    .join(" ");

  box.innerHTML = `
    <div class="chart-view rise" id="trend-chart">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="chart">
        <defs>
          <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#10B981" stop-opacity=".26"/>
            <stop offset="1" stop-color="#10B981" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#EF4444" stop-opacity=".18"/>
            <stop offset="1" stop-color="#EF4444" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <g class="grid"><line x1="0" y1="0" x2="${W}" y2="0"/><path d="${grid}"/></g>
        <path class="area inc" d="${areaInc}"/>
        <path class="area exp" d="${areaExp}"/>
        <path class="line inc" d="M ${ptsInc}"/>
        <path class="line exp" d="M ${ptsExp}"/>
      </svg>
      <div class="mlabels">${trend.map((m) => `<span>${fmtMonth(m.ym)}</span>`).join("")}</div>
      <div class="hdots"></div>
      <div class="tt" hidden></div>
    </div>`;

  const view = box.querySelector(".chart-view");
  const svg = view.querySelector(".chart");
  const hdots = view.querySelector(".hdots");
  const tt = view.querySelector(".tt");

  const data = trend.map((m, i) => ({
    x: x(i),
    inc: Number(m.income),
    exp: Number(m.expense),
    yi: y(m.income),
    ye: y(m.expense),
    ym: m.ym,
  }));

  hdots.innerHTML = data
    .map(
      (d, i) =>
        `<span class="hdot hd-inc" data-i="${i}" style="left:${((d.x / W) * 100).toFixed(2)}%;top:${((d.yi / H) * 100).toFixed(2)}%"></span>` +
        `<span class="hdot hd-exp" data-i="${i}" style="left:${((d.x / W) * 100).toFixed(2)}%;top:${((d.ye / H) * 100).toFixed(2)}%"></span>`
    )
    .join("");

  const dots = hdots.querySelectorAll(".hdot");

  function nearest(px) {
    const c = Math.max(0, Math.min(W, px));
    let best = 0, bd = Infinity;
    data.forEach((d, i) => {
      const dd = Math.abs(d.x - c);
      if (dd < bd) { bd = dd; best = i; }
    });
    return best;
  }

  function show(i) {
    const d = data[i];
    tt.hidden = false;
    tt.style.left = `calc(${((d.x / W) * 100).toFixed(1)}% - 54px)`;
    tt.style.top = `${Math.max(2, Math.min((Math.min(d.yi, d.ye) / H) * 100, 70)).toFixed(1)}%`;
    tt.innerHTML =
      `<div class="tt-m">${fmtMonth(d.ym)}</div>` +
      `<div class="tt-r"><i class="d inc"></i>${money.format(d.inc)}</div>` +
      `<div class="tt-r"><i class="d exp"></i>${money.format(d.exp)}</div>`;
    dots.forEach((c) => c.classList.toggle("on", Number(c.dataset.i) === i));
  }

  function hide() {
    tt.hidden = true;
    dots.forEach((c) => c.classList.remove("on"));
  }

  view.addEventListener("pointermove", (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    show(nearest(px));
  });
  view.addEventListener("pointerleave", hide);
  show(n - 1);
}

function renderSubs() {
  const box = $("#subs");
  const subs = (state.summary?.subscriptions || []).filter((s) => s.is_active);
  if (!subs.length) {
    box.innerHTML = `<p class="empty">Sin suscripciones activas.</p>`;
    return;
  }
  box.innerHTML = subs
    .map(
      (s, i) => `<div class="row rise" style="animation-delay:${Math.min(i, 8) * 45}ms">
        <div class="dot" style="background:#6366F11F;color:#6366F1">&#8635;</div>
        <div class="body">
          <div class="title">${escapeHtml(s.name)}</div>
          <div class="meta">Día ${s.billing_day} · ${escapeHtml(s.account_name)}</div>
        </div>
        <div class="amt">${money.format(s.amount)}</div>
      </div>`
    )
    .join("");
}

function renderMonthOptions() {
  const sel = $("#month");
  const months = (state.stats?.trend || []).map((m) => m.ym);
  if (state.month && !months.includes(state.month)) months.push(state.month);
  months.sort().reverse();
  sel.innerHTML = months
    .map((m) => `<option value="${m}" ${m === state.month ? "selected" : ""}>${fmtMonth(m)}</option>`)
    .join("");
}

// ---------------------------------------------------------------- datos

async function load() {
  skeleton();
  try {
    const summary = await api("/api/summary");
    state.summary = summary;

    let month = state.month;
    if (!month) {
      const stats0 = await api("/api/stats");
      const ymCol = (stats0.trend || []).map((m) => m.ym);
      const now = new Date();
      const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      month = ymCol.includes(current) ? current : (ymCol.sort().reverse()[0] || current);
      state.month = month;
    }

    const [stats, txns] = await Promise.all([
      api(`/api/stats?month=${encodeURIComponent(month)}`),
      api(`/api/transactions?month=${encodeURIComponent(month)}&limit=200`),
    ]);
    state.stats = stats;
    state.txns = txns.items || [];

    renderHero();
    renderMonthOptions();
    renderTotals();
    renderTxns();
    renderCategories();
    renderTrend();
    renderSubs();
    $("#updated").textContent = `Actualizado ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
    $("#err").hidden = true;
  } catch {
    $("#hero").innerHTML = "";
    $("#totals").innerHTML = "";
    $("#txns").innerHTML = "";
    $("#err").hidden = false;
  }
}

// ---------------------------------------------------------------- interacción

$("#month").addEventListener("change", async (e) => {
  state.month = e.target.value;
  const [stats, txns] = await Promise.all([
    api(`/api/stats?month=${encodeURIComponent(state.month)}`),
    api(`/api/transactions?month=${encodeURIComponent(state.month)}&limit=200`),
  ]);
  state.stats = stats;
  state.txns = txns.items || [];
  renderTotals();
  renderTxns();
  renderCategories();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
}

load();