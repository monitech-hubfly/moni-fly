-- =============================================================================
-- sync_dev_with_prod.sql
-- =============================================================================
-- Sincroniza um banco DEV (ou qualquer clone) com alterações aplicadas
-- manualmente em PROD que não estão cobertas por um único ficheiro de
-- migration — consolidado a partir de migrations >= 148, prod_bootstrap_*.sql
-- e alinhamento com 111/112/114/128/149–153.
--
-- Idempotente: IF NOT EXISTS, WHERE NOT EXISTS, DROP POLICY IF EXISTS,
-- CREATE OR REPLACE VIEW, ON CONFLICT DO NOTHING onde há índice UNIQUE.
-- Seguro a reexecutar se parte do conteúdo já existir.
--
-- Pré-requisitos: schema base (processo_step_one, kanban_cards, profiles, …)
-- via `supabase db push` ou migrations antigas. Se algum GRANT falhar por
-- tabela/view inexistente, comente a linha correspondente.
-- =============================================================================

BEGIN;

-- ─── 0. Constraint UNIQUE em kanbans(nome) (necessária para ON CONFLICT) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kanbans_nome_unique'
      AND conrelid = 'public.kanbans'::regclass
  ) THEN
    DELETE FROM public.kanbans c
    WHERE c.ctid NOT IN (
      SELECT min(c2.ctid) FROM public.kanbans c2 GROUP BY c2.nome
    );
    ALTER TABLE public.kanbans ADD CONSTRAINT kanbans_nome_unique UNIQUE (nome);
  END IF;
END;
$$;

-- ─── 1. Colunas em kanbans ───────────────────────────────────────────────────
ALTER TABLE public.kanbans
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS ordem INTEGER,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

UPDATE public.kanbans SET ativo = true WHERE ativo IS NULL;

COMMENT ON COLUMN public.kanbans.ativo IS 'Kanban visível nas listagens quando true.';
COMMENT ON COLUMN public.kanbans.descricao IS 'Descrição resumida do propósito do kanban.';

-- ─── 2. Renomes legados → nomes canônicos “Funil …” (114) ────────────────────
UPDATE public.kanbans SET nome = 'Funil Portfólio'     WHERE nome = 'Portfolio';
UPDATE public.kanbans SET nome = 'Funil Operações'     WHERE nome = 'Operações';
UPDATE public.kanbans SET nome = 'Funil Contabilidade' WHERE nome = 'Contabilidade';
UPDATE public.kanbans SET nome = 'Funil Crédito'      WHERE nome = 'Crédito';

-- ─── 3. Seed dos seis kanbans canônicos ─────────────────────────────────────
INSERT INTO public.kanbans (nome, descricao, ordem, ativo) VALUES
  ('Funil Step One',     'Funil de viabilidade de novas franquias',           1, true),
  ('Funil Portfólio',    'Gestão de portfolio de franquias',                  2, true),
  ('Funil Operações',    'Gestão operacional de franquias',                    3, true),
  ('Funil Contabilidade','Gestão contábil de franquias',                       4, true),
  ('Funil Crédito',      'Gestão de crédito de franquias',                      5, true),
  ('Funil Acoplamento',  'Gestão do processo de acoplamento de terreno e casa', 6, true)
ON CONFLICT (nome) DO NOTHING;

UPDATE public.kanbans k SET descricao = 'Funil de viabilidade de novas franquias'
  WHERE k.nome = 'Funil Step One' AND k.descricao IS NULL;
UPDATE public.kanbans k SET descricao = 'Gestão de portfolio de franquias'
  WHERE k.nome = 'Funil Portfólio' AND k.descricao IS NULL;
UPDATE public.kanbans k SET descricao = 'Gestão operacional de franquias'
  WHERE k.nome = 'Funil Operações' AND k.descricao IS NULL;
UPDATE public.kanbans k SET descricao = 'Gestão contábil de franquias'
  WHERE k.nome = 'Funil Contabilidade' AND k.descricao IS NULL;
UPDATE public.kanbans k SET descricao = 'Gestão de crédito de franquias'
  WHERE k.nome = 'Funil Crédito' AND k.descricao IS NULL;
UPDATE public.kanbans k SET descricao = 'Gestão do processo de acoplamento de terreno e casa'
  WHERE k.nome = 'Funil Acoplamento' AND k.descricao IS NULL;

-- ─── 4. kanban_fases: slug + índice único parcial (112) ───────────────────────
ALTER TABLE public.kanban_fases
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_fases_kanban_slug
  ON public.kanban_fases (kanban_id, slug)
  WHERE slug IS NOT NULL;

-- Funil Contabilidade / Crédito (nomes antigos ou novos)
INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
SELECT k.id, fase.nome, fase.slug, fase.ordem, 7, true
FROM public.kanbans k
CROSS JOIN (VALUES
  ('Abertura da Incorporadora', 'contabilidade_incorporadora', 1),
  ('Abertura da SPE',          'contabilidade_spe',             2),
  ('Abertura da Gestora',      'contabilidade_gestora',         3)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'Funil Contabilidade'
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

UPDATE public.kanban_fases kf
SET nome = v.novo
FROM public.kanbans k,
  (VALUES
    ('contabilidade_incorporadora', 'Abertura da Incorporadora'),
    ('contabilidade_spe',           'Abertura da SPE'),
    ('contabilidade_gestora',       'Abertura da Gestora')
  ) AS v(slug, novo)
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Contabilidade'
  AND kf.slug = v.slug;

INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
SELECT k.id, fase.nome, fase.slug, fase.ordem, 7, true
FROM public.kanbans k
CROSS JOIN (VALUES
  ('Crédito Terreno', 'credito_terreno', 1),
  ('Crédito Obra',    'credito_obra',    2)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'Funil Crédito'
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

-- Funil Portfólio e Funil Operações — 19 fases (112), nomes alinhados 114
INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
SELECT k.id, fase.nome, fase.slug, fase.ordem, 7, true
FROM public.kanbans k
CROSS JOIN (VALUES
  ('Step 2: Novo Negócio',                     'step_2',                    1),
  ('Aprovação Moní - Novo Negócio',           'aprovacao_moni_novo_negocio',2),
  ('Step 3: Opção',                           'step_3',                    3),
  ('Acoplamento',                             'acoplamento',               4),
  ('Step 4: Check Legal + Checklist de Crédito','step_4',                  5),
  ('Step 5: Comitê',                          'step_5',                    6),
  ('Step 6: Diligência',                      'step_6',                    7),
  ('Step 7: Contrato',                        'step_7',                    8),
  ('Passagem para Wayser',                    'passagem_wayser',           9),
  ('Planialtimétrico',                        'planialtimetrico',          10),
  ('Sondagem (paralelo Planialtimétrico)',    'sondagem',                  11),
  ('Projeto Legal',                           'projeto_legal',             12),
  ('Aprovação no Condomínio',                 'aprovacao_condominio',      13),
  ('Aprovação na Prefeitura',                 'aprovacao_prefeitura',      14),
  ('Revisão do BCA',                          'revisao_bca',               15),
  ('Processos Cartorários',                   'processos_cartorarios',    16),
  ('Aguardando Crédito',                      'aguardando_credito',        17),
  ('Em Obra',                                 'em_obra',                   18),
  ('Moní Care',                               'moni_care',                 19)
) AS fase(nome, slug, ordem)
WHERE k.nome IN ('Funil Portfólio', 'Funil Operações')
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

-- Funil Acoplamento — 4 fases (128)
INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
SELECT k.id, fase.nome, fase.slug, fase.ordem, 7, true
FROM public.kanbans k
CROSS JOIN (VALUES
  ('Modelagem do Terreno',      'modelagem_terreno',       1),
  ('Modelagem da Casa + GBox',  'modelagem_casa_gbox',     2),
  ('Validação do Acoplamento',  'validacao_acoplamento',   3),
  ('Alterações do Acoplamento', 'alteracoes_acoplamento',  4)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'Funil Acoplamento'
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

-- Funil Step One — “Dados do Candidato” (148) + fases 092 em falta (sem duplicar nome)
DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND COALESCE(ativo, true)
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE 'sync: Funil Step One não encontrado; fases Step One ignoradas.';
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND nome = 'Dados do Candidato'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND nome = 'Descrição do Candidato'
    ) THEN
      UPDATE public.kanban_fases
      SET nome = 'Dados do Candidato', slug = 'stepone_dados_candidato'
      WHERE kanban_id = v_kanban_id AND nome = 'Descrição do Candidato';
    ELSE
      UPDATE public.kanban_fases
      SET ordem = ordem + 1
      WHERE kanban_id = v_kanban_id AND COALESCE(ativo, true) = true;

      INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
      VALUES (v_kanban_id, 'Dados do Candidato', 'stepone_dados_candidato', 1, 7, true);
    END IF;
  END IF;
END;
$$;

INSERT INTO public.kanban_fases (kanban_id, nome, ordem, sla_dias, ativo)
SELECT k.id, fase.nome, fase.ordem, fase.sla_dias, true
FROM public.kanbans k
CROSS JOIN (VALUES
  ('Dados da Cidade',        2,  7),
  ('Lista de Condomínios',   3,  7),
  ('Dados dos Condomínios',  4, 10),
  ('Lotes disponíveis',      5,  7),
  ('Mapa de Competidores',   6,  7),
  ('BCA + Batalha de Casas', 7, 14),
  ('Hipóteses',              8,  7)
) AS fase(nome, ordem, sla_dias)
WHERE k.nome = 'Funil Step One'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id AND kf.nome = fase.nome
  );

-- Slugs canónicos por nome (fases criadas em 092 sem slug)
UPDATE public.kanban_fases kf SET slug = 'stepone_dados_candidato'
  FROM public.kanbans k WHERE k.id = kf.kanban_id AND k.nome = 'Funil Step One'
  AND kf.nome = 'Dados do Candidato' AND kf.slug IS NULL;
UPDATE public.kanban_fases kf SET slug = 'stepone_dados_cidade'
  FROM public.kanbans k WHERE k.id = kf.kanban_id AND k.nome = 'Funil Step One'
  AND kf.nome = 'Dados da Cidade' AND kf.slug IS NULL;
UPDATE public.kanban_fases kf SET slug = 'stepone_lista_cond'
  FROM public.kanbans k WHERE k.id = kf.kanban_id AND k.nome = 'Funil Step One'
  AND kf.nome = 'Lista de Condomínios' AND kf.slug IS NULL;
UPDATE public.kanban_fases kf SET slug = 'stepone_dados_cond'
  FROM public.kanbans k WHERE k.id = kf.kanban_id AND k.nome = 'Funil Step One'
  AND kf.nome = 'Dados dos Condomínios' AND kf.slug IS NULL;
UPDATE public.kanban_fases kf SET slug = 'stepone_lotes'
  FROM public.kanbans k WHERE k.id = kf.kanban_id AND k.nome = 'Funil Step One'
  AND kf.nome = 'Lotes disponíveis' AND kf.slug IS NULL;
UPDATE public.kanban_fases kf SET slug = 'stepone_mapa'
  FROM public.kanbans k WHERE k.id = kf.kanban_id AND k.nome = 'Funil Step One'
  AND kf.nome = 'Mapa de Competidores' AND kf.slug IS NULL;
UPDATE public.kanban_fases kf SET slug = 'stepone_bca'
  FROM public.kanbans k WHERE k.id = kf.kanban_id AND k.nome = 'Funil Step One'
  AND kf.nome = 'BCA + Batalha de Casas' AND kf.slug IS NULL;
UPDATE public.kanban_fases kf SET slug = 'stepone_hipoteses'
  FROM public.kanbans k WHERE k.id = kf.kanban_id AND k.nome = 'Funil Step One'
  AND kf.nome = 'Hipóteses' AND kf.slug IS NULL;

-- ─── 5. View legado: criado_em + etapa_slug (114) ────────────────────────────
CREATE OR REPLACE VIEW public.v_processo_como_kanban_cards AS
SELECT
  p.id,
  kf.kanban_id,
  kf.id          AS fase_id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' - ', p.numero_franquia, p.nome_condominio)), ''),
    'Sem título'
  )              AS titulo,
  p.status,
  p.created_at   AS criado_em,
  p.updated_at,
  p.user_id      AS responsavel_id,
  p.etapa_painel AS etapa_slug,
  NULL::date     AS data_prazo_sla,
  'legado'::text AS origem
FROM public.processo_step_one p
JOIN public.kanban_fases kf ON kf.slug = p.etapa_painel
JOIN public.kanbans k       ON k.id   = kf.kanban_id
WHERE k.nome IN ('Funil Portfólio', 'Funil Operações', 'Funil Contabilidade', 'Funil Crédito')
  AND p.cancelado_em IS NULL
  AND p.removido_em  IS NULL;

COMMENT ON VIEW public.v_processo_como_kanban_cards IS
  'processo_step_one exposto como card de kanban (legado). Inclui criado_em e etapa_slug.';

-- ─── 6. kanban_atividades — colunas manuais em PROD + origem (116/120) ───────
ALTER TABLE public.kanban_atividades
  DROP CONSTRAINT IF EXISTS kanban_atividades_card_id_fkey;

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS concluida_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ordem INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responsavel_nome_texto TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT,
  ADD COLUMN IF NOT EXISTS responsaveis_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trava BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem_externa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS solicitante_nome TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_email TEXT,
  ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.kanban_atividades SET origem = 'nativo' WHERE origem IS NULL;
ALTER TABLE public.kanban_atividades ALTER COLUMN origem SET DEFAULT 'nativo';

ALTER TABLE public.kanban_atividades
  DROP CONSTRAINT IF EXISTS kanban_atividades_origem_check;
ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_origem_check
  CHECK (origem IN ('nativo', 'legado', 'sirene', 'externo'));

ALTER TABLE public.kanban_atividades
  ALTER COLUMN origem SET NOT NULL;

ALTER TABLE public.kanban_atividades
  ALTER COLUMN card_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_card_id
  ON public.kanban_atividades (card_id);

UPDATE public.kanban_atividades
SET responsaveis_ids = ARRAY[responsavel_id]
WHERE responsavel_id IS NOT NULL
  AND (responsaveis_ids IS NULL OR responsaveis_ids = '{}');

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_responsaveis
  ON public.kanban_atividades USING GIN (responsaveis_ids);

COMMENT ON COLUMN public.kanban_atividades.responsavel_nome_texto IS
  'Responsável por nome (catálogo Moní / externo) quando responsaveis_ids não resolve para perfil.';

-- ─── 7. Checklist estrutural (149) + colunas tokens (151) ───────────────────
CREATE TABLE IF NOT EXISTS public.kanban_fase_checklist_itens (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id               UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  ordem                 INTEGER     NOT NULL DEFAULT 0,
  label                 TEXT        NOT NULL,
  tipo                  TEXT        NOT NULL DEFAULT 'texto_curto'
    CHECK (tipo IN (
      'texto_curto','texto_longo','email','telefone',
      'numero','anexo','anexo_template','checkbox'
    )),
  obrigatorio           BOOLEAN     DEFAULT TRUE,
  visivel_candidato     BOOLEAN     DEFAULT TRUE,
  template_storage_path TEXT,
  placeholder           TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fase_checklist_itens_fase ON public.kanban_fase_checklist_itens(fase_id);

CREATE TABLE IF NOT EXISTS public.kanban_fase_checklist_respostas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID        NOT NULL REFERENCES public.kanban_fase_checklist_itens(id) ON DELETE CASCADE,
  card_id        UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  valor          TEXT,
  arquivo_path   TEXT,
  preenchido_por UUID        REFERENCES auth.users(id),
  preenchido_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_fase_checklist_respostas_card ON public.kanban_fase_checklist_respostas(card_id);
CREATE INDEX IF NOT EXISTS idx_fase_checklist_respostas_item ON public.kanban_fase_checklist_respostas(item_id);

CREATE TABLE IF NOT EXISTS public.kanban_card_form_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_id    UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  usado_em   TIMESTAMPTZ,
  created_by UUID        REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.kanban_card_form_tokens
  ADD COLUMN IF NOT EXISTS email_candidato     TEXT,
  ADD COLUMN IF NOT EXISTS nome_candidato      TEXT,
  ADD COLUMN IF NOT EXISTS cobranca_enviada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cobrancas_enviadas  INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_card_form_tokens_card  ON public.kanban_card_form_tokens(card_id);
CREATE INDEX IF NOT EXISTS idx_card_form_tokens_token ON public.kanban_card_form_tokens(token);

-- ─── 8. RLS: checklist + tokens (149–150) e kanban_atividades (com sirene) ───
ALTER TABLE public.kanban_fase_checklist_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_fase_checklist_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_card_form_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_atividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fase_checklist_select_interno" ON public.kanban_fase_checklist_itens;
CREATE POLICY "fase_checklist_select_interno" ON public.kanban_fase_checklist_itens
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fase_checklist_admin" ON public.kanban_fase_checklist_itens;
CREATE POLICY "fase_checklist_admin" ON public.kanban_fase_checklist_itens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "fase_checklist_resp_select" ON public.kanban_fase_checklist_respostas;
CREATE POLICY "fase_checklist_resp_select" ON public.kanban_fase_checklist_respostas
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fase_checklist_resp_upsert" ON public.kanban_fase_checklist_respostas;
CREATE POLICY "fase_checklist_resp_upsert" ON public.kanban_fase_checklist_respostas
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "form_tokens_select_interno" ON public.kanban_card_form_tokens;
CREATE POLICY "form_tokens_select_interno" ON public.kanban_card_form_tokens
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "form_tokens_insert_interno" ON public.kanban_card_form_tokens;
CREATE POLICY "form_tokens_insert_interno" ON public.kanban_card_form_tokens
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS kanban_atividades_select ON public.kanban_atividades;
CREATE POLICY kanban_atividades_select ON public.kanban_atividades
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor')
    )
    OR (
      kanban_atividades.origem IN ('sirene', 'externo')
      AND (
        kanban_atividades.criado_por = auth.uid()
        OR kanban_atividades.responsavel_id = auth.uid()
        OR auth.uid() = ANY (COALESCE(kanban_atividades.responsaveis_ids, '{}'))
      )
    )
    OR (
      kanban_atividades.origem = 'nativo'
      AND EXISTS (
        SELECT 1 FROM public.kanban_cards
        WHERE kanban_cards.id = kanban_atividades.card_id
          AND kanban_cards.franqueado_id = auth.uid()
      )
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS kanban_atividades_insert ON public.kanban_atividades;
CREATE POLICY kanban_atividades_insert ON public.kanban_atividades
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor')
    )
    OR (
      kanban_atividades.origem IN ('sirene', 'externo')
      AND (
        kanban_atividades.criado_por = auth.uid()
        OR kanban_atividades.responsavel_id = auth.uid()
        OR auth.uid() = ANY (COALESCE(kanban_atividades.responsaveis_ids, '{}'))
      )
    )
    OR (
      kanban_atividades.origem = 'nativo'
      AND EXISTS (
        SELECT 1 FROM public.kanban_cards
        WHERE kanban_cards.id = kanban_atividades.card_id
          AND kanban_cards.franqueado_id = auth.uid()
      )
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS kanban_atividades_update ON public.kanban_atividades;
CREATE POLICY kanban_atividades_update ON public.kanban_atividades
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor')
    )
    OR (
      kanban_atividades.origem IN ('sirene', 'externo')
      AND (
        kanban_atividades.criado_por = auth.uid()
        OR kanban_atividades.responsavel_id = auth.uid()
        OR auth.uid() = ANY (COALESCE(kanban_atividades.responsaveis_ids, '{}'))
      )
    )
    OR (
      kanban_atividades.origem = 'nativo'
      AND EXISTS (
        SELECT 1 FROM public.kanban_cards
        WHERE kanban_cards.id = kanban_atividades.card_id
          AND kanban_cards.franqueado_id = auth.uid()
      )
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS kanban_atividades_delete ON public.kanban_atividades;
CREATE POLICY kanban_atividades_delete ON public.kanban_atividades
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor')
    )
    OR (
      kanban_atividades.origem IN ('sirene', 'externo')
      AND (
        kanban_atividades.criado_por = auth.uid()
        OR kanban_atividades.responsavel_id = auth.uid()
        OR auth.uid() = ANY (COALESCE(kanban_atividades.responsaveis_ids, '{}'))
      )
    )
    OR (
      kanban_atividades.origem = 'nativo'
      AND EXISTS (
        SELECT 1 FROM public.kanban_cards
        WHERE kanban_cards.id = kanban_atividades.card_id
          AND kanban_cards.franqueado_id = auth.uid()
      )
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

-- ─── 9. PROD: RLS desligado em kanbans e kanban_fases ────────────────────────
ALTER TABLE public.kanbans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_fases DISABLE ROW LEVEL SECURITY;

-- ─── 10. GRANTs — kanban, views, checklist, tokens + service_role ──────────────
GRANT SELECT ON public.kanbans TO authenticated, anon;
GRANT SELECT ON public.kanban_fases TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_atividades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_historico TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_card_comentarios TO authenticated;
GRANT SELECT ON public.kanban_times TO authenticated, anon;

GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;
GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;

GRANT SELECT ON public.kanban_fase_checklist_itens TO authenticated, service_role;
GRANT ALL    ON public.kanban_fase_checklist_itens TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_fase_checklist_respostas TO authenticated;
GRANT ALL ON public.kanban_fase_checklist_respostas TO service_role;

GRANT ALL ON public.kanban_card_form_tokens TO authenticated;
GRANT ALL ON public.kanban_card_form_tokens TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
