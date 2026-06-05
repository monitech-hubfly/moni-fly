-- 1 lote: espelha rede_franqueado_id em processo_step_one (LIMIT 25). Repita até pendentes_processo = 0.
UPDATE public.processo_step_one ps
SET
  origem_rede_franqueados_id = batch.rede_franqueado_id,
  numero_franquia = coalesce(ps.numero_franquia, batch.n_franquia),
  updated_at = now()
FROM (
  SELECT ps2.id, k.rede_franqueado_id, rf.n_franquia
  FROM public.processo_step_one ps2
  JOIN public.kanban_cards k ON (
    ps2.id = k.id OR ps2.id = k.projeto_id OR k.projeto_id = ps2.id
  )
  JOIN public.rede_franqueados rf ON rf.id = k.rede_franqueado_id
  WHERE ps2.origem_rede_franqueados_id IS NULL
    AND k.rede_franqueado_id IS NOT NULL
  LIMIT 25
) batch
WHERE ps.id = batch.id;
