-- 20260729120000: Adiciona coluna resolucao em pastelaria_cards
-- Armazena o descritivo "Como você resolveu essa atividade?" preenchido no modal de horas.

ALTER TABLE public.pastelaria_cards
  ADD COLUMN IF NOT EXISTS resolucao TEXT;
