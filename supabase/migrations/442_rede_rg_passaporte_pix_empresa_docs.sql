-- 442: Rede de Franqueados — RG/Passaporte, Pix (empresa/SPE) e anexos de empresas adicionais.

ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_rg_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_passaporte_path TEXT;

COMMENT ON COLUMN public.rede_franqueados.anexo_rg_path IS
  'Storage path (bucket rede-attachments) — RG do franqueado.';
COMMENT ON COLUMN public.rede_franqueados.anexo_passaporte_path IS
  'Storage path (bucket rede-attachments) — passaporte do franqueado.';

ALTER TABLE public.franqueado_empresas
  ADD COLUMN IF NOT EXISTS conta_pix_tipo TEXT,
  ADD COLUMN IF NOT EXISTS conta_pix_chave TEXT,
  ADD COLUMN IF NOT EXISTS anexo_contrato_social_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_contrato_social_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_cnpj_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_cnpj_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_inscricao_municipal_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_inscricao_municipal_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_certidao_junta_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_certidao_junta_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_conta_bancaria_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_conta_bancaria_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_inscricao_estadual_path TEXT;

COMMENT ON COLUMN public.franqueado_empresas.conta_pix_tipo IS
  'Tipo da chave Pix da conta bancária PJ (incorporadora, gestora ou empresa adicional).';
COMMENT ON COLUMN public.franqueado_empresas.conta_pix_chave IS
  'Chave Pix da conta bancária PJ.';
COMMENT ON COLUMN public.franqueado_empresas.anexo_contrato_social_path IS
  'Anexo contrato social — empresas adicionais (tipo empresa).';

ALTER TABLE public.franqueado_spe
  ADD COLUMN IF NOT EXISTS conta_pix_tipo TEXT,
  ADD COLUMN IF NOT EXISTS conta_pix_chave TEXT;

COMMENT ON COLUMN public.franqueado_spe.conta_pix_tipo IS 'Tipo da chave Pix da conta bancária da SPE.';
COMMENT ON COLUMN public.franqueado_spe.conta_pix_chave IS 'Chave Pix da conta bancária da SPE.';

NOTIFY pgrst, 'reload schema';
