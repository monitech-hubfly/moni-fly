-- SPE por projeto do franqueado (N por rede_franqueado; opcional vínculo com card Kanban).

CREATE TABLE IF NOT EXISTS public.franqueado_spe (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rede_franqueado_id      UUID NOT NULL REFERENCES public.rede_franqueados(id) ON DELETE CASCADE,
  kanban_card_id          UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  nome_projeto            TEXT,
  razao_social            TEXT,
  cnpj                    TEXT,
  inscricao_municipal     TEXT,
  inscricao_estadual      TEXT,
  status                  TEXT DEFAULT 'em_abertura' CHECK (status IN ('ativa', 'inativa', 'em_abertura')),
  conta_banco             TEXT,
  conta_agencia           TEXT,
  conta_numero            TEXT,
  conta_tipo              TEXT,
  observacoes             TEXT,
  anexo_contrato_social_path              TEXT,
  anexo_contrato_social_justificativa     TEXT,
  anexo_cnpj_path                         TEXT,
  anexo_cnpj_justificativa                TEXT,
  anexo_inscricao_municipal_path          TEXT,
  anexo_inscricao_municipal_justificativa TEXT,
  anexo_certidao_junta_path               TEXT,
  anexo_certidao_junta_justificativa      TEXT,
  anexo_conta_bancaria_path               TEXT,
  anexo_conta_bancaria_justificativa      TEXT,
  anexo_inscricao_estadual_path           TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_franqueado_spe_kanban_card_id
  ON public.franqueado_spe (kanban_card_id)
  WHERE kanban_card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_franqueado_spe_rede_franqueado_id
  ON public.franqueado_spe (rede_franqueado_id);

COMMENT ON TABLE public.franqueado_spe IS
  'SPE por projeto do franqueado; pode vincular a um card Kanban (1:1 quando vinculado).';

ALTER TABLE public.franqueado_spe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "franqueado_spe_select_admin_team" ON public.franqueado_spe;
CREATE POLICY "franqueado_spe_select_admin_team"
  ON public.franqueado_spe FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "franqueado_spe_select_frank_own" ON public.franqueado_spe;
CREATE POLICY "franqueado_spe_select_frank_own"
  ON public.franqueado_spe FOR SELECT TO authenticated
  USING (
    rede_franqueado_id IN (
      SELECT p.rede_franqueado_id FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id IS NOT NULL
        AND p.role IN ('frank', 'franqueado')
    )
  );

DROP POLICY IF EXISTS "franqueado_spe_insert_admin_team" ON public.franqueado_spe;
CREATE POLICY "franqueado_spe_insert_admin_team"
  ON public.franqueado_spe FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "franqueado_spe_update_admin_team" ON public.franqueado_spe;
CREATE POLICY "franqueado_spe_update_admin_team"
  ON public.franqueado_spe FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "franqueado_spe_delete_admin_team" ON public.franqueado_spe;
CREATE POLICY "franqueado_spe_delete_admin_team"
  ON public.franqueado_spe FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

-- Cards podem referenciar SPE vinculada (leitura rápida no modal).
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS franqueado_spe_id UUID REFERENCES public.franqueado_spe(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_franqueado_spe_id
  ON public.kanban_cards (franqueado_spe_id)
  WHERE franqueado_spe_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.franqueado_spe TO authenticated;
