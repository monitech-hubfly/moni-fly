-- 177: Funil Portfólio — coluna "Captação Moní Capital" entre Contrato (step_7) e Passagem para Wayser.
-- Idempotente: não duplica se o slug já existir nesse kanban.

DO $$
DECLARE
  v_kanban_id uuid;
BEGIN
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Portfólio' AND ativo = true
  ORDER BY id
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '177: kanban Funil Portfólio não encontrado.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'captacao_moni_capital'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id
    AND ordem >= 9;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, ativo)
  VALUES (
    v_kanban_id,
    'Captação Moní Capital',
    'captacao_moni_capital',
    9,
    true
  );
END $$;

COMMENT ON COLUMN public.processo_step_one.etapa_painel IS
  'Etapa no Painel Novos Negócios: step_1, step_2, aprovacao_moni_novo_negocio, step_3, step_4, acoplamento, step_5, step_6, step_7, captacao_moni_capital, passagem_wayser, planialtimetrico, sondagem, projeto_legal, aprovacao_condominio, aprovacao_prefeitura, revisao_bca, processos_cartorarios, aguardando_credito, em_obra, moni_care, contabilidade_incorporadora, contabilidade_spe, contabilidade_gestora, credito_terreno, credito_obra';
