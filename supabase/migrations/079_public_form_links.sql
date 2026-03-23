create table if not exists public.processo_public_form_links (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processo_step_one(id) on delete cascade,
  form_type text not null check (form_type in ('legal', 'credito')),
  token text not null unique,
  expires_at timestamptz not null,
  created_by uuid null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_public_form_links_processo_type
  on public.processo_public_form_links (processo_id, form_type);

create index if not exists idx_public_form_links_token
  on public.processo_public_form_links (token);

alter table public.processo_public_form_links enable row level security;

drop policy if exists "public_form_links_auth_read" on public.processo_public_form_links;
create policy "public_form_links_auth_read"
  on public.processo_public_form_links
  for select
  to authenticated
  using (true);

drop policy if exists "public_form_links_auth_write" on public.processo_public_form_links;
create policy "public_form_links_auth_write"
  on public.processo_public_form_links
  for all
  to authenticated
  using (true)
  with check (true);
