-- 270: Funil Step One — Dados da Cidade: indicadores IBGE + mapa interativo (Steps Viabilidade etapa 1).

ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
  CHECK (tipo IN (
    'texto_curto',
    'texto_longo',
    'email',
    'telefone',
    'numero',
    'url',
    'anexo',
    'anexo_template',
    'checkbox',
    'data',
    'hora',
    'tabela',
    'condominio',
    'pesquisa_condominio',
    'listagem_casas_zap',
    'dados_cidade_ibge',
    'mapa_praca'
  ));

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
    RAISE NOTICE '270: fase dados_cidade não encontrada; pulando.';
    RETURN;
  END IF;

  -- Campos manuais substituídos pela busca automática IBGE (Seção 1 do Step 1 legado).
  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id
    AND i.fase_id = v_fase_id
    AND i.label IN ('População estimada', 'Renda média per capita');

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id
    AND label IN ('População estimada', 'Renda média per capita');

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 3, 'Dados da cidade (IBGE)', 'dados_cidade_ibge', true, true,
    'Indicadores automáticos: população, PIB per capita, renda, área e densidade.'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id AND i.label = 'Dados da cidade (IBGE)'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 4, 'Mapa interativo da praça', 'mapa_praca', true, true,
    'OpenStreetMap + equipamentos urbanos (escolas, hospitais, comércio, parques etc.).'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id AND i.label = 'Mapa interativo da praça'
  );

  UPDATE public.kanban_fase_checklist_itens SET ordem = 1
  WHERE fase_id = v_fase_id AND label = 'Cidade de interesse';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 2
  WHERE fase_id = v_fase_id AND label = 'Estado';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 3, tipo = 'dados_cidade_ibge',
    placeholder = 'Indicadores automáticos: população, PIB per capita, renda, área e densidade.'
  WHERE fase_id = v_fase_id AND label = 'Dados da cidade (IBGE)';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 4, tipo = 'mapa_praca',
    placeholder = 'OpenStreetMap + equipamentos urbanos (escolas, hospitais, comércio, parques etc.).'
  WHERE fase_id = v_fase_id AND label = 'Mapa interativo da praça';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 5
  WHERE fase_id = v_fase_id AND label = 'Tabela de Condomínios';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 6
  WHERE fase_id = v_fase_id AND label = 'Observações sobre a praça';

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Analise a praça de atuação do negócio:

1. Confira cidade e estado do processo
2. Revise os indicadores IBGE (população, PIB, renda, área, densidade)
3. Explore o mapa interativo com equipamentos urbanos da região
4. Selecione condomínios na Tabela de Condomínios (cadastro ou novos prospects)
5. Registre observações sobre a praça

Os itens IBGE e mapa usam a mesma ferramenta do Step 1 — Mapeamento da Região (Dados da Cidade).
$instr$
  WHERE id = v_fase_id;
END;
$$;
