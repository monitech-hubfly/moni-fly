-- 279: Funil Step One — campos de caracterização do condomínio (fase Dados dos Condomínios).
-- Inseridos antes de "Pesquisa de condomínios prospectados" (idempotente).

DO $$
DECLARE
  v_fase_id UUID;
  v_label_mapa CONSTANT TEXT :=
    'Mapa do Condomínio (cole o mapa com a infraestrutura demarcada por Pins)';
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('dados_condominios', 'stepone_dados_cond')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'dados_condominios' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '279: fase dados_condominios não encontrada; pulando.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 1, 'Localização – Condomínio e Contexto', 'texto_longo', true, true,
    'Posicionamento do condomínio, público e dinâmica de mercado.'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id AND i.label = 'Localização – Condomínio e Contexto'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 2, 'Características do Condomínio', 'texto_longo', true, true,
    'Infraestrutura, padrão de produto e maturidade.'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id AND i.label = 'Características do Condomínio'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 3, 'Tempo de Condomínio', 'texto_curto', true, true,
    'Liquidez e valorização exponencial — tempo de existência ou maturação do empreendimento.'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id AND i.label = 'Tempo de Condomínio'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 4, 'Oferta Atual (Estoque)', 'texto_longo', true, true,
    'Perfil das casas disponíveis, tipologias e faixa de preço.'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id AND i.label = 'Oferta Atual (Estoque)'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 5, 'Demanda (Histórico de Vendas)', 'texto_longo', true, true, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id AND i.label = 'Demanda (Histórico de Vendas)'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 6, 'Volume, velocidade e comportamento de compra', 'texto_longo', true, true, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id AND i.label = 'Volume, velocidade e comportamento de compra'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 7, 'Tamanho lote padrão', 'texto_curto', true, true, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id AND i.label = 'Tamanho lote padrão'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 8, v_label_mapa, 'anexo', true, true, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id
      AND (i.label = v_label_mapa OR i.label ILIKE 'Mapa d% Condom%nio (cole o mapa%')
  );

  UPDATE public.kanban_fase_checklist_itens SET ordem = 1
  WHERE fase_id = v_fase_id AND label = 'Localização – Condomínio e Contexto';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 2
  WHERE fase_id = v_fase_id AND label = 'Características do Condomínio';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 3
  WHERE fase_id = v_fase_id AND label = 'Tempo de Condomínio';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 4
  WHERE fase_id = v_fase_id AND label = 'Oferta Atual (Estoque)';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 5
  WHERE fase_id = v_fase_id AND label = 'Demanda (Histórico de Vendas)';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 6
  WHERE fase_id = v_fase_id AND label = 'Volume, velocidade e comportamento de compra';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 7
  WHERE fase_id = v_fase_id AND label = 'Tamanho lote padrão';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 8
  WHERE fase_id = v_fase_id
    AND (label = v_label_mapa OR label ILIKE 'Mapa d% Condom%nio (cole o mapa%');

  UPDATE public.kanban_fase_checklist_itens SET ordem = 9
  WHERE fase_id = v_fase_id AND label = 'Pesquisa de condomínios prospectados';

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Preencha primeiro a caracterização do condomínio (localização, características, liquidez, lote padrão e mapa com pins) e em seguida a pesquisa de condomínios prospectados.

Realize a pesquisa de mercado para cada condomínio prospectado na fase Dados da Cidade (item "Tabela de Condomínios").

Use as abas do checklist para alternar entre os condomínios da Tabela de Condomínios (fase Dados da Cidade) e responda todas as perguntas em cada um.

2. Metodologia de pesquisa — três fontes
• Pesquisa online — portais imobiliários, sites de incorporadoras, Google Maps e redes sociais.
• Contato com corretores — ligações e mensagens para corretores que atuam no condomínio.
• Destaques — informações obtidas em visitas, anúncios em evidência e conversas com moradores.

3. Preparação para contato

3.1 Seleção
Selecione na tabela da fase Dados da Cidade os condomínios com maior potencial (tickets, giro e proximidade). Priorize os que aparecem nos portais e têm corretores ativos.

3.2 Abordagem padrão
"Olá, [nome]! Sou franqueado Moni e estou mapeando condomínios na região de [cidade]. Você atua no [condomínio]? Poderia me ajudar com algumas informações sobre lotes, casas à venda e valores praticados? Agradeço desde já!"

As respostas ficam salvas na linha correspondente da tabela de condomínios (fase anterior).
$instr$
  WHERE id = v_fase_id;
END;
$$;
