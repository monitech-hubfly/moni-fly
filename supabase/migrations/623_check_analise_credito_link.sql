-- 623: Check Análise de Crédito passa a ser link, na lateral e nas fases.
-- Limpa o valor antigo de checkbox (true/false). Idempotente. Não move cards.

COMMENT ON COLUMN public.processo_step_one.check_analise_credito IS
  'Link do Check Análise de Crédito. Espelhado no checklist via negocio:check_analise_credito.';

UPDATE public.processo_step_one
SET check_analise_credito = NULL
WHERE check_analise_credito IN ('true', 'false');

UPDATE public.kanban_fase_checklist_itens
SET tipo = 'url'
WHERE campo_slug = 'check_analise_credito'
  AND chave_compartilhada = 'negocio:check_analise_credito'
  AND tipo IS DISTINCT FROM 'url';

UPDATE public.kanban_card_checklist_compartilhado
SET valor = NULL
WHERE chave = 'negocio:check_analise_credito'
  AND valor::text IN ('"true"', '"false"', 'true', 'false');

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('623', 'check_analise_credito_link')
ON CONFLICT (version) DO NOTHING;
