-- 557: kanban_operacoes_rodada_vinculos — Operações → Funil Divify (rodadas 1ª–6ª).
-- Espelho estrutural de 230 + 495 (coluna filho) + 498 (grants) + 499 (unique index),
-- com RLS por profiles.role (admin/team/consultor/supervisor) conforme spec Rodadas.

-- ---------------------------------------------------------------------------
-- Função genérica updated_at (cria só se não existir)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Trigger BEFORE UPDATE: define NEW.updated_at = now(). Reutilizável.';

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kanban_operacoes_rodada_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacoes_card_id uuid NOT NULL REFERENCES public.kanban_cards (id) ON DELETE CASCADE,
  rodada_index smallint NOT NULL CHECK (rodada_index BETWEEN 1 AND 6),
  divify_card_id uuid NULL REFERENCES public.kanban_cards (id) ON DELETE SET NULL,
  concluido_em timestamptz NULL,
  concluido_por uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operacoes_card_id, rodada_index)
);

COMMENT ON TABLE public.kanban_operacoes_rodada_vinculos IS
  'Vínculos preset de rodada (1ª–6ª) no Funil Operações; ao concluir cria card filho no Funil Divify.';

COMMENT ON COLUMN public.kanban_operacoes_rodada_vinculos.divify_card_id IS
  'Card filho criado no Funil Divify (Moní Capital) ao concluir o vínculo de rodada.';

COMMENT ON COLUMN public.kanban_operacoes_rodada_vinculos.rodada_index IS
  'Número da rodada (1–6), espelho de tranche_index nas tranches de Crédito Obra.';

-- UNIQUE INDEX explícito (mesmo padrão da 499; reforça o UNIQUE da tabela para upsert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rodada_vinculos_card_index
  ON public.kanban_operacoes_rodada_vinculos (operacoes_card_id, rodada_index);

CREATE INDEX IF NOT EXISTS idx_kanban_operacoes_rodada_vinculos_divify
  ON public.kanban_operacoes_rodada_vinculos (divify_card_id)
  WHERE divify_card_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Trigger updated_at
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_kanban_operacoes_rodada_vinculos_updated_at
  ON public.kanban_operacoes_rodada_vinculos;

CREATE TRIGGER trg_kanban_operacoes_rodada_vinculos_updated_at
  BEFORE UPDATE ON public.kanban_operacoes_rodada_vinculos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.kanban_operacoes_rodada_vinculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kanban_operacoes_rodada_vinculos_select
  ON public.kanban_operacoes_rodada_vinculos;
CREATE POLICY kanban_operacoes_rodada_vinculos_select
  ON public.kanban_operacoes_rodada_vinculos
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS kanban_operacoes_rodada_vinculos_insert
  ON public.kanban_operacoes_rodada_vinculos;
CREATE POLICY kanban_operacoes_rodada_vinculos_insert
  ON public.kanban_operacoes_rodada_vinculos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS kanban_operacoes_rodada_vinculos_update
  ON public.kanban_operacoes_rodada_vinculos;
CREATE POLICY kanban_operacoes_rodada_vinculos_update
  ON public.kanban_operacoes_rodada_vinculos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS kanban_operacoes_rodada_vinculos_delete
  ON public.kanban_operacoes_rodada_vinculos;
CREATE POLICY kanban_operacoes_rodada_vinculos_delete
  ON public.kanban_operacoes_rodada_vinculos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- GRANTs
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_operacoes_rodada_vinculos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_operacoes_rodada_vinculos TO service_role;

-- ---------------------------------------------------------------------------
-- Registro + PostgREST
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('557', 'kanban_operacoes_rodada_vinculos')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
