-- =============================================================================
-- prod_bootstrap_4.sql — parte 4/5 (migrations 136 a 141) | após: _3 | antes: _5
-- NOTA: 136 contém DROP COLUMN em rede_franqueados.
-- =============================================================================

-- PROD: colunas e campos de interação referenciados nas RLS de anexos
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS franqueado_nome TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS responsaveis_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- === MIGRATION 136: 136_rede_remover_kit_boas_vindas.sql ===
ALTER TABLE public.rede_franqueados
  DROP COLUMN IF EXISTS data_kit_boas_vindas;


-- === MIGRATION 137: 137_anexos_chamados_e_rede.sql ===
-- PARTE 1: Buckets (INSERT condicional: sem depender de UNIQUE/ON CONFLICT no PROD)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'chamados-attachments', 'chamados-attachments', false, 10485760, null
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chamados-attachments');
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'subchamados-attachments', 'subchamados-attachments', false, 10485760, null
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'subchamados-attachments');
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'rede-attachments', 'rede-attachments', false, 10485760, null
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'rede-attachments');

-- PARTE 2: Anexos de chamados
CREATE TABLE IF NOT EXISTS public.chamado_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID NOT NULL REFERENCES public.kanban_atividades(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  tamanho INTEGER,
  tipo_mime TEXT,
  uploader_id UUID REFERENCES auth.users(id),
  uploader_nome TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chamado_anexos_chamado
  ON public.chamado_anexos(chamado_id);

ALTER TABLE public.chamado_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chamado_anexos_select" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_select" ON public.chamado_anexos
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
    OR uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.kanban_atividades a
      WHERE a.id = chamado_id AND auth.uid() = ANY(COALESCE(a.responsaveis_ids, '{}'))
    )
  );

DROP POLICY IF EXISTS "chamado_anexos_insert" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_insert" ON public.chamado_anexos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "chamado_anexos_delete" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_delete" ON public.chamado_anexos
  FOR DELETE TO authenticated USING (
    uploader_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
  );

-- PARTE 3: Anexos de sub-chamados
CREATE TABLE IF NOT EXISTS public.subchamado_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subchamado_id BIGINT NOT NULL REFERENCES public.sirene_topicos(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  tamanho INTEGER,
  tipo_mime TEXT,
  uploader_id UUID REFERENCES auth.users(id),
  uploader_nome TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subchamado_anexos_subchamado
  ON public.subchamado_anexos(subchamado_id);

ALTER TABLE public.subchamado_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subchamado_anexos_select" ON public.subchamado_anexos;
CREATE POLICY "subchamado_anexos_select" ON public.subchamado_anexos
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "subchamado_anexos_insert" ON public.subchamado_anexos;
CREATE POLICY "subchamado_anexos_insert" ON public.subchamado_anexos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "subchamado_anexos_delete" ON public.subchamado_anexos;
CREATE POLICY "subchamado_anexos_delete" ON public.subchamado_anexos
  FOR DELETE TO authenticated USING (
    uploader_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
  );

-- PARTE 4: Colunas de anexos na rede de franqueados
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_cof_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_contrato_path TEXT;

COMMENT ON COLUMN public.rede_franqueados.anexo_cof_path IS
  'Caminho no bucket rede-attachments para o COF assinado';
COMMENT ON COLUMN public.rede_franqueados.anexo_contrato_path IS
  'Caminho no bucket rede-attachments para o Contrato assinado';

-- PARTE 5: Policies do storage
DROP POLICY IF EXISTS "chamados_attachments_select" ON storage.objects;
CREATE POLICY "chamados_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chamados-attachments');

DROP POLICY IF EXISTS "chamados_attachments_insert" ON storage.objects;
CREATE POLICY "chamados_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chamados-attachments');

DROP POLICY IF EXISTS "chamados_attachments_delete" ON storage.objects;
CREATE POLICY "chamados_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chamados-attachments');

DROP POLICY IF EXISTS "subchamados_attachments_all" ON storage.objects;
CREATE POLICY "subchamados_attachments_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'subchamados-attachments')
  WITH CHECK (bucket_id = 'subchamados-attachments');

DROP POLICY IF EXISTS "rede_attachments_select" ON storage.objects;
CREATE POLICY "rede_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rede-attachments');

DROP POLICY IF EXISTS "rede_attachments_insert" ON storage.objects;
CREATE POLICY "rede_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rede-attachments'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
  );

DROP POLICY IF EXISTS "rede_attachments_delete" ON storage.objects;
CREATE POLICY "rede_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'rede-attachments'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
  );


-- === MIGRATION 138: 138_chamado_anexos_rls_criador.sql ===
-- Frank / criador do chamado: ver anexos e inserir só nos chamados que criou (ou admin/team/responsável).

DROP POLICY IF EXISTS "chamado_anexos_select" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_select" ON public.chamado_anexos
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
    OR uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.kanban_atividades a
      WHERE a.id = chamado_id AND auth.uid() = ANY(COALESCE(a.responsaveis_ids, '{}'))
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_atividades a
      WHERE a.id = chamado_id AND a.criado_por = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chamado_anexos_insert" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_insert" ON public.chamado_anexos
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
    OR EXISTS (
      SELECT 1 FROM public.kanban_atividades a
      WHERE a.id = chamado_id
        AND (
          a.criado_por = auth.uid()
          OR auth.uid() = ANY(COALESCE(a.responsaveis_ids, '{}'))
        )
    )
  );


-- === MIGRATION 139: 139_rede_attachments_select_staff.sql ===
-- Documentos sensíveis da rede: só admin/team leem no storage (Frank autenticado não baixa).

DROP POLICY IF EXISTS "rede_attachments_select" ON storage.objects;
CREATE POLICY "rede_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rede-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );


-- === MIGRATION 140: 140_rede_franqueados_update_team.sql ===
-- Time interno pode atualizar linhas da rede (ex.: anexos COF / contrato assinado).

DROP POLICY IF EXISTS "rede_franqueados_update_team" ON public.rede_franqueados;
CREATE POLICY "rede_franqueados_update_team"
  ON public.rede_franqueados FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'team'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'team'));


-- === MIGRATION 141: 141_rede_attachments_insert_consultor.sql ===
-- Consultores também enviam documentos da rede (alinha ao UPDATE em rede_franqueados).

DROP POLICY IF EXISTS "rede_attachments_insert" ON storage.objects;
CREATE POLICY "rede_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rede-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );

DROP POLICY IF EXISTS "rede_attachments_delete" ON storage.objects;
CREATE POLICY "rede_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'rede-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );


