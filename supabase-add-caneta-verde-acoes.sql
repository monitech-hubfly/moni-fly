-- Opcional: adiciona a coluna "caneta verde" na tabela acoes (tarefas).
-- Rode no Supabase → SQL Editor se quiser que o campo "Oportunidade caneta verde?" seja salvo.
-- Depois de rodar, o app já exibe o campo; para persistir o valor, será necessário
-- que o código envie caneta_verde no insert/update (já previsto no supabase-migracao-workload.sql).

ALTER TABLE acoes
  ADD COLUMN IF NOT EXISTS caneta_verde text CHECK (caneta_verde IS NULL OR caneta_verde IN ('sim', 'nao'));
