-- 280: Funil Step One — campos de caracterização por aba/condomínio (remove itens globais da 279).

DO $$
DECLARE
  v_fase_id UUID;
  v_labels TEXT[] := ARRAY[
    'Localização – Condomínio e Contexto',
    'Características do Condomínio',
    'Tempo de Condomínio',
    'Oferta Atual (Estoque)',
    'Demanda (Histórico de Vendas)',
    'Volume, velocidade e comportamento de compra',
    'Tamanho lote padrão',
    'Mapa do Condomínio (cole o mapa com a infraestrutura demarcada por Pins)'
  ];
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
    RAISE NOTICE '280: fase dados_condominios não encontrada; pulando.';
    RETURN;
  END IF;

  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id
    AND i.fase_id = v_fase_id
    AND (
      i.label = ANY (v_labels)
      OR i.label ILIKE 'Mapa d% Condom%nio (cole o mapa%'
    );

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id
    AND (
      label = ANY (v_labels)
      OR label ILIKE 'Mapa d% Condom%nio (cole o mapa%'
    );

  UPDATE public.kanban_fase_checklist_itens
  SET
    ordem = 1,
    placeholder = 'Use as abas para preencher caracterização, liquidez, mapa e pesquisa de mercado de cada condomínio da Tabela de Condomínios (fase Dados da Cidade).'
  WHERE fase_id = v_fase_id
    AND label = 'Pesquisa de condomínios prospectados';

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Para cada condomínio da Tabela de Condomínios (fase Dados da Cidade), use as abas do checklist e preencha:

1. Caracterização — localização, contexto e características do empreendimento
2. Liquidez e valorização — tempo, oferta, demanda, volume de compra, tamanho de lote padrão e mapa com pins
3. Pesquisa de mercado — perguntas por fonte (online, corretor, destaques)

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
