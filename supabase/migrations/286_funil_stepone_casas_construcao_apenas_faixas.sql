-- 286: Funil Step One — construções / como são / faixas de preço apenas por faixa (não na caracterização global).

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
    RAISE NOTICE '286: fase dados_condominios não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens
  SET placeholder = 'Caracterização e lotes são globais por condomínio. Construções, perfil das casas e faixas de preço ficam em cada aba de faixa (Premium, Intermediária, Entrada).'
  WHERE fase_id = v_fase_id
    AND label = 'Pesquisa de condomínios prospectados';

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Para cada condomínio da Tabela de Condomínios (fase Dados da Cidade), use as abas do checklist:

1. Caracterização do condomínio (fora das faixas)
   • Localização – Condomínio e Contexto
   • Características do Condomínio
   • Tempo de Condomínio
   • Oferta Atual (Estoque)*
   • Características buscadas e elogiadas pelos compradores
   • Mapa com pins (opcional)
   • Volume, velocidade e comportamento de compra do condomínio*

2. Sobre os lotes (fora das faixas)
   • Tamanho lote padrão*
   • Quantos lotes e quantos disponíveis para venda*
   • Tamanho médio dos lotes*
   • Preço médio do m² de venda dos lotes*
   • Área de maior valorização e demanda*

3. Faixas de produto — preencha as três abas:
   • Faixa Premium
   • Faixa Intermediária
   • Faixa de Entrada

   Em cada faixa (Liquidez e Valorização Exponencial):
   • Quantas casas estão sendo construídas? Dessas, quantas estão para venda e quantas são para cliente final?
   • Como são essas casas?
   • Quantas casas estão prontas?*
   • Quais as faixas de preço dessas casas?
   • Preço do m², tempo de venda, vendas nos últimos 12 meses, remanescentes e locação*

Metodologia de pesquisa — três fontes
• Pesquisa online — portais, incorporadoras, Google Maps e redes sociais.
• Contato com corretores — ligações e mensagens no condomínio.
• Destaques — visitas, anúncios em evidência e conversas com moradores.

Campos marcados com * são obrigatórios para concluir a sessão do condomínio.

As respostas ficam salvas na linha correspondente da tabela de condomínios (fase anterior).
$instr$
  WHERE id = v_fase_id;
END;
$$;
