# db.py — acceso a datos (Supabase/Postgres).
import psycopg2.extras
from psycopg2.extensions import connection

from . import DATABASE_URL


def get_conn() -> connection:
    return psycopg2.connect(DATABASE_URL, sslmode="require")


def dict_conn() -> connection:
    c = get_conn()
    c.autocommit = False
    return c


def fetch_dict(cur):
    return [dict(r) for r in cur.fetchall()]