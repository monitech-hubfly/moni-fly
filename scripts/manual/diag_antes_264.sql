-- Diagnóstico ANTES da 264: contagem e locks em kanban_fases
SELECT count(*) AS fases_moni_capital
FROM public.kanban_fases
WHERE kanban_id = '724aef36-37de-4454-bf6f-ec481693aeeb';

SELECT pid, state, wait_event_type, wait_event, query_start,
       left(query, 120) AS query_preview
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND query ILIKE '%kanban_fases%'
ORDER BY query_start NULLS LAST;
