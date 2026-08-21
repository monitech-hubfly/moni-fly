-- IMPORTANTE: Este arquivo deve ser executado manualmente no SQL Editor do Supabase.
-- Acesse: https://supabase.com/dashboard → seu projeto → SQL Editor → New query
-- Cole o conteúdo abaixo e clique em "Run".

-- OPCIONAL: migrar registros legados de gantt_planejamento para o modo moderno.
-- Execute no SQL Editor do Supabase apenas se houver registros com semana_inicio/semana_fim
-- e semanas_selecionadas vazia nas áreas Produto / Projetos - Modelo Virtual.
-- Substitua <trimestre_id> e <semana_iso> pelos valores corretos antes de rodar.

-- Exemplo: corrigir registro específico
update gantt_planejamento
set semanas_selecionadas = '{14}',
    semana_inicio = null,
    semana_fim = null
where id = '4be1cd7a-92bc-441b-8928-b6f4f07f2cf6';

