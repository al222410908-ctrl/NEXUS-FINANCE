import os

import psycopg2

c = psycopg2.connect(os.environ["DATABASE_URL"], sslmode="require")
cur = c.cursor()
cur.execute("select name, balance from accounts where type='cash_pocket'")
print("Cuenta:", cur.fetchone())
cur.execute(
    """select t.created_at, t.tx_type, t.amount, t.raw_input, c.name
       from transactions t left join categories c on c.id=t.category_id
       order by t.created_at desc limit 10"""
)
print("Ultimos movimientos:")
for r in cur.fetchall():
    print("  ", r)
cur.execute("select saved_amount from piggy_banks")
print("Alcancia:", cur.fetchone())
c.close()