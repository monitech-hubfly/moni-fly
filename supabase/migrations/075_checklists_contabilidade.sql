create table if not exists public.checklist_incorporadora (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references public.processo_step_one(id) on delete cascade,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  data_abertura date,
  situacao text check (situacao in ('Ativa', 'Inativa')),
  cnaes text[] not null default '{}',
  endereco text,
  inscricao_municipal_1 text,
  inscricao_municipal_2 text,
  upload_contrato_social text,
  upload_cartao_cnpj text,
  upload_comprovante_endereco text,
  preenchido_por uuid references auth.users(id),
  completo boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (processo_id)
);

create table if not exists public.checklist_spe (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references public.processo_step_one(id) on delete cascade,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  data_abertura date,
  situacao text check (situacao in ('Ativa', 'Inativa')),
  cnaes text[] not null default '{}',
  endereco text,
  inscricao_municipal_1 text,
  inscricao_municipal_2 text,
  upload_contrato_social text,
  upload_cartao_cnpj text,
  upload_comprovante_endereco text,
  preenchido_por uuid references auth.users(id),
  completo boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (processo_id)
);

create table if not exists public.checklist_gestora (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references public.processo_step_one(id) on delete cascade,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  data_abertura date,
  situacao text check (situacao in ('Ativa', 'Inativa')),
  cnaes text[] not null default '{}',
  endereco text,
  inscricao_municipal_1 text,
  inscricao_municipal_2 text,
  upload_contrato_social text,
  upload_cartao_cnpj text,
  upload_comprovante_endereco text,
  preenchido_por uuid references auth.users(id),
  completo boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (processo_id)
);

alter table public.checklist_incorporadora enable row level security;
alter table public.checklist_spe enable row level security;
alter table public.checklist_gestora enable row level security;

drop policy if exists "Leitura autenticada" on public.checklist_incorporadora;
drop policy if exists "Insert autenticado" on public.checklist_incorporadora;
drop policy if exists "Update pelo preenchedor" on public.checklist_incorporadora;
create policy "Leitura autenticada" on public.checklist_incorporadora
  for select using (auth.role() = 'authenticated');
create policy "Insert autenticado" on public.checklist_incorporadora
  for insert with check (auth.role() = 'authenticated');
create policy "Update pelo preenchedor" on public.checklist_incorporadora
  for update using (auth.uid() = preenchido_por);

drop policy if exists "Leitura autenticada" on public.checklist_spe;
drop policy if exists "Insert autenticado" on public.checklist_spe;
drop policy if exists "Update pelo preenchedor" on public.checklist_spe;
create policy "Leitura autenticada" on public.checklist_spe
  for select using (auth.role() = 'authenticated');
create policy "Insert autenticado" on public.checklist_spe
  for insert with check (auth.role() = 'authenticated');
create policy "Update pelo preenchedor" on public.checklist_spe
  for update using (auth.uid() = preenchido_por);

drop policy if exists "Leitura autenticada" on public.checklist_gestora;
drop policy if exists "Insert autenticado" on public.checklist_gestora;
drop policy if exists "Update pelo preenchedor" on public.checklist_gestora;
create policy "Leitura autenticada" on public.checklist_gestora
  for select using (auth.role() = 'authenticated');
create policy "Insert autenticado" on public.checklist_gestora
  for insert with check (auth.role() = 'authenticated');
create policy "Update pelo preenchedor" on public.checklist_gestora
  for update using (auth.uid() = preenchido_por);
