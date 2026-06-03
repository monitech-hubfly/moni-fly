-- Checklist Legal por condomínio (kanban / acoplamento) — versões, log e tokens públicos

CREATE TABLE IF NOT EXISTS public.checklist_legal_condominio (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id   UUID NOT NULL REFERENCES public.condominios (id) ON DELETE CASCADE,
  versao          INT NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho', 'concluido')),
  respostas_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  arquivos_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  form_version    INT NOT NULL DEFAULT 1,
  card_origem_id  UUID REFERENCES public.kanban_cards (id) ON DELETE SET NULL,
  created_by      UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (condominio_id, versao)
);

CREATE INDEX IF NOT EXISTS idx_checklist_legal_condominio_condominio
  ON public.checklist_legal_condominio (condominio_id);

CREATE INDEX IF NOT EXISTS idx_checklist_legal_condominio_status
  ON public.checklist_legal_condominio (condominio_id, status, versao DESC);

COMMENT ON TABLE public.checklist_legal_condominio IS
  'Checklist Legal versionado por condomínio. Última versão concluída é canônica para novos cards.';

CREATE TABLE IF NOT EXISTS public.checklist_legal_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id  UUID NOT NULL REFERENCES public.checklist_legal_condominio (id) ON DELETE CASCADE,
  condominio_id UUID NOT NULL REFERENCES public.condominios (id) ON DELETE CASCADE,
  card_id       UUID REFERENCES public.kanban_cards (id) ON DELETE SET NULL,
  acao          TEXT NOT NULL,
  actor_id      UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_label   TEXT,
  detalhes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_legal_log_checklist
  ON public.checklist_legal_log (checklist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checklist_legal_log_condominio
  ON public.checklist_legal_log (condominio_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.checklist_legal_public_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  card_id       UUID NOT NULL REFERENCES public.kanban_cards (id) ON DELETE CASCADE,
  condominio_id UUID REFERENCES public.condominios (id) ON DELETE SET NULL,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  revoked_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_legal_public_tokens_token
  ON public.checklist_legal_public_tokens (token);

CREATE INDEX IF NOT EXISTS idx_checklist_legal_public_tokens_card
  ON public.checklist_legal_public_tokens (card_id);

ALTER TABLE public.checklist_legal_condominio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_legal_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_legal_public_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_legal_condominio_select_auth" ON public.checklist_legal_condominio;
CREATE POLICY "checklist_legal_condominio_select_auth"
  ON public.checklist_legal_condominio FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "checklist_legal_condominio_insert_auth" ON public.checklist_legal_condominio;
CREATE POLICY "checklist_legal_condominio_insert_auth"
  ON public.checklist_legal_condominio FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "checklist_legal_condominio_update_auth" ON public.checklist_legal_condominio;
CREATE POLICY "checklist_legal_condominio_update_auth"
  ON public.checklist_legal_condominio FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "checklist_legal_log_select_auth" ON public.checklist_legal_log;
CREATE POLICY "checklist_legal_log_select_auth"
  ON public.checklist_legal_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "checklist_legal_log_insert_auth" ON public.checklist_legal_log;
CREATE POLICY "checklist_legal_log_insert_auth"
  ON public.checklist_legal_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "checklist_legal_public_tokens_select_auth" ON public.checklist_legal_public_tokens;
CREATE POLICY "checklist_legal_public_tokens_select_auth"
  ON public.checklist_legal_public_tokens FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "checklist_legal_public_tokens_insert_auth" ON public.checklist_legal_public_tokens;
CREATE POLICY "checklist_legal_public_tokens_insert_auth"
  ON public.checklist_legal_public_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE ON public.checklist_legal_condominio TO authenticated;
GRANT SELECT, INSERT ON public.checklist_legal_log TO authenticated;
GRANT SELECT, INSERT ON public.checklist_legal_public_tokens TO authenticated;

NOTIFY pgrst, 'reload schema';
