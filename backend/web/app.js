const bootBox = () => document.getElementById("root");

window.addEventListener("error", (e) => {
  const root = bootBox();
  if (root) root.innerHTML = "<p class=\"boot\">Error al cargar el panel: " + escapeHtml(e.message || "desconocido") + "</p>";
});

if (!window.React || !window.htm) {
  const root = bootBox();
  if (root) {
    root.innerHTML = "<p class=\"boot\">No se pudieron cargar las librerías del panel (React o htm). Revisa tu conexión a internet y vuelve a cargar.</p>";
  }
  throw new Error("librerias web no disponibles");
}

const { useState, useEffect, useRef, useMemo } = React;
const h = window.htm.bind(React.createElement);

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
  Up: '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>',
  Down: '<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>',
};
SVG["Sin categoría"] = SVG.Otros;

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

function Icon({ cat, size = 19 }) {
  const inner = SVG[cat] || SVG.Otros;
  return h`<svg viewBox="0 0 24 24" width=${size} height=${size} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ...${{ dangerouslySetInnerHTML: { __html: inner } }}></svg>`;
}

function C({ v }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = money.format(Number(v));
      return;
    }
    const target = Number(v);
    const dur = 700;
    const start = performance.now();
    let raf;
    function frame(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = money.format(target * eased);
      if (p < 1) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [v]);
  return h`<span ref=${ref}>${money.format(0)}</span>`;
}

// ---------------------------------------------------------------- cargas

function Sk({ cls, st }) {
  return h`<div className="sk ${cls || ""}" style=${st || {}}></div>`;
}

function LoadingHero() {
  return h`<div className="hero" aria-label="Saldos">
    <div className="balance-card">
      <Sk cls="h16 w30" st=${{ background: "rgba(255,255,255,.1)" }} />
      <Sk cls="h56 w70" st=${{ background: "rgba(255,255,255,.14)", margin: "12px 0" }} />
      <Sk cls="h12 w50" st=${{ background: "rgba(255,255,255,.08)" }} />
    </div>
    <div className="piggy-card">
      <Sk cls="h20 w50" />
      <Sk cls="h12 w90" st=${{ marginTop: 16 }} />
    </div>
  </div>`;
}

function LoadingList({ rows = 4 }) {
  const items = Array.from({ length: rows }, (_, i) =>
    h`<div className="row" key=${i}>
      <Sk cls="icon" />
      <div className="body"><Sk cls="h16 w70" /><Sk cls="h12 w40" st=${{ marginTop: 7 }} /></div>
      <Sk cls="h16 w24" />
    </div>`
  );
  return h`<div className="list">${items}</div>`;
}

// ---------------------------------------------------------------- secciones

function HeroView({ summary }) {
  const { accounts, piggy_banks, allowance } = summary;
  const pocketName = allowance?.[0]?.account_name;
  const pocket =
    accounts.find((a) => a.name === pocketName) ||
    accounts.find((a) => a.type === "cash_pocket");
  const cards = [];

  if (pocket) {
    const base = allowance?.[0]?.base_amount ?? 0;
    cards.push(h`<div className="balance-card rise" key="pocket">
      <div className="label">${escapeHtml(pocket.name)}</div>
      <div className="amount"><C v=${Number(pocket.balance)} /></div>
      <div className="tags">
        <span className="tag">Base ${money.format(base)}</span>
        <span className="tag">Se reinicia cada lunes</span>
      </div>
    </div>`);
  }

  piggy_banks.forEach((p, i) => {
    const saved = Number(p.saved_amount);
    const target = Number(p.target_amount) || 1;
    const pct = Math.min(100, Math.round((saved / target) * 100));
    cards.push(h`<div className="piggy-card rise" key=${"pig" + i} style=${{ animationDelay: `${90 + i * 70}ms` }}>
      <div className="piggy-top">
        <span className="name"><i className="d"></i>${escapeHtml(p.name)}</span>
        <span className="val">${pct}%</span>
      </div>
      <div className="progress"><i style=${{ width: `${pct}%` }}></i></div>
      <div className="piggy-foot">
        <span className="saved"><C v=${saved} /></span>
        <span>Meta ${money.format(target)}</span>
      </div>
    </div>`);
  });

  return h`<section className="hero" aria-label="Saldos">${cards}</section>`;
}

function TotalsView({ stats }) {
  const t = stats?.totals || { income: 0, expense: 0 };
  return h`<section className="totals" aria-label="Totales del mes">
    <div className="total income rise">
      <div className="t-icon"><Icon cat="Up" /></div>
      <div className="body">
        <div className="k">Ingresos</div>
        <div className="v"><C v=${t.income} /></div>
      </div>
    </div>
    <div className="total expense rise" style=${{ animationDelay: "60ms" }}>
      <div className="t-icon"><Icon cat="Down" /></div>
      <div className="body">
        <div className="k">Gastos</div>
        <div className="v"><C v=${t.expense} /></div>
      </div>
    </div>
  </section>`;
}

function TxnsView({ txns }) {
  if (!txns.length) return h`<p className="empty">Sin movimientos este mes.</p>`;
  const rows = txns.map((t, i) => {
    const isIncome = t.tx_type === "income";
    const sign = isIncome ? "+" : t.tx_type === "expense" ? "\u2212" : "";
    const cls = t.tx_type === "income" ? "income" : t.tx_type === "sweep" ? "sweep" : "expense";
    const isSweep = t.tx_type === "sweep";
    const cat = t.category || (isIncome ? "Salario" : isSweep ? "Otros" : "Otros");
    const color = isSweep ? "#64748B" : catColor(cat);
    return h`<div className="row rise" key=${t.id || i} style=${{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
      <span className="dot" style=${{ background: color + "1F", color }}>
        ${isSweep ? h`<Icon cat="Suscripciones" />` : h`<Icon cat=${cat} />`}
      </span>
      <div className="body">
        <div className="title">${escapeHtml(t.concept || t.category || "Movimiento")}</div>
        <div className="meta">${escapeHtml(cat)}</div>
      </div>
      <div className="side">
        <div className="date">${fmtDate(t.created_at)}</div>
        <div className="amt ${cls}">${sign}${money.format(t.amount)}</div>
      </div>
    </div>`;
  });
  return h`<div className="list">${rows}</div>`;
}

function CategoriesView({ cats }) {
  const canvasRef = useRef(null);

  if (!cats.length) return h`<p className="empty">Sin gastos registrados este mes.</p>`;

  const total = cats.reduce((s, c) => s + Number(c.total), 0) || 1;

  useEffect(() => {
    if (!window.Chart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const old = window.Chart.getChart(canvas);
    if (old) old.destroy();
    const chart = new window.Chart(canvas, {
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
              label: (ctx) => ` ${money.format(ctx.parsed)} \u00b7 ${Math.round((ctx.parsed / total) * 100)}%`,
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [cats]);

  if (!window.Chart) {
    const max = Math.max(...cats.map((c) => Number(c.total)));
    return h`<div>${cats.map((c) =>
      h`<div className="cat-row" key=${c.category} style=${{ background: catColor(c.category) + "0D", padding: "8px 10px", borderRadius: 10 }}>
        <i className="cc" style=${{ background: catColor(c.category) }}></i>
        <span className="cn">${escapeHtml(c.category)}</span>
        <span className="cv">${money.format(c.total)}</span>
      </div>`
    )}</div>`;
  }

  return h`<div className="donut-row">
    <div className="donut-box"><canvas ref=${canvasRef} id="catChart" /></div>
    <div className="cat-legend" aria-hidden="true">${cats.map((c) => {
      const pct = Math.round((Number(c.total) / total) * 100);
      return h`<div className="cat-row" key=${c.category}>
        <i className="cc" style=${{ background: catColor(c.category) }}></i>
        <span className="cn">${escapeHtml(c.category)}</span>
        <span className="cv">${money.format(c.total)} \u00b7 ${pct}%</span>
      </div>`;
    })}</div>
  </div>`;
}

function TrendView({ trend }) {
  const canvasRef = useRef(null);

  if (!trend.length) return h`<p className="empty">Aún no hay historial.</p>`;

  useEffect(() => {
    if (!window.Chart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const old = window.Chart.getChart(canvas);
    if (old) old.destroy();
    const chart = new window.Chart(canvas, {
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
    return () => chart.destroy();
  }, [trend]);

  if (!window.Chart) {
    const max = Math.max(1, ...trend.flatMap((m) => [Number(m.income), Number(m.expense)]));
    return h`<div className="chart-fallback rise">${trend.map((m, i) => {
      const hgt = (v) => Math.max(3, Math.round((Number(v) / max) * 150));
      return h`<div className="col rise" key=${m.ym} style=${{ animationDelay: `${i * 50}ms` }}>
        <div className="pair">
          <div className="bar income" style=${{ height: hgt(m.income) }}></div>
          <div className="bar expense" style=${{ height: hgt(m.expense) }}></div>
        </div>
        <div className="m">${fmtMonth(m.ym)}</div>
      </div>`;
    })}</div>`;
  }

  return h`<div className="trend-canvas"><canvas ref=${canvasRef} id="trendChart" /></div>`;
}

function SubsView({ subs }) {
  const active = (subs || []).filter((s) => s.is_active);
  if (!active.length) return h`<p className="empty">Sin suscripciones activas.</p>`;
  const rows = active.map((s, i) =>
    h`<div className="row rise" key=${s.id || i} style=${{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
      <span className="dot" style=${{ background: "#6366F11F", color: "#818CF8" }}><Icon cat="Suscripciones" /></span>
      <div className="body">
        <div className="title">${escapeHtml(s.name)}</div>
        <div className="meta">Día ${s.billing_day}</div>
      </div>
      <div className="side">
        <div className="date">${escapeHtml(s.account_name)}</div>
        <div className="amt">${money.format(s.amount)}</div>
      </div>
    </div>`
  );
  return h`<div className="list compact">${rows}</div>`;
}

function MonthSelect({ month, trend, onMonth }) {
  const months = useMemo(() => {
    const list = (trend || []).map((m) => m.ym);
    if (month && !list.includes(month)) list.push(month);
    return list.sort().reverse();
  }, [trend, month]);
  const opts = months.map((m) => h`<option value=${m} key=${m}>${fmtMonth(m)}</option>`);
  return h`<select id="month" aria-label="Mes" title="Mes" value=${month || ""} onChange=${(e) => onMonth(e.target.value)}>
    ${opts.length ? opts : h`<option value="">…</option>`}</select>`;
}

// ---------------------------------------------------------------- app

function App() {
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [txns, setTxns] = useState(null);
  const [month, setMonth] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await api("/api/summary");
        setSummary(s);
        const s0 = await api("/api/stats");
        const now = new Date();
        const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const cols = (s0.trend || []).map((m) => m.ym);
        const m = cols.includes(cur) ? cur : (cols.sort().reverse()[0] || cur);
        const [st, tx] = await Promise.all([
          api(`/api/stats?month=${encodeURIComponent(m)}`),
          api(`/api/transactions?month=${encodeURIComponent(m)}&limit=200`),
        ]);
        setMonth(m);
        setStats(st);
        setTxns(tx.items || []);
        setErr(false);
      } catch {
        setErr(true);
      }
    })();
  }, []);

  async function onMonth(m) {
    setMonth(m);
    setErr(false);
    try {
      const [st, tx] = await Promise.all([
        api(`/api/stats?month=${encodeURIComponent(m)}`),
        api(`/api/transactions?month=${encodeURIComponent(m)}&limit=200`),
      ]);
      setStats(st);
      setTxns(tx.items || []);
    } catch {
      setErr(true);
    }
  }

  const topbar = h`<header className="topbar">
    <div className="brand">
      <img src="/icons/icon-192.png" alt="" width="30" height="30" />
      <span>Nexus Finance</span>
    </div>
    <MonthSelect month=${month} trend=${stats?.trend} onMonth=${onMonth} />
  </header>`;

  if (err) {
    return h`<${React.Fragment}>
      ${topbar}
      <main className="wrap"><p className="err">No se pudo cargar el panel. Revisa tu conexión o inténtalo de nuevo.</p></main>
    </${React.Fragment}>`;
  }

  return h`<${React.Fragment}>
    ${topbar}
    <main className="wrap">
      ${summary ? h`<HeroView summary=${summary} />` : h`<LoadingHero />`}
      ${stats ? h`<TotalsView stats=${stats} />` : h`<LoadingList rows=${2} />`}

      <section className="card-section">
        <h2>Movimientos</h2>
        ${txns ? h`<TxnsView txns=${txns} />` : h`<LoadingList />`}
      </section>

      <section className="card-section">
        <h2>Gastos por categoría</h2>
        ${stats ? h`<CategoriesView cats=${stats.by_category || []} />` : h`<p className="empty">Cargando…</p>`}
      </section>

      <section className="card-section">
        <h2>Tendencia</h2>
        <div className="legend">
          <span className="lg"><i className="d inc"></i>Ingresos</span>
          <span className="lg"><i className="d exp"></i>Gastos</span>
        </div>
        ${stats ? h`<TrendView trend=${stats.trend || []} />` : h`<p className="empty">Cargando…</p>`}
      </section>

      <section className="card-section">
        <h2>Suscripciones</h2>
        ${summary ? h`<SubsView subs=${summary.subscriptions || []} />` : h`<p className="empty">Cargando…</p>`}
      </section>

      <p className="updated">Actualizado ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</p>
    </main>
  </${React.Fragment}>`;
}

window.addEventListener("error", (e) => {
  const root = document.getElementById("root");
  if (root) root.innerHTML = '<p class="boot">Error al cargar el panel: ' + escapeHtml(e.message || "desconocido") + "</p>";
});

try {
  ReactDOM.createRoot(document.getElementById("root")).render(h`<App />`);
} catch (e) {
  const root = document.getElementById("root");
  if (root) root.innerHTML = '<p class="boot">Error de arranque: ' + escapeHtml(e.message || String(e)) + "</p>";
}