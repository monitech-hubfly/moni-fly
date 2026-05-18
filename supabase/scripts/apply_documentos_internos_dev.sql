-- Cole no SQL Editor do Supabase DEV (bgaadvfucnrkpimaszjv).
-- Idempotente: pode rodar mais de uma vez.

-- 183: colunas + tipo documento-interno + Carta Fiança
alter table public.uni_biblioteca
  add column if not exists slug text,
  add column if not exists ativo boolean not null default true;

alter table public.uni_biblioteca drop constraint if exists uni_biblioteca_tipo_check;

alter table public.uni_biblioteca
  add constraint uni_biblioteca_tipo_check
  check (tipo in ('arquivo', 'link', 'video', 'documento-interno'));

create unique index if not exists idx_uni_biblioteca_slug_unique
  on public.uni_biblioteca (slug)
  where slug is not null and btrim(slug) <> '';

insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, slug, tags, visivel_para, ativo)
select
  'pre-obra',
  'Carta Fiança',
  'Entenda como a Carta Fiança se encaixa na operação e como a Moní pode recomendar formas de viabilizá-la. Cobre: o que é, quando contratar, como viabilizar o pagamento e o impacto no VGV.',
  'documento-interno',
  null,
  'carta-fianca',
  array['pre-obra', 'carta-fianca', 'funding', 'garantia', 'vgv'],
  array['frank', 'team', 'admin']::text[],
  true
where not exists (
  select 1 from public.uni_biblioteca where slug = 'carta-fianca'
);

-- 184: Moní Capital (opcional)
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

-- Verificação
select id, titulo, categoria, tipo, slug, ativo
from public.uni_biblioteca
where categoria = 'pre-obra'
order by titulo;
