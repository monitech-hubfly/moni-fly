-- 584: Funil Loteadores — uma coluna «Entrar em contato», remove fases e move cards.
-- Idempotente. Fases saem do board com ativo = false (não DELETE).
-- Slug de Passagem permanece passagem_waysers_moni_inc; só o nome vira Passagem IMOB.
--
-- Destino dos cards que estavam nas fases removidas (fase seguinte que continua no funil):
--   R1 Conceito            → NDA
--   Opção                  → Aguardando Ficha
--   Acoplamento            → Viabilidade / Premissas
--   Executar Material      → Validação
--   Cto c/ Precedentes     → Passagem IMOB
--   Diligência             → Passagem IMOB
--   Cto Showroom           → Passagem IMOB
--   Passagem para Waysers  → Assinados  (antes de receber os cards acima)
-- Card do loteador «Teste Fer» é excluído.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  v_contato UUID;
  v_ids UUID[];
  v_moved INT;
  v_restantes INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome IN ('Funil Loteadores', 'Funil Moní INC')
    ORDER BY CASE WHEN nome = 'Funil Loteadores' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '584: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_contato
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'primeiro_contato_moni_inc'
  LIMIT 1;

  IF v_contato IS NULL THEN
    UPDATE public.kanban_fases
    SET slug = 'primeiro_contato_moni_inc',
        nome = 'Entrar em contato',
        ativo = true,
        ordem = 1
    WHERE kanban_id = v_kanban_id
      AND slug = 'loteador_cadastro'
    RETURNING id INTO v_contato;
  END IF;

  IF v_contato IS NULL THEN
    INSERT INTO public.kanban_fases (
      kanban_id, nome, slug, ordem, sla_dias, ativo, materiais
    )
    VALUES (
      v_kanban_id, 'Entrar em contato', 'primeiro_contato_moni_inc', 1, 1, true, '[]'::jsonb
    )
    RETURNING id INTO v_contato;
  END IF;

  UPDATE public.kanban_fases
  SET nome = 'Entrar em contato', ativo = true
  WHERE id = v_contato
    AND (nome IS DISTINCT FROM 'Entrar em contato' OR ativo IS DISTINCT FROM true);

  UPDATE public.kanban_cards c
  SET fase_id = v_contato,
      updated_at = now()
  WHERE c.kanban_id = v_kanban_id
    AND c.fase_id <> v_contato
    AND c.fase_id IN (
      SELECT f.id
      FROM public.kanban_fases f
      WHERE f.kanban_id = v_kanban_id
        AND f.id <> v_contato
        AND (
          f.slug = 'loteador_cadastro'
          OR lower(btrim(f.nome)) = 'entrar em contato'
        )
    );
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE '584: Entrar em contato unificada — % card(s) movidos', v_moved;

  UPDATE public.kanban_fases
  SET ativo = false
  WHERE kanban_id = v_kanban_id
    AND id <> v_contato
    AND (
      slug = 'loteador_cadastro'
      OR lower(btrim(nome)) = 'entrar em contato'
    );

  SELECT COALESCE(array_agg(c.id), ARRAY[]::uuid[])
  INTO v_ids
  FROM public.kanban_cards c
  LEFT JOIN public.rede_loteadores rl ON rl.id = c.rede_loteador_id
  WHERE c.kanban_id = v_kanban_id
    AND (
      lower(btrim(COALESCE(rl.nome, ''))) = 'teste fer'
      OR lower(btrim(c.titulo)) LIKE '%teste fer%'
    );

  IF COALESCE(array_length(v_ids, 1), 0) > 0 THEN
    IF to_regclass('public.kanban_perdas') IS NOT NULL THEN
      DELETE FROM public.kanban_perdas WHERE card_id = ANY (v_ids);
    END IF;
    IF to_regclass('public.kanban_ganhos') IS NOT NULL THEN
      DELETE FROM public.kanban_ganhos WHERE card_id = ANY (v_ids);
    END IF;
    DELETE FROM public.kanban_cards WHERE id = ANY (v_ids);
    RAISE NOTICE '584: card Teste Fer excluído (%).', array_length(v_ids, 1);
  ELSE
    RAISE NOTICE '584: card Teste Fer não encontrado — nada a excluir.';
  END IF;

  -- Passagem → Assinados antes de receber cards das fases de contrato removidas.
  UPDATE public.kanban_cards c
  SET fase_id = dest.id,
      entered_fase_at = now(),
      updated_at = now()
  FROM public.kanban_fases orig, public.kanban_fases dest
  WHERE c.kanban_id = v_kanban_id
    AND c.fase_id = orig.id
    AND orig.kanban_id = v_kanban_id
    AND orig.slug = 'passagem_waysers_moni_inc'
    AND dest.kanban_id = v_kanban_id
    AND dest.slug = 'assinados_moni_inc';
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE '584: Passagem → Assinados: % card(s)', v_moved;

  UPDATE public.kanban_cards c
  SET fase_id = dest.id,
      entered_fase_at = now(),
      updated_at = now()
  FROM public.kanban_fases orig, public.kanban_fases dest
  WHERE c.kanban_id = v_kanban_id
    AND c.fase_id = orig.id
    AND orig.kanban_id = v_kanban_id
    AND dest.kanban_id = v_kanban_id
    AND (
      (orig.slug = 'r1_conceito_moni_inc' AND dest.slug = 'nda_moni_inc')
      OR (orig.slug = 'opcao_moni_inc' AND dest.slug = 'aguardando_ficha_moni_inc')
      OR (orig.slug = 'acoplamento_moni_inc' AND dest.slug = 'viabilidade_moni_inc')
      OR (orig.slug = 'execucao_material_moni_inc' AND dest.slug = 'validacao_moni_inc')
      OR (
        orig.slug IN (
          'cto_precedentes_moni_inc',
          'diligencia_moni_inc',
          'cto_showroom_moni_inc'
        )
        AND dest.slug = 'passagem_waysers_moni_inc'
      )
    );
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE '584: cards de fases removidas realocados: %', v_moved;

  UPDATE public.kanban_fases
  SET ativo = false
  WHERE kanban_id = v_kanban_id
    AND slug IN (
      'r1_conceito_moni_inc',
      'opcao_moni_inc',
      'acoplamento_moni_inc',
      'execucao_material_moni_inc',
      'cto_precedentes_moni_inc',
      'diligencia_moni_inc',
      'cto_showroom_moni_inc'
    );

  UPDATE public.kanban_fases
  SET nome = 'Passagem IMOB',
      ativo = true
  WHERE kanban_id = v_kanban_id
    AND slug = 'passagem_waysers_moni_inc'
    AND (nome IS DISTINCT FROM 'Passagem IMOB' OR ativo IS DISTINCT FROM true);

  UPDATE public.kanban_fases AS f
  SET ordem = v.ordem
  FROM (
    VALUES
      ('primeiro_contato_moni_inc', 1),
      ('nda_moni_inc', 2),
      ('aguardando_ficha_moni_inc', 3),
      ('novo_produto_moni_inc', 4),
      ('viabilidade_moni_inc', 5),
      ('validacao_moni_inc', 6),
      ('r2_plano_teorico_moni_inc', 7),
      ('revisoes_moni_inc', 8),
      ('acoplamento_gbox_moni_inc', 9),
      ('comite_moni_inc', 10),
      ('revisoes_pos_comite_moni_inc', 11),
      ('passagem_waysers_moni_inc', 12),
      ('contrato_parceria_moni_inc', 13),
      ('assinados_moni_inc', 14)
  ) AS v(slug, ordem)
  WHERE f.kanban_id = v_kanban_id
    AND f.slug = v.slug
    AND f.ordem IS DISTINCT FROM v.ordem;

  SELECT COUNT(*)::int INTO v_restantes
  FROM public.kanban_cards c
  JOIN public.kanban_fases f ON f.id = c.fase_id
  WHERE c.kanban_id = v_kanban_id
    AND f.slug IN (
      'loteador_cadastro',
      'r1_conceito_moni_inc',
      'opcao_moni_inc',
      'acoplamento_moni_inc',
      'execucao_material_moni_inc',
      'cto_precedentes_moni_inc',
      'diligencia_moni_inc',
      'cto_showroom_moni_inc'
    );

  IF v_restantes > 0 THEN
    RAISE EXCEPTION '584: ainda há % card(s) em fases que seriam desativadas', v_restantes;
  END IF;

  RAISE NOTICE '584: Funil Loteadores enxugado.';
END $$;

NOTIFY pgrst, 'reload schema';
