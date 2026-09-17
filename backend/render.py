# render.py — Pinta el panel de Nexus como HTML del servidor (SSR).
# El contenido queda visible AUNQUE JavaScript no funcione. React/Chart.js
# solo lo mejoran encima. Sin secretos: solo datos de lectura.
import html
import json
import time
from pathlib import Path

WEB_DIR = Path(__file__).parent / "web"

CAT_COLOR = {
    "Comida": "#F59E0B",
    "Transporte": "#3B82F6",
    "Hogar": "#8B5CF6",
    "Entretenimiento": "#EC4899",
    "Salud": "#14B8A6",
    "Ropa": "#6366F1",
    "Servicios": "#0EA5E9",
    "Suscripciones": "#EF4444",
    "Salario": "#10B981",
    "Otros": "#64748B",
    "Sin categoría": "#94A3B8",
}

_ICONS = {
    "Salario": '<rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>',
    "Transporte": '<polyline points="5 11 1 11 4 4 11 4"></polyline><polyline points="19 11 23 11 20 4 13 4"></polyline><line x1="12" y1="14" x2="12" y2="20"></line><line x1="8" y1="20" x2="16" y2="20"></line>',
    "Comida": '<path d="M7 2v5M7 12v10M4 12h6"></path><path d="M17 2v20M14 8a4 4 0 0 1 6 0v6h-6z"></path>',
    "Hogar": '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
    "Entretenimiento": '<rect x="2" y="3" width="20" height="18" rx="2"></rect><line x1="2" y1="8" x2="22" y2="8"></line><line x1="7" y1="3" x2="7" y2="8"></line><line x1="17" y1="3" x2="17" y2="8"></line><line x1="7" y1="16" x2="7" y2="21"></line><line x1="17" y1="16" x2="17" y2="21"></line>',
    "Salud": '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
    "Ropa": '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 1.1.84l.9-.15a1 1 0 0 0 .88-.72V21a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.13a1 1 0 0 0 .88.71l.9.16a1 1 0 0 0 1.1-.86l.58-3.47a2 2 0 0 0-1.34-2.23Z"></path>',
    "Servicios": '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
    "Suscripciones": '<polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path>',
    "Otros": '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>',
    "Up": '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>',
    "Down": '<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>',
}
_ICONS["Sin categoría"] = _ICONS["Otros"]

_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

VERSION = "v17"


def esc(s):
    return html.escape(str(s), quote=True)


def money(v):
    try:
        return "${:,.2f}".format(float(v or 0))
    except (TypeError, ValueError):
        return "$0.00"


def cat_color(cat):
    return CAT_COLOR.get(cat, CAT_COLOR["Otros"])


def svg(cat, size=19, sw=1.7):
    inner = _ICONS.get(cat, _ICONS["Otros"])
    return (
        f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" '
        f'stroke="currentColor" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{inner}</svg>'
    )


def fmt_date(value):
    try:
        dt = value if hasattr(value, "strftime") else (value.isoformat() if value else "")
        s = dt.strftime("%Y-%m-%d") if hasattr(value, "strftime") else str(value)[:10]
        y, m, d = s.split("-")
        return f"{int(d):02d} {_MESES[int(m) - 1]}"
    except Exception:
        return esc(value)[:12]


def fmt_month(ym):
    try:
        y, m = str(ym).split("-")
        return f"{_MESES[int(m) - 1]} {str(y)[-2:]}"
    except Exception:
        return esc(ym)


def _total_row(t4, income):
    color = "#10B981" if income else "#EF4444"
    icon = svg("Up" if income else "Down")
    return (
        f'<div class="total {"income" if income else "expense"}">'
        f'<div class="t-icon">{icon}</div>'
        f'<div class="body"><div class="k">{"Ingresos" if income else "Gastos"}</div>'
        f'<div class="v">{money(t4.get("income" if income else "expense", 0))}</div></div></div>'
    )


def _hero(summary):
    accounts = summary.get("accounts") or []
    piggy = summary.get("piggy_banks") or []
    allowance = summary.get("allowance") or []
    pocket_name = allowance[0].get("account_name") if allowance else None
    pocket = next((a for a in accounts if a.get("name") == pocket_name), None)
    if pocket is None:
        pocket = next((a for a in accounts if a.get("type") == "cash_pocket"), None)

    cards = ""
    if pocket:
        base = float((allowance[0] if allowance else {}).get("base_amount") or 0)
        cards += (
            f'<div class="balance-card">'
            f'<div class="label">{esc(pocket["name"])}</div>'
            f'<div class="amount">{money(pocket["balance"])}</div>'
            f'<div class="tags"><span class="tag">Base {money(base)}</span>'
            f'<span class="tag">Se reinicia cada lunes</span></div></div>'
        )
    for p in piggy:
        saved = float(p.get("saved_amount") or 0)
        target = float(p.get("target_amount") or 1)
        pct = min(100, round(saved / target * 100)) if target else 0
        cards += (
            f'<div class="piggy-card">'
            f'<div class="piggy-top"><span class="name"><i class="d"></i>{esc(p["name"])}</span>'
            f'<span class="val">{pct}%</span></div>'
            f'<div class="progress"><i style="width:{pct}%"></i></div>'
            f'<div class="piggy-foot"><span class="saved">{money(saved)}</span>'
            f'<span>Meta {money(target)}</span></div></div>'
        )
    return f'<section class="hero">{cards}</section>'


def _txns(txns):
    if not txns:
        return '<p class="empty">Sin movimientos este mes.</p>'
    rows = []
    for t in txns:
        tt = t.get("tx_type")
        cat = t.get("category") or ("Salario" if tt == "income" else "Otros")
        income = tt == "income"
        sweep = tt == "sweep"
        sign = "+" if income else ("&#8722;" if tt == "expense" else "")
        cls = "income" if income else ("sweep" if sweep else "expense")
        color = "#64748B" if sweep else cat_color(cat)
        icon = svg("Suscripciones") if sweep else svg(cat)
        title = t.get("concept") or t.get("category") or "Movimiento"
        rows.append(
            f'<div class="row">'
            f'<span class="dot" style="background:{color}1F;color:{color}">{icon}</span>'
            f'<div class="body"><div class="title">{esc(title)}</div>'
            f'<div class="meta">{esc(cat)}</div></div>'
            f'<div class="side"><div class="date">{fmt_date(t.get("created_at"))}</div>'
            f'<div class="amt {cls}">{sign}{money(t.get("amount"))}</div></div></div>'
        )
    return '<div class="list">' + "".join(rows) + "</div>"


def _cats(stats):
    cats = stats.get("by_category") or []
    if not cats:
        return '<p class="empty">Sin gastos registrados este mes.</p>'
    total = sum(float(c.get("total") or 0) for c in cats) or 1
    # Donut estático con gradiente cónico (puro CSS, no necesita JS)
    stops = []
    pct_sum = 0.0
    for c in cats:
        pct = float(c.get("total") or 0) / total * 100
        stops.append(f"{cat_color(c['category'])} {pct_sum:.2f}% {pct_sum + pct:.2f}%")
        pct_sum += pct
    legend = "".join(
        f'<div class="cat-row"><i class="cc" style="background:{cat_color(c["category"])}"></i>'
        f'<span class="cn">{esc(c["category"])}</span>'
        f'<span class="cv">{money(c["total"])} · {round(float(c["total"]) / total * 100)}%</span></div>'
        for c in cats
    )
    return (
        f'<div class="donut-row">'
        f'<div class="donut-box static"><i class="conic" style="background:conic-gradient({", ".join(stops)})"></i></div>'
        f'<div class="cat-legend">{legend}</div></div>'
    )


def _trend(stats):
    trend = stats.get("trend") or []
    if not trend:
        return '<p class="empty">Aún no hay historial.</p>'
    maxv = max([1.0] + [float(m.get("income") or 0) for m in trend] + [float(m.get("expense") or 0) for m in trend])
    bars = ""
    for m in trend:
        hi = max(3, round(float(m.get("income") or 0) / maxv * 150))
        he = max(3, round(float(m.get("expense") or 0) / maxv * 150))
        bars += (
            f'<div class="col">'
            f'<div class="pair"><div class="bar income" style="height:{hi}px"></div>'
            f'<div class="bar expense" style="height:{he}px"></div></div>'
            f'<div class="m">{fmt_month(m.get("ym"))}</div></div>'
        )
    return (
        '<div class="legend">'
        '<span class="lg"><i class="d inc"></i>Ingresos</span>'
        '<span class="lg"><i class="d exp"></i>Gastos</span></div>'
        f'<div class="chart-fallback">{bars}</div>'
    )


def _subs(summary):
    subs = [s for s in (summary.get("subscriptions") or []) if s.get("is_active")]
    if not subs:
        return '<p class="empty">Sin suscripciones activas.</p>'
    rows = "".join(
        f'<div class="row">'
        f'<span class="dot" style="background:#6366F11F;color:#818CF8">{svg("Suscripciones")}</span>'
        f'<div class="body"><div class="title">{esc(s["name"])}</div>'
        f'<div class="meta">Día {esc(s["billing_day"])}</div></div>'
        f'<div class="side"><div class="date">{esc(s.get("account_name"))}</div>'
        f'<div class="amt">{money(s.get("amount"))}</div></div></div>'
        for s in subs
    )
    return f'<div class="list compact">{rows}</div>'


def _month_options(stats, month):
    months = [m["ym"] for m in (stats.get("trend") or [])]
    if month and month not in months:
        months.append(month)
    months = sorted(set(months), reverse=True)
    if not months:
        return ""
    return "".join(
        f'<option value="{m}" {"selected" if m == month else ""}>{fmt_month(m)}</option>' for m in months
    )


def _build(summary, stats, txns, month):
    css = (WEB_DIR / "styles.css").read_text(encoding="utf-8")
    raw_totals = stats.get("totals") or {}
    if not isinstance(raw_totals, dict):
        raw_totals = {}
    totals = {"income": raw_totals.get("income", 0), "expense": raw_totals.get("expense", 0)}
    emb = {
        "summary": summary,
        "stats": stats,
        "txns": list(txns),
        "month": month,
        "v": VERSION,
    }
    emb_json = json.dumps(emb, default=str)
    now = time.strftime("%H:%M")
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Nexus Finance</title>
<meta name="theme-color" content="#0F172A" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/icons/icon-192.png" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Nexus" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<script>
if ("serviceWorker" in navigator) {{
  navigator.serviceWorker.getRegistrations().then(function (rs) {{ rs.forEach(function (r) {{ r.unregister(); }}); }});
}}
if ("caches" in window) {{
  caches.keys().then(function (keys) {{ keys.forEach(function (k) {{ caches.delete(k); }}); }});
}}
</script>
<style>{css}
.donut-box.static ::selection {{ background: transparent; }}
.donut-box.static .conic {{ position: absolute; inset: 0; border-radius: 50%; }}
.donut-box.static::after {{
  content: "";
  position: absolute; inset: 0; margin: auto;
  width: 44%; height: 44%; border-radius: 50%;
  background: #1E293B;
}}
</style>
<script>window.__NEXUS__ = {emb_json};</script>
</head>
<body>
<div id="root">
  <header class="topbar">
    <div class="brand"><img src="/icons/icon-192.png" alt="" width="30" height="30" /><span>Nexus Finance</span></div>
    <select id="month" aria-label="Mes" title="Mes">{_month_options(stats, month)}</select>
  </header>
  <main class="wrap">
    {_hero(summary)}
    <section class="totals">
      {_total_row(totals, True)}
      {_total_row(totals, False)}
    </section>
    <section class="card-section"><h2>Movimientos</h2>{_txns(txns)}</section>
    <section class="card-section">
      <h2>Gastos por categoría</h2>
      <div id="categories" class="categories-wrap">{_cats(stats)}</div>
    </section>
    <section class="card-section">
      <h2>Tendencia</h2>
      <div id="trend" class="trend-wrap" style="height:auto">{_trend(stats)}</div>
    </section>
    <section class="card-section"><h2>Suscripciones</h2>{_subs(summary)}</section>
    <p class="updated">Actualizado {now} · {VERSION} (vista servidor)</p>
  </main>
</div>
<div id="hw" class="hw">{VERSION} · vista servidor cargada</div>
<script src="/vendor/react.min.js"></script>
<script src="/vendor/react-dom.min.js"></script>
<script src="/vendor/htm.min.js"></script>
<script src="/vendor/chart.min.js"></script>
<script src="/app.js?v{VERSION}"></script>
</body>
</html>
"""


def render_panel(summary, stats, txns, month) -> str:
    """Devuelve el HTML del panel; nunca falla aunque falten datos (se pinta vacío)."""
    try:
        return _build(summary, stats, txns, month)
    except Exception:
        css = (WEB_DIR / "styles.css").read_text(encoding="utf-8")
        return (
            "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\" />"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
            "<title>Nexus Finance</title><style>body{background:#0F172A;color:#E2E8F0;"
            "font-family:system-ui,sans-serif;padding:24px}h1{font-size:1.1rem}"
            ".boot{color:#94A3B8;font-size:.9rem}</style></head><body>"
            "<h1>Nexus Finance</h1><p class=\"boot\">No se pudo preparar el panel.</p></body></html>"
        )