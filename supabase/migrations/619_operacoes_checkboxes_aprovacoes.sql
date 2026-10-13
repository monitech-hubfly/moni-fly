-- 619: Funil Pré Obra e Obra — checkboxes de aprovação nas fases.
-- Aprovação no Condomínio, Aprovação na Prefeitura e Instrumento Garantidor.
-- Idempotente. Não move cards.

DO $$
DECLARE
  v_kanban uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    SELECT id INTO v_kanban
    FROM public.kanbans
    WHERE nome IN ('Funil Pré Obra e Obra', 'Funil Operações')
    ORDER BY CASE WHEN nome = 'Funil Pré Obra e Obra' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_kanban IS NULL THEN
    RAISE NOTICE '619: Funil Pré Obra e Obra não encontrado — pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens i
  SET
    label = n.label,
    tipo = 'checkbox',
    obrigatorio = false,
    visivel_candidato = false,
    ordem = n.ordem,
    config_json = '{}'::jsonb
  FROM (
    VALUES
      ('aprovacao_condominio', 'aprov_condominio', 'Aprov. Condomínio', 20),
      ('aprovacao_prefeitura', 'aprov_prefeitura', 'Aprov. Prefeitura', 20),
      ('aprovacao_prefeitura', 'alvara', 'Alvará', 21),
      ('instrumento_garantidor', 'inst_garantidor_transferencia', 'Int. Garantidor Transferência', 10)
  ) AS n(fase_slug, campo_slug, label, ordem)
  JOIN public.kanban_fases kf
    ON kf.kanban_id = v_kanban
   AND kf.slug = n.fase_slug
  WHERE i.fase_id = kf.id
    AND i.campo_slug = n.campo_slug;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT kf.id, n.ordem, n.label, 'checkbox', false, false, n.campo_slug, '{}'::jsonb
  FROM (
    VALUES
      ('aprovacao_condominio', 'aprov_condominio', 'Aprov. Condomínio', 20),
      ('aprovacao_prefeitura', 'aprov_prefeitura', 'Aprov. Prefeitura', 20),
      ('aprovacao_prefeitura', 'alvara', 'Alvará', 21),
      ('instrumento_garantidor', 'inst_garantidor_transferencia', 'Int. Garantidor Transferência', 10)
  ) AS n(fase_slug, campo_slug, label, ordem)
  JOIN public.kanban_fases kf
    ON kf.kanban_id = v_kanban
   AND kf.slug = n.fase_slug
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = kf.id
      AND i.campo_slug = n.campo_slug
  );
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('619', 'operacoes_checkboxes_aprovacoes')
ON CONFLICT (version) DO NOTHING;
