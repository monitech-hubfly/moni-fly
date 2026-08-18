-- 535: rede_corretores — status `pendente` para cadastro público (aguardando revisão).
-- Idempotente.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rede_corretores'
  ) THEN
    ALTER TABLE public.rede_corretores DROP CONSTRAINT IF EXISTS rede_corretores_status_check;
    ALTER TABLE public.rede_corretores
      ADD CONSTRAINT rede_corretores_status_check
      CHECK (status IN ('ativo', 'inativo', 'em_analise', 'pendente'));
  END IF;
END $$;

COMMENT ON COLUMN public.rede_corretores.status IS
  'ativo | inativo | em_analise | pendente (intake público aguardando revisão)';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rede_corretores TO service_role;

NOTIFY pgrst, 'reload schema';
