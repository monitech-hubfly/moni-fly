-- Chamados internos vs visíveis para Frank/franqueado (RLS SELECT).
-- Internos: visivel_frank = FALSE (default). Abertos pelo próprio Frank/franqueado: TRUE.

ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS visivel_frank BOOLEAN NOT NULL DEFAULT FALSE;

-- Retroativo: quem abriu tem role frank ou franqueado
UPDATE public.sirene_chamados sc
SET visivel_frank = TRUE
FROM public.profiles p
WHERE p.id = sc.aberto_por
  AND p.role IN ('frank', 'franqueado');

CREATE INDEX IF NOT EXISTS idx_sirene_chamados_visivel_frank
  ON public.sirene_chamados (visivel_frank)
  WHERE visivel_frank = TRUE;

-- Substitui a policy de 037: internos veem tudo; Frank/franqueado só linhas visivel_frank.
-- Mantém sirene_chamados_hdm_team_select (035) como OR adicional para times HDM.
DROP POLICY IF EXISTS "sirene_chamados_select" ON public.sirene_chamados;
CREATE POLICY "sirene_chamados_select"
  ON public.sirene_chamados FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('frank', 'franqueado')
      )
      AND visivel_frank = TRUE
    )
  );
