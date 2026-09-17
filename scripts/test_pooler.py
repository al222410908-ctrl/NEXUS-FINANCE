import psycopg2

PWD = "ZUZljO0vQppfNavH"
ref = "khpkkhvqmaefidzmzxav"
host = "aws-0-us-east-2.pooler.supabase.com"

candidates = {
    "session_5432": f"postgresql://postgres.{ref}:{PWD}@{host}:5432/postgres",
    "transaction_6543": f"postgresql://postgres.{ref}:{PWD}@{host}:6543/postgres",
}

for name, url in candidates.items():
    try:
        c = psycopg2.connect(url, sslmode="require", connect_timeout=15)
        cur = c.cursor()
        cur.execute("select count(*) from accounts")
        print(name, "OK accounts=", cur.fetchone()[0])
        c.close()
    except Exception as e:
        print(name, "FAIL:", type(e).__name__, str(e)[:160])