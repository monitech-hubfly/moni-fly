-- 573: Funil Jurídico — remove checklist estrutural da fase Análise Inicial.
-- Campos: origem do card, tipo de contrato, documentos para tratativas.
-- Idempotente. UUID canônico: KANBAN_IDS.JURIDICO.

DO $$
DECLARE
  v_kanban_id uuid := '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid;
  v_slugs text[] := ARRAY[
    'juridico_origem_identificada',
    'juridico_tipo_contrato_confirmado',
    'juridico_docs_necessarios'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome = 'Funil Jurídico'
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '573: Funil Jurídico não encontrado — pulando.';
    RETURN;
  END IF;

  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  INNER JOIN public.kanban_fases f ON f.id = i.fase_id
  WHERE r.item_id = i.id
    AND f.kanban_id = v_kanban_id
    AND f.slug = 'juridico_analise_inicial'
    AND (
      COALESCE(i.campo_slug, '') = ANY (v_slugs)
      OR TRIM(i.label) IN (
        'Origem do card identificada (Portfólio / Loteadores / Comercial)',
        'Tipo de contrato confirmado',
        'Documentos necessários para as tratativas'
      )
    );

  DELETE FROM public.kanban_fase_checklist_itens i
  USING public.kanban_fases f
  WHERE i.fase_id = f.id
    AND f.kanban_id = v_kanban_id
    AND f.slug = 'juridico_analise_inicial'
    AND (
      COALESCE(i.campo_slug, '') = ANY (v_slugs)
      OR TRIM(i.label) IN (
        'Origem do card identificada (Portfólio / Loteadores / Comercial)',
        'Tipo de contrato confirmado',
        'Documentos necessários para as tratativas'
      )
    );
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('573', 'funil_juridico_analise_inicial_sem_checklist')
ON CONFLICT (version) DO NOTHING;
