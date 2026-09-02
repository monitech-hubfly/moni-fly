-- Atividades (checklist do card): vários times e vários responsáveis por item.
-- Colunas legadas time_nome / responsavel_nome permanecem (primeiro valor) para compatibilidade.

ALTER TABLE public.processo_card_checklist
  ADD COLUMN IF NOT EXISTS times_nomes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS responsaveis_nomes TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.processo_card_checklist
SET times_nomes = CASE
    WHEN time_nome IS NOT NULL AND btrim(time_nome) <> '' THEN ARRAY[btrim(time_nome)]
    ELSE '{}'::text[]
  END
WHERE cardinality(times_nomes) = 0;

UPDATE public.processo_card_checklist
SET responsaveis_nomes = CASE
    WHEN responsavel_nome IS NOT NULL AND btrim(responsavel_nome) <> '' THEN ARRAY[btrim(responsavel_nome)]
    ELSE '{}'::text[]
  END
WHERE cardinality(responsaveis_nomes) = 0;

COMMENT ON COLUMN public.processo_card_checklist.times_nomes IS 'Times associados à atividade (múltiplos).';
COMMENT ON COLUMN public.processo_card_checklist.responsaveis_nomes IS 'Responsáveis associados à atividade (múltiplos).';
