-- 284: Funil Step One — Dados dos Condomínios com faixas Premium / Intermediária / Entrada.

DO $$
DECLARE
  v_fase_id UUID;
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
    RAISE NOTICE '284: fase dados_condominios não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens
  SET
    ordem = 1,
    placeholder = 'Use as abas por condomínio: caracterização geral e, em cada faixa (Premium, Intermediária, Entrada), liquidez, lotes, casas e locação.'
  WHERE fase_id = v_fase_id
    AND label = 'Pesquisa de condomínios prospectados';

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Para cada condomínio da Tabela de Condomínios (fase Dados da Cidade), use as abas do checklist:

1. Caracterização do condomínio (fora das faixas)
   • Localização e contexto
   • Características do empreendimento
   • Tempo de condomínio
   • Construções em andamento (venda vs. cliente final)
   • Características buscadas e elogiadas pelos compradores
   • Mapa com pins (opcional)

2. Faixas de produto — preencha as três abas:
   • Faixa Premium
   • Faixa Intermediária
   • Faixa de Entrada

   Em cada faixa: Liquidez e Valorização Exponencial (oferta, demanda, volume, lote padrão), Sobre os lotes, indicadores de casas e locação.

Metodologia de pesquisa — três fontes
• Pesquisa online — portais, incorporadoras, Google Maps e redes sociais.
• Contato com corretores — ligações e mensagens no condomínio.
• Destaques — visitas, anúncios em evidência e conversas com moradores.

As respostas ficam salvas na linha correspondente da tabela de condomínios (fase anterior).
$instr$
  WHERE id = v_fase_id;
END;
$$;
