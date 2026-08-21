-- 418: Negociação — vínculo opcional com fase/marco da calculadora (campo JSON existente).

COMMENT ON COLUMN public.processo_step_one.negociacao_linhas IS
  'Array JSON: [{ condicao, valor, data_pagamento, vinculo_calculadora? }] — '
  'vinculo_calculadora: "fase:<slug>" ou "marco:<id>" (ex. fase:em_obra, marco:M0). '
  'Com vínculo, a data na calculadora segue a fase/marco; sem vínculo, usa data_pagamento manual.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('418', 'negociacao_vinculo_fase_calculadora')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
