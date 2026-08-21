-- 371: Funil Step One — ordem canónica das fases (paridade PROD).
-- Alinha colunas do board: Onboarding → … → Mapa antes de Dados dos Condomínios → … → Hipóteses.
-- Idempotente; absorve pre_batalha em batalha (301); cria fases ausentes (276/304/305).

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_pre_batalha_id UUID;
  v_fase_batalha_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
     OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  ORDER BY CASE WHEN id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '371: kanban Funil Step One não encontrado; pulando.';
    RETURN;
  END IF;

  -- Onboarding (276)
  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug IN ('onboarding', 'stepone_onboarding')
  ) THEN
    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes)
    VALUES (
      v_kanban_id,
      'Onboarding',
      'onboarding',
      1,
      1,
      true,
      $instr$
<p>Bem-vindo ao Funil Step One. Conclua os itens desta fase antes de avançar para <strong>Dados do Candidato</strong>.</p>
$instr$
    );
  END IF;

  -- Configurador de casas (304 — mínimo)
  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug IN ('configurador_casas', 'stepone_configurador_casas')
  ) THEN
    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
    VALUES (v_kanban_id, 'Configurador de casas', 'configurador_casas', 8, 1, true);
  END IF;

  -- Batalha de Casas (305 — mínimo; checklist vem da 305 completa se db:sync-dev)
  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug IN ('batalha_casas', 'stepone_batalha_casas')
  ) THEN
    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
    VALUES (v_kanban_id, 'Batalha de Casas', 'batalha_casas', 10, 1, true);
  END IF;

  SELECT id INTO v_fase_batalha_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('batalha', 'stepone_batalha')
    AND COALESCE(ativo, true) = true
  ORDER BY CASE WHEN slug = 'batalha' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT id INTO v_fase_pre_batalha_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('pre_batalha', 'stepone_pre_batalha')
    AND COALESCE(ativo, true) = true
  ORDER BY CASE WHEN slug = 'pre_batalha' THEN 0 ELSE 1 END
  LIMIT 1;

  -- Absorve pre_batalha → batalha (301)
  IF v_fase_pre_batalha_id IS NOT NULL AND v_fase_batalha_id IS NOT NULL THEN
    UPDATE public.kanban_cards SET fase_id = v_fase_batalha_id WHERE fase_id = v_fase_pre_batalha_id;
    UPDATE public.kanban_fases SET ativo = false, instrucoes = NULL WHERE id = v_fase_pre_batalha_id;
  ELSIF v_fase_pre_batalha_id IS NOT NULL AND v_fase_batalha_id IS NULL THEN
    UPDATE public.kanban_fases
    SET slug = 'batalha', nome = 'Pré Batalha', ativo = true
    WHERE id = v_fase_pre_batalha_id;
    v_fase_batalha_id := v_fase_pre_batalha_id;
  END IF;

  IF v_fase_batalha_id IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET nome = 'Pré Batalha', slug = 'batalha', ativo = true
    WHERE id = v_fase_batalha_id;
  END IF;

  UPDATE public.kanban_fases
  SET ativo = false, instrucoes = NULL
  WHERE kanban_id = v_kanban_id
    AND slug IN ('lista_condominios', 'stepone_lista_cond');

  -- Ordem canónica PROD (kanban-ids.ts / stepone-fase-slugs.ts)
  UPDATE public.kanban_fases
  SET ordem = CASE slug
    WHEN 'onboarding' THEN 1
    WHEN 'stepone_onboarding' THEN 1
    WHEN 'dados_candidato' THEN 2
    WHEN 'stepone_dados_candidato' THEN 2
    WHEN 'dados_cidade' THEN 3
    WHEN 'stepone_dados_cidade' THEN 3
    WHEN 'mapa_competidores' THEN 4
    WHEN 'stepone_mapa' THEN 4
    WHEN 'dados_condominios' THEN 5
    WHEN 'stepone_dados_cond' THEN 5
    WHEN 'lotes_disponiveis' THEN 6
    WHEN 'stepone_lotes' THEN 6
    WHEN 'batalha' THEN 7
    WHEN 'stepone_batalha' THEN 7
    WHEN 'configurador_casas' THEN 8
    WHEN 'stepone_configurador_casas' THEN 8
    WHEN 'bca' THEN 9
    WHEN 'stepone_bca' THEN 9
    WHEN 'bca_batalha_casas' THEN 9
    WHEN 'batalha_casas' THEN 10
    WHEN 'stepone_batalha_casas' THEN 10
    WHEN 'escolha' THEN 11
    WHEN 'stepone_escolha' THEN 11
    WHEN 'hipoteses' THEN 12
    WHEN 'stepone_hipoteses' THEN 12
    ELSE ordem
  END,
  slug = CASE slug
    WHEN 'stepone_onboarding' THEN 'onboarding'
    WHEN 'stepone_dados_candidato' THEN 'dados_candidato'
    WHEN 'stepone_dados_cidade' THEN 'dados_cidade'
    WHEN 'stepone_mapa' THEN 'mapa_competidores'
    WHEN 'stepone_dados_cond' THEN 'dados_condominios'
    WHEN 'stepone_lotes' THEN 'lotes_disponiveis'
    WHEN 'stepone_batalha' THEN 'batalha'
    WHEN 'stepone_configurador_casas' THEN 'configurador_casas'
    WHEN 'stepone_bca' THEN 'bca'
    WHEN 'bca_batalha_casas' THEN 'bca'
    WHEN 'stepone_batalha_casas' THEN 'batalha_casas'
    WHEN 'stepone_escolha' THEN 'escolha'
    WHEN 'stepone_hipoteses' THEN 'hipoteses'
    ELSE slug
  END
  WHERE kanban_id = v_kanban_id
    AND COALESCE(ativo, true) = true
    AND slug NOT IN ('pre_batalha', 'stepone_pre_batalha', 'lista_condominios', 'stepone_lista_cond');

END;
$$;

NOTIFY pgrst, 'reload schema';
