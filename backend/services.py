# services.py — lógica de negocio: registrar movimientos, barrido semanal, suscripciones.
import json
import logging
import re
from datetime import date, timedelta
from decimal import Decimal

import psycopg2.extras

from . import TELEGRAM_TOKEN, groq_client
from .db import dict_conn, fetch_dict

log = logging.getLogger("nexus.services")

# ---------------------------------------------------------------------------
# Parser (Groq con respaldo por reglas)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """Eres el extractor de gastos de NexusFinance.
Recibes un mensaje de Telegram de un usuario y debes devolver SOLO JSON:
{"type":"expense|income|transfer","amount":123.45,"concept":"gasolina","category":"Transporte"}
Normas:
- type: expense si gastó/compró/pagó, income si recibió/cobró/ganó/vendió, transfer si movió entre cuentas.
- amount: número positivo. Si dice "gaste 530 y luego 30" usar el total (560).
- category: una categoría corta en español.
- Si no puedes extraer algo, usa null.
No expliques nada, solo JSON."""


def parse_message_with_groq(text: str):
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )
        raw = completion.choices[0].message.content
        parsed = json.loads(raw)
        return {
            "type": parsed.get("type"),
            "amount": float(parsed.get("amount") or 0),
            "concept": parsed.get("concept"),
            "category": parsed.get("category"),
        }
    except Exception as e:  # noqa
        log.warning("Groq falló (%s); usando reglas.", e)
        return None


def parse_message_rules(text: str):
    low = " ".join(text.lower().split())
    ttype = "expense"
    for w in ("recibí", "recibi", "cobré", "cobre", "gané", "gane", "vendí", "vendi", "cobro de", "ingreso"):
        if w in low:
            ttype = "income"
            break
    for w in ("transferir", "transferi", "moví", "movi", "pase de"):
        if w in low:
            ttype = "transfer"
            break

    amount = None

    m = re.search(r"(\d[\d\s]*[.,]?\d*)", low)
    if m:
        try:
            amount = float(m.group(1).replace(" ", "").replace(",", "."))
        except ValueError:
            amount = None
    cleaner = re.sub(r"(\d[\d\s]*[.,]?\d*)", "", low)
    concept = cleaner.strip(" ,.:;") or None
    for stop in ("gaste en", "gaste", "pague", "pague el", "pague la", "compre", "compré", "recibi", "recibí", "cobre", "cobré", "gane", "gané", "de en", "en el", "en la", "del"):
        if concept and concept.startswith(stop):
            concept = concept[len(stop):].strip(" ,.:;")
            break

    cat_map = {
        "comida": "Comida", "comer": "Comida", "tacos": "Comida", "super": "Comida",
        "food": "Comida", "restaurante": "Comida", "mercado": "Comida", "papitas": "Comida",
        "gasolina": "Transporte", "gasoliner": "Transporte", "uber": "Transporte", "taxi": "Transporte",
        "camion": "Transporte", "camión": "Transporte", "bici": "Transporte", "metro": "Transporte",
        "luz": "Servicios", "agua": "Servicios", "internet": "Servicios", "telefono": "Servicios",
        "teléfono": "Servicios", "netflix": "Suscripciones", "spotify": "Suscripciones",
        "renta": "Hogar", "casa": "Hogar", "doctor": "Salud", "medic": "Salud", "farmac": "Salud",
        "salario": "Salario", "nomina": "Salario", "nómina": "Salario", "sueldo": "Salario",
    }
    category = None
    if concept:
        for key, cat in cat_map.items():
            if key in low:
                category = cat
                break
    if concept:
        for art in ("el ", "la ", "los ", "las ", "un ", "una ", "unos ", "unas "):
            if concept.startswith(art) and len(concept) > len(art):
                concept = concept[len(art):]
                break
    return {"type": ttype, "amount": amount, "concept": concept, "category": category}


def parse_message(text: str):
    if groq_client:
        res = parse_message_with_groq(text)
        if res and res.get("amount"):
            return res
    return parse_message_rules(text)


# ---------------------------------------------------------------------------
# Registro de movimientos (bot)
# ---------------------------------------------------------------------------


def get_or_create_category(cur, name: str):
    cur.execute("select id from categories where name=%s", (name,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        "insert into categories (name, icon) values (%s, %s) returning id",
        (name, "tag"),
    )
    return cur.fetchone()[0]


def register_transaction(conn, amount, ttype, concept, category_name=None):
    """Registra un gasto/ingreso/transferencia y actualiza el saldo de la cuenta."""
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        account = select_default_account(cur, ttype)
        if not account:
            conn.rollback()
            return None, "No hay cuenta por defecto configurada (crea una cuenta manualmente)."

        if category_name:
            cat_id = get_or_create_category(cur, category_name)
        else:
            cat_id = None

        cur.execute(
            """
            insert into transactions (account_id, category_id, amount, tx_type, source, raw_input)
            values (%s, %s, %s, %s, 'bot', %s)
            """,
            (account["id"], cat_id, amount, ttype, concept),
        )

        if ttype == "expense":
            sign = Decimal("-1")
        elif ttype == "income":
            sign = Decimal("1")
        else:
            sign = Decimal("0")

        cur.execute(
            "update accounts set balance = balance + %s where id = %s",
            (sign * Decimal(str(amount)), account["id"]),
        )
        cur.execute("select balance from accounts where id=%s", (account["id"],))
        new_balance = cur.fetchone()[0]
    conn.commit()
    return account, new_balance


def select_default_account(cur, ttype):
    """La cuenta default es el bolsillo semanal; si no existe, la primera cuenta."""
    cur.execute(
        """
        select a.* from accounts a
        join periodic_allowances pa on pa.account_id = a.id
        where a.type = 'cash_pocket'
        order by a.created_at
        limit 1
        """,
    )
    row = cur.fetchone()
    if row:
        return dict(row)
    cur.execute("select * from accounts order by created_at limit 1")
    row = cur.fetchone()
    return dict(row) if row else None


def list_summary(conn):
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("select * from accounts order by type, name")
        accounts = fetch_dict(cur)
        cur.execute(
            """
            select t.created_at::date as day,
                   t.tx_type,
                   t.amount,
                   t.raw_input as concept,
                   c.name as category,
                   a.name as account
            from transactions t
            left join categories c on c.id = t.category_id
            join accounts a on a.id = t.account_id
            order by t.created_at desc
            limit 10
            """
        )
        recent = fetch_dict(cur)
    return accounts, recent


# ---------------------------------------------------------------------------
# Barrido semanal (cron). Regla de sobregasto elegida: ABSORBER EL DÉFICIT.
# ---------------------------------------------------------------------------


def run_sweep(conn, today: date):
    """Resetea el bolsillo. Si sobraba, barre a la alcancía (sweep).
    Si quedó negativo, absorbe el déficit: la nueva semana arranca con
    base - déficit."""
    results = []
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(
            """
            select pa.*, a.name as account_name
            from periodic_allowances pa
            join accounts a on a.id = pa.account_id
            """
        )
        allowances = fetch_dict(cur)

        for pa in allowances:
            cur.execute(
                "select balance from accounts where id=%s",
                (pa["account_id"],),
            )
            balance = Decimal(str(cur.fetchone()[0]))
            base = Decimal(str(pa["base_amount"]))

            piggy_id = pa["target_piggybank_id"]
            surplus = balance if balance > 0 else Decimal("0")
            deficit = -balance if balance < 0 else Decimal("0")
            swept = Decimal("0")
            carried = Decimal("0")

            if pa["rollover_mode"] == "sweep_to_piggybank":
                if surplus > 0 and piggy_id:
                    swept = surplus
                    cur.execute(
                        "update piggy_banks set saved_amount = saved_amount + %s where id=%s",
                        (str(swept), piggy_id),
                    )
            elif pa["rollover_mode"] == "keep_in_pocket":
                carried = surplus
            # discard => no se barre ni se arrastra: el sobrante se pierde.

            # Nuevo balance = base de la semana (± sobrante arrastrado) − déficit absorbido.
            reset_to = base + carried - deficit
            if reset_to < 0:
                reset_to = Decimal("0")

            cur.execute(
                "update accounts set balance=%s where id=%s",
                (str(reset_to), pa["account_id"]),
            )
            cur.execute(
                """
                insert into sweep_log (pocket_account_id, amount_swept, target_piggybank_id)
                values (%s, %s, %s)
                """,
                (pa["account_id"], str(swept), piggy_id),
            )
            results.append(
                {
                    "account": pa["account_name"],
                    "was": str(balance),
                    "swept": str(swept),
                    "deficit": str(deficit),
                    "new_balance": str(reset_to),
                }
            )
    conn.commit()
    return results


# ---------------------------------------------------------------------------
# Suscripciones: revisión diaria, descuenta 5 días antes del billing_day.
# ---------------------------------------------------------------------------


def run_subscriptions(conn, today: date):
    """Revisa suscripciones activas y, si hoy = billing_day - 5, registra el pago."""
    paid = []
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("select * from subscriptions where is_active = true")
        subs = fetch_dict(cur)
        for s in subs:
            due = day_due_in(today, s["billing_day"])
            if due != 5:
                continue
            cur.execute(
                "select balance from accounts where id=%s",
                (s["linked_account_id"],),
            )
            bal = cur.fetchone()
            if bal is None:
                continue
            cur.execute(
                """
                insert into transactions (account_id, category_id, amount, tx_type, source, raw_input)
                values (%s, %s, %s, %s, 'bot', %s)
                """,
                (
                    s["linked_account_id"],
                    s["category_id"],
                    s["amount"],
                    "expense",
                    f"suscripción automática: {s['name']}",
                ),
            )
            cur.execute(
                "update accounts set balance = balance - %s where id=%s",
                (s["amount"], s["linked_account_id"]),
            )
            paid.append(s["name"])
    conn.commit()
    return paid


def day_due_in(today: date, billing_day: int) -> int:
    """Cuantos días faltan para el próximo billing_day (cuenta corte/fin de mes)."""
    yd = date(today.year, today.month, billing_day)
    if yd < today:
        # mes siguiente
        if today.month == 12:
            yd = date(today.year + 1, 1, billing_day)
        else:
            yd = date(today.year, today.month + 1, billing_day)
    return (yd - today).days


# ---------------------------------------------------------------------------
# Telegram
# ---------------------------------------------------------------------------


def telegram_send(chat_id, text):
    import requests

    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    return requests.post(url, json={"chat_id": chat_id, "text": text}, timeout=10)