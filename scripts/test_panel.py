"""Prueba el panel web + endpoints /api sin levantar servidor.
Uso: DATABASE_URL=... py scripts/test_panel.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("DASHBOARD_PASSWORD", "test123")
os.environ.setdefault("CRON_AUTH_TOKEN", "tok")

HAS_DB = bool(os.environ.get("DATABASE_URL"))

from fastapi.testclient import TestClient  # noqa: E402

from backend.main import app  # noqa: E402

c = TestClient(app)

print("health        ", *c.get("/api/health").json().values())
print("index         ", c.get("/").status_code, c.get("/").headers.get("content-type"))
print("styles.css    ", c.get("/styles.css").status_code)
print("app.js        ", c.get("/app.js").status_code)
print("manifest      ", c.get("/manifest.webmanifest").status_code)
print("sw.js         ", c.get("/sw.js").status_code)
print("icon-192      ", c.get("/icons/icon-192.png").status_code)

print("summary noauth", c.get("/api/summary").status_code, "(espera 401)")
print("login bad     ", c.post("/api/login", json={"password": "nope"}).status_code, "(espera 401)")
print("login ok      ", c.post("/api/login", json={"password": "test123"}).status_code, "(espera 200)")

if not HAS_DB:
    print("(sin DATABASE_URL: se omiten las pruebas que tocan la base)")
else:
    s = c.get("/api/summary")
    print("summary auth  ", s.status_code, "cuentas:", [a["name"] for a in s.json().get("accounts", [])])
    print("alcancia      ", [(p["name"], str(p["saved_amount"])) for p in s.json().get("piggy_banks", [])])
    st = c.get("/api/stats?month=2026-09")
    print("stats         ", st.status_code, "totales:", st.json().get("totals"), "cats:", len(st.json().get("by_category", [])))
    tx = c.get("/api/transactions?limit=3")
    print("txns          ", tx.status_code, "items:", len(tx.json().get("items", [])))
    tok = c.get("/api/summary", headers={"x-dashboard-token": "test123"})
    print("summary token ", tok.status_code, "(espera 200)")
print("logout        ", c.post("/api/logout").status_code, "| summary tras logout:", c.get("/api/summary").status_code)