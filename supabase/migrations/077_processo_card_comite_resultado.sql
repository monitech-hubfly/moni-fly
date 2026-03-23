alter table public.processo_card_comite
add column if not exists comite_resultado text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'processo_card_comite_resultado_check'
  ) then
    alter table public.processo_card_comite
    add constraint processo_card_comite_resultado_check
    check (comite_resultado in ('pendente', 'aprovado', 'reprovado'));
  end if;
end $$;

update public.processo_card_comite
set comite_resultado = 'pendente'
where comite_resultado is null;

alter table public.processo_card_comite
alter column comite_resultado set default 'pendente';
