-- 418: Negociação — campo opcional fase_id por linha (data atrelada à fase da calculadora).

COMMENT ON COLUMN public.processo_step_one.negociacao_linhas IS
  'Array JSON: [{ condicao, valor, data_pagamento, fase_id? }] — condições de negociação; fase_id atrela pagamento à fase da calculadora.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('418', 'negociacao_linhas_fase_id')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
