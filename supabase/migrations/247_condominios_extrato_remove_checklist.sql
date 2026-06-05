-- 247: Campos Extrato no cadastro de condomínios; remove checklist duplicados (Giro / Extrato).

ALTER TABLE public.condominios
  ADD COLUMN IF NOT EXISTS extrato_como_eram_casas TEXT,
  ADD COLUMN IF NOT EXISTS extrato_tempo_venda TEXT;

COMMENT ON COLUMN public.condominios.extrato_como_eram_casas IS
  'Extrato: como eram as casas vendidas no condomínio (cadastro rede).';
COMMENT ON COLUMN public.condominios.extrato_tempo_venda IS
  'Extrato: quanto tempo demorou para vender (cadastro rede).';

-- Info agora vive só em `condominios` (estimativa_casas_vendidas_ano cobre o Giro).
DELETE FROM public.kanban_fase_checklist_itens
WHERE label IN (
  'Giro — Quantas casas venderam nos últimos 12 meses',
  'Giro — Quantas casas venderam nos últimos 12 meses*',
  'Extrato — Como eram essas casas',
  'Extrato — Como eram essas casas*',
  'Extrato — Quanto tempo demorou pra vender',
  'Extrato — Quanto tempo demorou pra vender*'
)
OR label LIKE 'Giro — Quantas casas venderam nos últimos 12 meses%'
OR label LIKE 'Extrato — Como eram essas casas%'
OR label LIKE 'Extrato — Quanto tempo demorou pra vender%';
