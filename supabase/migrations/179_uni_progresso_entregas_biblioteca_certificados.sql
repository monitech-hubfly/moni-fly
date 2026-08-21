-- Universidade Moní: progresso, entregas, biblioteca e certificados

create table if not exists public.uni_progresso (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  modulo_id    uuid not null references public.uni_modulos(id) on delete cascade,
  casa_id      uuid references public.uni_casas(id),
  status       text not null default 'pendente' check (status in ('pendente','em_progresso','concluido')),
  dados        jsonb,
  nota         int check (nota between 0 and 100),
  concluido_em timestamptz,
  criado_em    timestamptz default now(),
  unique(user_id, modulo_id)
);

create table if not exists public.uni_entregas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  casa_id      uuid references public.uni_casas(id),
  modulo_id    uuid references public.uni_modulos(id),
  tipo         text check (tipo in ('arquivo','link','texto')),
  valor        text,
  aprovado     boolean,
  aprovado_por uuid references auth.users(id),
  criado_em    timestamptz default now()
);

create table if not exists public.uni_biblioteca (
  id           uuid primary key default gen_random_uuid(),
  categoria    text not null,
  titulo       text not null,
  descricao    text,
  tipo         text check (tipo in ('arquivo','link','video')),
  url          text,
  tags         text[],
  visivel_para text[] default '{frank,team,admin}',
  criado_em    timestamptz default now()
);

create table if not exists public.uni_certificados (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nivel       int not null check (nivel between 1 and 5),
  titulo      text not null,
  emitido_em  timestamptz default now(),
  unique(user_id, nivel)
);

create index if not exists idx_uni_progresso_user on public.uni_progresso (user_id);
create index if not exists idx_uni_progresso_modulo on public.uni_progresso (modulo_id);
create index if not exists idx_uni_entregas_user on public.uni_entregas (user_id);
create index if not exists idx_uni_entregas_aprovado_null on public.uni_entregas (aprovado) where aprovado is null;
create index if not exists idx_uni_biblioteca_categoria on public.uni_biblioteca (categoria);
create index if not exists idx_uni_certificados_user on public.uni_certificados (user_id);
