-- Texto opcional por item de progresso (ex.: score 0–100 em item_id quiz_score na Casa 1).
-- Só roda se a tabela já existir (pode ser criada por migration posterior com timestamp em clones novos).
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'franqueado_onboarding_progresso'
  ) then
    alter table public.franqueado_onboarding_progresso
      add column if not exists conteudo text;
    comment on column public.franqueado_onboarding_progresso.conteudo is
      'Valor textual por item (ex.: quiz_score com nota do quiz no onboarding Casa 1).';
  end if;
end $$;
