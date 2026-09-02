-- 272: Funil Step One — Dados da Cidade: uma aba por cidade da área de atuação do franqueado.

DO $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('dados_cidade', 'stepone_dados_cidade')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'dados_cidade' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '272: fase dados_cidade não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Analise cada cidade da área de atuação do franqueado (use as abas no checklist):

1. Revise os indicadores IBGE (população, PIB, renda, área, densidade)
2. Explore o mapa interativo com equipamentos urbanos da região
3. Descreva brevemente a cidade e envie o mapa com condomínios demarcados por pins
4. Selecione condomínios na Tabela de Condomínios (cadastro ou novos prospects)
5. Registre observações sobre a praça

Repita para todas as cidades cadastradas em Rede de Franqueados → Área de atuação.
$instr$
  WHERE id = v_fase_id;
END;
$$;
