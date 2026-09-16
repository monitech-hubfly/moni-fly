-- 552: Referência da planilha de lotes no Storage (Funil Loteadores).
-- Upload no card; parse só no simulador público.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Não aplicar em PROD sem revisão da Ingrid.

ALTER TABLE public.imob_card_modelo
  ADD COLUMN IF NOT EXISTS planilha_lotes_path text,
  ADD COLUMN IF NOT EXISTS planilha_lotes_nome text,
  ADD COLUMN IF NOT EXISTS planilha_lotes_enviado_em timestamptz;

COMMENT ON COLUMN public.imob_card_modelo.planilha_lotes_path IS
  'Storage path (bucket processo-docs) da planilha de lotes (.csv/.xlsx).';
COMMENT ON COLUMN public.imob_card_modelo.planilha_lotes_nome IS
  'Nome original do arquivo da planilha de lotes.';
COMMENT ON COLUMN public.imob_card_modelo.planilha_lotes_enviado_em IS
  'Data/hora do último upload da planilha de lotes.';

-- Qualquer autenticado pode gravar a referência da planilha (upload/substituir).
-- DELETE do modelo continua restrito à policy admin/team existente.
DROP POLICY IF EXISTS "imob_card_modelo_insert_auth" ON public.imob_card_modelo;
CREATE POLICY "imob_card_modelo_insert_auth"
  ON public.imob_card_modelo
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "imob_card_modelo_update_auth" ON public.imob_card_modelo;
CREATE POLICY "imob_card_modelo_update_auth"
  ON public.imob_card_modelo
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
