-- 436: Funil Portfólio — nova fase «Cto Condições Precedentes» (entre Comitê e Diligência)
--      + renomear «Aprovação Moní - Novo Negócio» → «Análise de Novo Negócio».
-- Idempotente: não duplica slug; renomeia sempre que aplicável.

DO $$
DECLARE
  v_kanban_id uuid;
  v_ordem_step6 int;
BEGIN
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Portfólio' AND COALESCE(ativo, true)
  ORDER BY id
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '436: kanban Funil Portfólio não encontrado.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET nome = 'Análise de Novo Negócio'
  WHERE kanban_id = v_kanban_id
    AND slug = 'aprovacao_moni_novo_negocio'
    AND nome IS DISTINCT FROM 'Análise de Novo Negócio';

  IF EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'cto_condicoes_precedentes'
  ) THEN
    RETURN;
  END IF;

  SELECT ordem INTO v_ordem_step6
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'step_6'
  LIMIT 1;

  IF v_ordem_step6 IS NULL THEN
    v_ordem_step6 := 7;
  END IF;

  UPDATE public.kanban_fases
  SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id
    AND ordem >= v_ordem_step6;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
  VALUES (
    v_kanban_id,
    'Cto Condições Precedentes',
    'cto_condicoes_precedentes',
    v_ordem_step6,
    7,
    true
  );
END $$;

COMMENT ON COLUMN public.processo_step_one.etapa_painel IS
  'Etapa no Painel Novos Negócios: step_1, step_2, aprovacao_moni_novo_negocio, step_3, step_4, acoplamento, step_5, cto_condicoes_precedentes, step_6, step_7, captacao_moni_capital, passagem_wayser, planialtimetrico, sondagem, projeto_legal, aprovacao_condominio, aprovacao_prefeitura, revisao_bca, processos_cartorarios, aguardando_credito, em_obra, moni_care, contabilidade_incorporadora, contabilidade_spe, contabilidade_gestora, credito_terreno, credito_obra';

NOTIFY pgrst, 'reload schema';
