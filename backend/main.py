# main.py — FastAPI: webhook de bot, endpoints del cron, API del panel web y PWA.
import hashlib
import hmac
import logging
import time
from datetime import date
from decimal import Decimal
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import (
    ALLOWED_USER_IDS,
    CRON_AUTH_TOKEN,
    DASHBOARD_PASSWORD,
    DASHBOARD_SECRET,
    TELEGRAM_TOKEN,
)
from .db import dict_conn
from .services import (
    get_dashboard,
    get_stats,
    list_summary,
    list_transactions,
    parse_message,
    register_transaction,
    run_subscriptions,
    run_sweep,
    telegram_send,
)

WEB_DIR = Path(__file__).parent / "web"
SESSION_COOKIE = "nx_session"
SESSION_TTL = 60 * 60 * 24 * 30  # 30 días

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("nexus.main")

app = FastAPI(title="NexusFinance API", version="0.1.0")


@app.get("/api/health")
def health():
    return {"ok": True, "service": "NexusFinance"}


# ---------------------------------------------------------------------------
# Panel web (PWA): login por contraseña + API de solo lectura
# ---------------------------------------------------------------------------


class LoginBody(BaseModel):
    password: str = ""


def _pwd_ok(candidate: str) -> bool:
    """Acepta la contraseña del panel o el token del cron (respaldo garantizado)."""
    candidate = (candidate or "").strip()
    if not candidate:
        return False
    if DASHBOARD_PASSWORD and hmac.compare_digest(candidate, DASHBOARD_PASSWORD):
        return True
    if CRON_AUTH_TOKEN and hmac.compare_digest(candidate, CRON_AUTH_TOKEN):
        return True
    return False


def _sign(payload: str) -> str:
    return hmac.new(DASHBOARD_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()


def _make_token() -> str:
    exp = str(int(time.time()) + SESSION_TTL)
    return f"{exp}.{_sign(exp)}"


def _valid_token(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    payload, sig = token.rsplit(".", 1)
    if not hmac.compare_digest(_sign(payload), sig):
        return False
    try:
        return int(payload) > int(time.time())
    except ValueError:
        return False


def _require_session(request: Request):
    if _valid_token(request.cookies.get(SESSION_COOKIE)):
        return
    if _pwd_ok(request.headers.get("x-dashboard-token")):
        return
    raise HTTPException(401, "No autorizado")


@app.post("/api/login")
def api_login(body: LoginBody, request: Request, response: Response):
    if not _pwd_ok(body.password):
        raise HTTPException(401, "Contraseña incorrecta")
    response.set_cookie(
        SESSION_COOKIE,
        _make_token(),
        max_age=SESSION_TTL,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
    )
    return {"ok": True}


@app.post("/api/logout")
def api_logout(response: Response):
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@app.get("/api/session")
def api_session(request: Request):
    _require_session(request)
    return {"ok": True}


@app.get("/api/summary")
def api_summary(request: Request):
    _require_session(request)
    conn = dict_conn()
    try:
        return get_dashboard(conn)
    finally:
        conn.close()


@app.get("/api/transactions")
def api_transactions(request: Request, limit: int = 100, month: str | None = None):
    _require_session(request)
    conn = dict_conn()
    try:
        return {"items": list_transactions(conn, limit, month)}
    finally:
        conn.close()


@app.get("/api/stats")
def api_stats(request: Request, month: str | None = None):
    _require_session(request)
    conn = dict_conn()
    try:
        return get_stats(conn, month)
    finally:
        conn.close()


@app.get("/api/check")
def api_check(pw: str = ""):
    """Autodiagnóstico (sin secretos): qué config y si la contraseña/token es válida."""
    from . import DATABASE_URL

    return {
        "pw_ok": _pwd_ok(pw),
        "has_cron": bool(CRON_AUTH_TOKEN),
        "has_dash": bool(DASHBOARD_PASSWORD),
        "dash_differs": bool(
            DASHBOARD_PASSWORD and CRON_AUTH_TOKEN and DASHBOARD_PASSWORD != CRON_AUTH_TOKEN
        ),
        "db_host": (
            DATABASE_URL.split("@", 1)[1].split("/", 1)[0]
            if DATABASE_URL and "@" in DATABASE_URL
            else None
        ),
    }


@app.get("/debug/db")
def debug_db(token: str = ""):
    if CRON_AUTH_TOKEN and token != CRON_AUTH_TOKEN:
        raise HTTPException(403, "Bad token")
    from . import DATABASE_URL

    info = {
        "has_database_url": bool(DATABASE_URL),
        "db_url_scheme": DATABASE_URL.split("://", 1)[0] if DATABASE_URL else None,
        "db_url_host": (DATABASE_URL.split("@", 1)[1].split("/", 1)[0] if "@" in DATABASE_URL else None),
    }
    try:
        conn = dict_conn()
        with conn.cursor() as cur:
            cur.execute("select count(*) from accounts")
            info["accounts"] = cur.fetchone()[0]
        conn.close()
        info["ok"] = True
    except Exception as e:  # noqa
        info["ok"] = False
        info["error"] = f"{type(e).__name__}: {e}"
    return info


# ---------------------------------------------------------------------------
# Telegram webhook
# ---------------------------------------------------------------------------


@app.post("/webhook/{token}")
async def telegram_webhook(token: str, request: Request):
    if token != CRON_AUTH_TOKEN:
        raise HTTPException(403, "Bad token")
    update = await request.json()
    message = update.get("message")
    if not message:
        return {"ok": True}

    user_id = message.get("from", {}).get("id")
    chat_id = message.get("chat", {}).get("id")
    text = (message.get("text") or "").strip()

    if not text or user_id not in ALLOWED_USER_IDS:
        return {"ok": True}

    if text.lower() in ("/resumen", "/status"):
        return _reply_summary(chat_id)

    if not text.startswith("/"):
        parsed = parse_message(text)
        if not parsed or parsed.get("amount") in (None, 0):
            telegram_send(
                chat_id,
                "No entendí el monto. Ejemplo: 'gaste 530 en gasolina'",
            )
            return {"ok": True}

        conn = dict_conn()
        try:
            account, new_balance = register_transaction(
                conn,
                parsed["amount"],
                parsed["type"],
                parsed.get("concept"),
                parsed.get("category"),
            )
        finally:
            conn.close()

        if new_balance is None:
            telegram_send(chat_id, "No hay cuenta por defecto configurada.")
            return {"ok": True}

        tipo_label = {"expense": "Gasto", "income": "Ingreso", "transfer": "Transferencia"}[
            parsed["type"]
        ]
        cat = parsed.get("category") or "sin categoría"
        reply = (
            f"✅ {tipo_label}: ${parsed['amount']:.2f}\n"
            f"Categoría: {cat}\n"
            f"Cuenta: {account['name']}\n"
            f"Saldo {account['name']}: ${new_balance:,.2f}"
        )
        telegram_send(chat_id, reply)

    return {"ok": True}


def _reply_summary(chat_id):
    conn = dict_conn()
    try:
        accounts, recent = list_summary(conn)
    finally:
        conn.close()
    lines = ["💰 **Tus cuentas**"]
    for a in accounts:
        lines.append(f"• {a['name']}: ${float(a['balance']):,.2f}")
    lines.append("")
    lines.append("🧾 **Últimos movimientos**")
    for t in recent:
        sign = "+" if t["tx_type"] == "income" else "−"
        lines.append(
            f"{t['day']} {sign}${float(t['amount']):,.2f} "
            f"({t['category'] or '—'} — {t['account']})"
        )
    telegram_send(chat_id, "\n".join(lines))
    return {"ok": True}


# ---------------------------------------------------------------------------
# Cron (GitHub Actions) — protegido con token
# ---------------------------------------------------------------------------


@app.post("/cron/sweep")
async def cron_sweep(x_cron_token: str = Header(None)):
    _require_cron(x_cron_token)
    conn = dict_conn()
    try:
        results = run_sweep(conn, date.today())
    finally:
        conn.close()
    return {"ok": True, "swept_allowances": results}


@app.post("/cron/subscriptions")
async def cron_subscriptions(x_cron_token: str = Header(None)):
    _require_cron(x_cron_token)
    conn = dict_conn()
    try:
        paid = run_subscriptions(conn, date.today())
    finally:
        conn.close()
    return {"ok": True, "paid_this_cycle": paid}


def _require_cron(token):
    if CRON_AUTH_TOKEN and token != CRON_AUTH_TOKEN:
        raise HTTPException(403, "Bad token")


# PWA: va al final para que las rutas /api y /webhook tengan prioridad.
if WEB_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")