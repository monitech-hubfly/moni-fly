-- 431: Repara tabela etapa_progresso ausente no DEV (criação de franqueado / Step One).
-- Idempotente. Origem: 002_idempotent_schema.sql

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE TABLE IF NOT EXISTS public.etapa_progresso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  etapa_id INT NOT NULL CHECK (etapa_id >= 1 AND etapa_id <= 11),
  status TEXT NOT NULL DEFAULT 'nao_iniciada' CHECK (status IN ('nao_iniciada', 'em_andamento', 'concluida', 'refeita')),
  iniciada_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  tentativas INT NOT NULL DEFAULT 0,
  dados_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(processo_id, etapa_id)
);

CREATE INDEX IF NOT EXISTS idx_etapa_progresso_user ON public.etapa_progresso(user_id);
CREATE INDEX IF NOT EXISTS idx_etapa_progresso_processo ON public.etapa_progresso(processo_id);

ALTER TABLE public.etapa_progresso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank owns etapa_progresso" ON public.etapa_progresso;
DROP POLICY IF EXISTS "Consultor reads portfolio etapa_progresso" ON public.etapa_progresso;
DROP POLICY IF EXISTS "Admin all etapa_progresso" ON public.etapa_progresso;
DROP POLICY IF EXISTS "Team all etapa_progresso" ON public.etapa_progresso;

CREATE POLICY "Frank owns etapa_progresso" ON public.etapa_progresso
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Consultor reads portfolio etapa_progresso" ON public.etapa_progresso
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.consultor_id = auth.uid())
  );

CREATE POLICY "Admin all etapa_progresso" ON public.etapa_progresso
  FOR ALL USING (public.get_my_role() = 'admin');

CREATE POLICY "Team all etapa_progresso" ON public.etapa_progresso
  FOR ALL USING (public.get_my_role() = 'team');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.etapa_progresso TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etapa_progresso TO service_role;
