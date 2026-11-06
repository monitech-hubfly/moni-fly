-- Migration 685: carometro_ausencias — garante tabela, índice e RLS em PROD
-- Idempotente: seguro re-executar em DEV (onde a tabela já existe)

CREATE TABLE IF NOT EXISTS public.carometro_ausencias (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data       date NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, data)
);

ALTER TABLE public.carometro_ausencias ENABLE ROW LEVEL SECURITY;

-- Usuário lê e escreve apenas suas próprias ausências
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'carometro_ausencias' AND policyname = 'ausencias_self'
  ) THEN
    CREATE POLICY ausencias_self
      ON public.carometro_ausencias
      FOR ALL
      USING  (profile_id = auth.uid())
      WITH CHECK (profile_id = auth.uid());
  END IF;
END $$;

-- Qualquer usuário autenticado pode LER ausências de outros
-- (necessário para o Modal de Agendamento e Sirene verificarem disponibilidade)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'carometro_ausencias' AND policyname = 'carometro_ausencias_read_all_auth'
  ) THEN
    CREATE POLICY carometro_ausencias_read_all_auth
      ON public.carometro_ausencias
      FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
