-- RLS Universidade + sincronização de certificados (sem INSERT direto para franqueado)

-- Garante casa_id a partir do módulo
create or replace function public.uni_progresso_set_casa_id()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.casa_id is null and new.modulo_id is not null then
    select m.casa_id into new.casa_id from public.uni_modulos m where m.id = new.modulo_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_uni_progresso_set_casa on public.uni_progresso;
create trigger tr_uni_progresso_set_casa
  before insert or update of modulo_id, casa_id on public.uni_progresso
  for each row
  execute procedure public.uni_progresso_set_casa_id();

-- Sincroniza certificados níveis 1–5 conforme conclusão das casas (obrigatórios)
create or replace function public.uni_sync_certificados(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  my_role text;
  l1 boolean;
  l2 boolean;
  l3 boolean;
  l4 boolean;
  l5 boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  my_role := public.get_my_role();
  if auth.uid() <> p_user_id and my_role not in ('admin', 'team') then
    raise exception 'forbidden';
  end if;

  select
    not exists (
      select 1
      from public.uni_modulos m
      join public.uni_casas c on c.id = m.casa_id and c.numero = 0 and c.ativa = true
      where m.obrigatorio = true
        and not exists (
          select 1 from public.uni_progresso p
          where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
        )
    )
    and not exists (
      select 1
      from public.uni_modulos m
      join public.uni_casas c on c.id = m.casa_id and c.numero = 1 and c.ativa = true
      where m.obrigatorio = true
        and not exists (
          select 1 from public.uni_progresso p
          where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
        )
    )
  into l1;

  select not exists (
    select 1
    from public.uni_modulos m
    join public.uni_casas c on c.id = m.casa_id and c.numero = 2 and c.ativa = true
    where m.obrigatorio = true
      and not exists (
        select 1 from public.uni_progresso p
        where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
      )
  ) into l2;

  select not exists (
    select 1
    from public.uni_modulos m
    join public.uni_casas c on c.id = m.casa_id and c.numero = 3 and c.ativa = true
    where m.obrigatorio = true
      and not exists (
        select 1 from public.uni_progresso p
        where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
      )
  ) into l3;

  select
    not exists (
      select 1
      from public.uni_modulos m
      join public.uni_casas c on c.id = m.casa_id and c.numero = 4 and c.ativa = true
      where m.obrigatorio = true
        and not exists (
          select 1 from public.uni_progresso p
          where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
        )
    )
    and not exists (
      select 1
      from public.uni_modulos m
      join public.uni_casas c on c.id = m.casa_id and c.numero = 5 and c.ativa = true
      where m.obrigatorio = true
        and not exists (
          select 1 from public.uni_progresso p
          where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
        )
    )
  into l4;

  select
    not exists (
      select 1
      from public.uni_modulos m
      join public.uni_casas c on c.id = m.casa_id and c.numero in (6, 7, 8, 9) and c.ativa = true
      where m.obrigatorio = true
        and not exists (
          select 1 from public.uni_progresso p
          where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
        )
    )
  into l5;

  if l1 then
    insert into public.uni_certificados (user_id, nivel, titulo)
    values (p_user_id, 1, 'Fundamentos')
    on conflict (user_id, nivel) do nothing;
  end if;
  if l2 then
    insert into public.uni_certificados (user_id, nivel, titulo)
    values (p_user_id, 2, 'Step One')
    on conflict (user_id, nivel) do nothing;
  end if;
  if l3 then
    insert into public.uni_certificados (user_id, nivel, titulo)
    values (p_user_id, 3, 'BCA e hipótese')
    on conflict (user_id, nivel) do nothing;
  end if;
  if l4 then
    insert into public.uni_certificados (user_id, nivel, titulo)
    values (p_user_id, 4, 'Negociação')
    on conflict (user_id, nivel) do nothing;
  end if;
  if l5 then
    insert into public.uni_certificados (user_id, nivel, titulo)
    values (p_user_id, 5, 'Operação completa')
    on conflict (user_id, nivel) do nothing;
  end if;
end;
$$;

grant execute on function public.uni_sync_certificados(uuid) to authenticated;

-- RLS
alter table public.uni_casas enable row level security;
alter table public.uni_modulos enable row level security;
alter table public.uni_progresso enable row level security;
alter table public.uni_entregas enable row level security;
alter table public.uni_biblioteca enable row level security;
alter table public.uni_certificados enable row level security;

-- uni_casas
drop policy if exists uni_casas_select_auth on public.uni_casas;
create policy uni_casas_select_auth on public.uni_casas for select to authenticated using (true);

drop policy if exists uni_casas_write_staff on public.uni_casas;
create policy uni_casas_write_staff on public.uni_casas for all to authenticated
  using (public.get_my_role() in ('admin', 'team'))
  with check (public.get_my_role() in ('admin', 'team'));

-- uni_modulos
drop policy if exists uni_modulos_select_auth on public.uni_modulos;
create policy uni_modulos_select_auth on public.uni_modulos for select to authenticated using (true);

drop policy if exists uni_modulos_write_staff on public.uni_modulos;
create policy uni_modulos_write_staff on public.uni_modulos for all to authenticated
  using (public.get_my_role() in ('admin', 'team'))
  with check (public.get_my_role() in ('admin', 'team'));

-- uni_progresso
drop policy if exists uni_progresso_select_own on public.uni_progresso;
create policy uni_progresso_select_own on public.uni_progresso for select to authenticated
  using (user_id = auth.uid());

drop policy if exists uni_progresso_select_staff on public.uni_progresso;
create policy uni_progresso_select_staff on public.uni_progresso for select to authenticated
  using (public.get_my_role() in ('admin', 'team'));

drop policy if exists uni_progresso_insert_own on public.uni_progresso;
create policy uni_progresso_insert_own on public.uni_progresso for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists uni_progresso_update_own on public.uni_progresso;
create policy uni_progresso_update_own on public.uni_progresso for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- uni_entregas
drop policy if exists uni_entregas_select_own on public.uni_entregas;
create policy uni_entregas_select_own on public.uni_entregas for select to authenticated
  using (user_id = auth.uid());

drop policy if exists uni_entregas_select_staff on public.uni_entregas;
create policy uni_entregas_select_staff on public.uni_entregas for select to authenticated
  using (public.get_my_role() in ('admin', 'team'));

drop policy if exists uni_entregas_insert_own on public.uni_entregas;
create policy uni_entregas_insert_own on public.uni_entregas for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists uni_entregas_update_staff on public.uni_entregas;
create policy uni_entregas_update_staff on public.uni_entregas for update to authenticated
  using (public.get_my_role() in ('admin', 'team'))
  with check (public.get_my_role() in ('admin', 'team'));

-- uni_biblioteca (visivel_para guarda papéis: frank, team, admin)
drop policy if exists uni_biblioteca_select on public.uni_biblioteca;
create policy uni_biblioteca_select on public.uni_biblioteca for select to authenticated
  using (
    public.get_my_role() in ('admin', 'team')
    or public.get_my_role()::text = any (coalesce(visivel_para, array[]::text[]))
  );

drop policy if exists uni_biblioteca_write_staff on public.uni_biblioteca;
create policy uni_biblioteca_write_staff on public.uni_biblioteca for all to authenticated
  using (public.get_my_role() in ('admin', 'team'))
  with check (public.get_my_role() in ('admin', 'team'));

-- uni_certificados: só leitura do dono; inserts via uni_sync_certificados (definer)
drop policy if exists uni_certificados_select_own on public.uni_certificados;
create policy uni_certificados_select_own on public.uni_certificados for select to authenticated
  using (user_id = auth.uid());

drop policy if exists uni_certificados_select_staff on public.uni_certificados;
create policy uni_certificados_select_staff on public.uni_certificados for select to authenticated
  using (public.get_my_role() in ('admin', 'team'));
