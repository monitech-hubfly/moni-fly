-- 506: kanban_proximas_atividades — tabela + RLS + grants PostgREST (popover do board).

CREATE TABLE IF NOT EXISTS public.kanban_proximas_atividades (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       uuid        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  descricao     text        NOT NULL,
  prazo         date        NULL,
  criado_por    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  concluido_em  timestamptz NULL,
  concluido_por uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_kanban_proximas_atividades_card_id
  ON public.kanban_proximas_atividades(card_id);

CREATE INDEX IF NOT EXISTS idx_kanban_proximas_atividades_card_aberto
  ON public.kanban_proximas_atividades(card_id)
  WHERE concluido_em IS NULL;

ALTER TABLE public.kanban_proximas_atividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autenticados podem tudo" ON public.kanban_proximas_atividades;
CREATE POLICY "autenticados podem tudo"
  ON public.kanban_proximas_atividades
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_proximas_atividades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_proximas_atividades TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_proximas_atividades TO anon;

COMMENT ON TABLE public.kanban_proximas_atividades IS
  'Lista de próximas atividades por card (popover ProximaAtividadeDot).';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('506', 'kanban_proximas_atividades_grants')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
