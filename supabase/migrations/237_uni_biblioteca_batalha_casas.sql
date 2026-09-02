-- 237: Documento interno Batalha de Casas (Universidade > Ferramentas).

insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, slug, tags, visivel_para, ativo)
select
  'batalhas',
  'Batalha de Casas — passo a passo',
  'Guia interativo: o que é a batalha, fluxo em 6 etapas, escala -3 a +2, eixos Atributos do Lote, Preço e Produto, ranking G/E/P, giro e tese de vendas.',
  'documento-interno',
  null,
  'batalha-casas',
  array['batalhas', 'step-one', 'ranking', 'score', 'giro'],
  array['frank', 'team', 'admin']::text[],
  true
where not exists (
  select 1 from public.uni_biblioteca where slug = 'batalha-casas'
);
