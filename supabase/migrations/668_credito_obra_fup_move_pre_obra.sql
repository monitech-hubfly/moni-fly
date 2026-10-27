-- 668: Cards de Crédito Obra que já estão em FUP Cartório (ou depois)
-- avançam o card de Pré Obra e Obra para Crédito Aprovado, se ele ainda
-- estiver antes dessa fase. Concluídos marca credito_finalizado.
-- Idempotente. Não retrocede.

DO $$
DECLARE
  v_operacoes uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
  v_credito uuid := '6463af1d-850d-4958-b74c-404f8d668e21'::uuid;
  v_fup_ordem int;
  v_dest_id uuid;
  v_dest_ordem int;
  v_concluidos_ordem int;
  r record;
  v_ordem_atual int;
  v_slug_atual text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_operacoes) THEN
    SELECT id INTO v_operacoes
    FROM public.kanbans
    WHERE nome IN ('Funil Pré Obra e Obra', 'Funil Operações')
    ORDER BY CASE WHEN nome = 'Funil Pré Obra e Obra' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_credito) THEN
    SELECT id INTO v_credito
    FROM public.kanbans
    WHERE nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito')
    ORDER BY CASE WHEN nome = 'Funil Crédito Obra' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_operacoes IS NULL OR v_credito IS NULL THEN
    RAISE NOTICE '668: funil não encontrado — pulando.';
    RETURN;
  END IF;

  SELECT f.ordem INTO v_fup_ordem
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_credito
    AND f.slug = 'co_followup_cartorio'
  ORDER BY f.ativo DESC, f.ordem
  LIMIT 1;

  SELECT f.id, f.ordem INTO v_dest_id, v_dest_ordem
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_operacoes
    AND f.slug = 'credito_aprovado'
    AND f.ativo = true
  LIMIT 1;

  SELECT f.ordem INTO v_concluidos_ordem
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_credito
    AND f.slug = 'co_sharepoint_3a'
  ORDER BY f.ativo DESC, f.ordem
  LIMIT 1;

  IF v_fup_ordem IS NULL OR v_dest_id IS NULL THEN
    RAISE NOTICE '668: fase FUP ou Crédito Aprovado não encontrada — pulando.';
    RETURN;
  END IF;

  FOR r IN
    SELECT DISTINCT pai.id AS pai_id, ff.ordem AS ordem_filho, ff.slug AS slug_filho
    FROM public.kanban_cards filho
    JOIN public.kanban_fases ff ON ff.id = filho.fase_id
    JOIN public.kanban_cards pai
      ON pai.kanban_id = v_operacoes
     AND COALESCE(pai.arquivado, false) = false
     AND (
       pai.id = filho.origem_card_id
       OR (
         filho.origem_card_id IS NOT NULL
         AND pai.origem_card_id = filho.origem_card_id
       )
       OR (
         filho.projeto_id IS NOT NULL
         AND pai.projeto_id = filho.projeto_id
       )
       OR EXISTS (
         SELECT 1
         FROM public.kanban_card_vinculos v
         WHERE (v.card_origem_id = filho.id AND v.card_destino_id = pai.id)
            OR (v.card_destino_id = filho.id AND v.card_origem_id = pai.id)
       )
     )
    WHERE filho.kanban_id = v_credito
      AND COALESCE(filho.arquivado, false) = false
      AND ff.ordem >= v_fup_ordem
  LOOP
    SELECT f.ordem, f.slug INTO v_ordem_atual, v_slug_atual
    FROM public.kanban_cards c
    JOIN public.kanban_fases f ON f.id = c.fase_id
    WHERE c.id = r.pai_id;

    IF v_slug_atual IS DISTINCT FROM 'credito_aprovado'
       AND (v_ordem_atual IS NULL OR v_dest_ordem IS NULL OR v_ordem_atual < v_dest_ordem)
    THEN
      UPDATE public.kanban_cards
      SET fase_id = v_dest_id
      WHERE id = r.pai_id;

      INSERT INTO public.kanban_historico (card_id, usuario_nome, acao, tipo, detalhe)
      VALUES (
        r.pai_id,
        'Sistema',
        'bastao_retorno',
        'bastao',
        jsonb_build_object(
          'tipo', 'bastao_retorno',
          'descricao', 'Crédito Obra já estava em FUP Cartório ou depois → Pré Obra e Obra em Crédito Aprovado.',
          'fase_slug', r.slug_filho,
          'fase_pai_slug', 'credito_aprovado',
          'esteira', 'Crédito Obra'
        )
      );
    END IF;

    IF v_concluidos_ordem IS NOT NULL AND r.ordem_filho >= v_concluidos_ordem THEN
      UPDATE public.kanban_cards
      SET credito_finalizado = true
      WHERE id = r.pai_id
        AND COALESCE(credito_finalizado, false) = false;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('668', 'credito_obra_fup_move_pre_obra')
ON CONFLICT (version) DO NOTHING;
