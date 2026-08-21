-- Execute no SQL Editor do Supabase (produção) se a migration 204 ainda não foi aplicada.
-- Idempotente: só altera linhas com status "Em processo".

UPDATE public.rede_franqueados
SET
  status_franquia = 'Em Operação',
  updated_at = NOW()
WHERE status_franquia IS NOT NULL
  AND lower(regexp_replace(trim(status_franquia), '\s+', ' ', 'g')) IN ('em processo', 'em processo.');

UPDATE public.processo_step_one
SET status_franquia = 'Em Operação'
WHERE status_franquia IS NOT NULL
  AND lower(regexp_replace(trim(status_franquia), '\s+', ' ', 'g')) IN ('em processo', 'em processo.');
