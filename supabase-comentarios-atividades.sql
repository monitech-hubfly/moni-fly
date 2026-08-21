-- IMPORTANTE: Este arquivo deve ser executado manualmente no SQL Editor do Supabase.
-- Acesse: https://supabase.com/dashboard → seu projeto → SQL Editor → New query
-- Cole o conteúdo abaixo e clique em "Run".
--
-- Rodar no SQL Editor do Supabase (https://supabase.com/dashboard)
-- Projeto: Carômetro

create table if not exists comentarios_atividade (
  id uuid primary key default gen_random_uuid(),
  acao_id uuid not null,
  semana_iso integer not null,
  semana_ano integer not null,
  texto text not null,
  created_at timestamptz default now()
);

-- Se aparecer erro de row-level security ao salvar no Gantt, rode também:
-- supabase-comentarios-rls.sql
