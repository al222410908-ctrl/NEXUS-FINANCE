"""Prueba del barrido: sobrante -> alcancia, y con deficit absorbed."""
import json
import os
from datetime import date

import psycopg2

from backend.db import dict_conn
from backend.services import run_sweep

DATABASE_URL = os.environ["DATABASE_URL"]


def q(sql, args=()):
    c = psycopg2.connect(DATABASE_URL, sslmode="require")
    c.autocommit = True
    cur = c.cursor()
    cur.execute(sql, args)
    try:
        rows = cur.fetchall()
    except psycopg2.ProgrammingError:
        rows = None
    c.close()
    return rows


# Escenario 1: sobrante de 480 -> barre 480 a la alcancia, nuevo balance = 500
q("update accounts set balance=480 where type='cash_pocket'")
conn = dict_conn()
res = run_sweep(conn, date(2026, 9, 21))
conn.close()
print("ESC 1 (sobrante 480):", json.dumps(res, ensure_ascii=False))

alcancia = q("select saved_amount from piggy_banks")[0][0]
balance = q("select balance from accounts where type='cash_pocket'")[0][0]
print("  alcancia:", alcancia, "| balance:", balance)

# Escenario 2: deficit -30 absorbe, arranca en 470
q("update accounts set balance=-30 where type='cash_pocket'")
conn = dict_conn()
res = run_sweep(conn, date(2026, 9, 21))
conn.close()
b_after = q("select balance from accounts where type='cash_pocket'")[0][0]
print("ESC 2 (deficit 30):", json.dumps(res, ensure_ascii=False), "| nuevo balance:", b_after)

# Escenario 3: keep_in_pocket — sobrante 200 se arrastra, balance 700
q("update periodic_allowances set rollover_mode='keep_in_pocket'")
q("update accounts set balance=200 where type='cash_pocket'")
conn = dict_conn()
res = run_sweep(conn, date(2026, 9, 21))
conn.close()
b_after = q("select balance from accounts where type='cash_pocket'")[0][0]
print("ESC 3 (keep_in_pocket 200):", json.dumps(res, ensure_ascii=False), "| nuevo balance:", b_after)

# Restaurar config: sweep_to_piggybank, balance 500
q("update periodic_allowances set rollover_mode='sweep_to_piggybank'")
q("update accounts set balance=500 where type='cash_pocket'")
print("OK restaurado: balance=500, rollover=sweep_to_piggybank")