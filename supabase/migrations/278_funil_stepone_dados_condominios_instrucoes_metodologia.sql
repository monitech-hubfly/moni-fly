-- 278: Funil Step One — metodologia de pesquisa nas instruções da fase Dados dos Condomínios
-- (conteúdo antes exibido no painel colapsável do checklist).

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
    RAISE NOTICE '278: fase dados_condominios não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
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

  UPDATE public.kanban_fase_checklist_itens
  SET placeholder = 'Responda todas as perguntas de cada seção e salve antes de avançar para o próximo condomínio.'
  WHERE fase_id = v_fase_id
    AND label = 'Pesquisa de condomínios prospectados';
END;
$$;
