-- =============================================================================
-- prod_bootstrap_3.sql — parte 3/5 (migrations 129 a 135) | após: _2 | antes: _4
-- =============================================================================

-- PROD: garantir colunas em kanban_cards quando a tabela veio de bootstrap manual
-- (antes de vínculos / FKs e políticas que assumem o schema completo)
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS franqueado_nome TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- === MIGRATION 129: 129_fases_instrucoes.sql ===
-- ─── 129: Instruções e materiais em kanban_fases (modal kanban) ───────────────

ALTER TABLE public.kanban_fases
  ADD COLUMN IF NOT EXISTS instrucoes TEXT,
  ADD COLUMN IF NOT EXISTS materiais JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.kanban_fases.instrucoes IS
  'Orientações da fase exibidas no KanbanCardModal.';
COMMENT ON COLUMN public.kanban_fases.materiais IS
  'JSON array: [{"titulo","url","tipo"}]; tipo: link | documento | video.';

-- Após 099 (só SELECT em kanban_fases): permitir UPDATE para admin/consultor.
DROP POLICY IF EXISTS "kanban_fases_update_admin_consultor" ON public.kanban_fases;
CREATE POLICY "kanban_fases_update_admin_consultor"
  ON public.kanban_fases
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );


-- === MIGRATION 130: 130_vinculos_cards.sql ===
-- ─── 130: Vínculos entre cards nativos (relacionamentos no modal) ────────────

CREATE TABLE IF NOT EXISTS public.kanban_card_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_origem_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  card_destino_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  tipo_vinculo TEXT NOT NULL DEFAULT 'relacionado'
    CHECK (tipo_vinculo IN ('relacionado', 'depende_de', 'bloqueia')),
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(card_origem_id, card_destino_id),
  CHECK (card_origem_id <> card_destino_id)
);

-- PROD: tabela vazia criada manualmente sem o schema completo — adiciona colunas
-- antes de índices/RLS (IF NOT EXISTS não altera tabela já correta)
ALTER TABLE public.kanban_card_vinculos
  ADD COLUMN IF NOT EXISTS card_origem_id UUID,
  ADD COLUMN IF NOT EXISTS card_destino_id UUID;

CREATE INDEX IF NOT EXISTS idx_kanban_card_vinculos_origem
  ON public.kanban_card_vinculos(card_origem_id);
CREATE INDEX IF NOT EXISTS idx_kanban_card_vinculos_destino
  ON public.kanban_card_vinculos(card_destino_id);

COMMENT ON TABLE public.kanban_card_vinculos IS
  'Relacionamentos entre cards: origem → destino conforme tipo_vinculo.';

ALTER TABLE public.kanban_card_vinculos ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado (card visível no modal já passou RLS do card).
DROP POLICY IF EXISTS "kanban_card_vinculos_select_auth" ON public.kanban_card_vinculos;
CREATE POLICY "kanban_card_vinculos_select_auth"
  ON public.kanban_card_vinculos
  FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: admin e consultor (alinhado a outras tabelas de configuração do kanban).
DROP POLICY IF EXISTS "kanban_card_vinculos_insert_admin" ON public.kanban_card_vinculos;
CREATE POLICY "kanban_card_vinculos_insert_admin"
  ON public.kanban_card_vinculos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "kanban_card_vinculos_delete_admin" ON public.kanban_card_vinculos;
CREATE POLICY "kanban_card_vinculos_delete_admin"
  ON public.kanban_card_vinculos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

GRANT SELECT ON public.kanban_card_vinculos TO authenticated;
GRANT INSERT, DELETE ON public.kanban_card_vinculos TO authenticated;


-- === MIGRATION 131: 131_convites_frank.sql ===
-- ─── 131: Convites Portal Frank (link 7 dias) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.convites_frank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT (gen_random_uuid()::text),
  email TEXT,
  franqueado_id UUID REFERENCES public.rede_franqueados(id) ON DELETE SET NULL,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  usado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convites_frank_token ON public.convites_frank(token);
CREATE INDEX IF NOT EXISTS idx_convites_frank_expira ON public.convites_frank(expira_em);

COMMENT ON TABLE public.convites_frank IS
  'Convite por link para cadastro no portal do franqueado (7 dias). Leitura/aceite via service role nas routes.';

ALTER TABLE public.convites_frank ENABLE ROW LEVEL SECURITY;

-- Apenas admin/consultor gerencia convites autenticados.
DROP POLICY IF EXISTS "convites_frank_select_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_select_admin"
  ON public.convites_frank FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_insert_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_insert_admin"
  ON public.convites_frank FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_update_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_update_admin"
  ON public.convites_frank FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.convites_frank TO authenticated;


-- === MIGRATION 132: 132_roles_e_cargos.sql ===
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cargo TEXT
  CHECK (cargo IN ('adm', 'analista', 'estagiario'));

COMMENT ON COLUMN public.profiles.cargo IS
  'Cargo dentro do grupo: adm, analista ou estagiario';

UPDATE public.profiles
SET role = 'team'
WHERE role = 'consultor';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'team', 'frank', 'parceiro', 'fornecedor', 'cliente'));

DO $$
DECLARE
  r       RECORD;
  v_qual  TEXT;
  v_check TEXT;
  v_sql   TEXT;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schemaname,
      c.relname AS tablename,
      p.polname AS policyname,
      CASE p.polpermissive WHEN true THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS permissive,
      CASE p.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        ELSE 'ALL'
      END AS cmd,
      pg_get_expr(p.polqual,      p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
    FROM pg_policy p
    JOIN pg_class     c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        pg_get_expr(p.polqual,      p.polrelid) LIKE '%consultor%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%consultor%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);

    v_qual  := replace(
                 replace(r.qual,  '''consultor''::text', '''team'''),
                 '''consultor''', '''team''');
    v_check := replace(
                 replace(r.with_check, '''consultor''::text', '''team'''),
                 '''consultor''', '''team''');

    v_sql := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO authenticated',
      r.policyname, r.schemaname, r.tablename, r.permissive, r.cmd);

    IF v_qual IS NOT NULL THEN
      v_sql := v_sql || ' USING (' || v_qual || ')';
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || ' WITH CHECK (' || v_check || ')';
    END IF;

    EXECUTE v_sql;
    RAISE NOTICE 'Policy atualizada: % em %.%', r.policyname, r.schemaname, r.tablename;
  END LOOP;
END;
$$;

GRANT SELECT ON public.profiles TO authenticated, anon;


-- === MIGRATION 133: 133_permissoes_por_cargo.sql ===
CREATE TABLE IF NOT EXISTS public.permissoes_perfil (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role       TEXT NOT NULL,
  cargo      TEXT NOT NULL,
  permissao  TEXT NOT NULL,
  valor      BOOLEAN DEFAULT true,
  criado_em  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, cargo, permissao)
);

COMMENT ON TABLE public.permissoes_perfil IS
  'Matriz de permissões por role + cargo. Lida pelo frontend para controlar acesso a ações.';

ALTER TABLE public.permissoes_perfil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissoes_perfil_select_auth" ON public.permissoes_perfil;
CREATE POLICY "permissoes_perfil_select_auth"
  ON public.permissoes_perfil FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.permissoes_perfil (role, cargo, permissao, valor)
SELECT v.role, v.cargo, v.permissao, v.valor
FROM (VALUES
-- ── Admin / adm ──────────────────────────────────────────────────────────────
('admin', 'adm', 'criar_cards',        true),
('admin', 'adm', 'mover_fase',         true),
('admin', 'adm', 'arquivar_cards',     true),
('admin', 'adm', 'finalizar_cards',    true),
('admin', 'adm', 'criar_chamados',     true),
('admin', 'adm', 'ver_sirene',         true),
('admin', 'adm', 'ver_dashboard',      true),
('admin', 'adm', 'configurar_sla',     true),
('admin', 'adm', 'convidar_usuarios',  true),
('admin', 'adm', 'editar_instrucoes',  true),
('admin', 'adm', 'vincular_cards',     true),
-- ── Admin / analista ─────────────────────────────────────────────────────────
('admin', 'analista', 'criar_cards',        true),
('admin', 'analista', 'mover_fase',         true),
('admin', 'analista', 'arquivar_cards',     true),
('admin', 'analista', 'finalizar_cards',    true),
('admin', 'analista', 'criar_chamados',     true),
('admin', 'analista', 'ver_sirene',         true),
('admin', 'analista', 'ver_dashboard',      true),
('admin', 'analista', 'configurar_sla',     false),
('admin', 'analista', 'convidar_usuarios',  false),
('admin', 'analista', 'editar_instrucoes',  true),
('admin', 'analista', 'vincular_cards',     true),
-- ── Admin / estagiario ───────────────────────────────────────────────────────
('admin', 'estagiario', 'criar_cards',        false),
('admin', 'estagiario', 'mover_fase',         false),
('admin', 'estagiario', 'arquivar_cards',     false),
('admin', 'estagiario', 'finalizar_cards',    false),
('admin', 'estagiario', 'criar_chamados',     true),
('admin', 'estagiario', 'ver_sirene',         true),
('admin', 'estagiario', 'ver_dashboard',      true),
('admin', 'estagiario', 'configurar_sla',     false),
('admin', 'estagiario', 'convidar_usuarios',  false),
('admin', 'estagiario', 'editar_instrucoes',  false),
('admin', 'estagiario', 'vincular_cards',     false),
-- ── Team / adm ───────────────────────────────────────────────────────────────
('team', 'adm', 'criar_cards',        true),
('team', 'adm', 'mover_fase',         true),
('team', 'adm', 'arquivar_cards',     true),
('team', 'adm', 'finalizar_cards',    true),
('team', 'adm', 'criar_chamados',     true),
('team', 'adm', 'ver_sirene',         true),
('team', 'adm', 'ver_dashboard',      true),
('team', 'adm', 'configurar_sla',     true),
('team', 'adm', 'convidar_usuarios',  true),
('team', 'adm', 'editar_instrucoes',  true),
('team', 'adm', 'vincular_cards',     true),
-- ── Team / analista ──────────────────────────────────────────────────────────
('team', 'analista', 'criar_cards',        true),
('team', 'analista', 'mover_fase',         true),
('team', 'analista', 'arquivar_cards',     false),
('team', 'analista', 'finalizar_cards',    false),
('team', 'analista', 'criar_chamados',     true),
('team', 'analista', 'ver_sirene',         true),
('team', 'analista', 'ver_dashboard',      true),
('team', 'analista', 'configurar_sla',     false),
('team', 'analista', 'convidar_usuarios',  false),
('team', 'analista', 'editar_instrucoes',  true),
('team', 'analista', 'vincular_cards',     true),
-- ── Team / estagiario ────────────────────────────────────────────────────────
('team', 'estagiario', 'criar_cards',        false),
('team', 'estagiario', 'mover_fase',         false),
('team', 'estagiario', 'arquivar_cards',     false),
('team', 'estagiario', 'finalizar_cards',    false),
('team', 'estagiario', 'criar_chamados',     true),
('team', 'estagiario', 'ver_sirene',         true),
('team', 'estagiario', 'ver_dashboard',      false),
('team', 'estagiario', 'configurar_sla',     false),
('team', 'estagiario', 'convidar_usuarios',  false),
('team', 'estagiario', 'editar_instrucoes',  false),
('team', 'estagiario', 'vincular_cards',     false),
-- ── Frank / adm ──────────────────────────────────────────────────────────────
('frank', 'adm', 'criar_chamados',  true),
('frank', 'adm', 'ver_dashboard',   true),
('frank', 'adm', 'criar_cards',     false),
('frank', 'adm', 'mover_fase',      false),
('frank', 'adm', 'arquivar_cards',  false),
('frank', 'adm', 'finalizar_cards', false),
('frank', 'adm', 'ver_sirene',      false),
-- ── Frank / analista ─────────────────────────────────────────────────────────
('frank', 'analista', 'criar_chamados',  true),
('frank', 'analista', 'ver_dashboard',   false),
('frank', 'analista', 'criar_cards',     false),
('frank', 'analista', 'mover_fase',      false),
('frank', 'analista', 'arquivar_cards',  false),
('frank', 'analista', 'finalizar_cards', false),
('frank', 'analista', 'ver_sirene',      false),
-- ── Frank / estagiario ───────────────────────────────────────────────────────
('frank', 'estagiario', 'criar_chamados', false),
('frank', 'estagiario', 'ver_dashboard',  false),
-- ── Parceiro ─────────────────────────────────────────────────────────────────
('parceiro', 'adm',       'criar_chamados', true),
('parceiro', 'analista',  'criar_chamados', true),
('parceiro', 'estagiario','criar_chamados', false),
-- ── Fornecedor ───────────────────────────────────────────────────────────────
('fornecedor', 'adm',       'criar_chamados', true),
('fornecedor', 'analista',  'criar_chamados', true),
('fornecedor', 'estagiario','criar_chamados', false)
) AS v(role, cargo, permissao, valor)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.permissoes_perfil p
  WHERE p.role = v.role
    AND p.cargo = v.cargo
    AND p.permissao = v.permissao
);

GRANT SELECT ON public.permissoes_perfil TO authenticated, anon;


-- === MIGRATION 134: 134_profiles_funis_acesso.sql ===
-- Kanbans permitidos (Time + Estagiário): valores = public.kanbans.nome
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS funis_acesso TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.profiles.funis_acesso IS
  'Lista de kanbans.nome acessíveis; usado para Time + estagiário. NULL = não aplicável ou sem restrição por esta lista.';


-- === MIGRATION 135: 135_frank_validacao_trimestral.sql ===
-- Validação trimestral de dados (Frank) + vínculo perfil ↔ rede_franqueados + RLS

-- ─── 1. Tabela de validações ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.frank_validacoes_dados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frank_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  validado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (frank_id, periodo)
);

COMMENT ON TABLE public.frank_validacoes_dados IS
  'Confirmação trimestral de dados do franqueado (periodo ex.: 2026-01, 2026-04, 2026-07, 2026-11).';

CREATE INDEX IF NOT EXISTS idx_frank_validacoes_frank ON public.frank_validacoes_dados (frank_id);
CREATE INDEX IF NOT EXISTS idx_frank_validacoes_periodo ON public.frank_validacoes_dados (periodo);

ALTER TABLE public.frank_validacoes_dados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "frank_validacoes_select_own" ON public.frank_validacoes_dados;
CREATE POLICY "frank_validacoes_select_own"
  ON public.frank_validacoes_dados FOR SELECT TO authenticated
  USING (frank_id = auth.uid());

DROP POLICY IF EXISTS "frank_validacoes_insert_own" ON public.frank_validacoes_dados;
CREATE POLICY "frank_validacoes_insert_own"
  ON public.frank_validacoes_dados FOR INSERT TO authenticated
  WITH CHECK (frank_id = auth.uid());

DROP POLICY IF EXISTS "frank_validacoes_update_own" ON public.frank_validacoes_dados;
CREATE POLICY "frank_validacoes_update_own"
  ON public.frank_validacoes_dados FOR UPDATE TO authenticated
  USING (frank_id = auth.uid())
  WITH CHECK (frank_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.frank_validacoes_dados TO authenticated;

-- ─── 2. Perfil → linha da rede (cadastro portal) ─────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rede_franqueado_id UUID REFERENCES public.rede_franqueados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.rede_franqueado_id IS
  'Linha em rede_franqueados associada ao franqueado (portal).';

CREATE INDEX IF NOT EXISTS idx_profiles_rede_franqueado_id ON public.profiles (rede_franqueado_id);

-- ─── 3. Frank pode atualizar a própria linha na rede ────────────────────────
DROP POLICY IF EXISTS "rede_franqueados_update_frank_own" ON public.rede_franqueados;
CREATE POLICY "rede_franqueados_update_frank_own"
  ON public.rede_franqueados FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT p.rede_franqueado_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id IS NOT NULL
    )
  )
  WITH CHECK (
    id IN (
      SELECT p.rede_franqueado_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id IS NOT NULL
    )
  );

-- ─── 4. Convites Frank: admin ou time (legado consultor → team na 132) ───────
DROP POLICY IF EXISTS "convites_frank_select_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_select_admin"
  ON public.convites_frank FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_insert_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_insert_admin"
  ON public.convites_frank FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_update_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_update_admin"
  ON public.convites_frank FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );


