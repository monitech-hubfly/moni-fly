-- 243: Atualiza descrição do guia Batalha de Casas (conteúdo revisado PROMPT 10).

update public.uni_biblioteca
set
  descricao = 'Guia interativo: o que é a batalha, fluxo Mapa → Pré-Batalha → Configurador → BCA → Batalha → Tese, escala -3 a +2, atributos com pré-preenchimento Lotes Disponíveis, Preço (D/E/I/P + custo Configurador), Produto, ranking G/E/P, giro e tese de vendas.',
  tags = array['batalhas', 'step-one', 'ranking', 'score', 'giro', 'pre-batalha']
where slug = 'batalha-casas';
