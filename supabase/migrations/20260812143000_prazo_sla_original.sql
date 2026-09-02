-- 20260812143000: Campo imutável de referência SLA para prazos de atividades
ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS prazo_sla_original DATE;

-- Retroativo: registros já aceitos recebem a data_fim atual como referência original
UPDATE public.sirene_topicos
SET prazo_sla_original = data_fim
WHERE prazo_status = 'aceito'
  AND data_fim IS NOT NULL
  AND prazo_sla_original IS NULL;
