-- Quantos processo_step_one ainda faltam espelhar rede_franqueado_id
SELECT count(*) AS pendentes_processo
FROM public.processo_step_one ps2
JOIN public.kanban_cards k ON (
  ps2.id = k.id OR ps2.id = k.projeto_id OR k.projeto_id = ps2.id
)
WHERE ps2.origem_rede_franqueados_id IS NULL
  AND k.rede_franqueado_id IS NOT NULL;
