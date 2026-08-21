-- 414: Linhas de negociação (condição · valor · data de pagamento) em Dados do Negócio.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS negociacao_linhas jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.processo_step_one.negociacao_linhas IS
  'Array JSON: [{ condicao, valor, data_pagamento }] — condições de negociação do terreno.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('414', 'processo_negociacao_linhas')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
