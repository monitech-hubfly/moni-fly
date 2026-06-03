-- Paralisados (nome da fase), vínculos legado card_id, anexos em comentários, RLS team

UPDATE public.kanban_fases f
SET nome = 'Paralisados'
FROM public.kanbans k
WHERE k.id = f.kanban_id
  AND k.nome = 'Funil Acoplamento'
  AND f.slug = 'acoplamento_reprovado'
  AND f.nome IS DISTINCT FROM 'Paralisados';

COMMENT ON COLUMN public.kanban_cards.motivo_reprovacao_acoplamento IS
  'Motivo ao mover card para fase Paralisados no Funil Acoplamento.';

-- PROD legado: coluna card_id NOT NULL sem preenchimento automático
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kanban_card_vinculos'
      AND column_name = 'card_id'
  ) THEN
    ALTER TABLE public.kanban_card_vinculos ALTER COLUMN card_id DROP NOT NULL;
    UPDATE public.kanban_card_vinculos
    SET card_id = card_origem_id
    WHERE card_id IS NULL AND card_origem_id IS NOT NULL;
  END IF;
END $$;

ALTER TABLE public.kanban_card_vinculos
  ADD COLUMN IF NOT EXISTS card_origem_id UUID REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS card_destino_id UUID REFERENCES public.kanban_cards(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "kanban_card_vinculos_insert_admin" ON public.kanban_card_vinculos;
CREATE POLICY "kanban_card_vinculos_insert_admin"
  ON public.kanban_card_vinculos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor', 'team')
    )
  );

-- Anexos em comentários de cards (todos os funis)
CREATE TABLE IF NOT EXISTS public.kanban_card_comentario_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comentario_id UUID NOT NULL REFERENCES public.kanban_card_comentarios(id) ON DELETE CASCADE,
  card_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_card_comentario_anexos_comentario
  ON public.kanban_card_comentario_anexos(comentario_id);

ALTER TABLE public.kanban_card_comentario_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_card_comentario_anexos_select" ON public.kanban_card_comentario_anexos;
CREATE POLICY "kanban_card_comentario_anexos_select"
  ON public.kanban_card_comentario_anexos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kanban_card_comentario_anexos_insert" ON public.kanban_card_comentario_anexos;
CREATE POLICY "kanban_card_comentario_anexos_insert"
  ON public.kanban_card_comentario_anexos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT ON public.kanban_card_comentario_anexos TO authenticated;
