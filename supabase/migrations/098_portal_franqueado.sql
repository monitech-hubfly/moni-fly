-- ─── 098: Portal do Franqueado — Sprint F ────────────────────────────────────
-- Idempotente: DO $$ com verificações, CREATE TABLE IF NOT EXISTS.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
-- GRANTs das tabelas criadas em 095/096/097 ficam em cada migration respectiva.
-- Este script cuida apenas de: role, convites_franqueado e RLS de kanban_cards.

-- ─── 1. Role franqueado em profiles ──────────────────────────────────────────
-- Se a coluna role tiver CHECK constraint sem 'franqueado', recria incluindo-o.
DO $$
DECLARE
  v_constraint_name TEXT;
  v_check_clause    TEXT;
BEGIN
  SELECT cc.constraint_name, cc.check_clause
  INTO v_constraint_name, v_check_clause
  FROM information_schema.check_constraints cc
  JOIN information_schema.constraint_column_usage ccu
    ON cc.constraint_name = ccu.constraint_name
   AND cc.constraint_schema = ccu.constraint_schema
  WHERE ccu.table_schema = 'public'
    AND ccu.table_name   = 'profiles'
    AND ccu.column_name  = 'role'
  LIMIT 1;

  -- Só age se encontrou constraint E ela não inclui 'franqueado'
  IF v_constraint_name IS NOT NULL AND v_check_clause NOT LIKE '%franqueado%' THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('admin', 'consultor', 'frank', 'franqueado'));
  END IF;
END;
$$;

-- ─── 2. convites_franqueado ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.convites_franqueado (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT        NOT NULL,
  franqueado_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  token          TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  usado          BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convites_email      ON public.convites_franqueado(email);
CREATE INDEX IF NOT EXISTS idx_convites_token      ON public.convites_franqueado(token);
CREATE INDEX IF NOT EXISTS idx_convites_franqueado ON public.convites_franqueado(franqueado_id);

COMMENT ON TABLE public.convites_franqueado IS
  'Convites de acesso ao portal do franqueado. '
  'token é único e de uso único (usado = true após aceite).';

-- ─── 3. RLS em convites_franqueado ───────────────────────────────────────────
ALTER TABLE public.convites_franqueado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "convites_select" ON public.convites_franqueado;
CREATE POLICY "convites_select"
  ON public.convites_franqueado FOR SELECT
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_insert" ON public.convites_franqueado;
CREATE POLICY "convites_insert"
  ON public.convites_franqueado FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_update" ON public.convites_franqueado;
CREATE POLICY "convites_update"
  ON public.convites_franqueado FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- ─── 5. GRANTs — somente tabelas criadas nesta migration ─────────────────────
GRANT SELECT ON public.convites_franqueado TO authenticated;
GRANT INSERT, UPDATE ON public.convites_franqueado TO authenticated;
