-- Histórico de prazo das metas (mãe e filha) e permissão do time nas metas filhas.
-- Idempotente. O gatilho grava a mudança mesmo se a alteração vier de fora da tela.

CREATE TABLE IF NOT EXISTS public.objetivo_prazo_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objetivo_id uuid NOT NULL REFERENCES public.objetivos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('definicao', 'alteracao', 'vigente')),
  data_inicio_anterior date,
  data_fim_anterior date,
  data_inicio_nova date,
  data_fim_nova date,
  profile_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_objetivo_prazo_historico_objetivo
  ON public.objetivo_prazo_historico (objetivo_id, criado_em);

ALTER TABLE public.objetivo_prazo_historico ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'objetivo_prazo_historico'
      AND policyname = 'objetivo_prazo_historico_select'
  ) THEN
    CREATE POLICY objetivo_prazo_historico_select
      ON public.objetivo_prazo_historico
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

GRANT SELECT ON public.objetivo_prazo_historico TO authenticated;

-- Time e admin podem criar, editar, arquivar e reabrir só meta filha.
-- Meta mãe continua restrita à policy de admin já existente.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'objetivos' AND policyname = 'team_filha_insert'
  ) THEN
    CREATE POLICY team_filha_insert
      ON public.objetivos
      FOR INSERT
      TO authenticated
      WITH CHECK (
        objetivo_pai_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'team')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'objetivos' AND policyname = 'team_filha_update'
  ) THEN
    CREATE POLICY team_filha_update
      ON public.objetivos
      FOR UPDATE
      TO authenticated
      USING (
        objetivo_pai_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'team')
        )
      )
      WITH CHECK (
        objetivo_pai_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'team')
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.registrar_prazo_objetivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.data_inicio IS NOT NULL OR NEW.data_fim IS NOT NULL THEN
      INSERT INTO public.objetivo_prazo_historico (
        objetivo_id, tipo, data_inicio_nova, data_fim_nova, profile_id
      ) VALUES (
        NEW.id, 'definicao', NEW.data_inicio, NEW.data_fim, auth.uid()
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.data_inicio IS DISTINCT FROM OLD.data_inicio
     OR NEW.data_fim IS DISTINCT FROM OLD.data_fim THEN
    INSERT INTO public.objetivo_prazo_historico (
      objetivo_id, tipo,
      data_inicio_anterior, data_fim_anterior,
      data_inicio_nova, data_fim_nova,
      profile_id
    ) VALUES (
      NEW.id, 'alteracao',
      OLD.data_inicio, OLD.data_fim,
      NEW.data_inicio, NEW.data_fim,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registrar_prazo_objetivo ON public.objetivos;
CREATE TRIGGER trg_registrar_prazo_objetivo
  AFTER INSERT OR UPDATE OF data_inicio, data_fim ON public.objetivos
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_prazo_objetivo();

INSERT INTO public.objetivo_prazo_historico (objetivo_id, tipo, data_inicio_nova, data_fim_nova)
SELECT o.id, 'vigente', o.data_inicio, o.data_fim
FROM public.objetivos o
WHERE (o.data_inicio IS NOT NULL OR o.data_fim IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.objetivo_prazo_historico h WHERE h.objetivo_id = o.id
  );

NOTIFY pgrst, 'reload schema';
