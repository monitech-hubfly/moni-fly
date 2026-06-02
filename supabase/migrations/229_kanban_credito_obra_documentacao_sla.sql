-- Funil Crédito Obra: documentação alvará/terreno SPE + início do SLA sob demanda.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS alvara_url TEXT,
  ADD COLUMN IF NOT EXISTS docs_terreno_url TEXT,
  ADD COLUMN IF NOT EXISTS sla_iniciado_em TIMESTAMPTZ;

COMMENT ON COLUMN public.kanban_cards.alvara_url IS
  'URL do alvará (Funil Crédito Obra — fase co_documentacao_alvara).';
COMMENT ON COLUMN public.kanban_cards.docs_terreno_url IS
  'URL da documentação terreno SPE (Funil Crédito Obra — fase co_documentacao_alvara).';
COMMENT ON COLUMN public.kanban_cards.sla_iniciado_em IS
  'Quando preenchido, o SLA da fase usa esta data em vez de created_at. '
  'Em co_documentacao_alvara só é setado após alvara_url e docs_terreno_url.';
