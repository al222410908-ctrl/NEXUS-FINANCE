const $ = (s) => document.querySelector(s);
const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

const CAT_ICON = {
  Comida: "🍔", Transporte: "⛽", Hogar: "🏠", Entretenimiento: "🎬",
  Salud: "💊", Ropa: "👕", Servicios: "💡", Suscripciones: "🔁",
  Salario: "💼", Otros: "🏷️", "Sin categoría": "🏷️",
};

const state = { summary: null, stats: null, txns: [], month: null };
let PW = sessionStorage.getItem("nx_pw") || "";

async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  if (PW) headers.set("x-dashboard-token", PW);
  const res = await fetch(path, { credentials: "omit", ...opts, headers });
  if (res.status === 401) {
    PW = "";
    sessionStorage.removeItem("nx_pw");
    showLogin();
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function showLogin() {
  $("#app").hidden = true;
  $("#login").hidden = false;
  $("#password").focus();
}

function showApp() {
  $("#login").hidden = true;
  $("#app").hidden = false;
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function fmtMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
}

// ---------------------------------------------------------------- rendering

function renderHero() {
  const { accounts, piggy_banks, allowance } = state.summary;
  const pocketName = allowance?.[0]?.account_name;
  const pocket =
    accounts.find((a) => a.name === pocketName) ||
    accounts.find((a) => a.type === "cash_pocket");

  const hero = $("#hero");
  hero.innerHTML = "";

  if (pocket) {
    const card = document.createElement("div");
    card.className = "balance-card";
    card.innerHTML = `
      <div class="label">${pocket.name}</div>
      <div class="amount">${money.format(pocket.balance)}</div>
      <div class="sub">Se reinicia cada lunes · base ${money.format(allowance?.[0]?.base_amount ?? 0)}</div>`;
    hero.appendChild(card);
  }

  for (const p of piggy_banks) {
    const saved = Number(p.saved_amount);
    const target = Number(p.target_amount) || 1;
    const pct = Math.min(100, Math.round((saved / target) * 100));
    const card = document.createElement("div");
    card.className = "piggy-card";
    card.innerHTML = `
      <div class="piggy-top">
        <span class="name">🐖 ${p.name}</span>
        <span class="val">${pct}%</span>
      </div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="piggy-foot"><span>${money.format(saved)}</span><span>meta ${money.format(target)}</span></div>`;
    hero.appendChild(card);
  }
}

function renderTotals() {
  const t = state.stats?.totals || { income: 0, expense: 0 };
  $("#totals").innerHTML = `
    <div class="total income"><div class="k">Ingresos del mes</div><div class="v">${money.format(t.income)}</div></div>
    <div class="total expense"><div class="k">Gastos del mes</div><div class="v">${money.format(t.expense)}</div></div>`;
}

function renderTxns() {
  const box = $("#txns");
  if (!state.txns.length) {
    box.innerHTML = `<p class="empty">Sin movimientos este mes.</p>`;
    return;
  }
  box.innerHTML = state.txns
    .map((t) => {
      const isIncome = t.tx_type === "income";
      const sign = isIncome ? "+" : t.tx_type === "expense" ? "−" : "";
      const cls = t.tx_type === "income" ? "income" : t.tx_type === "sweep" ? "sweep" : "expense";
      const title = t.concept || t.category || "Movimiento";
      const icon = CAT_ICON[t.category] || "💸";
      return `<div class="row">
        <div class="icon">${icon}</div>
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
    .map((c) => {
      const total = Number(c.total);
      const pct = Math.max(4, Math.round((total / max) * 100));
      return `<div class="bar-row">
        <div class="bar-head"><span class="cat">${CAT_ICON[c.category] || "🏷️"} ${escapeHtml(c.category)}</span><span class="val">${money.format(total)}</span></div>
        <div class="bar-track"><i style="width:${pct}%"></i></div>
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
  const max = Math.max(1, ...trend.flatMap((m) => [Number(m.income), Number(m.expense)]));
  box.innerHTML = trend
    .map((m) => {
      const h = (v) => Math.max(3, Math.round((Number(v) / max) * 110));
      return `<div class="col">
        <div class="pair">
          <div class="bar income" style="height:${h(m.income)}px" title="Ingresos ${money.format(m.income)}"></div>
          <div class="bar expense" style="height:${h(m.expense)}px" title="Gastos ${money.format(m.expense)}"></div>
        </div>
        <div class="m">${fmtMonth(m.ym)}</div>
      </div>`;
    })
    .join("");
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
      (s) => `<div class="row">
        <div class="icon">🔁</div>
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------------------------------------------------------------- data load

async function load() {
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
}

// ---------------------------------------------------------------- boot

async function boot() {
  try {
    await api("/api/session");
    showApp();
    await load();
  } catch {
    /* Sin sesión válida: api() ya mostró el login */
  }
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#login-error");
  err.hidden = true;
  const pwd = $("#password").value.trim();
  if (!pwd) {
    err.textContent = "Escribe tu contraseña.";
    err.hidden = false;
    return;
  }
  try {
    await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    PW = pwd;
    sessionStorage.setItem("nx_pw", pwd);
    $("#password").value = "";
    showApp();
    await load();
  } catch (e2) {
    // 401 (o cualquier fallo tras login) cae aquí.
    err.textContent = "Contraseña incorrecta. Pega el token exacto (respetando mayúsculas).";
    err.hidden = false;
  }
});

$("#logout").addEventListener("click", async () => {
  PW = "";
  sessionStorage.removeItem("nx_pw");
  await fetch("/api/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
  showLogin();
});

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
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

boot();
