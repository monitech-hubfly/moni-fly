-- Migration 221: Tabelas que existiam no PROD mas não no repositório
-- Todas idempotentes (IF NOT EXISTS)

-- 1. apify_usage
CREATE TABLE IF NOT EXISTS apify_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  processo_id uuid,
  condominio text,
  resultados integer,
  custo_usd numeric,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE apify_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_apify_usage" ON apify_usage;
CREATE POLICY "allow_all_apify_usage" ON apify_usage FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON apify_usage TO anon, authenticated;

-- 2. bca_inputs
CREATE TABLE IF NOT EXISTS bca_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL,
  nome_condominio text DEFAULT '',
  nome_casa text DEFAULT '',
  area_vendas_m2 numeric DEFAULT 627,
  custo_terreno numeric DEFAULT -1000000,
  itbi_percentual numeric DEFAULT 0.04,
  custo_casa numeric DEFAULT -2510000,
  mes_inicio_obra integer DEFAULT 3,
  obra_mes1 numeric DEFAULT 0.15,
  obra_mes2 numeric DEFAULT 0.25,
  obra_mes3 numeric DEFAULT 0.18,
  obra_mes4 numeric DEFAULT 0.10,
  obra_mes5 numeric DEFAULT 0.10,
  obra_mes6 numeric DEFAULT 0.01,
  obra_mes7 numeric DEFAULT 0.01,
  obra_mes9 numeric DEFAULT 0.08,
  obra_mes10 numeric DEFAULT 0.08,
  comissao_vendas numeric DEFAULT -0.08,
  impostos numeric DEFAULT 0.06,
  taxa_plataforma numeric DEFAULT -0.07,
  taxa_gestao_frank numeric DEFAULT -0.08,
  projetos_taxa_obra numeric DEFAULT -50000,
  capital_giro_inicial numeric DEFAULT -25000,
  vgv_target numeric DEFAULT 6000000,
  vgv_liquidacao numeric DEFAULT 5400000,
  vgv_recompra numeric DEFAULT 5300000,
  permuta_planta numeric DEFAULT 0.25,
  permuta_target numeric DEFAULT 0.25,
  permuta_liquidacao numeric DEFAULT 0.25,
  permuta_recompra numeric DEFAULT 0.36,
  percentual_funding numeric DEFAULT 1.0,
  cdi_an numeric DEFAULT 0.15,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE bca_inputs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_bca_inputs" ON bca_inputs;
CREATE POLICY "allow_all_bca_inputs" ON bca_inputs FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON bca_inputs TO anon, authenticated;

-- 3. casas_escolhidas_etapa5
CREATE TABLE IF NOT EXISTS casas_escolhidas_etapa5 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL,
  catalogo_casa_id uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE casas_escolhidas_etapa5 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_casas_escolhidas_etapa5" ON casas_escolhidas_etapa5;
CREATE POLICY "allow_all_casas_escolhidas_etapa5" ON casas_escolhidas_etapa5 FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON casas_escolhidas_etapa5 TO anon, authenticated;

-- 4. checklist_legal_condominio
CREATE TABLE IF NOT EXISTS checklist_legal_condominio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'rascunho',
  respostas_json jsonb NOT NULL DEFAULT '{}',
  arquivos_json jsonb NOT NULL DEFAULT '{}',
  form_version integer NOT NULL DEFAULT 1,
  card_origem_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE checklist_legal_condominio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_checklist_legal_condominio" ON checklist_legal_condominio;
CREATE POLICY "allow_all_checklist_legal_condominio" ON checklist_legal_condominio FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON checklist_legal_condominio TO anon, authenticated;

-- 5. checklist_legal_log
CREATE TABLE IF NOT EXISTS checklist_legal_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL,
  condominio_id uuid NOT NULL,
  card_id uuid,
  acao text NOT NULL,
  actor_id uuid,
  actor_label text,
  detalhes jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE checklist_legal_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_checklist_legal_log" ON checklist_legal_log;
CREATE POLICY "allow_all_checklist_legal_log" ON checklist_legal_log FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON checklist_legal_log TO anon, authenticated;

-- 6. checklist_legal_public_tokens
CREATE TABLE IF NOT EXISTS checklist_legal_public_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  card_id uuid NOT NULL,
  condominio_id uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE checklist_legal_public_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_checklist_legal_public_tokens" ON checklist_legal_public_tokens;
CREATE POLICY "allow_all_checklist_legal_public_tokens" ON checklist_legal_public_tokens FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON checklist_legal_public_tokens TO anon, authenticated;

-- 7. condominios_lotes
CREATE TABLE IF NOT EXISTS condominios_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL,
  quadra text,
  lote text,
  area_m2 numeric,
  valor numeric,
  situacao_documental text,
  fotos_path text,
  vista_privilegiada boolean NOT NULL DEFAULT false,
  perto_area_verde boolean NOT NULL DEFAULT false,
  muro boolean NOT NULL DEFAULT false,
  perto_area_convivencia boolean NOT NULL DEFAULT false,
  perto_lixeira boolean NOT NULL DEFAULT false,
  observacoes text,
  kanban_card_id uuid,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE condominios_lotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_condominios_lotes" ON condominios_lotes;
CREATE POLICY "allow_all_condominios_lotes" ON condominios_lotes FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON condominios_lotes TO anon, authenticated;

-- 8. franqueado_empresas
CREATE TABLE IF NOT EXISTS franqueado_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rede_franqueado_id uuid NOT NULL,
  tipo text NOT NULL,
  razao_social text,
  cnpj text,
  inscricao_municipal text,
  inscricao_estadual text,
  data_abertura date,
  status text DEFAULT 'ativa',
  conta_banco text,
  conta_agencia text,
  conta_numero text,
  conta_tipo text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE franqueado_empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_franqueado_empresas" ON franqueado_empresas;
CREATE POLICY "allow_all_franqueado_empresas" ON franqueado_empresas FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON franqueado_empresas TO anon, authenticated;

-- 9. kanban_card_comentario_anexos
CREATE TABLE IF NOT EXISTS kanban_card_comentario_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comentario_id uuid NOT NULL,
  card_id uuid NOT NULL,
  storage_path text NOT NULL,
  nome_original text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE kanban_card_comentario_anexos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_kanban_card_comentario_anexos" ON kanban_card_comentario_anexos;
CREATE POLICY "allow_all_kanban_card_comentario_anexos" ON kanban_card_comentario_anexos FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON kanban_card_comentario_anexos TO anon, authenticated;

-- 10. kanban_operacoes_tranche_vinculos
CREATE TABLE IF NOT EXISTS kanban_operacoes_tranche_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacoes_card_id uuid NOT NULL,
  tranche_index smallint NOT NULL,
  pct_fisico_financeiro numeric,
  nfts_url text,
  evidencias_url text,
  concluido_em timestamptz,
  concluido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE kanban_operacoes_tranche_vinculos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_kanban_operacoes_tranche_vinculos" ON kanban_operacoes_tranche_vinculos;
CREATE POLICY "allow_all_kanban_operacoes_tranche_vinculos" ON kanban_operacoes_tranche_vinculos FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON kanban_operacoes_tranche_vinculos TO anon, authenticated;

-- 11. rede_loteadores
CREATE TABLE IF NOT EXISTS rede_loteadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  cidade text,
  estado text,
  contato_nome text,
  contato_telefone text,
  contato_email text,
  portfolio_descricao text,
  status text DEFAULT 'ativo',
  observacoes text,
  criado_por uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE rede_loteadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_rede_loteadores" ON rede_loteadores;
CREATE POLICY "allow_all_rede_loteadores" ON rede_loteadores FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON rede_loteadores TO anon, authenticated;

-- 12. Colunas em kanban_cards
ALTER TABLE kanban_cards
  ADD COLUMN IF NOT EXISTS acoplamento_concluido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credito_terreno_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contabilidade_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS juridico_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capital_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credito_obra_ok boolean NOT NULL DEFAULT false;

-- 13. View v_portfolio_saude
CREATE OR REPLACE VIEW v_portfolio_saude AS
SELECT kc.id AS card_id,
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
    ( SELECT min(kh.criado_em)
           FROM kanban_historico kh
             JOIN kanban_fases kf2 ON kf2.id = COALESCE((kh.detalhe ->> 'fase_nova_id')::uuid, (kh.detalhe ->> 'fase_id')::uuid)
          WHERE kh.card_id = kc.id AND kh.acao = ANY (ARRAY['fase_avancada','fase_retrocedida','card_criado']) AND kf2.slug = 'step_3') AS data_step3_opcao,
    ( SELECT min(kh.criado_em)
           FROM kanban_historico kh
             JOIN kanban_fases kf2 ON kf2.id = COALESCE((kh.detalhe ->> 'fase_nova_id')::uuid, (kh.detalhe ->> 'fase_id')::uuid)
          WHERE kh.card_id = kc.id AND kh.acao = ANY (ARRAY['fase_avancada','fase_retrocedida','card_criado']) AND kf2.slug = 'step_5') AS data_step5_comite,
    ( SELECT min(kh.criado_em)
           FROM kanban_historico kh
             JOIN kanban_fases kf2 ON kf2.id = COALESCE((kh.detalhe ->> 'fase_nova_id')::uuid, (kh.detalhe ->> 'fase_id')::uuid)
          WHERE kh.card_id = kc.id AND kh.acao = ANY (ARRAY['fase_avancada','fase_retrocedida','card_criado']) AND kf2.slug = 'step_7') AS data_step7_contrato,
    ((kf.slug = 'captacao_moni_capital') OR (kf.ordem >= COALESCE(( SELECT min(kf_cap.ordem)
           FROM kanban_fases kf_cap
          WHERE kf_cap.kanban_id = k.id AND kf_cap.slug = 'captacao_moni_capital'), 999999))) AS capital_aplicavel
   FROM kanban_cards kc
     JOIN kanbans k ON k.id = kc.kanban_id
     JOIN kanban_fases kf ON kf.id = kc.fase_id
     LEFT JOIN rede_franqueados rf ON rf.id = kc.rede_franqueado_id
  WHERE k.nome = 'Funil Portfólio' AND kc.arquivado = false AND kc.concluido = false;

NOTIFY pgrst, 'reload schema';
