-- Onboarding Casa 0: progresso por item + missão (RLS: apenas o próprio usuário)

-- ---------------------------------------------------------------------------
-- franqueado_onboarding_progresso
-- ---------------------------------------------------------------------------
create table if not exists public.franqueado_onboarding_progresso (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  casa_id       text not null,
  item_id       text not null,
  status        text not null default 'pendente'
    check (status in ('pendente', 'em_andamento', 'concluido')),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, casa_id, item_id)
);

create index if not exists idx_franqueado_onboarding_progresso_user
  on public.franqueado_onboarding_progresso (user_id);

create index if not exists idx_franqueado_onboarding_progresso_user_casa
  on public.franqueado_onboarding_progresso (user_id, casa_id);

alter table public.franqueado_onboarding_progresso enable row level security;

drop policy if exists franqueado_onboarding_progresso_select_own
  on public.franqueado_onboarding_progresso;
create policy franqueado_onboarding_progresso_select_own
  on public.franqueado_onboarding_progresso
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists franqueado_onboarding_progresso_insert_own
  on public.franqueado_onboarding_progresso;
create policy franqueado_onboarding_progresso_insert_own
  on public.franqueado_onboarding_progresso
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists franqueado_onboarding_progresso_update_own
  on public.franqueado_onboarding_progresso;
create policy franqueado_onboarding_progresso_update_own
  on public.franqueado_onboarding_progresso
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.franqueado_onboarding_progresso to authenticated;

-- ---------------------------------------------------------------------------
-- franqueado_onboarding_missao
-- ---------------------------------------------------------------------------
create table if not exists public.franqueado_onboarding_missao (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  casa_id       text not null,
  conteudo      text,
  status        text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'aprovado')),
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, casa_id)
);

create index if not exists idx_franqueado_onboarding_missao_user
  on public.franqueado_onboarding_missao (user_id);

alter table public.franqueado_onboarding_missao enable row level security;

drop policy if exists franqueado_onboarding_missao_select_own
  on public.franqueado_onboarding_missao;
create policy franqueado_onboarding_missao_select_own
  on public.franqueado_onboarding_missao
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists franqueado_onboarding_missao_insert_own
  on public.franqueado_onboarding_missao;
create policy franqueado_onboarding_missao_insert_own
  on public.franqueado_onboarding_missao
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists franqueado_onboarding_missao_update_own
  on public.franqueado_onboarding_missao;
create policy franqueado_onboarding_missao_update_own
  on public.franqueado_onboarding_missao
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.franqueado_onboarding_missao to authenticated;
