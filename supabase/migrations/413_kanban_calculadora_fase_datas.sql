-- 413: Overrides manuais de datas (início/fim) por fase na Calculadora de Fases.

BEGIN;

CREATE TABLE IF NOT EXISTS public.kanban_calculadora_fase_datas (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      uuid        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_id      uuid        NOT NULL,
  data_inicio  date,
  data_fim     date,
  editado_por  uuid        REFERENCES auth.users(id),
  editado_em   timestamptz DEFAULT now(),
  UNIQUE (card_id, fase_id)
);

CREATE INDEX IF NOT EXISTS idx_calculadora_fase_datas_card_id
  ON public.kanban_calculadora_fase_datas(card_id);

CREATE INDEX IF NOT EXISTS idx_calculadora_fase_datas_fase_id
  ON public.kanban_calculadora_fase_datas(fase_id);

ALTER TABLE public.kanban_calculadora_fase_datas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calculadora_fase_datas_select"
  ON public.kanban_calculadora_fase_datas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards c
      WHERE c.id = kanban_calculadora_fase_datas.card_id
    )
  );

CREATE POLICY "calculadora_fase_datas_insert"
  ON public.kanban_calculadora_fase_datas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

CREATE POLICY "calculadora_fase_datas_update"
  ON public.kanban_calculadora_fase_datas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

CREATE POLICY "calculadora_fase_datas_delete"
  ON public.kanban_calculadora_fase_datas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

GRANT SELECT ON public.kanban_calculadora_fase_datas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.kanban_calculadora_fase_datas TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('413', 'kanban_calculadora_fase_datas')
ON CONFLICT (version) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
