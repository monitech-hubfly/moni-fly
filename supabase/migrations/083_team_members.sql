create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_name text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_type text not null check (member_type in ('time', 'adm')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_name, user_id, member_type)
);

create index if not exists idx_team_members_team_name
  on public.team_members (team_name);

create index if not exists idx_team_members_user_id
  on public.team_members (user_id);

comment on table public.team_members is
  'Vínculo usuário x time com tipo de participação (time/adm).';

comment on column public.team_members.team_name is
  'Nome lógico do time (ex.: Marketing, Crédito, Moní Capital).';

comment on column public.team_members.member_type is
  'Tipo no time: time ou adm.';

alter table public.team_members enable row level security;

drop policy if exists "team_members_auth_read" on public.team_members;
create policy "team_members_auth_read"
  on public.team_members
  for select
  to authenticated
  using (true);

drop policy if exists "team_members_admin_write" on public.team_members;
drop policy if exists "team_members_auth_write" on public.team_members;
create policy "team_members_auth_write"
  on public.team_members
  for all
  to authenticated
  using (true)
  with check (true);

-- Seed inicial por e-mail (só insere quando o profile existe).
with src(team_name, email, member_type) as (
  values
    ('Marketing', 'negao@moni.casa', 'time'),
    ('Novos Franks', 'paula.cruz@moni.casa', 'time'),
    ('Portfólio', 'helenna.luz@moni.casa', 'time'),
    ('Acoplamento', 'elisabete.nucci@moni.casa', 'time'),
    ('Waysers', 'nathalia.ferezin@moni.casa', 'time'),
    ('Waysers', 'rafael.mata@moni.casa', 'time'),
    ('Frank Moní', 'daniel.viotto@moni.casa', 'time'),
    ('Crédito', 'kim@moni.casa', 'time'),
    ('Crédito', 'neil@moni.casa', 'adm'),
    ('Produto', 'vinicius.fr@moni.casa', 'time'),
    ('Produto', 'fabio.siano@moni.casa', 'time'),
    ('Homologações', 'karoline.galdino@moni.casa', 'time'),
    ('Homologações', 'helena.oliveira@moni.casa', 'time'),
    ('Homologações', 'jessica.silva@moni.casa', 'time'),
    ('Homologações', 'leticia.duarte@moni.casa', 'time'),
    ('Modelo Virtual', 'bruna.scarpeli@moni.casa', 'time'),
    ('Modelo Virtual', 'larissa.lima@moni.casa', 'time'),
    ('Modelo Virtual', 'vitor.penha@moni.casa', 'time'),
    ('Executivo', 'bruna.scarpeli@moni.casa', 'time'),
    ('Executivo', 'larissa.lima@moni.casa', 'time'),
    ('Executivo', 'vitor.penha@moni.casa', 'time'),
    ('Caneta Verde', 'fernanda.lobao@moni.casa', 'adm'),
    ('Caneta Verde', 'ingrid.hora@moni.casa', 'adm'),
    ('Caneta Verde', 'danilo.n@moni.casa', 'adm'),
    ('CEO', 'murillo@moni.casa', 'adm'),
    ('CEO', 'neil@moni.casa', 'adm'),
    ('Financeiro', 'isa.seabra@moni.casa', 'time'),
    ('Financeiro', 'felipe.batista@moni.casa', 'time'),
    ('Financeiro', 'kim@moni.casa', 'time'),
    ('Contabilidade', 'isa.seabra@moni.casa', 'adm'),
    ('Contabilidade', 'felipe.batista@moni.casa', 'time'),
    ('Contabilidade', 'kim@moni.casa', 'time'),
    ('Moní Capital', 'neil@moni.casa', 'adm'),
    ('Moní Capital', 'neil@moni.casa', 'time'),
    ('Moní Capital', 'murillo@moni.casa', 'adm'),
    ('Moní Capital', 'kim@moni.casa', 'time'),
    ('Moní Capital', 'felipe.batista@moni.casa', 'time'),
    ('Moní Capital', 'diogo.chagas@moni.casa', 'time')
)
insert into public.team_members (team_name, user_id, member_type)
select src.team_name, p.id, src.member_type
from src
join public.profiles p on lower(p.email) = lower(src.email)
on conflict (team_name, user_id, member_type) do nothing;
