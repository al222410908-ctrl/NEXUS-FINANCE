# main.py — FastAPI: webhook de bot, endpoints del cron y estado.
import logging
from datetime import date
from decimal import Decimal

from fastapi import FastAPI, Header, HTTPException, Request

from . import ALLOWED_USER_IDS, CRON_AUTH_TOKEN, TELEGRAM_TOKEN
from .db import dict_conn
from .services import (
    list_summary,
    parse_message,
    register_transaction,
    run_subscriptions,
    run_sweep,
    telegram_send,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("nexus.main")

app = FastAPI(title="NexusFinance API", version="0.1.0")


@app.get("/")
def root():
    return {"ok": True, "service": "NexusFinance"}


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