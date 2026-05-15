-- Texto opcional por item de progresso (ex.: score 0–100 em item_id quiz_score na Casa 1).
alter table public.franqueado_onboarding_progresso
  add column if not exists conteudo text;

comment on column public.franqueado_onboarding_progresso.conteudo is
  'Valor textual por item (ex.: quiz_score com nota do quiz no onboarding Casa 1).';
