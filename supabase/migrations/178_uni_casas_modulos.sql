-- Universidade Moní: casas e módulos do tabuleiro
-- (numeração 178+ — evita colisão com migrations legadas 016*.)

create table if not exists public.uni_casas (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  numero      int not null,
  titulo      text not null,
  descricao   text,
  cor_tema    text,
  ativa       boolean default true,
  criado_em   timestamptz default now()
);

create table if not exists public.uni_modulos (
  id          uuid primary key default gen_random_uuid(),
  casa_id     uuid not null references public.uni_casas(id) on delete cascade,
  tipo        text not null check (tipo in ('video','checklist','quiz','template','leitura')),
  titulo      text not null,
  conteudo    jsonb,
  ordem       int not null,
  obrigatorio boolean default true,
  criado_em   timestamptz default now()
);

create index if not exists idx_uni_modulos_casa_ordem on public.uni_modulos (casa_id, ordem);
create index if not exists idx_uni_casas_numero on public.uni_casas (numero);
create index if not exists idx_uni_casas_ativa on public.uni_casas (ativa) where ativa = true;
