-- NexusFinance — Esquema corregido para Supabase (PostgreSQL 15)
-- Ejecutar en SQL Editor del dashboard de Supabase.

-- 1. Categorías
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  icon VARCHAR(30),
  is_default BOOLEAN DEFAULT false
);

-- 2. Cuentas Financieras
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('cash_pocket','cash_vault','credit_card','debit')),
  balance NUMERIC(12, 2) DEFAULT 0.00,
  credit_limit NUMERIC(12, 2),
  cut_off_day INT CHECK (cut_off_day BETWEEN 1 AND 28),
  payment_due_day INT CHECK (payment_due_day BETWEEN 1 AND 28),
  allow_negative BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Alcancías de Ahorro
CREATE TABLE piggy_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(60) NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
  saved_amount NUMERIC(12, 2) DEFAULT 0.00 CHECK (saved_amount >= 0),
  deadline DATE,
  icon VARCHAR(30)
);

-- 4. Configuración del Bolsillo Semanal (sin saldo duplicado)
CREATE TABLE periodic_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  base_amount NUMERIC(10, 2) DEFAULT 500.00,
  reset_day INT DEFAULT 1 CHECK (reset_day BETWEEN 1 AND 7),
  reset_hour INT DEFAULT 0 CHECK (reset_hour BETWEEN 0 AND 23),
  timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
  rollover_mode VARCHAR(20) DEFAULT 'sweep_to_piggybank'
    CHECK (rollover_mode IN ('sweep_to_piggybank','keep_in_pocket','discard')),
  target_piggybank_id UUID REFERENCES piggy_banks(id) ON DELETE SET NULL,
  UNIQUE(account_id)
);

-- 5. Suscripciones y Pagos Fijos
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(60) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  billing_day INT NOT NULL CHECK (billing_day BETWEEN 1 AND 28),
  linked_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL
);

-- 6. Transacciones
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  tx_type VARCHAR(15) NOT NULL CHECK (tx_type IN ('expense','income','transfer','sweep')),
  source VARCHAR(20) DEFAULT 'bot',
  raw_input TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Log de Barridos
CREATE TABLE sweep_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pocket_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount_swept NUMERIC(12, 2) NOT NULL,
  target_piggybank_id UUID REFERENCES piggy_banks(id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ DEFAULT now()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_txn_created     ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_account      ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_sweep_executed   ON sweep_log(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_subs_active      ON subscriptions(is_active, billing_day);

-- Datos iniciales (categorias comunes)
INSERT INTO categories (name, icon, is_default) VALUES
  ('Comida',       'utensils',    false),
  ('Transporte',   'car',         false),
  ('Hogar',        'home',        false),
  ('Entretenimiento','film',      false),
  ('Salud',        'heart',       false),
  ('Ropa',         'shirt',       false),
  ('Servicios',    'wifi',        false),
  ('Suscripciones','credit-card', false),
  ('Salario',      'briefcase',   true),
  ('Otros',        'tag',         true)
ON CONFLICT (name) DO NOTHING;