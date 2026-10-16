-- 575: Funil Jurídico — card pode nascer sem franqueado/condomínio/quadra/lote,
-- com nome do candidato, UF, cidade e observações.
-- Idempotente.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS juridico_nome_candidato text,
  ADD COLUMN IF NOT EXISTS juridico_estado text,
  ADD COLUMN IF NOT EXISTS juridico_cidade text,
  ADD COLUMN IF NOT EXISTS juridico_observacoes text;

COMMENT ON COLUMN public.kanban_cards.juridico_nome_candidato IS
  'Funil Jurídico: nome do candidato quando o card não vincula franqueado.';
COMMENT ON COLUMN public.kanban_cards.juridico_estado IS
  'Funil Jurídico: UF do candidato (sigla).';
COMMENT ON COLUMN public.kanban_cards.juridico_cidade IS
  'Funil Jurídico: cidade do candidato (IBGE, filtrada pela UF).';
COMMENT ON COLUMN public.kanban_cards.juridico_observacoes IS
  'Funil Jurídico: observações/solicitações na abertura do card candidato.';
