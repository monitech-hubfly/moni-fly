-- 201: Projeto de negócio (espinha dorsal) + vínculo em kanban_cards.
-- Frank enxerga projetos da própria linha em rede_franqueados (profiles.rede_franqueado_id).

-- ─── Tabela projeto_negocio ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projeto_negocio (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  franqueado_id    UUID        REFERENCES public.rede_franqueados(id) ON DELETE SET NULL,
  titulo           TEXT        NOT NULL,
  numero_formatado TEXT        UNIQUE,
  status           TEXT        NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'concluido', 'cancelado')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_negocio_franqueado_id
  ON public.projeto_negocio (franqueado_id);

CREATE INDEX IF NOT EXISTS idx_projeto_negocio_status
  ON public.projeto_negocio (status);

COMMENT ON TABLE public.projeto_negocio IS
  'Projeto/hipótese de negócio (ID mestre). Cards de kanban podem referenciar via projeto_id.';
COMMENT ON COLUMN public.projeto_negocio.numero_formatado IS
  'Identificador legível (ex.: FK0001-BAR-L12). Gerado por trigger se omitido no INSERT.';
COMMENT ON COLUMN public.projeto_negocio.franqueado_id IS
  'Linha em rede_franqueados do franqueado dono do projeto.';

-- ─── Trigger: numero_formatado automático ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gerar_numero_formatado_projeto_negocio()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_n_franquia   TEXT;
  v_slug         TEXT;
  v_seq          INT;
  v_candidato    TEXT;
  v_tentativas   INT := 0;
BEGIN
  IF NEW.numero_formatado IS NOT NULL AND btrim(NEW.numero_formatado) <> '' THEN
    RETURN NEW;
  END IF;

  IF NEW.franqueado_id IS NOT NULL THEN
    SELECT NULLIF(btrim(rf.n_franquia), '')
    INTO v_n_franquia
    FROM public.rede_franqueados rf
    WHERE rf.id = NEW.franqueado_id;
  END IF;

  v_n_franquia := COALESCE(v_n_franquia, 'FK0000');

  v_slug := upper(
    regexp_replace(
      COALESCE(substring(btrim(NEW.titulo) FROM 1 FOR 24), 'PRJ'),
      '[^A-Za-z0-9]',
      '',
      'g'
    )
  );
  IF length(v_slug) < 3 THEN
    v_slug := rpad(v_slug, 3, 'X');
  ELSE
    v_slug := substring(v_slug FROM 1 FOR 3);
  END IF;

  SELECT COALESCE(count(*)::INT, 0) + 1
  INTO v_seq
  FROM public.projeto_negocio pn
  WHERE pn.franqueado_id IS NOT DISTINCT FROM NEW.franqueado_id;

  LOOP
    v_candidato := v_n_franquia || '-' || v_slug || '-P' || lpad(v_seq::TEXT, 2, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.projeto_negocio WHERE numero_formatado = v_candidato
    );
    v_seq := v_seq + 1;
    v_tentativas := v_tentativas + 1;
    IF v_tentativas > 500 THEN
      RAISE EXCEPTION 'Não foi possível gerar numero_formatado único para projeto_negocio';
    END IF;
  END LOOP;

  NEW.numero_formatado := v_candidato;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projeto_negocio_numero_formatado ON public.projeto_negocio;
CREATE TRIGGER trg_projeto_negocio_numero_formatado
  BEFORE INSERT ON public.projeto_negocio
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_numero_formatado_projeto_negocio();

-- ─── kanban_cards.projeto_id ───────────────────────────────────────────────────
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS projeto_id UUID REFERENCES public.projeto_negocio(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_projeto_id
  ON public.kanban_cards (projeto_id);

COMMENT ON COLUMN public.kanban_cards.projeto_id IS
  'Projeto mestre ao qual este card pertence (esteiras vinculadas). Nullable para cards legados.';

-- ─── RLS projeto_negocio ─────────────────────────────────────────────────────
ALTER TABLE public.projeto_negocio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projeto_negocio_select_admin_team" ON public.projeto_negocio;
CREATE POLICY "projeto_negocio_select_admin_team"
  ON public.projeto_negocio
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team')
    )
  );

-- Frank: linha da rede vinculada ao perfil (franqueado_id → rede_franqueados.id, não auth.uid()).
DROP POLICY IF EXISTS "projeto_negocio_select_frank_own" ON public.projeto_negocio;
CREATE POLICY "projeto_negocio_select_frank_own"
  ON public.projeto_negocio
  FOR SELECT
  TO authenticated
  USING (
    franqueado_id IS NOT NULL
    AND franqueado_id IN (
      SELECT p.rede_franqueado_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id IS NOT NULL
        AND p.role IN ('frank', 'franqueado')
    )
  );

DROP POLICY IF EXISTS "projeto_negocio_insert_admin_team" ON public.projeto_negocio;
CREATE POLICY "projeto_negocio_insert_admin_team"
  ON public.projeto_negocio
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "projeto_negocio_update_admin_team" ON public.projeto_negocio;
CREATE POLICY "projeto_negocio_update_admin_team"
  ON public.projeto_negocio
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "projeto_negocio_delete_admin_team" ON public.projeto_negocio;
CREATE POLICY "projeto_negocio_delete_admin_team"
  ON public.projeto_negocio
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team')
    )
  );

GRANT SELECT ON public.projeto_negocio TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.projeto_negocio TO authenticated;
