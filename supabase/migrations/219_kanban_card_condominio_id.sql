-- 219: vínculo de cards/processos ao cadastro central de condomínios + nome único

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS condominio_id UUID REFERENCES public.condominios (id) ON DELETE SET NULL;

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS condominio_id UUID REFERENCES public.condominios (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_condominio_id ON public.kanban_cards (condominio_id);
CREATE INDEX IF NOT EXISTS idx_processo_step_one_condominio_id ON public.processo_step_one (condominio_id);

COMMENT ON COLUMN public.kanban_cards.condominio_id IS 'FK para cadastro central em condominios.';
COMMENT ON COLUMN public.processo_step_one.condominio_id IS 'FK para cadastro central em condominios.';

-- Nome único (case-insensitive, ignorando espaços nas pontas)
CREATE UNIQUE INDEX IF NOT EXISTS idx_condominios_nome_unique
  ON public.condominios (lower(trim(nome)));

-- Permite cadastro pelo time autenticado no app (cards), com checagem de duplicidade no índice
DROP POLICY IF EXISTS "condominios_insert_authenticated" ON public.condominios;
CREATE POLICY "condominios_insert_authenticated"
  ON public.condominios
  FOR INSERT
  TO authenticated
  WITH CHECK (trim(nome) <> '');
