-- 616: Negociação do Funil Portfólio nas fases Comitê, Revisões Comitê e Demais Comitês.
-- Chave compartilhada negocio:negociacao_linhas, espelhada em processo_step_one.negociacao_linhas.
-- Obrigatório nas três fases. Idempotente. Não move cards.

DO $$
DECLARE
  v_kanban uuid := 'c57120a0-991c-422b-8def-4d16a9411d45';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    RAISE NOTICE '616: Funil Portfólio não encontrado — seed ignorado.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens i
  SET label = 'Negociação',
      tipo = 'texto_longo',
      obrigatorio = true,
      ordem = 37,
      visivel_candidato = false,
      config_json = '{"widget":"negocio_negociacao"}'::jsonb,
      chave_compartilhada = 'negocio:negociacao_linhas'
  FROM public.kanban_fases kf
  WHERE kf.kanban_id = v_kanban
    AND kf.slug IN ('step_5', 'revisoes_comite', 'segundo_comite')
    AND i.fase_id = kf.id
    AND i.campo_slug = 'negociacao_linhas';

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, chave_compartilhada
  )
  SELECT kf.id, 37, 'Negociação', 'texto_longo', true, false, 'negociacao_linhas',
         '{"widget":"negocio_negociacao"}'::jsonb, 'negocio:negociacao_linhas'
  FROM public.kanban_fases kf
  WHERE kf.kanban_id = v_kanban
    AND kf.slug IN ('step_5', 'revisoes_comite', 'segundo_comite')
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = kf.id
        AND i.campo_slug = 'negociacao_linhas'
    );
END $$;

INSERT INTO public.kanban_card_checklist_compartilhado (card_id, chave, valor)
SELECT c.id,
       'negocio:negociacao_linhas',
       to_jsonb(p.negociacao_linhas::text)
FROM public.kanban_cards c
JOIN public.processo_step_one p ON p.id = c.processo_step_one_id
WHERE c.kanban_id = 'c57120a0-991c-422b-8def-4d16a9411d45'
  AND jsonb_typeof(p.negociacao_linhas) = 'array'
  AND jsonb_array_length(p.negociacao_linhas) > 0
ON CONFLICT (card_id, chave) DO NOTHING;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('616', 'portfolio_checklist_negociacao')
ON CONFLICT (version) DO NOTHING;
