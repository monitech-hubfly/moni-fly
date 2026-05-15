-- Adiciona coluna objetivo_id na tabela tarefas (para associar comportamentos às metas)
-- Execute no Supabase → SQL Editor

ALTER TABLE tarefas
  ADD COLUMN IF NOT EXISTS objetivo_id uuid REFERENCES objetivos(id) ON DELETE SET NULL;
