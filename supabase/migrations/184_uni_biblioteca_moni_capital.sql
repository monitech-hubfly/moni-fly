-- 184: Documento interno Moní Capital (pre-obra).

insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, slug, tags, visivel_para, ativo)
select
  'pre-obra',
  'Moní Capital',
  'Captação de recursos para o seu projeto sem tirar dinheiro do bolso. Conheça a plataforma de captação privada da rede Moní: contexto, regras, passo a passo e materiais necessários.',
  'documento-interno',
  null,
  'moni-capital',
  array['pre-obra', 'moni-capital', 'captação', 'funding', 'spe'],
  array['frank', 'team', 'admin']::text[],
  true
where not exists (
  select 1 from public.uni_biblioteca where slug = 'moni-capital'
);
