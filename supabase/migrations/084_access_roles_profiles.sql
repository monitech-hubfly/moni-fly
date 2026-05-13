-- Controle de acesso por role + metadados de convite/aprovação em profiles.

alter table public.profiles
  add column if not exists nome_completo text,
  add column if not exists cargo text,
  add column if not exists departamento text,
  add column if not exists aprovado_em timestamptz,
  add column if not exists aprovado_por uuid references auth.users(id),
  add column if not exists convidado_por uuid references auth.users(id),
  add column if not exists invite_token text unique;

-- Expandimos o domínio de roles preservando legados para não quebrar features existentes.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  alter column role set default 'pending';
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'team', 'pending', 'blocked', 'frank', 'consultor', 'supervisor'));

comment on column public.profiles.role is
  'Role de acesso: admin|team|pending|blocked (mantendo legados frank|consultor|supervisor).';

comment on column public.profiles.invite_token is
  'Token de convite para fluxo /aceitar-convite.';

-- Seed consolidado por e-mail (admin > team).
create or replace function public.seed_users()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set
    role = s.role,
    departamento = s.departamento,
    updated_at = now(),
    aprovado_em = coalesce(p.aprovado_em, case when s.role = 'admin' or s.role = 'team' then now() else null end)
  from (
    values
      ('negao@moni.casa', 'team', 'Marketing'),
      ('paula.cruz@moni.casa', 'team', 'Novos Franks'),
      ('helenna.luz@moni.casa', 'team', 'Portfólio'),
      ('elisabete.nucci@moni.casa', 'team', 'Acoplamento'),
      ('nathalia.ferezin@moni.casa', 'team', 'Waysers'),
      ('rafael.mata@moni.casa', 'team', 'Waysers'),
      ('daniel.viotto@moni.casa', 'team', 'Frank Moní'),
      ('kim@moni.casa', 'team', 'Crédito'),
      ('neil@moni.casa', 'admin', 'Crédito'),
      ('vinicius.fr@moni.casa', 'team', 'Produto'),
      ('fabio.siano@moni.casa', 'team', 'Produto'),
      ('karoline.galdino@moni.casa', 'team', 'Homologações'),
      ('helena.oliveira@moni.casa', 'team', 'Homologações'),
      ('jessica.silva@moni.casa', 'team', 'Homologações'),
      ('leticia.duarte@moni.casa', 'team', 'Homologações'),
      ('bruna.scarpeli@moni.casa', 'team', 'Modelo Virtual / Executivo'),
      ('larissa.lima@moni.casa', 'team', 'Modelo Virtual / Executivo'),
      ('vitor.penha@moni.casa', 'team', 'Modelo Virtual / Executivo'),
      ('fernanda.lobao@moni.casa', 'admin', 'Caneta Verde'),
      ('ingrid.hora@moni.casa', 'admin', 'Caneta Verde'),
      ('danilo.n@moni.casa', 'admin', 'Caneta Verde'),
      ('murillo@moni.casa', 'admin', 'CEO'),
      ('isa.seabra@moni.casa', 'admin', 'Contabilidade'),
      ('felipe.batista@moni.casa', 'team', 'Financeiro'),
      ('diogo.chagas@moni.casa', 'team', 'Moní Capital')
  ) as s(email, role, departamento)
  where lower(p.email) = lower(s.email);
end;
$$;

