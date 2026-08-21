-- IMPORTANTE: Este arquivo deve ser executado manualmente no SQL Editor do Supabase.
-- Acesse: https://supabase.com/dashboard → seu projeto → SQL Editor → New query
-- Cole o conteúdo abaixo e clique em "Run".
--
-- Corrige erro: "new row violates row-level security policy for table 'comentarios_atividade'"
-- (e o mesmo para comentários de indicador, se aplicável).
--
-- Pré-requisito: tabelas criadas com supabase-comentarios-atividades.sql e
-- supabase-comentarios-indicadores.sql

-- ========== comentarios_atividade ==========
alter table if exists comentarios_atividade enable row level security;

drop policy if exists "comentarios_atividade_select" on comentarios_atividade;
drop policy if exists "comentarios_atividade_insert" on comentarios_atividade;
drop policy if exists "comentarios_atividade_update" on comentarios_atividade;
drop policy if exists "comentarios_atividade_delete" on comentarios_atividade;

create policy "comentarios_atividade_select"
on comentarios_atividade
for select
using (true);

create policy "comentarios_atividade_insert"
on comentarios_atividade
for insert
with check (true);

create policy "comentarios_atividade_update"
on comentarios_atividade
for update
using (true);

create policy "comentarios_atividade_delete"
on comentarios_atividade
for delete
using (true);

-- ========== comentarios_indicador ==========
alter table if exists comentarios_indicador enable row level security;

drop policy if exists "comentarios_indicador_select" on comentarios_indicador;
drop policy if exists "comentarios_indicador_insert" on comentarios_indicador;
drop policy if exists "comentarios_indicador_update" on comentarios_indicador;
drop policy if exists "comentarios_indicador_delete" on comentarios_indicador;

create policy "comentarios_indicador_select"
on comentarios_indicador
for select
using (true);

create policy "comentarios_indicador_insert"
on comentarios_indicador
for insert
with check (true);

create policy "comentarios_indicador_update"
on comentarios_indicador
for update
using (true);

create policy "comentarios_indicador_delete"
on comentarios_indicador
for delete
using (true);
