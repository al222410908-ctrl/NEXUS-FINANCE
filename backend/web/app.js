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

const SVG = {
  Salario: '<rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>',
  Transporte: '<polyline points="5 11 1 11 4 4 11 4"></polyline><polyline points="19 11 23 11 20 4 13 4"></polyline><line x1="12" y1="14" x2="12" y2="20"></line><line x1="8" y1="20" x2="16" y2="20"></line>',
  Comida: '<path d="M7 2v5M7 12v10M4 12h6"></path><path d="M17 2v20M14 8a4 4 0 0 1 6 0v6h-6z"></path>',
  Hogar: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
  Entretenimiento: '<rect x="2" y="3" width="20" height="18" rx="2"></rect><line x1="2" y1="8" x2="22" y2="8"></line><line x1="7" y1="3" x2="7" y2="8"></line><line x1="17" y1="3" x2="17" y2="8"></line><line x1="7" y1="16" x2="7" y2="21"></line><line x1="17" y1="16" x2="17" y2="21"></line>',
  Salud: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
  Ropa: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 1.1.84l.9-.15a1 1 0 0 0 .88-.72V21a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.13a1 1 0 0 0 .88.71l.9.16a1 1 0 0 0 1.1-.86l.58-3.47a2 2 0 0 0-1.34-2.23Z"></path>',
  Servicios: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
  Suscripciones: '<polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path>',
  Otros: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>',
};
SVG["Sin categoría"] = SVG.Otros;

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

function icon(cat, size = 19) {
  const d = SVG[cat] || SVG.Otros;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

const ARROW_UP = `<svg viewBox="0 0 24 24" class="tx" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
const ARROW_DOWN = `<svg viewBox="0 0 24 24" class="tx" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`;
const REPEAT = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${SVG.Suscripciones}</svg>`;

function countUp(el, value) {
  if (!el) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = money.format(value);
    return;
  }
  const dur = 700;
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
    <div class="row">
      <div class="sk icon"></div>
      <div class="body">
        <div class="sk h16 w70"></div>
        <div class="sk h12 w40" style="margin-top:7px"></div>
      </div>
      <div class="sk h16 w24"></div>
    </div>`).join("");

  $("#hero").innerHTML = `
    <div class="balance-card">
      <div class="sk h16 w30" style="background:rgba(255,255,255,.1)"></div>
      <div class="sk h56 w70" style="background:rgba(255,255,255,.14);margin:12px 0"></div>
      <div class="sk h12 w50" style="background:rgba(255,255,255,.08)"></div>
    </div>
    <div class="piggy-card">
      <div class="sk h20 w50"></div>
      <div class="sk h12 w90" style="margin-top:16px"></div>
    </div>`;

  $("#totals").innerHTML = `
    <div class="total"><div class="sk icon"></div><div class="body"><div class="sk h12 w50"></div><div class="sk h20 w80" style="margin-top:6px"></div></div></div>
    <div class="total"><div class="sk icon"></div><div class="body"><div class="sk h12 w50"></div><div class="sk h20 w80" style="margin-top:6px"></div></div></div>`;

  $("#txns").innerHTML = txns;
  $("#categories").innerHTML = `<p class="empty">Cargando…</p>`;
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
    const base = allowance?.[0]?.base_amount ?? 0;
    el.innerHTML = `
      <div class="label">${escapeHtml(pocket.name)}</div>
      <div class="amount">${money.format(0)}</div>
      <div class="tags">
        <span class="tag">Base ${money.format(base)}</span>
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
    el.style.animationDelay = `${90 + i * 70}ms`;
    el.innerHTML = `
      <div class="piggy-top">
        <span class="name"><i class="d"></i>${escapeHtml(p.name)}</span>
        <span class="val">${pct}%</span>
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
    <div class="total income rise">
      <div class="t-icon">${ARROW_UP}</div>
      <div class="body">
        <div class="k">Ingresos</div>
        <div class="v">${money.format(0)}</div>
      </div>
    </div>
    <div class="total expense rise" style="animation-delay:60ms">
      <div class="t-icon">${ARROW_DOWN}</div>
      <div class="body">
        <div class="k">Gastos</div>
        <div class="v">${money.format(0)}</div>
      </div>
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
      const isSweep = t.tx_type === "sweep";
      const title = t.concept || t.category || "Movimiento";
      const cat = t.category || (isIncome ? "Salario" : isSweep ? "Otros" : "Otros");
      const color = isSweep ? "#64748B" : catColor(cat);
      return `<div class="row rise" style="animation-delay:${Math.min(i, 12) * 35}ms">
        <div class="dot" style="background:${color}1F;color:${color}">${isSweep ? REPEAT : icon(cat)}</div>
        <div class="body">
          <div class="title">${escapeHtml(title)}</div>
          <div class="meta">${escapeHtml(cat)}</div>
        </div>
        <div class="side">
          <div class="date">${fmtDate(t.created_at)}</div>
          <div class="amt ${cls}">${sign}${money.format(t.amount)}</div>
        </div>
      </div>`;
    })
    .join("");
}

function destroyChart(id) {
  const el = document.getElementById(id);
  if (el && window.Chart && window.Chart.getChart(el)) window.Chart.getChart(el).destroy();
}

function renderCategories() {
  const box = $("#categories");
  const cats = state.stats?.by_category || [];
  if (!cats.length) {
    box.innerHTML = `<p class="empty">Sin gastos registrados este mes.</p>`;
    return;
  }
  const total = cats.reduce((s, c) => s + Number(c.total), 0) || 1;

  if (!window.Chart) {
    const max = Math.max(...cats.map((c) => Number(c.total)));
    box.innerHTML = cats
      .map((c) => {
        const pct = Math.max(4, Math.round((Number(c.total) / max) * 100));
        const color = catColor(c.category);
        return `<div class="cat-row" style="background:${color}0D;padding:8px 10px;border-radius:10px"><i class="cc" style="background:${color}"></i>
          <span class="cn">${escapeHtml(c.category)}</span>
          <span class="cv">${money.format(c.total)}</span></div>`;
      })
      .join("");
    return;
  }

  destroyChart("catChart");
  box.innerHTML = `
    <div class="donut-box rise"><canvas id="catChart"></canvas></div>
    <div id="catLegend" class="cat-legend rise" style="animation-delay:80ms"></div>`;

  new Chart(document.getElementById("catChart"), {
    type: "doughnut",
    data: {
      labels: cats.map((c) => c.category),
      datasets: [{
        data: cats.map((c) => Number(c.total)),
        backgroundColor: cats.map((c) => catColor(c.category)),
        borderColor: "#1E293B",
        borderWidth: 5,
        hoverOffset: 7,
      }],
    },
    options: {
      cutout: "72%",
      maintainAspectRatio: false,
      animation: { animateRotate: true, animateScale: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0B1220",
          borderColor: "rgba(255,255,255,.08)",
          borderWidth: 1,
          titleColor: "#fff",
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => ` ${money.format(ctx.parsed)} · ${Math.round((ctx.parsed / total) * 100)}%`,
          },
        },
      },
    },
  });

  document.getElementById("catLegend").innerHTML = cats
    .map((c) => {
      const pct = Math.round((Number(c.total) / total) * 100);
      return `<div class="cat-row"><i class="cc" style="background:${catColor(c.category)}"></i>
        <span class="cn">${escapeHtml(c.category)}</span>
        <span class="cv">${money.format(c.total)} · ${pct}%</span></div>`;
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

  if (!window.Chart) {
    const max = Math.max(1, ...trend.flatMap((m) => [Number(m.income), Number(m.expense)]));
    box.innerHTML = `<div class="chart-fallback rise">${trend
      .map((m, i) => {
        const h = (v) => Math.max(3, Math.round((Number(v) / max) * 150));
        return `<div class="col rise" style="animation-delay:${i * 50}ms">
          <div class="pair">
            <div class="bar income" style="height:${h(m.income)}px"></div>
            <div class="bar expense" style="height:${h(m.expense)}px"></div>
          </div>
          <div class="m">${fmtMonth(m.ym)}</div>
        </div>`;
      })
      .join("")}</div>`;
    return;
  }

  destroyChart("trendChart");
  box.innerHTML = `<canvas id="trendChart" class="rise"></canvas>`;

  new Chart(document.getElementById("trendChart"), {
    type: "bar",
    data: {
      labels: trend.map((m) => fmtMonth(m.ym)),
      datasets: [
        { label: "Ingresos", data: trend.map((m) => Number(m.income)), backgroundColor: "#10B981", borderRadius: 5, barPercentage: 0.55, categoryPercentage: 0.66 },
        { label: "Gastos", data: trend.map((m) => Number(m.expense)), backgroundColor: "#EF4444", borderRadius: 5, barPercentage: 0.55, categoryPercentage: 0.66 },
      ],
    },
    options: {
      maintainAspectRatio: false,
      animation: { duration: 700, easing: "easeOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0B1220",
          borderColor: "rgba(255,255,255,.08)",
          borderWidth: 1,
          titleColor: "#fff",
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${money.format(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748B", font: { size: 10 } } },
        y: {
          grid: { color: "rgba(255,255,255,.06)" },
          ticks: {
            color: "#64748B",
            font: { size: 10 },
            callback: (v) => "$" + Number(v).toLocaleString("es-MX"),
          },
        },
      },
    },
  });
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
        <div class="dot" style="background:#6366F11F;color:#818CF8">${REPEAT}</div>
        <div class="body">
          <div class="title">${escapeHtml(s.name)}</div>
          <div class="meta">Día ${s.billing_day} · ${escapeHtml(s.account_name)}</div>
        </div>
        <div class="side">
          <div class="date">${escapeHtml(s.account_name)}</div>
          <div class="amt">${money.format(s.amount)}</div>
        </div>
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