-- Repositório: Tipo de Documento, Padrão, Variações e versões.
-- Reaproveita repositorio_secoes, repositorio_documentos e o bucket documentos-templates.
-- repositorio_documentos passa a ser uma versão de arquivo. O arquivo antigo não é apagado.
-- Não editar migrations já aplicadas. Não aplicar em produção neste passo.

CREATE TABLE IF NOT EXISTS public.repositorio_tipos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secao_id    uuid NOT NULL REFERENCES public.repositorio_secoes(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  ordem       integer NOT NULL DEFAULT 0,
  checklist   text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.repositorio_variacoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id          uuid NOT NULL REFERENCES public.repositorio_tipos(id) ON DELETE CASCADE,
  nome             text NOT NULL,
  quando_utilizar  text,
  ordem            integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.repositorio_documentos
  ADD COLUMN IF NOT EXISTS tipo_id uuid REFERENCES public.repositorio_tipos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS variacao_id uuid REFERENCES public.repositorio_variacoes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vigente boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS juridico_ponto_id uuid;

COMMENT ON COLUMN public.repositorio_documentos.tipo_id IS
  'Versão do documento padrão deste tipo. Mutuamente exclusivo com variacao_id.';
COMMENT ON COLUMN public.repositorio_documentos.variacao_id IS
  'Versão do arquivo desta variação. Mutuamente exclusivo com tipo_id.';
COMMENT ON COLUMN public.repositorio_documentos.vigente IS
  'Arquivo mostrado na tela principal. As demais versões ficam no histórico.';
COMMENT ON COLUMN public.repositorio_documentos.juridico_ponto_id IS
  'Opcional. Reservado para o ponto jurídico que originar uma versão futura. Sem integração automática.';
COMMENT ON COLUMN public.repositorio_tipos.checklist IS
  'Itens opcionais do tipo, só o nome de cada documento. Não é checklist de fase nem de conclusão.';

DO $$
DECLARE
  r record;
  v_tipo uuid;
BEGIN
  FOR r IN
    SELECT id, secao_id, nome, ordem
    FROM public.repositorio_documentos
    WHERE tipo_id IS NULL AND variacao_id IS NULL
  LOOP
    INSERT INTO public.repositorio_tipos (secao_id, nome, ordem)
    VALUES (r.secao_id, r.nome, COALESCE(r.ordem, 0))
    RETURNING id INTO v_tipo;
    UPDATE public.repositorio_documentos
       SET tipo_id = v_tipo, vigente = true
     WHERE id = r.id;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'repositorio_documentos_alvo_chk'
  ) THEN
    ALTER TABLE public.repositorio_documentos
      ADD CONSTRAINT repositorio_documentos_alvo_chk
      CHECK (
        (tipo_id IS NOT NULL AND variacao_id IS NULL)
        OR (tipo_id IS NULL AND variacao_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS repositorio_documentos_vigente_padrao_idx
  ON public.repositorio_documentos (tipo_id)
  WHERE vigente AND tipo_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS repositorio_documentos_vigente_variacao_idx
  ON public.repositorio_documentos (variacao_id)
  WHERE vigente AND variacao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS repositorio_tipos_secao_idx
  ON public.repositorio_tipos (secao_id, ordem);

CREATE INDEX IF NOT EXISTS repositorio_variacoes_tipo_idx
  ON public.repositorio_variacoes (tipo_id, ordem);

DO $$
BEGIN
  IF to_regclass('public.juridico_pontos') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'repositorio_documentos_juridico_ponto_fkey'
     ) THEN
    ALTER TABLE public.repositorio_documentos
      ADD CONSTRAINT repositorio_documentos_juridico_ponto_fkey
      FOREIGN KEY (juridico_ponto_id) REFERENCES public.juridico_pontos(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.repositorio_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repositorio_variacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS repositorio_tipos_select ON public.repositorio_tipos;
CREATE POLICY repositorio_tipos_select ON public.repositorio_tipos
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS repositorio_tipos_staff ON public.repositorio_tipos;
CREATE POLICY repositorio_tipos_staff ON public.repositorio_tipos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS repositorio_variacoes_select ON public.repositorio_variacoes;
CREATE POLICY repositorio_variacoes_select ON public.repositorio_variacoes
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS repositorio_variacoes_staff ON public.repositorio_variacoes;
CREATE POLICY repositorio_variacoes_staff ON public.repositorio_variacoes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS repositorio_secoes_staff ON public.repositorio_secoes;
CREATE POLICY repositorio_secoes_staff ON public.repositorio_secoes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS repositorio_docs_staff ON public.repositorio_documentos;
CREATE POLICY repositorio_docs_staff ON public.repositorio_documentos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'team')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repositorio_tipos TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repositorio_variacoes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repositorio_secoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repositorio_documentos TO service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('600', 'repositorio_tipos_variacoes')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
