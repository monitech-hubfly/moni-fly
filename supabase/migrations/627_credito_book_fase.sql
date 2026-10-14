-- 627: Book do empreendimento obrigatório na fase Book do Funil Crédito.
-- Espelha a lateral (negocio:book_empreendimento) e os cards vinculados.
-- Idempotente. Não move cards.

DO $$
DECLARE
  v_kanban uuid := '6463af1d-850d-4958-b74c-404f8d668e21'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    SELECT id INTO v_kanban
    FROM public.kanbans
    WHERE nome IN ('Funil Crédito Obra', 'Funil Crédito', 'Funil Cash Me')
    ORDER BY CASE
      WHEN nome = 'Funil Crédito Obra' THEN 0
      WHEN nome = 'Funil Crédito' THEN 1
      ELSE 2
    END
    LIMIT 1;
  END IF;

  IF v_kanban IS NULL THEN
    RAISE NOTICE '627: kanban Funil Crédito não encontrado; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens i
  SET
    label = 'Book do empreendimento',
    tipo = 'url',
    obrigatorio = true,
    ordem = 90,
    visivel_candidato = true,
    campo_slug = 'book_empreendimento',
    chave_compartilhada = 'negocio:book_empreendimento',
    placeholder = 'https://…'
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_kanban
    AND f.slug = 'co_book'
    AND i.fase_id = f.id
    AND (
      i.campo_slug = 'book_empreendimento'
      OR i.chave_compartilhada = 'negocio:book_empreendimento'
      OR lower(trim(i.label)) IN ('book do empreendimento', 'book do book')
    );

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug,
    config_json, chave_compartilhada, placeholder
  )
  SELECT
    f.id,
    90,
    'Book do empreendimento',
    'url',
    true,
    true,
    'book_empreendimento',
    '{}'::jsonb,
    'negocio:book_empreendimento',
    'https://…'
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_kanban
    AND f.slug = 'co_book'
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND (
          i.campo_slug = 'book_empreendimento'
          OR i.chave_compartilhada = 'negocio:book_empreendimento'
        )
    );
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('627', 'credito_book_fase')
ON CONFLICT (version) DO NOTHING;
