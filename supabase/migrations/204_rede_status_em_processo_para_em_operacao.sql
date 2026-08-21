-- Normaliza status legado "Em processo" → "Em Operação" (opção removida do formulário).

DO $$
DECLARE
  n_rede integer;
  n_step integer;
BEGIN
  UPDATE public.rede_franqueados
  SET
    status_franquia = 'Em Operação',
    updated_at = NOW()
  WHERE status_franquia IS NOT NULL
    AND lower(regexp_replace(trim(status_franquia), '\s+', ' ', 'g')) IN ('em processo', 'em processo.');

  GET DIAGNOSTICS n_rede = ROW_COUNT;

  UPDATE public.processo_step_one
  SET status_franquia = 'Em Operação'
  WHERE status_franquia IS NOT NULL
    AND lower(regexp_replace(trim(status_franquia), '\s+', ' ', 'g')) IN ('em processo', 'em processo.');

  GET DIAGNOSTICS n_step = ROW_COUNT;

  RAISE NOTICE 'rede_franqueados: % linha(s); processo_step_one: % linha(s)', n_rede, n_step;
END $$;
