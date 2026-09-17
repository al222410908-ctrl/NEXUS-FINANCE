import os
import psycopg2

c = psycopg2.connect(os.environ["DATABASE_URL"], sslmode="require")
c.autocommit = True
cur = c.cursor()
cur.execute("update accounts set balance=500 where type='cash_pocket'")
cur.execute("delete from transactions where source='bot' and raw_input='gasolinera'")
cur.execute("delete from sweep_log")
cur.execute("update piggy_banks set saved_amount=0")
cur.close()
c.close()
print("limpieza OK: balance 500, sin tx de prueba, sweep_log vacio, alcancia 0")