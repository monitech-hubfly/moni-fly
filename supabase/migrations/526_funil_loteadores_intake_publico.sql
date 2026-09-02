-- 526: Link público estável para novo cadastro + card no Funil Loteadores.
-- Uma linha só. O token nasce uma vez e nunca é rotacionado.

CREATE TABLE IF NOT EXISTS public.kanban_loteador_intake_publico (
  id          TEXT        PRIMARY KEY DEFAULT 'default',
  token       TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.kanban_loteador_intake_publico (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.kanban_loteador_intake_publico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loteador_intake_publico_select_interno" ON public.kanban_loteador_intake_publico;
CREATE POLICY "loteador_intake_publico_select_interno" ON public.kanban_loteador_intake_publico
  FOR SELECT USING (auth.role() = 'authenticated');

GRANT SELECT ON public.kanban_loteador_intake_publico TO authenticated;

COMMENT ON TABLE public.kanban_loteador_intake_publico IS
  'Token único e imutável do link externo de captação: cada envio cria um cadastro e um card novos (nunca edita o anterior).';

NOTIFY pgrst, 'reload schema';
