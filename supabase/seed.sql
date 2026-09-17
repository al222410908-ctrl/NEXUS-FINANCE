-- seed.sql — datos iniciales para arrancar (ejecutar DESPUÉS de schema.sql).
-- Crea una cuenta "Bolsillo Semanal" de $500 con barrido a una alcancía.

-- Alcancía por defecto
INSERT INTO piggy_banks (name, target_amount, icon) VALUES ('Fondo de emergencia', 5000, 'piggy-bank');

-- Cuenta bolsillo
INSERT INTO accounts (name, type, balance, allow_negative)
SELECT 'Bolsillo Semanal', 'cash_pocket', 500.00, TRUE
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE type = 'cash_pocket');

-- Su configuración semanal (se recarga lunes 00:00, barriendo el sobrante a la alcancía)
INSERT INTO periodic_allowances (account_id, base_amount, reset_day, reset_hour, timezone, rollover_mode, target_piggybank_id)
SELECT a.id, 500.00, 1, 0, 'America/Mexico_City', 'sweep_to_piggybank', p.id
FROM accounts a, piggy_banks p
WHERE a.type = 'cash_pocket' AND p.name = 'Fondo de emergencia'
  AND NOT EXISTS (SELECT 1 FROM periodic_allowances pa WHERE pa.account_id = a.id);