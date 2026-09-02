-- IMPORTANTE: Este arquivo deve ser executado manualmente no SQL Editor do Supabase.
-- Acesse: https://supabase.com/dashboard → seu projeto → SQL Editor → New query
-- Cole o conteúdo abaixo e clique em "Run".

-- Políticas permissivas para o Planejamento (Gantt).
-- Corrige erro: "new row violates row-level security policy for table 'gantt_planejamento'".

-- Se a tabela não existir ainda, rode antes o arquivo:
-- supabase-gantt-planejamento-colunas-completas.sql

alter table if exists gantt_planejamento enable row level security;

drop policy if exists "gantt_planejamento_select" on gantt_planejamento;
drop policy if exists "gantt_planejamento_insert" on gantt_planejamento;
drop policy if exists "gantt_planejamento_update" on gantt_planejamento;
drop policy if exists "gantt_planejamento_delete" on gantt_planejamento;

create policy "gantt_planejamento_select"
on gantt_planejamento
for select
using (true);

create policy "gantt_planejamento_insert"
on gantt_planejamento
for insert
with check (true);

create policy "gantt_planejamento_update"
on gantt_planejamento
for update
using (true);

create policy "gantt_planejamento_delete"
on gantt_planejamento
for delete
using (true);
