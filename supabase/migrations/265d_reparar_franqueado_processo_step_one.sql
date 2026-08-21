-- 265d: Espelha rede_franqueado_id em processo_step_one.
-- SQL Editor: re-execute -- PART C até pendentes_processo = 0.

-- ══════════════════════════════════════════════════════════════════════════════
-- PART C — processo_step_one (re-execute até concluir)
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  batch_size constant int := 100;
  max_batches constant int := 50;
  n int;
  total int := 0;
  batch_num int := 0;
BEGIN
  LOOP
    batch_num := batch_num + 1;
    EXIT WHEN batch_num > max_batches;

    UPDATE public.processo_step_one ps
    SET
      origem_rede_franqueados_id = batch.rede_franqueado_id,
      numero_franquia = coalesce(ps.numero_franquia, batch.n_franquia),
      updated_at = now()
    FROM (
      SELECT
        ps2.id,
        k.rede_franqueado_id,
        rf.n_franquia
      FROM public.processo_step_one ps2
      JOIN public.kanban_cards k ON (
        ps2.id = k.id
        OR ps2.id = k.projeto_id
        OR k.projeto_id = ps2.id
      )
      JOIN public.rede_franqueados rf ON rf.id = k.rede_franqueado_id
      WHERE ps2.origem_rede_franqueados_id IS NULL
        AND k.rede_franqueado_id IS NOT NULL
      LIMIT batch_size
    ) batch
    WHERE ps.id = batch.id;

    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
    EXIT WHEN n = 0;
  END LOOP;

  RAISE NOTICE '265d parte C (processo_step_one): % linha(s) nesta execução', total;
END $$;

-- Verificação (opcional)
SELECT count(*) AS pendentes_processo
FROM public.processo_step_one ps2
JOIN public.kanban_cards k ON (
  ps2.id = k.id OR ps2.id = k.projeto_id OR k.projeto_id = ps2.id
)
WHERE ps2.origem_rede_franqueados_id IS NULL
  AND k.rede_franqueado_id IS NOT NULL;
