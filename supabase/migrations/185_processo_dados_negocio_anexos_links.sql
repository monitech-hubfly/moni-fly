-- Dados do Negócio no modal Kanban: links e anexos em processo_step_one.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS link_bca TEXT,
  ADD COLUMN IF NOT EXISTS link_mapa_competidores TEXT,
  ADD COLUMN IF NOT EXISTS link_acoplamento TEXT,
  ADD COLUMN IF NOT EXISTS link_apresentacao_comite TEXT,
  ADD COLUMN IF NOT EXISTS anexo_opcao_permuta_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_contrato_permuta_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_seguro_garantia_path TEXT;

COMMENT ON COLUMN public.processo_step_one.link_bca IS 'Link do BCA (dados do negócio).';
COMMENT ON COLUMN public.processo_step_one.link_mapa_competidores IS 'Link do mapa de competidores.';
COMMENT ON COLUMN public.processo_step_one.link_acoplamento IS 'Link de acoplamento.';
COMMENT ON COLUMN public.processo_step_one.link_apresentacao_comite IS 'Link da apresentação do comitê.';
COMMENT ON COLUMN public.processo_step_one.anexo_opcao_permuta_path IS 'Storage path (processo-docs) — opção de permuta.';
COMMENT ON COLUMN public.processo_step_one.anexo_contrato_permuta_path IS 'Storage path (processo-docs) — contrato de permuta.';
COMMENT ON COLUMN public.processo_step_one.anexo_seguro_garantia_path IS 'Storage path (processo-docs) — seguro garantia.';
