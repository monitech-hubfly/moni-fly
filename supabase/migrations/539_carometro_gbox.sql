-- Migration: carometro_gbox
-- Tabela para persistir GBox do Dashboard Casas Moní no Supabase

CREATE TABLE IF NOT EXISTS carometro_gbox (
  id        serial PRIMARY KEY,
  casa_nome text NOT NULL,
  status    text,
  data      date,
  link      text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(casa_nome)
);

ALTER TABLE carometro_gbox ENABLE ROW LEVEL SECURITY;
