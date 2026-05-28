-- Cole no Supabase → SQL Editor se os documentos de empresa falharem (schema cache).
-- Idempotente.

ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_contrato_social_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_contrato_social_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_cnpj_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_cnpj_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_inscricao_municipal_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_inscricao_municipal_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_certidao_junta_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_certidao_junta_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_conta_bancaria_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_conta_bancaria_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_inscricao_estadual_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_contrato_social_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_contrato_social_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_cnpj_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_cnpj_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_inscricao_municipal_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_inscricao_municipal_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_certidao_junta_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_certidao_junta_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_conta_bancaria_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_conta_bancaria_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_inscricao_estadual_path TEXT;
