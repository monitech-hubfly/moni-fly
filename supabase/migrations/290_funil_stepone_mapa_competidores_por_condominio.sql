-- 290: Mapa de Competidores — rótulo alinhado às sessões por condomínio (como Lotes Disponíveis).

DO $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('mapa_competidores', 'stepone_mapa')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'mapa_competidores' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '290: fase mapa_competidores não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens
  SET
    label = 'Listagem de casas por condomínio prospectado',
    placeholder = 'Para cada condomínio da Tabela de Condomínios: varredura ZAP e cadastro manual de casas.'
  WHERE fase_id = v_fase_id
    AND tipo = 'listagem_casas_zap';

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Levante todas as casas anunciadas e vendidas em cada condomínio prospectado e na região, na faixa de valor de venda estimada.

Use o checklist abaixo — uma sessão por condomínio (mesma ordem da Tabela de Condomínios, por ticket médio de casas):
1. Varrer a ZAP (Apify) filtrando pelo condomínio da aba
2. Complementar com casas manuais quando necessário
3. Validar mensalmente o status das casas cadastradas manualmente
4. Registrar a faixa de valor e observações do levantamento

Com base nesse mapa, identifique valores target, programas e estilos do mercado local — insumo para Pré-batalha e Batalha de Casas.
$instr$
  WHERE id = v_fase_id;
END;
$$;
