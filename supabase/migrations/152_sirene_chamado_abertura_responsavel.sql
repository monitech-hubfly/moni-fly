-- Nome do responsável escolhido no modal de novo chamado (lista fixa por time).
ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS abertura_responsavel_nome TEXT;

COMMENT ON COLUMN public.sirene_chamados.abertura_responsavel_nome IS
  'Responsável indicado na abertura do chamado (texto; catálogo Sirene por time).';
