-- =============================================================================
-- Migration: 430_sistema_pericia_redesenho_v3.sql
-- Projeto: Hub Fly (Next.js 14 + Supabase)
-- Descrição: Redesenho v3 do sistema de perícias Sirene
-- Idempotente: sim (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- =============================================================================

-- =============================================================================
-- SEÇÃO 1: SEQUENCE PARA NUMERAÇÃO AUTOMÁTICA DE PERÍCIAS
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS sirene_pericia_numero_seq START 1;


-- =============================================================================
-- SEÇÃO 2: EXPANSÃO DE sirene_pericias COM NOVAS COLUNAS
-- =============================================================================

-- Número único e legível da perícia (ex: P-001)
ALTER TABLE sirene_pericias
  ADD COLUMN IF NOT EXISTS numero text UNIQUE DEFAULT 'P-' || LPAD(nextval('sirene_pericia_numero_seq')::text, 3, '0');

-- Domínio de negócio da perícia
ALTER TABLE sirene_pericias
  ADD COLUMN IF NOT EXISTS dominio text NOT NULL DEFAULT 'Outros';

-- Restrição de valores do campo tipo (coluna já existe, apenas adiciona CHECK se não existir)
-- Nota: o CHECK é adicionado via constraint nomeada abaixo para ser idempotente
ALTER TABLE sirene_pericias
  ADD COLUMN IF NOT EXISTS tipo text;

-- Datas de ciclo de vida
ALTER TABLE sirene_pericias
  ADD COLUMN IF NOT EXISTS data_previsao_conclusao date;

ALTER TABLE sirene_pericias
  ADD COLUMN IF NOT EXISTS data_conclusao_real date;

-- Campos de análise e encerramento
ALTER TABLE sirene_pericias
  ADD COLUMN IF NOT EXISTS causa_raiz text;

ALTER TABLE sirene_pericias
  ADD COLUMN IF NOT EXISTS parecer_final text;

ALTER TABLE sirene_pericias
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;

-- Contadores denormalizados para performance
ALTER TABLE sirene_pericias
  ADD COLUMN IF NOT EXISTS recidivas_count int DEFAULT 0;

ALTER TABLE sirene_pericias
  ADD COLUMN IF NOT EXISTS chamados_count int DEFAULT 0;

ALTER TABLE sirene_pericias
  ADD COLUMN IF NOT EXISTS carometro_count int DEFAULT 0;

-- Rastreabilidade de criação
ALTER TABLE sirene_pericias
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);


-- =============================================================================
-- SEÇÃO 3: CONSTRAINT DE STATUS (COMENTADA — AUDITAR ANTES DE DESCOMENTAR)
-- =============================================================================

-- AUDITAR: execute a query abaixo para verificar os valores atuais antes de
-- descomentar a constraint. Valores fora do enum causarão erro imediato.
--
-- SELECT DISTINCT status FROM sirene_pericias;
--
-- ALTER TABLE sirene_pericias ADD CONSTRAINT pericias_status_check CHECK (
--   status IN ('rascunho','aberta','investigando','plano_acao','concluida','cancelada'));


-- =============================================================================
-- SEÇÃO 4: CONSTRAINT DE DOMÍNIO (COMENTADA — AUDITAR ANTES DE DESCOMENTAR)
-- =============================================================================

-- AUDITAR: execute a query abaixo para verificar os valores atuais antes de
-- descomentar a constraint. Valores fora do enum causarão erro imediato.
--
-- SELECT DISTINCT dominio FROM sirene_pericias;
--
-- ALTER TABLE sirene_pericias ADD CONSTRAINT pericias_dominio_check CHECK (
--   dominio IN (
--     'GBox',
--     'Crédito e financeiro',
--     'Inadimplência e atrasos',
--     'Taxa de franquia',
--     'Homologações e fornecedores',
--     'Produtos e catálogo',
--     'Contratos e jurídico',
--     'SPE e estruturas jurídicas',
--     'Acoplamento',
--     'Viabilidade e comitê',
--     'Terrenistas e permuta',
--     'Obra e cronograma',
--     'Divulgação e IMOB',
--     'Moní Care',
--     'Ciclo do Frank',
--     'Ferramentas e IA',
--     'Outros'
--   ));


-- =============================================================================
-- SEÇÃO 5: MELHORIA DE sirene_pericia_chamados
-- =============================================================================

-- Motivo pelo qual o chamado foi vinculado à perícia
ALTER TABLE sirene_pericia_chamados
  ADD COLUMN IF NOT EXISTS motivo_vinculacao text;

-- Quem realizou o vínculo
ALTER TABLE sirene_pericia_chamados
  ADD COLUMN IF NOT EXISTS vinculado_por uuid REFERENCES auth.users(id);

-- Quando o vínculo foi criado
ALTER TABLE sirene_pericia_chamados
  ADD COLUMN IF NOT EXISTS vinculado_em timestamptz DEFAULT now();


-- =============================================================================
-- SEÇÃO 6: FK DE pericia_id EM sirene_chamados
-- =============================================================================

-- Vincula um chamado diretamente a uma perícia (além do mapeamento textual existente)
ALTER TABLE sirene_chamados
  ADD COLUMN IF NOT EXISTS pericia_id bigint REFERENCES sirene_pericias(id) ON DELETE SET NULL;


-- =============================================================================
-- SEÇÃO 7: TABELA sirene_pericia_carometro_vinculos
-- =============================================================================

CREATE TABLE IF NOT EXISTS sirene_pericia_carometro_vinculos (
  id              bigserial    PRIMARY KEY,
  pericia_id      bigint       NOT NULL REFERENCES sirene_pericias(id) ON DELETE CASCADE,
  item_tipo       text         NOT NULL CHECK (item_tipo IN ('acao', 'tarefa')),
  item_id         bigint       NOT NULL,
  item_descricao  text,
  franqueado_id   uuid         REFERENCES auth.users(id),
  vinculado_por   uuid         REFERENCES auth.users(id),
  vinculado_em    timestamptz  DEFAULT now()
);


-- =============================================================================
-- SEÇÃO 8: TABELA sirene_pericia_acoes
-- =============================================================================

CREATE TABLE IF NOT EXISTS sirene_pericia_acoes (
  id                bigserial   PRIMARY KEY,
  pericia_id        bigint      NOT NULL REFERENCES sirene_pericias(id) ON DELETE CASCADE,
  descricao         text        NOT NULL,
  time_responsavel  text,
  responsavel_id    uuid        REFERENCES auth.users(id),
  responsavel_nome  text,
  prazo             date,
  status            text        DEFAULT 'pendente'
                                CHECK (status IN ('pendente','em_andamento','concluida')),
  conclusao         text,
  created_at        timestamptz DEFAULT now()
);


-- =============================================================================
-- SEÇÃO 9: TABELA sirene_pericia_historico
-- =============================================================================

CREATE TABLE IF NOT EXISTS sirene_pericia_historico (
  id             bigserial   PRIMARY KEY,
  pericia_id     bigint      NOT NULL REFERENCES sirene_pericias(id) ON DELETE CASCADE,
  fase_anterior  text,
  fase_nova      text,
  observacao     text,
  user_id        uuid        REFERENCES auth.users(id),
  created_at     timestamptz DEFAULT now()
);


-- =============================================================================
-- SEÇÃO 10: HABILITAR RLS NAS 3 TABELAS NOVAS
-- =============================================================================

ALTER TABLE sirene_pericia_carometro_vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sirene_pericia_acoes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sirene_pericia_historico          ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SEÇÃO 11: POLÍTICAS RLS PARA sirene_pericias
-- =============================================================================

-- DROP de políticas antigas que possam existir com nomes comuns
DROP POLICY IF EXISTS "pericias_all_policy"                    ON sirene_pericias;
DROP POLICY IF EXISTS "pericias_select_policy"                 ON sirene_pericias;
DROP POLICY IF EXISTS "pericias_insert_policy"                 ON sirene_pericias;
DROP POLICY IF EXISTS "pericias_update_policy"                 ON sirene_pericias;
DROP POLICY IF EXISTS "pericias_delete_policy"                 ON sirene_pericias;
DROP POLICY IF EXISTS "pericias_admin_policy"                  ON sirene_pericias;
DROP POLICY IF EXISTS "pericias_caneta_verde_admin"            ON sirene_pericias;
DROP POLICY IF EXISTS "pericias_select_chamados_vinculados"    ON sirene_pericias;

-- Política principal: acesso total para caneta_verde, admin e team
CREATE POLICY pericias_caneta_verde_admin
  ON sirene_pericias
  FOR ALL
  USING (
    get_my_sirene_papel() = 'caneta_verde'
    OR get_my_sirene_papel() IN ('admin', 'team')
  )
  WITH CHECK (
    get_my_sirene_papel() = 'caneta_verde'
    OR get_my_sirene_papel() IN ('admin', 'team')
  );

-- Política de leitura: usuários com chamados vinculados podem ver a perícia
CREATE POLICY pericias_select_chamados_vinculados
  ON sirene_pericias
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM sirene_pericia_chamados spc
      JOIN sirene_chamados sc ON sc.id = spc.chamado_id
      WHERE spc.pericia_id = sirene_pericias.id
        AND sc.responsavel_id = auth.uid()
    )
  );


-- =============================================================================
-- SEÇÃO 12: POLÍTICAS RLS PARA AS TABELAS NOVAS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- sirene_pericia_acoes
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "pericia_acoes_all"  ON sirene_pericia_acoes;

CREATE POLICY pericia_acoes_all
  ON sirene_pericia_acoes
  FOR ALL
  USING (
    get_my_sirene_papel() = 'caneta_verde'
    OR get_my_sirene_papel() IN ('admin', 'team')
  )
  WITH CHECK (
    get_my_sirene_papel() = 'caneta_verde'
    OR get_my_sirene_papel() IN ('admin', 'team')
  );

-- ---------------------------------------------------------------------------
-- sirene_pericia_historico
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "pericia_historico_select"  ON sirene_pericia_historico;
DROP POLICY IF EXISTS "pericia_historico_insert"  ON sirene_pericia_historico;

-- SELECT: caneta_verde, admin e team podem ler o histórico
CREATE POLICY pericia_historico_select
  ON sirene_pericia_historico
  FOR SELECT
  USING (
    get_my_sirene_papel() = 'caneta_verde'
    OR get_my_sirene_papel() IN ('admin', 'team')
  );

-- INSERT: apenas via trigger (SECURITY DEFINER) — nenhum usuário direto
-- Esta policy não existe intencionalmente; o trigger usa SECURITY DEFINER
-- para gravar sem depender de permissão RLS do usuário final.

-- ---------------------------------------------------------------------------
-- sirene_pericia_carometro_vinculos
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "carometro_vinculos_insert"  ON sirene_pericia_carometro_vinculos;
DROP POLICY IF EXISTS "carometro_vinculos_select"  ON sirene_pericia_carometro_vinculos;

-- INSERT: dono do item, caneta_verde ou admin podem vincular
CREATE POLICY carometro_vinculos_insert
  ON sirene_pericia_carometro_vinculos
  FOR INSERT
  WITH CHECK (
    auth.uid() = franqueado_id
    OR get_my_sirene_papel() = 'caneta_verde'
    OR get_my_sirene_papel() IN ('admin', 'team')
  );

-- SELECT: caneta_verde, admin e team podem consultar vínculos
CREATE POLICY carometro_vinculos_select
  ON sirene_pericia_carometro_vinculos
  FOR SELECT
  USING (
    get_my_sirene_papel() = 'caneta_verde'
    OR get_my_sirene_papel() IN ('admin', 'team')
  );


-- =============================================================================
-- SEÇÃO 13: ÍNDICES PARA PERFORMANCE
-- =============================================================================

-- Filtro por domínio nas perícias
CREATE INDEX IF NOT EXISTS idx_pericias_dominio
  ON sirene_pericias(dominio);

-- Ações por perícia
CREATE INDEX IF NOT EXISTS idx_pericia_acoes_pericia_id
  ON sirene_pericia_acoes(pericia_id);

-- Histórico por perícia
CREATE INDEX IF NOT EXISTS idx_pericia_historico_pericia_id
  ON sirene_pericia_historico(pericia_id);

-- Chamados com perícia vinculada diretamente
CREATE INDEX IF NOT EXISTS idx_chamados_pericia_id
  ON sirene_chamados(pericia_id);

-- Vínculos de carômetro por perícia
CREATE INDEX IF NOT EXISTS idx_carometro_vinculos_pericia_id
  ON sirene_pericia_carometro_vinculos(pericia_id);

-- Vínculos de carômetro por tipo e id do item (lookup direto)
CREATE INDEX IF NOT EXISTS idx_carometro_vinculos_item
  ON sirene_pericia_carometro_vinculos(item_tipo, item_id);

-- Extensão de trigramas para buscas fuzzy futuras
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- =============================================================================
-- SEÇÃO 14: NOTIFICAR POSTGREST PARA RECARREGAR O SCHEMA
-- =============================================================================

NOTIFY pgrst, 'reload schema';
