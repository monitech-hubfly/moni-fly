-- Justificativa quando documento da franquia nÃ£o foi anexado (cadastro incompleto se vazio).

ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_cof_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_contrato_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_numero_franquia_justificativa TEXT;

COMMENT ON COLUMN public.rede_franqueados.anexo_cof_justificativa IS
  'Justificativa de ausÃªncia do COF assinado (quando anexo_cof_path estÃ¡ vazio).';
COMMENT ON COLUMN public.rede_franqueados.anexo_contrato_justificativa IS
  'Justificativa de ausÃªncia do contrato assinado (quando anexo_contrato_path estÃ¡ vazio).';
COMMENT ON COLUMN public.rede_franqueados.anexo_numero_franquia_justificativa IS
  'Justificativa de ausÃªncia do doc. de nÃºmero de franquia (quando anexo_numero_franquia_path estÃ¡ vazio).';

NOTIFY pgrst, 'reload schema';
-- 201: Projeto de negÃ³cio (espinha dorsal) + vÃ­nculo em kanban_cards.
-- Frank enxerga projetos da prÃ³pria linha em rede_franqueados (profiles.rede_franqueado_id).

-- â”€â”€â”€ Tabela projeto_negocio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  'Projeto/hipÃ³tese de negÃ³cio (ID mestre). Cards de kanban podem referenciar via projeto_id.';
COMMENT ON COLUMN public.projeto_negocio.numero_formatado IS
  'Identificador legÃ­vel (ex.: FK0001-BAR-L12). Gerado por trigger se omitido no INSERT.';
COMMENT ON COLUMN public.projeto_negocio.franqueado_id IS
  'Linha em rede_franqueados do franqueado dono do projeto.';

-- â”€â”€â”€ Trigger: numero_formatado automÃ¡tico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      RAISE EXCEPTION 'NÃ£o foi possÃ­vel gerar numero_formatado Ãºnico para projeto_negocio';
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

-- â”€â”€â”€ kanban_cards.projeto_id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS projeto_id UUID REFERENCES public.projeto_negocio(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_projeto_id
  ON public.kanban_cards (projeto_id);

COMMENT ON COLUMN public.kanban_cards.projeto_id IS
  'Projeto mestre ao qual este card pertence (esteiras vinculadas). Nullable para cards legados.';

-- â”€â”€â”€ RLS projeto_negocio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- Frank: linha da rede vinculada ao perfil (franqueado_id â†’ rede_franqueados.id, nÃ£o auth.uid()).
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
-- 203: Card do Funil Step One ao cadastrar rede â€” sÃ³ via app (criarLinhaRedeECard).
-- Remove trigger legado que criava card em "Dados da Cidade" sem rede_franqueado_id.

DROP TRIGGER IF EXISTS trg_rede_franqueados_criar_card_funil ON public.rede_franqueados;

COMMENT ON FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado() IS
  'Legado: substituÃ­do por ensureFunilStepOneCardFromRede (TS). Trigger removido na 203.';
-- Normaliza status legado "Em processo" â†’ "Em OperaÃ§Ã£o" (opÃ§Ã£o removida do formulÃ¡rio).

DO $$
DECLARE
  n_rede integer;
  n_step integer;
BEGIN
  UPDATE public.rede_franqueados
  SET
    status_franquia = 'Em OperaÃ§Ã£o',
    updated_at = NOW()
  WHERE status_franquia IS NOT NULL
    AND lower(regexp_replace(trim(status_franquia), '\s+', ' ', 'g')) IN ('em processo', 'em processo.');

  GET DIAGNOSTICS n_rede = ROW_COUNT;

  UPDATE public.processo_step_one
  SET status_franquia = 'Em OperaÃ§Ã£o'
  WHERE status_franquia IS NOT NULL
    AND lower(regexp_replace(trim(status_franquia), '\s+', ' ', 'g')) IN ('em processo', 'em processo.');

  GET DIAGNOSTICS n_step = ROW_COUNT;

  RAISE NOTICE 'rede_franqueados: % linha(s); processo_step_one: % linha(s)', n_rede, n_step;
END $$;
-- Documentos das empresas (Incorporadora + Gestora) na ficha do franqueado.

ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_contrato_social_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_contrato_social_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_cnpj_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_cnpj_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_inscricao_municipal_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_inscricao_municipal_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_certidao_junta_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_certidao_junta_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_conta_bancaria_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_conta_bancaria_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_inscricao_estadual_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_contrato_social_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_contrato_social_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_cnpj_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_cnpj_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_inscricao_municipal_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_inscricao_municipal_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_certidao_junta_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_certidao_junta_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_conta_bancaria_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_conta_bancaria_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_inscricao_estadual_path TEXT;
-- 206: Kanban Funil Loteadores + fases do fluxo de qualificaÃ§Ã£o (idempotente no kanban; fases substituÃ­das).

INSERT INTO public.kanbans (nome, descricao, ativo)
SELECT 'Funil Loteadores', 'QualificaÃ§Ã£o e encaminhamento de loteadores', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans WHERE nome = 'Funil Loteadores'
);

-- Legado: renomear MonÃ­ INC se ainda existir com o nome antigo.
UPDATE public.kanbans
SET
  nome = 'Funil Loteadores',
  descricao = COALESCE(NULLIF(btrim(descricao), ''), 'QualificaÃ§Ã£o e encaminhamento de loteadores')
WHERE nome = 'Funil MonÃ­ INC';

-- Remove fases anteriores (ex.: MonÃ­ INC); cards nessas fases sÃ£o removidos por ON DELETE CASCADE.
DELETE FROM public.kanban_fases
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Loteadores' LIMIT 1);

INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  f.sla_dias,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Cadastro do loteador', 'loteador_cadastro', 1, 2),
    ('AnÃ¡lise de portfÃ³lio', 'loteador_analise', 2, 5),
    ('Aguardando documentaÃ§Ã£o', 'loteador_docs', 3, 10),
    ('Encaminhamento JurÃ­dico', 'loteador_juridico', 4, 1),
    ('ConcluÃ­do', 'loteador_concluido', 5, NULL::integer)
) AS f(nome, slug, ordem, sla_dias)
WHERE k.nome = 'Funil Loteadores'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.slug = f.slug
  );
-- 207: Cadastro de loteadores + empresas (incorporadora/gestora) por franqueado na rede.

-- â”€â”€â”€ rede_loteadores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.rede_loteadores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                TEXT NOT NULL,
  cnpj                TEXT,
  cidade              TEXT,
  estado              TEXT,
  contato_nome        TEXT,
  contato_telefone    TEXT,
  contato_email       TEXT,
  portfolio_descricao TEXT,
  status              TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'em_analise')),
  observacoes         TEXT,
  criado_por          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rede_loteadores_status ON public.rede_loteadores (status);
CREATE INDEX IF NOT EXISTS idx_rede_loteadores_estado_cidade ON public.rede_loteadores (estado, cidade);

COMMENT ON TABLE public.rede_loteadores IS
  'Loteadores da rede (gestÃ£o interna). Frank nÃ£o tem acesso.';

ALTER TABLE public.rede_loteadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rede_loteadores_select_admin_team" ON public.rede_loteadores;
CREATE POLICY "rede_loteadores_select_admin_team"
  ON public.rede_loteadores
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

DROP POLICY IF EXISTS "rede_loteadores_insert_admin_team" ON public.rede_loteadores;
CREATE POLICY "rede_loteadores_insert_admin_team"
  ON public.rede_loteadores
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

DROP POLICY IF EXISTS "rede_loteadores_update_admin_team" ON public.rede_loteadores;
CREATE POLICY "rede_loteadores_update_admin_team"
  ON public.rede_loteadores
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

DROP POLICY IF EXISTS "rede_loteadores_delete_admin_team" ON public.rede_loteadores;
CREATE POLICY "rede_loteadores_delete_admin_team"
  ON public.rede_loteadores
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rede_loteadores TO authenticated;

-- â”€â”€â”€ franqueado_empresas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.franqueado_empresas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rede_franqueado_id    UUID NOT NULL REFERENCES public.rede_franqueados(id) ON DELETE CASCADE,
  tipo                  TEXT NOT NULL CHECK (tipo IN ('incorporadora', 'gestora')),
  razao_social          TEXT,
  cnpj                  TEXT,
  inscricao_municipal   TEXT,
  inscricao_estadual    TEXT,
  data_abertura         DATE,
  status                TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa', 'em_abertura')),
  conta_banco           TEXT,
  conta_agencia         TEXT,
  conta_numero          TEXT,
  conta_tipo            TEXT,
  observacoes           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (rede_franqueado_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_franqueado_empresas_rede_franqueado_id
  ON public.franqueado_empresas (rede_franqueado_id);

COMMENT ON TABLE public.franqueado_empresas IS
  'Dados cadastrais da incorporadora e da gestora por linha em rede_franqueados (mÃ¡x. uma de cada tipo).';
COMMENT ON COLUMN public.franqueado_empresas.rede_franqueado_id IS
  'FK para rede_franqueados.id; Frank acessa via profiles.rede_franqueado_id.';

ALTER TABLE public.franqueado_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "franqueado_empresas_select_admin_team" ON public.franqueado_empresas;
CREATE POLICY "franqueado_empresas_select_admin_team"
  ON public.franqueado_empresas
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

-- Frank: somente leitura das empresas da prÃ³pria linha na rede (profiles.rede_franqueado_id).
DROP POLICY IF EXISTS "franqueado_empresas_select_frank_own" ON public.franqueado_empresas;
CREATE POLICY "franqueado_empresas_select_frank_own"
  ON public.franqueado_empresas
  FOR SELECT
  TO authenticated
  USING (
    rede_franqueado_id IN (
      SELECT p.rede_franqueado_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id IS NOT NULL
        AND p.role IN ('frank', 'franqueado')
    )
  );

DROP POLICY IF EXISTS "franqueado_empresas_insert_admin_team" ON public.franqueado_empresas;
CREATE POLICY "franqueado_empresas_insert_admin_team"
  ON public.franqueado_empresas
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

DROP POLICY IF EXISTS "franqueado_empresas_update_admin_team" ON public.franqueado_empresas;
CREATE POLICY "franqueado_empresas_update_admin_team"
  ON public.franqueado_empresas
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

DROP POLICY IF EXISTS "franqueado_empresas_delete_admin_team" ON public.franqueado_empresas;
CREATE POLICY "franqueado_empresas_delete_admin_team"
  ON public.franqueado_empresas
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

GRANT SELECT ON public.franqueado_empresas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.franqueado_empresas TO authenticated;
-- 208: Cadastro de condomÃ­nios (rede). Admin/team CRUD; Frank somente leitura.

CREATE TABLE IF NOT EXISTS public.condominios (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                          TEXT NOT NULL,
  endereco                      TEXT,
  numero                        TEXT,
  cep                           TEXT,
  cidade                        TEXT,
  estado                        TEXT,
  ticket_medio_lote             NUMERIC(15, 2),
  ticket_medio_casas            NUMERIC(15, 2),
  ticket_medio_casas_rsm2       NUMERIC(15, 2),
  estimativa_casas_vendidas_ano INTEGER,
  criado_por                    UUID REFERENCES auth.users(id),
  created_at                    TIMESTAMPTZ DEFAULT now(),
  updated_at                    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condominios_estado_cidade ON public.condominios (estado, cidade);
CREATE INDEX IF NOT EXISTS idx_condominios_nome ON public.condominios (nome);

COMMENT ON TABLE public.condominios IS
  'CondomÃ­nios da rede. Frank: somente SELECT; admin/team: CRUD.';

ALTER TABLE public.condominios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "condominios_select_admin_team" ON public.condominios;
CREATE POLICY "condominios_select_admin_team"
  ON public.condominios
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

DROP POLICY IF EXISTS "condominios_select_frank" ON public.condominios;
CREATE POLICY "condominios_select_frank"
  ON public.condominios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('frank', 'franqueado')
    )
  );

DROP POLICY IF EXISTS "condominios_insert_admin_team" ON public.condominios;
CREATE POLICY "condominios_insert_admin_team"
  ON public.condominios
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

DROP POLICY IF EXISTS "condominios_update_admin_team" ON public.condominios;
CREATE POLICY "condominios_update_admin_team"
  ON public.condominios
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

DROP POLICY IF EXISTS "condominios_delete_admin_team" ON public.condominios;
CREATE POLICY "condominios_delete_admin_team"
  ON public.condominios
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominios TO authenticated;
-- 209: Checklists â€” Funil JurÃ­dico (diligÃªncia) e Funil Contabilidade (incorporadora + SPE).
-- Idempotente: INSERT â€¦ SELECT com WHERE NOT EXISTS (fase_id + label), alinhado ao Step One (157).

-- â”€â”€â”€ Funil JurÃ­dico â€” fase juridico_diligencia â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT 'f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid, ordem, label, tipo, obrigatorio, false
FROM (VALUES
  (1, 'MatrÃ­cula atualizada (menos de 30 dias)', 'anexo', true),
  (2, 'CertidÃ£o de Ã´nus reais', 'anexo', true),
  (3, 'CertidÃµes negativas do proprietÃ¡rio (cÃ­vel + trabalhista)', 'anexo', true),
  (4, 'IPTU em dia confirmado', 'checkbox', true),
  (5, 'Documentos pessoais de todos os proprietÃ¡rios', 'anexo', true),
  (6, 'Comprovante de endereÃ§o dos proprietÃ¡rios', 'anexo', true),
  (7, 'ConvenÃ§Ã£o do condomÃ­nio com recuos e restriÃ§Ãµes', 'anexo', false),
  (8, 'Parecer jurÃ­dico final', 'texto_longo', true)
) AS t(ordem, label, tipo, obrigatorio)
WHERE EXISTS (SELECT 1 FROM public.kanban_fases WHERE id = 'f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = 'f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid AND label = t.label
  );

-- â”€â”€â”€ Funil Contabilidade â€” fase contabilidade_incorporadora â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT 'd3b12d36-0a87-4f30-bd1d-5f206eba037d'::uuid, ordem, label, tipo, obrigatorio, false
FROM (VALUES
  (1, 'Contrato social da Incorporadora redigido', 'anexo', true),
  (2, 'CNPJ da Incorporadora emitido', 'anexo', true),
  (3, 'AlvarÃ¡ de funcionamento', 'checkbox', false)
) AS t(ordem, label, tipo, obrigatorio)
WHERE EXISTS (SELECT 1 FROM public.kanban_fases WHERE id = 'd3b12d36-0a87-4f30-bd1d-5f206eba037d'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = 'd3b12d36-0a87-4f30-bd1d-5f206eba037d'::uuid AND label = t.label
  );

-- â”€â”€â”€ Funil Contabilidade â€” fase contabilidade_spe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT 'a5facdfc-b6f2-41cb-aea2-63614712910b'::uuid, ordem, label, tipo, obrigatorio, false
FROM (VALUES
  (1, 'Contrato social da SPE', 'anexo', true),
  (2, 'CNPJ da SPE emitido', 'anexo', true),
  (3, 'Conta bancÃ¡ria da SPE aberta', 'checkbox', true)
) AS t(ordem, label, tipo, obrigatorio)
WHERE EXISTS (SELECT 1 FROM public.kanban_fases WHERE id = 'a5facdfc-b6f2-41cb-aea2-63614712910b'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = 'a5facdfc-b6f2-41cb-aea2-63614712910b'::uuid AND label = t.label
  );
-- Migration 210: colunas de bastÃ£o de retorno em kanban_cards
-- Todas as colunas jÃ¡ existem no PROD â€” IF NOT EXISTS garante idempotÃªncia

ALTER TABLE kanban_cards
  ADD COLUMN IF NOT EXISTS origem_card_id uuid REFERENCES kanban_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acoplamento_concluido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credito_terreno_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credito_obra_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contabilidade_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS juridico_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capital_ok boolean NOT NULL DEFAULT false;

-- Tipo de vÃ­nculo em kanban_card_vinculos
ALTER TABLE kanban_card_vinculos
  ADD COLUMN IF NOT EXISTS tipo_vinculo text NOT NULL DEFAULT 'relacionado'
    CHECK (tipo_vinculo IN ('relacionado','originou','depende_de','bloqueia','retornou')),
  ADD COLUMN IF NOT EXISTS kanban_origem_slug text,
  ADD COLUMN IF NOT EXISTS kanban_destino_slug text,
  ADD COLUMN IF NOT EXISTS fase_origem_slug text,
  ADD COLUMN IF NOT EXISTS fase_destino_slug text;

-- Ãndices de performance
CREATE INDEX IF NOT EXISTS idx_kanban_cards_origem_card_id
  ON kanban_cards(origem_card_id) WHERE origem_card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_projeto_id
  ON kanban_cards(projeto_id) WHERE projeto_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_card_vinculos_tipo
  ON kanban_card_vinculos(tipo_vinculo);
-- View: painel de saÃºde do Funil PortfÃ³lio (flags de bastÃ£o + datas de fases-chave)
-- Datas via kanban_historico (card_criado + mudanÃ§as de fase)

CREATE OR REPLACE VIEW public.v_portfolio_saude AS
SELECT
  kc.id AS card_id,
  kc.titulo,
  kc.rede_franqueado_id,
  rf.nome_completo AS franqueado_nome,
  rf.n_franquia,
  kf.slug AS fase_slug,
  kf.nome AS fase_nome,
  kf.ordem AS fase_ordem,
  kc.acoplamento_concluido,
  kc.credito_terreno_ok,
  kc.contabilidade_ok,
  kc.juridico_ok,
  kc.capital_ok,
  kc.credito_obra_ok,
  kc.created_at,
  kc.updated_at,
  (
    SELECT min(kh.criado_em)
    FROM public.kanban_historico kh
    JOIN public.kanban_fases kf2 ON kf2.id = COALESCE(
      (kh.detalhe->>'fase_nova_id')::uuid,
      (kh.detalhe->>'fase_id')::uuid
    )
    WHERE kh.card_id = kc.id
      AND kh.acao IN ('fase_avancada', 'fase_retrocedida', 'card_criado')
      AND kf2.slug = 'step_3'
  ) AS data_step3_opcao,
  (
    SELECT min(kh.criado_em)
    FROM public.kanban_historico kh
    JOIN public.kanban_fases kf2 ON kf2.id = COALESCE(
      (kh.detalhe->>'fase_nova_id')::uuid,
      (kh.detalhe->>'fase_id')::uuid
    )
    WHERE kh.card_id = kc.id
      AND kh.acao IN ('fase_avancada', 'fase_retrocedida', 'card_criado')
      AND kf2.slug = 'step_5'
  ) AS data_step5_comite,
  (
    SELECT min(kh.criado_em)
    FROM public.kanban_historico kh
    JOIN public.kanban_fases kf2 ON kf2.id = COALESCE(
      (kh.detalhe->>'fase_nova_id')::uuid,
      (kh.detalhe->>'fase_id')::uuid
    )
    WHERE kh.card_id = kc.id
      AND kh.acao IN ('fase_avancada', 'fase_retrocedida', 'card_criado')
      AND kf2.slug = 'step_7'
  ) AS data_step7_contrato,
  (
    kf.slug = 'captacao_moni_capital'
    OR kf.ordem >= COALESCE(
      (
        SELECT min(kf_cap.ordem)
        FROM public.kanban_fases kf_cap
        WHERE kf_cap.kanban_id = k.id
          AND kf_cap.slug = 'captacao_moni_capital'
      ),
      999999
    )
  ) AS capital_aplicavel
FROM public.kanban_cards kc
JOIN public.kanbans k ON k.id = kc.kanban_id
JOIN public.kanban_fases kf ON kf.id = kc.fase_id
LEFT JOIN public.rede_franqueados rf ON rf.id = kc.rede_franqueado_id
WHERE k.nome = 'Funil PortfÃ³lio'
  AND kc.arquivado = false
  AND kc.concluido = false;

COMMENT ON VIEW public.v_portfolio_saude IS
  'Cards ativos do Funil PortfÃ³lio com flags de esteiras paralelas e datas de entrada em step_3/5/7.';

GRANT SELECT ON public.v_portfolio_saude TO service_role;
GRANT SELECT ON public.v_portfolio_saude TO authenticated;
