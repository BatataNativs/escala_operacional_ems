-- Schema do Banco de Dados Cloudflare D1 para Escala Operacional

-- 1. Usuários do Sistema (Login de Operadores e Administradores)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator', -- 'admin' ou 'operator'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Efetivo Fixo da Seção (Operadores pertencentes à Unidade)
CREATE TABLE IF NOT EXISTS operators (
  id TEXT PRIMARY KEY,
  leg TEXT NOT NULL,
  name TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT 'EMS-SP',
  sort_order INTEGER DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Escalas Mensais (Metadados do Mês/Ano e Observações)
CREATE TABLE IF NOT EXISTS monthly_schedules (
  id TEXT PRIMARY KEY, -- formato: 'YYYY-MM_SECTOR' (ex: '2026-09_EMS-SP')
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 0-11
  sector TEXT NOT NULL,
  observations TEXT DEFAULT '[]', -- JSON array
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Turnos e Cargas Extras de Cada Operador no Mês
CREATE TABLE IF NOT EXISTS operator_month_data (
  schedule_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  shifts TEXT NOT NULL DEFAULT '{}', -- JSON: {"1":"M", "2":"T", ...}
  sub_shifts TEXT NOT NULL DEFAULT '{}', -- JSON: {"15":"M", ...}
  pimo REAL NOT NULL DEFAULT 0,
  instrucao_met REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (schedule_id, operator_id),
  FOREIGN KEY (schedule_id) REFERENCES monthly_schedules(id) ON DELETE CASCADE
);
