-- Funil Loteadores — relatório pós-migration 338–342 (SQL Editor → Run)
-- Lista fases, cards, checklists novos e itens legados preservados.

DO $$
DECLARE
  v_kanban_id UUID;
  r RECORD;
BEGIN
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE EXCEPTION 'Kanban Funil Loteadores não encontrado.';
  END IF;

  RAISE NOTICE '=== FASES (reaproveitadas / renomeadas / criadas) ===';
  FOR r IN
    SELECT
      kf.id,
      kf.slug,
      kf.nome,
      kf.ordem,
      COALESCE(kf.ativo, true) AS ativo,
      COUNT(kc.id)::int AS cards,
      COUNT(DISTINCT ci.id) FILTER (WHERE ci.campo_slug IS NOT NULL) AS checklist_novos,
      COUNT(DISTINCT ci.id) FILTER (WHERE ci.campo_slug IS NULL) AS checklist_legado
    FROM public.kanban_fases kf
    LEFT JOIN public.kanban_cards kc ON kc.fase_id = kf.id AND kc.kanban_id = v_kanban_id
    LEFT JOIN public.kanban_fase_checklist_itens ci ON ci.fase_id = kf.id
    WHERE kf.kanban_id = v_kanban_id
    GROUP BY kf.id, kf.slug, kf.nome, kf.ordem, kf.ativo
    ORDER BY kf.ordem NULLS LAST, kf.nome
  LOOP
    RAISE NOTICE 'fase id=% slug=% nome=% ordem=% ativo=% cards=% checklist_novos=% checklist_legado=%',
      r.id, r.slug, r.nome, r.ordem, r.ativo, r.cards, r.checklist_novos, r.checklist_legado;
  END LOOP;

  RAISE NOTICE '=== DUPLICATAS Viabilidade (validar se ambas ativas) ===';
  FOR r IN
    SELECT kf.slug, kf.nome, COALESCE(kf.ativo, true) AS ativo, COUNT(kc.id)::int AS cards
    FROM public.kanban_fases kf
    LEFT JOIN public.kanban_cards kc ON kc.fase_id = kf.id
    WHERE kf.kanban_id = v_kanban_id
      AND kf.slug IN ('viabilidade_moni_inc', 'dados_loteador_moni_inc')
    GROUP BY kf.id, kf.slug, kf.nome, kf.ativo
  LOOP
    RAISE NOTICE 'viabilidade-candidata slug=% nome=% ativo=% cards=%', r.slug, r.nome, r.ativo, r.cards;
  END LOOP;
END;
$$;

-- Resultado tabular (copiar do painel Results se preferir)
SELECT
  kf.ordem,
  kf.slug,
  kf.nome,
  COALESCE(kf.ativo, true) AS ativo,
  COUNT(kc.id)::int AS cards,
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.campo_slug IS NOT NULL) AS campos_novos,
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.campo_slug IS NULL) AS campos_legados
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
LEFT JOIN public.kanban_cards kc ON kc.fase_id = kf.id
LEFT JOIN public.kanban_fase_checklist_itens ci ON ci.fase_id = kf.id
WHERE k.id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
   OR k.nome = 'Funil Loteadores'
GROUP BY kf.id, kf.ordem, kf.slug, kf.nome, kf.ativo
ORDER BY kf.ordem NULLS LAST, kf.nome;
