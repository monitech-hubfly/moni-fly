-- 620: tipo documental Termo Recompra no Funil Jurídico.
-- Libera kanban_cards.juridico_tipo_contrato = termo_recompra e garante a tag.
-- Idempotente. Não move cards. Não altera PROD.

ALTER TABLE public.kanban_cards
  DROP CONSTRAINT IF EXISTS kanban_cards_juridico_tipo_contrato_check;

ALTER TABLE public.kanban_cards
  ADD CONSTRAINT kanban_cards_juridico_tipo_contrato_check
  CHECK (
    juridico_tipo_contrato IS NULL
    OR juridico_tipo_contrato IN (
      'opcao',
      'cto_com_precedentes',
      'cto_sem_precedentes',
      'termo_recompra',
      'nda',
      'parceria',
      'franquia',
      'cof',
      'aditivo',
      'documento_padrao',
      'demais'
    )
  );

COMMENT ON COLUMN public.kanban_cards.juridico_tipo_contrato IS
  'Funil Jurídico — tipo documental: opcao | cto_com_precedentes | cto_sem_precedentes | termo_recompra | nda | parceria | franquia | cof | aditivo | documento_padrao | demais.';

INSERT INTO public.kanban_tags (kanban_id, nome, cor)
SELECT
  '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid,
  'Termo Recompra',
  '#D4AD68'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.kanban_tags t
  WHERE t.kanban_id = '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid
    AND t.nome = 'Termo Recompra'
);

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('620', 'juridico_tipo_termo_recompra')
ON CONFLICT (version) DO NOTHING;
