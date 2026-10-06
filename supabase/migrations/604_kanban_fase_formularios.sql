-- Migration 604: vinculação de formulários a fases de kanban e rastreio por card.
-- formulario_id é text: a migration 603 grava formularios.id como texto (f0rm0001-…).
-- Idempotente. DEV já tem as tabelas; PROD recebe nesta migration.

CREATE TABLE IF NOT EXISTS public.kanban_fase_formularios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  kanban_id uuid NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  fase_id uuid NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  formulario_id text NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  obrigatorio boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now() NOT NULL,
  criado_por uuid REFERENCES auth.users(id),
  UNIQUE (fase_id, formulario_id)
);

ALTER TABLE public.kanban_fase_formularios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'kanban_fase_formularios' AND policyname = 'kff_select_autenticado'
  ) THEN
    CREATE POLICY kff_select_autenticado ON public.kanban_fase_formularios
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'kanban_fase_formularios' AND policyname = 'kff_admin_all'
  ) THEN
    CREATE POLICY kff_admin_all ON public.kanban_fase_formularios
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'consultor', 'supervisor'))
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'consultor', 'supervisor'))
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.kanban_card_formularios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_formulario_id uuid REFERENCES public.kanban_fase_formularios(id) ON DELETE SET NULL,
  formulario_id text NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  resposta_id uuid REFERENCES public.formulario_respostas(id) ON DELETE SET NULL,
  token text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_preenchimento', 'enviado')),
  criado_em timestamptz DEFAULT now() NOT NULL,
  criado_por uuid REFERENCES auth.users(id),
  atualizado_em timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.kanban_card_formularios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'kanban_card_formularios' AND policyname = 'kcf_select_card_owner_or_staff'
  ) THEN
    CREATE POLICY kcf_select_card_owner_or_staff ON public.kanban_card_formularios
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.kanban_cards kc
          WHERE kc.id = card_id
          AND (
            kc.franqueado_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor', 'supervisor'))
          )
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'kanban_card_formularios' AND policyname = 'kcf_staff_write'
  ) THEN
    CREATE POLICY kcf_staff_write ON public.kanban_card_formularios
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor', 'supervisor'))
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor', 'supervisor'))
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kanban_fase_formularios_fase_id ON public.kanban_fase_formularios(fase_id);
CREATE INDEX IF NOT EXISTS idx_kanban_card_formularios_card_id ON public.kanban_card_formularios(card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_card_formularios_resposta_id ON public.kanban_card_formularios(resposta_id);

ALTER TABLE public.formulario_respostas ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES public.kanban_cards(id) ON DELETE SET NULL;
ALTER TABLE public.formulario_respostas ADD COLUMN IF NOT EXISTS kanban_id uuid REFERENCES public.kanbans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_formulario_respostas_card_id ON public.formulario_respostas(card_id);

ALTER TABLE public.formulario_tokens ADD COLUMN IF NOT EXISTS usado boolean NOT NULL DEFAULT false;

ALTER TABLE public.formulario_respostas DROP CONSTRAINT IF EXISTS formulario_respostas_status_chk;
ALTER TABLE public.formulario_respostas
  ADD CONSTRAINT formulario_respostas_status_chk
  CHECK (status IN ('rascunho', 'iniciado', 'em_preenchimento', 'enviado', 'arquivado'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_fase_formularios TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_card_formularios TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('604', '604_kanban_fase_formularios')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
