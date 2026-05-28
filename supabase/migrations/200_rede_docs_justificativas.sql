-- Justificativa quando documento da franquia não foi anexado (cadastro incompleto se vazio).

ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_cof_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_contrato_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_numero_franquia_justificativa TEXT;

COMMENT ON COLUMN public.rede_franqueados.anexo_cof_justificativa IS
  'Justificativa de ausência do COF assinado (quando anexo_cof_path está vazio).';
COMMENT ON COLUMN public.rede_franqueados.anexo_contrato_justificativa IS
  'Justificativa de ausência do contrato assinado (quando anexo_contrato_path está vazio).';
COMMENT ON COLUMN public.rede_franqueados.anexo_numero_franquia_justificativa IS
  'Justificativa de ausência do doc. de número de franquia (quando anexo_numero_franquia_path está vazio).';

NOTIFY pgrst, 'reload schema';
