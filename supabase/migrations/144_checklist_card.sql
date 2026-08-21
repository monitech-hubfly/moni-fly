-- Checklist por card do kanban com visibilidade por responsável (Frank vê só os próprios)

CREATE TABLE IF NOT EXISTS public.kanban_checklist_itens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  texto         TEXT        NOT NULL,
  feito         BOOLEAN     NOT NULL DEFAULT FALSE,
  responsavel_id UUID       REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kanban_checklist_card       ON public.kanban_checklist_itens (card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_checklist_responsavel ON public.kanban_checklist_itens (responsavel_id);

COMMENT ON TABLE public.kanban_checklist_itens IS
  'Itens de checklist por card do kanban; frank vê somente os itens em que é responsável (RLS).';

ALTER TABLE public.kanban_checklist_itens ENABLE ROW LEVEL SECURITY;

-- Internos (não frank/franqueado) veem todos os itens do card
DROP POLICY IF EXISTS "checklist_select_interno" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_select_interno" ON public.kanban_checklist_itens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
  );

-- Frank/franqueado vê somente os itens onde é o responsável
DROP POLICY IF EXISTS "checklist_select_frank" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_select_frank" ON public.kanban_checklist_itens
  FOR SELECT USING (responsavel_id = auth.uid());

-- Apenas internos criam itens
DROP POLICY IF EXISTS "checklist_insert_interno" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_insert_interno" ON public.kanban_checklist_itens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
  );

-- Marcar feito: o próprio responsável OU um interno
DROP POLICY IF EXISTS "checklist_update" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_update" ON public.kanban_checklist_itens
  FOR UPDATE USING (
    responsavel_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
  );

-- Apenas internos deletam
DROP POLICY IF EXISTS "checklist_delete_interno" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_delete_interno" ON public.kanban_checklist_itens
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_checklist_itens TO authenticated;
