-- 338: Funil Loteadores — reordenar e complementar fases (incremental).
-- Regras: reaproveitar slugs/IDs existentes; NÃO mover cards; NÃO inativar fases com cards;
-- criar fase nova somente se o slug alvo ainda não existir.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_dados UUID;
  v_fase_viab UUID;
  v_cards_dados INT;
  v_cards_viab INT;
  r RECORD;
  v_instr_viab TEXT := $instr$
Analise viabilidade técnica e comercial: competidores, showroom, casas do catálogo, riscos e parecer.
Os dados cadastrais do loteador ficam no painel persistente «Dados do Loteador» (todas as fases).
$instr$;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome IN ('Funil Loteadores', 'Funil Moní INC')
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '338: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  -- ─── Fase 3: Viabilidade ───────────────────────────────────────────────────
  -- Prioridade: reaproveitar viabilidade_moni_inc; senão renomear dados_loteador_moni_inc;
  -- criar viabilidade_moni_inc apenas se nenhuma das duas existir.

  SELECT id INTO v_fase_viab
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'viabilidade_moni_inc'
  LIMIT 1;

  SELECT id INTO v_fase_dados
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'dados_loteador_moni_inc'
  LIMIT 1;

  IF v_fase_viab IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET
      nome = 'Viabilidade',
      ordem = 3,
      sla_dias = COALESCE(sla_dias, 5),
      ativo = true,
      instrucoes = COALESCE(NULLIF(btrim(instrucoes), ''), v_instr_viab)
    WHERE id = v_fase_viab;

    RAISE NOTICE '338: Viabilidade — reaproveitada fase existente slug=viabilidade_moni_inc id=%', v_fase_viab;

    IF v_fase_dados IS NOT NULL AND v_fase_dados <> v_fase_viab THEN
      SELECT COUNT(*) INTO v_cards_dados FROM public.kanban_cards WHERE fase_id = v_fase_dados AND kanban_id = v_kanban_id;
      SELECT COUNT(*) INTO v_cards_viab FROM public.kanban_cards WHERE fase_id = v_fase_viab AND kanban_id = v_kanban_id;

      IF v_cards_dados = 0 AND v_cards_viab >= 0 THEN
        UPDATE public.kanban_fases
        SET ativo = false, ordem = 98, nome = 'Dados do Loteador (legado — sem cards)'
        WHERE id = v_fase_dados;
        RAISE NOTICE '338: dados_loteador_moni_inc inativada (0 cards); validar manualmente se necessário.';
      ELSE
        RAISE NOTICE '338: ATENÇÃO — coexistem viabilidade_moni_inc e dados_loteador_moni_inc com cards (dados=%, viab=%). Nenhum card movido; validar manualmente.', v_cards_dados, v_cards_viab;
        UPDATE public.kanban_fases
        SET ordem = GREATEST(COALESCE(ordem, 0), 97), ativo = true
        WHERE id = v_fase_dados AND v_cards_dados > 0;
      END IF;
    END IF;

  ELSIF v_fase_dados IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET
      nome = 'Viabilidade',
      ordem = 3,
      sla_dias = COALESCE(sla_dias, 5),
      ativo = true,
      instrucoes = COALESCE(NULLIF(btrim(instrucoes), ''), v_instr_viab)
    WHERE id = v_fase_dados;

    RAISE NOTICE '338: Viabilidade — fase dados_loteador_moni_inc reaproveitada (renomeada), id=%, slug preservado.', v_fase_dados;

  ELSE
    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
    VALUES (v_kanban_id, 'Viabilidade', 'viabilidade_moni_inc', 3, 5, true, v_instr_viab, '[]'::jsonb);
    RAISE NOTICE '338: Viabilidade — fase criada slug=viabilidade_moni_inc (funil sem fase prévia na posição 3).';
  END IF;

  -- ─── Fases novas (somente se slug não existir) ───────────────────────────────

  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'execucao_material_moni_inc'
  ) THEN
    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
    VALUES (
      v_kanban_id, 'Execução do Material', 'execucao_material_moni_inc', 5, 5, true,
      'Produza simulações, oferta de showroom e materiais comerciais/institucionais.', '[]'::jsonb
    );
    RAISE NOTICE '338: criada execucao_material_moni_inc.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'batalha_casas_moni_inc'
  ) THEN
    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
    VALUES (v_kanban_id, 'Batalha de Casas', 'batalha_casas_moni_inc', 7, NULL, true, NULL, '[]'::jsonb);
    RAISE NOTICE '338: criada batalha_casas_moni_inc.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'revisoes_moni_inc'
  ) THEN
    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
    VALUES (
      v_kanban_id, 'Revisões', 'revisoes_moni_inc', 9, 3, true,
      'Registre ajustes solicitados, responsável, prazo e status da revisão.', '[]'::jsonb
    );
    RAISE NOTICE '338: criada revisoes_moni_inc.';
  END IF;

  -- ─── Atualizar fases existentes (ordem, nome, instruções) — sem recriar ───

  UPDATE public.kanban_fases AS kf
  SET
    nome = v.nome,
    ordem = v.ordem,
    sla_dias = COALESCE(v.sla_dias, kf.sla_dias),
    ativo = COALESCE(kf.ativo, true),
    instrucoes = CASE
      WHEN v.instrucoes IS NOT NULL THEN v.instrucoes
      ELSE kf.instrucoes
    END
  FROM (
    VALUES
      ('Primeiro Contato'::text, 'primeiro_contato_moni_inc'::text, 1, 2::integer, NULL::text),
      ('R1 Executada — Conceito', 'r1_conceito_moni_inc', 2, 5, NULL),
      ('Acoplamento', 'acoplamento_moni_inc', 4, 5,
        'Esta fase referencia o Kanban de Acoplamento. Não executa acoplamento aqui — use os links e status abaixo.'::text),
      ('Execução do Material', 'execucao_material_moni_inc', 5, 5, NULL),
      ('R2 Apresentar Plano Teórico', 'r2_plano_teorico_moni_inc', 6, 2, NULL),
      ('Batalha de Casas', 'batalha_casas_moni_inc', 7, NULL::integer, NULL),
      ('Comitê', 'comite_moni_inc', 8, 3, NULL),
      ('Revisões', 'revisoes_moni_inc', 9, 3, NULL),
      ('R3 Ajustes Finais nas Propostas', 'r3_ajustes_finais_moni_inc', 10, 2, NULL),
      ('Contrato', 'fechar_contrato_moni_inc', 11, 5, NULL),
      ('Abertura da SPE', 'abertura_spe_moni_inc', 12, 3, NULL),
      ('Diligência', 'diligencia_moni_inc', 13, 10, NULL),
      ('Moní Capital', 'moni_capital_moni_inc', 14, NULL::integer, NULL),
      ('Contrato de Parceria', 'contrato_parceria_moni_inc', 15, NULL::integer, NULL)
  ) AS v(nome, slug, ordem, sla_dias, instrucoes)
  WHERE kf.kanban_id = v_kanban_id
    AND kf.slug = v.slug;

  -- Viabilidade: ordem/nome já tratados acima; garantir ordem 3 nas slugs canônicas
  UPDATE public.kanban_fases
  SET ordem = 3, ativo = true
  WHERE kanban_id = v_kanban_id
    AND slug IN ('viabilidade_moni_inc', 'dados_loteador_moni_inc')
    AND COALESCE(ativo, true) = true
    AND nome = 'Viabilidade';

  -- Relatório em NOTICE (cards por fase)
  FOR r IN
    SELECT kf.slug, kf.nome, kf.ordem, COALESCE(kf.ativo, true) AS ativo, COUNT(kc.id)::int AS cards
    FROM public.kanban_fases kf
    LEFT JOIN public.kanban_cards kc ON kc.fase_id = kf.id AND kc.kanban_id = v_kanban_id
    WHERE kf.kanban_id = v_kanban_id
    GROUP BY kf.id, kf.slug, kf.nome, kf.ordem, kf.ativo
    ORDER BY kf.ordem NULLS LAST, kf.nome
  LOOP
    RAISE NOTICE '338: fase slug=% nome=% ordem=% cards=% ativo=%',
      r.slug, r.nome, r.ordem, r.cards, r.ativo;
  END LOOP;
END;
$$;
