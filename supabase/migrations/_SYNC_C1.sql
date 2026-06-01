-- 150: Tokens de formulÃ¡rio pÃºblico para candidatos (por card + fase)

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

CREATE INDEX IF NOT EXISTS idx_card_form_tokens_card  ON public.kanban_card_form_tokens(card_id);
CREATE INDEX IF NOT EXISTS idx_card_form_tokens_token ON public.kanban_card_form_tokens(token);

ALTER TABLE public.kanban_card_form_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_tokens_select_interno" ON public.kanban_card_form_tokens;
CREATE POLICY "form_tokens_select_interno" ON public.kanban_card_form_tokens
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "form_tokens_insert_interno" ON public.kanban_card_form_tokens;
CREATE POLICY "form_tokens_insert_interno" ON public.kanban_card_form_tokens
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON public.kanban_card_form_tokens TO authenticated;

NOTIFY pgrst, 'reload schema';
-- 151: Colunas de e-mail e controle de cobranÃ§a em kanban_card_form_tokens

ALTER TABLE public.kanban_card_form_tokens
  ADD COLUMN IF NOT EXISTS email_candidato     TEXT,
  ADD COLUMN IF NOT EXISTS nome_candidato      TEXT,
  ADD COLUMN IF NOT EXISTS cobranca_enviada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cobrancas_enviadas  INTEGER DEFAULT 0;
-- Nome do responsÃ¡vel escolhido no modal de novo chamado (lista fixa por time).
ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS abertura_responsavel_nome TEXT;

COMMENT ON COLUMN public.sirene_chamados.abertura_responsavel_nome IS
  'ResponsÃ¡vel indicado na abertura do chamado (texto; catÃ¡logo Sirene por time).';
-- Nome do responsÃ¡vel em texto (catÃ¡logo MonÃ­ / externo) quando nÃ£o hÃ¡ match em profiles.
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS responsavel_nome_texto TEXT;

COMMENT ON COLUMN public.kanban_atividades.responsavel_nome_texto IS
  'ResponsÃ¡vel por nome (ex.: catÃ¡logo TIMES_MONI) quando responsaveis_ids nÃ£o resolve para perfil.';
-- Prevenir duplicatas em kanban_fase_checklist_itens
DELETE FROM public.kanban_fase_checklist_itens a
USING public.kanban_fase_checklist_itens b
WHERE a.id > b.id
  AND a.fase_id = b.fase_id
  AND a.ordem = b.ordem
  AND a.label = b.label;

ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_fase_ordem_unique;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_fase_ordem_unique
  UNIQUE (fase_id, ordem, label);
CREATE TABLE public.repositorio_secoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.repositorio_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secao_id UUID NOT NULL REFERENCES public.repositorio_secoes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  storage_path TEXT NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'documentos-templates',
  criado_por UUID REFERENCES auth.users(id),
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.repositorio_secoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repositorio_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repositorio_select" ON public.repositorio_secoes
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "repositorio_admin" ON public.repositorio_secoes
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "repositorio_docs_select" ON public.repositorio_documentos
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "repositorio_docs_admin" ON public.repositorio_documentos
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT ALL ON public.repositorio_secoes TO authenticated;
GRANT ALL ON public.repositorio_documentos TO authenticated;

-- Seed: seÃ§Ã£o PrÃ© QualificaÃ§Ã£o
INSERT INTO public.repositorio_secoes (nome, ordem)
VALUES ('PrÃ© QualificaÃ§Ã£o', 1);
-- 157: Checklist estrutural â€” demais fases do Funil Step One (itens por fase).
-- Idempotente: alinha slug canÃ³nico + INSERT com WHERE NOT EXISTS (fase_id + label).

DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '157: kanban Funil Step One nÃ£o encontrado; pulando.';
    RETURN;
  END IF;

  -- Slugs canÃ³nicos (pedido do produto); idempotente por nome da fase.
  UPDATE public.kanban_fases SET slug = 'dados_cidade'
    WHERE kanban_id = v_kanban_id AND nome = 'Dados da Cidade';
  UPDATE public.kanban_fases SET slug = 'lista_condominios'
    WHERE kanban_id = v_kanban_id AND nome = 'Lista de CondomÃ­nios';
  UPDATE public.kanban_fases SET slug = 'dados_condominios'
    WHERE kanban_id = v_kanban_id AND nome = 'Dados dos CondomÃ­nios';
  UPDATE public.kanban_fases SET slug = 'lotes_disponiveis'
    WHERE kanban_id = v_kanban_id AND nome = 'Lotes disponÃ­veis';
  UPDATE public.kanban_fases SET slug = 'mapa_competidores'
    WHERE kanban_id = v_kanban_id AND nome = 'Mapa de Competidores';
  UPDATE public.kanban_fases SET slug = 'bca_batalha_casas'
    WHERE kanban_id = v_kanban_id AND nome = 'BCA + Batalha de Casas';
  UPDATE public.kanban_fases SET slug = 'hipoteses'
    WHERE kanban_id = v_kanban_id AND nome = 'HipÃ³teses';
END;
$$;

-- â”€â”€â”€ Dados da Cidade (slug: dados_cidade) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Cidade de interesse',       'texto_curto', NULL::text),
  (2, 'Estado',                    'texto_curto', NULL),
  (3, 'PopulaÃ§Ã£o estimada',        'numero',      NULL),
  (4, 'Renda mÃ©dia per capita',    'texto_curto', NULL),
  (5, 'ObservaÃ§Ãµes sobre a praÃ§a', 'texto_longo', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'dados_cidade'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- â”€â”€â”€ Lista de CondomÃ­nios (slug: lista_condominios) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Nome do condomÃ­nio',    'texto_curto', NULL::text),
  (2, 'EndereÃ§o',              'texto_curto', NULL),
  (3, 'NÃºmero de unidades',    'numero',      NULL),
  (4, 'Contato do sÃ­ndico',    'texto_curto', NULL),
  (5, 'Status de interesse',   'texto_curto', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'lista_condominios'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- â”€â”€â”€ Dados dos CondomÃ­nios (slug: dados_condominios) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Nome do condomÃ­nio',                 'texto_curto', NULL::text),
  (2, 'CNPJ do condomÃ­nio',                 'texto_curto', NULL),
  (3, 'Ãrea total do terreno mÂ²',           'numero',      NULL),
  (4, 'Ãrea disponÃ­vel para construÃ§Ã£o mÂ²', 'numero',      NULL),
  (5, 'DocumentaÃ§Ã£o regularizada',          'checkbox',    NULL),
  (6, 'ObservaÃ§Ãµes',                        'texto_longo', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'dados_condominios'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- â”€â”€â”€ Lotes disponÃ­veis (slug: lotes_disponiveis) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'IdentificaÃ§Ã£o do lote',  'texto_curto', NULL::text),
  (2, 'Ãrea mÂ²',                 'numero',      NULL),
  (3, 'Valor estimado',          'texto_curto', NULL),
  (4, 'SituaÃ§Ã£o documental',     'texto_curto', NULL),
  (5, 'Fotos do lote',           'anexo',       NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'lotes_disponiveis'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- â”€â”€â”€ Mapa de Competidores (slug: mapa_competidores) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Nome do competidor',          'texto_curto', NULL::text),
  (2, 'DistÃ¢ncia km',                'numero',      NULL),
  (3, 'Produto/serviÃ§o oferecido',   'texto_curto', NULL),
  (4, 'NÃ­vel de ameaÃ§a',             'texto_curto', NULL),
  (5, 'ObservaÃ§Ãµes',                 'texto_longo', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'mapa_competidores'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- â”€â”€â”€ BCA + Batalha de Casas (slug: bca_batalha_casas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'BCA elaborado',                   'checkbox',    NULL::text),
  (2, 'Link do BCA',                     'texto_curto', NULL),
  (3, 'Resultado da batalha de casas',   'texto_longo', NULL),
  (4, 'Aprovado pelo comitÃª',            'checkbox',    NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'bca_batalha_casas'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- â”€â”€â”€ HipÃ³teses (slug: hipoteses) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'HipÃ³tese principal',   'texto_longo', NULL::text),
  (2, 'Premissas assumidas',  'texto_longo', NULL),
  (3, 'Riscos identificados', 'texto_longo', NULL),
  (4, 'PrÃ³ximos passos',      'texto_longo', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'hipoteses'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );
-- 158: Kanban "Funil MonÃ­ INC" â€” cÃ³pia das fases do Funil Step One + checklist por fase.

INSERT INTO public.kanbans (nome, descricao, ordem, ativo)
SELECT 'Funil MonÃ­ INC', 'Funil de qualificaÃ§Ã£o MonÃ­ INC', 1, true
WHERE NOT EXISTS (SELECT 1 FROM public.kanbans WHERE nome = 'Funil MonÃ­ INC');

INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
SELECT
  (SELECT id FROM public.kanbans WHERE nome = 'Funil MonÃ­ INC' LIMIT 1),
  kf.nome,
  CASE
    WHEN kf.slug IS NOT NULL AND btrim(kf.slug::text) <> '' THEN btrim(kf.slug::text) || '_moni_inc'
    ELSE 'fase_' || kf.ordem::text || '_moni_inc'
  END,
  kf.ordem,
  kf.sla_dias,
  kf.ativo,
  kf.instrucoes,
  COALESCE(kf.materiais, '[]'::jsonb)
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Step One'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f2
    JOIN public.kanbans k2 ON k2.id = f2.kanban_id
    WHERE k2.nome = 'Funil MonÃ­ INC'
      AND f2.ordem = kf.ordem
  );

INSERT INTO public.kanban_fase_checklist_itens
  (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, template_storage_path, placeholder)
SELECT
  (
    SELECT f2.id
    FROM public.kanban_fases f2
    JOIN public.kanbans k2 ON k2.id = f2.kanban_id
    WHERE k2.nome = 'Funil MonÃ­ INC'
      AND f2.ordem = kf.ordem
    LIMIT 1
  ),
  ci.ordem,
  ci.label,
  ci.tipo,
  ci.obrigatorio,
  ci.visivel_candidato,
  ci.template_storage_path,
  ci.placeholder
FROM public.kanban_fase_checklist_itens ci
JOIN public.kanban_fases kf ON kf.id = ci.fase_id
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Step One'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens ci2
    JOIN public.kanban_fases f2 ON f2.id = ci2.fase_id
    JOIN public.kanbans k2 ON k2.id = f2.kanban_id
    WHERE k2.nome = 'Funil MonÃ­ INC'
      AND ci2.label = ci.label
      AND f2.ordem = kf.ordem
  );
-- 159: Funil MonÃ­ INC â€” substituir todas as fases atuais pelas fases do fluxo MonÃ­ INC.
-- Remove qualquer cÃ³pia do Step One (slugs com sufixo _moni_inc ou legado) sem depender da lista exacta.
-- AtenÃ§Ã£o: FK em kanban_cards(fase_id) com ON DELETE CASCADE remove cards que estavam nessas fases.

DELETE FROM public.kanban_fases
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil MonÃ­ INC' LIMIT 1);

INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  7,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Primeiro Contato', 'primeiro_contato_moni_inc', 1),
    ('R1 Executada: "Conceito"', 'r1_conceito_moni_inc', 2),
    ('R2 Apresentar Plano TeÃ³rico', 'r2_plano_teorico_moni_inc', 3),
    ('R3 Ajustes Finais nas Propostas', 'r3_ajustes_finais_moni_inc', 4),
    ('Fechar Contrato', 'fechar_contrato_moni_inc', 5)
) AS f(nome, slug, ordem)
WHERE k.nome = 'Funil MonÃ­ INC'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.slug = f.slug
  );
-- 160: Checklist por fase â€” Funil MonÃ­ INC (idempotente por fase_id + label).
-- Tipos `data` / `hora` (alinhado Ã  161 em bases que jÃ¡ aplicaram apenas a 160 antiga).

ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
  CHECK (tipo IN (
    'texto_curto',
    'texto_longo',
    'email',
    'telefone',
    'numero',
    'anexo',
    'anexo_template',
    'checkbox',
    'data',
    'hora'
  ));

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans WHERE nome = 'Funil MonÃ­ INC' LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '160_checklist_fases_moni_inc: kanban Funil MonÃ­ INC nÃ£o encontrado; pulando.';
    RETURN;
  END IF;

  -- Primeiro Contato
  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'primeiro_contato_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NOT NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    SELECT v_fase_id, 1, 'Data da ReuniÃ£o', 'data', true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND label = 'Data da ReuniÃ£o'
    );
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    SELECT v_fase_id, 2, 'HorÃ¡rio da ReuniÃ£o', 'hora', true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND label = 'HorÃ¡rio da ReuniÃ£o'
    );
  END IF;

  -- R2 Apresentar Plano TeÃ³rico
  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'r2_plano_teorico_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NOT NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    SELECT v_fase_id, v.ordem, v.label, 'anexo', true, true
    FROM (VALUES (1, 'Ficha de Cadastro'), (2, 'Calculadora BCA'), (3, '1Âº Acoplamento')) AS v(ordem, label)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND label = v.label
    );
  END IF;

  -- R3 Ajustes Finais nas Propostas
  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'r3_ajustes_finais_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NOT NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    SELECT v_fase_id, 1, 'EmoU', 'anexo', true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND label = 'EmoU'
    );
  END IF;

  -- Fechar Contrato
  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'fechar_contrato_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NOT NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    SELECT v_fase_id, 1, 'Contrato', 'anexo', true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND label = 'Contrato'
    );
  END IF;
END $$;
-- 161: Tipos checklist `data` / `hora` + substituir item Ãºnico por dois campos (Funil MonÃ­ INC â€” Primeiro Contato).

ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
  CHECK (tipo IN (
    'texto_curto',
    'texto_longo',
    'email',
    'telefone',
    'numero',
    'anexo',
    'anexo_template',
    'checkbox',
    'data',
    'hora'
  ));

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans WHERE nome = 'Funil MonÃ­ INC' LIMIT 1;
  IF v_kanban_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'primeiro_contato_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND label = 'Data e HorÃ¡rio da ReuniÃ£o';

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
  SELECT v_fase_id, 1, 'Data da ReuniÃ£o', 'data', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND label = 'Data da ReuniÃ£o'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
  SELECT v_fase_id, 2, 'HorÃ¡rio da ReuniÃ£o', 'hora', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND label = 'HorÃ¡rio da ReuniÃ£o'
  );
END $$;
-- 162: sirene_chamados â€” vÃ­nculo opcional a card do kanban + prazo para ordenaÃ§Ã£o na lista.
-- Expande CHECK de tipo em kanban_atividades para incluir chamados Sirene espelhados na board.

ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_kanban_nome TEXT,
  ADD COLUMN IF NOT EXISTS card_titulo TEXT,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE;

COMMENT ON COLUMN public.sirene_chamados.card_id IS 'Card de kanban (nativo) vinculado ao chamado, se houver.';
COMMENT ON COLUMN public.sirene_chamados.card_kanban_nome IS 'Nome do kanban em kanbans.nome (para rota do funil).';
COMMENT ON COLUMN public.sirene_chamados.card_titulo IS 'TÃ­tulo do card no momento do vÃ­nculo.';
COMMENT ON COLUMN public.sirene_chamados.data_vencimento IS 'Prazo exibido na ordenaÃ§Ã£o da lista de chamados (opcional).';

CREATE INDEX IF NOT EXISTS idx_sirene_chamados_card_id
  ON public.sirene_chamados(card_id)
  WHERE card_id IS NOT NULL;

ALTER TABLE public.kanban_atividades DROP CONSTRAINT IF EXISTS kanban_atividades_tipo_check;

ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_tipo_check
  CHECK (tipo IN ('atividade', 'duvida', 'chamado_padrao', 'chamado_hdm'));

NOTIFY pgrst, 'reload schema';
-- 163: kanban_cards â€” garantir concluido/arquivado NOT NULL DEFAULT false
--      + policy SELECT para admin/team verem todos os cards (alÃ©m do dono).
--
-- Contexto: listagens usam .eq('concluido', false); valores NULL nÃ£o passam.
-- RLS: team precisa de ramo explÃ­cito; sÃ³ INSERT/UPDATE/DELETE tinham sido alargados na 162.

-- â”€â”€â”€ 1) Normalizar nulos (antes de NOT NULL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
UPDATE public.kanban_cards SET concluido = false WHERE concluido IS NULL;
UPDATE public.kanban_cards SET arquivado = false WHERE arquivado IS NULL;

-- â”€â”€â”€ 2) Defaults e NOT NULL (idempotente se jÃ¡ estiver correto) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_cards
  ALTER COLUMN concluido SET DEFAULT false,
  ALTER COLUMN concluido SET NOT NULL;

ALTER TABLE public.kanban_cards
  ALTER COLUMN arquivado SET DEFAULT false,
  ALTER COLUMN arquivado SET NOT NULL;

-- â”€â”€â”€ 3) SELECT: visÃ£o ampla (admin, team â€” pedido 163) + consultor/supervisor
--     para alinhar a `visaoAmplaCards` em funil-moni-inc/page.tsx e Step One.
DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;

CREATE POLICY "kanban_cards_select"
  ON public.kanban_cards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
    OR franqueado_id = auth.uid()
  );
-- Liga cada linha origem=sirene em kanban_atividades ao sirene_chamados correspondente
-- (backfill alinhado Ã  migration 120: criado_por + created_at).

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS sirene_chamado_id BIGINT REFERENCES public.sirene_chamados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.kanban_atividades.sirene_chamado_id IS
  'Quando origem = sirene, aponta para o registro em sirene_chamados (lista unificada / painel).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_atividades_sirene_chamado_id_unique
  ON public.kanban_atividades (sirene_chamado_id)
  WHERE sirene_chamado_id IS NOT NULL;

UPDATE public.kanban_atividades ka
SET sirene_chamado_id = sc.id
FROM public.sirene_chamados sc
WHERE ka.origem = 'sirene'
  AND ka.sirene_chamado_id IS NULL
  AND ka.criado_por IS NOT DISTINCT FROM sc.aberto_por
  AND ka.created_at = sc.created_at;

NOTIFY pgrst, 'reload schema';
-- ClassificaÃ§Ã£o do sub-chamado (paridade com formulÃ¡rio kanban / Sirene Chamados).

ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'atividade';

UPDATE public.sirene_topicos
SET tipo = 'atividade'
WHERE tipo IS NULL OR tipo NOT IN ('atividade', 'duvida', 'chamado');

ALTER TABLE public.sirene_topicos
  ALTER COLUMN tipo SET DEFAULT 'atividade',
  ALTER COLUMN tipo SET NOT NULL;

ALTER TABLE public.sirene_topicos DROP CONSTRAINT IF EXISTS sirene_topicos_tipo_check;
ALTER TABLE public.sirene_topicos
  ADD CONSTRAINT sirene_topicos_tipo_check
  CHECK (tipo IN ('atividade', 'duvida', 'chamado'));

COMMENT ON COLUMN public.sirene_topicos.tipo IS
  'Sub-chamado: atividade | duvida | chamado (UI alinhada ao kanban).';

NOTIFY pgrst, 'reload schema';
ALTER TABLE processo_step_one ADD COLUMN IF NOT EXISTS quadra text;
-- Adiciona item "Tabela de CondomÃ­nios" (tipo tabela) na fase "Dados da Cidade" do Funil Step One.
-- Ordem 10 porque os itens 6â€“9 jÃ¡ foram inseridos diretamente no PROD via SQL.
INSERT INTO kanban_fase_checklist_itens (fase_id, label, tipo, ordem, obrigatorio, visivel_candidato, placeholder)
VALUES (
  'cd8c2bc6-ea2e-4d38-8425-d39ae648b014',
  'Tabela de CondomÃ­nios',
  'tabela',
  10,
  true,
  true,
  'Preencha os dados dos condomÃ­nios do seu perÃ­metro'
);
ALTER TABLE kanban_fase_checklist_itens
DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE kanban_fase_checklist_itens
ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
CHECK (tipo = ANY (ARRAY[
  'texto_curto', 'texto_longo', 'email', 'telefone', 'numero',
  'anexo', 'anexo_template', 'checkbox', 'data', 'hora', 'tabela'
]));
-- Autor pode editar apenas o prÃ³prio comentÃ¡rio (RLS + grant).

DROP POLICY IF EXISTS "kanban_card_comentarios_update_autor" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_update_autor"
  ON public.kanban_card_comentarios
  FOR UPDATE
  TO authenticated
  USING (autor_id = auth.uid())
  WITH CHECK (autor_id = auth.uid());

GRANT UPDATE ON public.kanban_card_comentarios TO authenticated;
-- Tags por kanban e vÃ­nculo por card

CREATE TABLE IF NOT EXISTS public.kanban_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kanban_id uuid NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#F5A623',
  created_at timestamptz DEFAULT now(),
  UNIQUE(kanban_id, nome)
);

CREATE TABLE IF NOT EXISTS public.kanban_card_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.kanban_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(card_id, tag_id)
);

-- Autor pode excluir apenas o prÃ³prio comentÃ¡rio (RLS + grant).

DROP POLICY IF EXISTS "kanban_card_comentarios_delete_autor" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_delete_autor"
  ON public.kanban_card_comentarios
  FOR DELETE
  TO authenticated
  USING (autor_id = auth.uid());

GRANT DELETE ON public.kanban_card_comentarios TO authenticated;
-- Dados de negÃ³cio (condomÃ­nio / quadra / lote) em cards nativos sem processo vinculado.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS nome_condominio TEXT,
  ADD COLUMN IF NOT EXISTS quadra TEXT,
  ADD COLUMN IF NOT EXISTS lote TEXT;

COMMENT ON COLUMN public.kanban_cards.nome_condominio IS 'Nome do condomÃ­nio (dados do negÃ³cio no card nativo).';
COMMENT ON COLUMN public.kanban_cards.quadra IS 'Quadra (dados do negÃ³cio no card nativo).';
COMMENT ON COLUMN public.kanban_cards.lote IS 'Lote (dados do negÃ³cio no card nativo).';
-- Datas de reuniÃ£o e follow-up em cards nativos e processos (legado via view).

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS data_reuniao date,
  ADD COLUMN IF NOT EXISTS data_followup date;

COMMENT ON COLUMN public.kanban_cards.data_reuniao IS 'Data planejada de reuniÃ£o (card nativo).';
COMMENT ON COLUMN public.kanban_cards.data_followup IS 'Data de follow-up (card nativo).';

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS data_reuniao date,
  ADD COLUMN IF NOT EXISTS data_followup date;

COMMENT ON COLUMN public.processo_step_one.data_reuniao IS 'Data planejada de reuniÃ£o (processo / card legado).';
COMMENT ON COLUMN public.processo_step_one.data_followup IS 'Data de follow-up (processo / card legado).';

CREATE OR REPLACE VIEW public.v_processo_como_kanban_cards AS
SELECT
  p.id,
  kf.kanban_id,
  kf.id          AS fase_id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' - ', p.numero_franquia, p.nome_condominio)), ''),
    'Sem tÃ­tulo'
  )              AS titulo,
  p.status,
  p.created_at   AS criado_em,
  p.updated_at,
  p.user_id      AS responsavel_id,
  p.etapa_painel AS etapa_slug,
  p.data_reuniao,
  p.data_followup,
  NULL::date     AS data_prazo_sla,
  'legado'       AS origem
FROM public.processo_step_one p
JOIN public.kanban_fases kf ON kf.slug = p.etapa_painel
JOIN public.kanbans k       ON k.id   = kf.kanban_id
WHERE k.nome IN ('Funil PortfÃ³lio', 'Funil OperaÃ§Ãµes', 'Funil Contabilidade', 'Funil CrÃ©dito')
  AND p.cancelado_em IS NULL
  AND p.removido_em  IS NULL;

GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;
-- Arquivamento administrativo de chamados Sirene (lista unificada / painel).

ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento_sirene TEXT;

COMMENT ON COLUMN public.sirene_chamados.arquivado IS 'Chamado oculto da lista padrÃ£o; visÃ­vel com â€œMostrar arquivadosâ€ (admin/team).';
COMMENT ON COLUMN public.sirene_chamados.motivo_arquivamento_sirene IS 'Motivo obrigatÃ³rio informado ao arquivar.';

CREATE INDEX IF NOT EXISTS idx_sirene_chamados_arquivado
  ON public.sirene_chamados (arquivado)
  WHERE arquivado = true;
-- Arquivamento de interaÃ§Ãµes (kanban_atividades) e sub-interaÃ§Ãµes (sirene_topicos)

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

COMMENT ON COLUMN public.kanban_atividades.arquivado IS 'InteraÃ§Ã£o arquivada; oculta no modal atÃ© nova polÃ­tica de exibiÃ§Ã£o.';

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_arquivado
  ON public.kanban_atividades (arquivado)
  WHERE arquivado = true;

ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

COMMENT ON COLUMN public.sirene_topicos.arquivado IS 'Sub-chamado arquivado; oculto nas listas ativas.';

CREATE INDEX IF NOT EXISTS idx_sirene_topicos_arquivado
  ON public.sirene_topicos (arquivado)
  WHERE arquivado = true;
-- Garante o time MonÃ­ "Produto" em kanban_times (novo chamado / interaÃ§Ãµes usam UUID desta tabela).
INSERT INTO public.kanban_times (id, nome)
SELECT gen_random_uuid(), 'Produto'
WHERE NOT EXISTS (SELECT 1 FROM public.kanban_times WHERE nome = 'Produto');
-- 177: Funil PortfÃ³lio â€” coluna "CaptaÃ§Ã£o MonÃ­ Capital" entre Contrato (step_7) e Passagem para Wayser.
-- Idempotente: nÃ£o duplica se o slug jÃ¡ existir nesse kanban.

DO $$
DECLARE
  v_kanban_id uuid;
BEGIN
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil PortfÃ³lio' AND ativo = true
  ORDER BY id
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '177: kanban Funil PortfÃ³lio nÃ£o encontrado.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'captacao_moni_capital'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id
    AND ordem >= 9;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, ativo)
  VALUES (
    v_kanban_id,
    'CaptaÃ§Ã£o MonÃ­ Capital',
    'captacao_moni_capital',
    9,
    true
  );
END $$;

COMMENT ON COLUMN public.processo_step_one.etapa_painel IS
  'Etapa no Painel Novos NegÃ³cios: step_1, step_2, aprovacao_moni_novo_negocio, step_3, step_4, acoplamento, step_5, step_6, step_7, captacao_moni_capital, passagem_wayser, planialtimetrico, sondagem, projeto_legal, aprovacao_condominio, aprovacao_prefeitura, revisao_bca, processos_cartorarios, aguardando_credito, em_obra, moni_care, contabilidade_incorporadora, contabilidade_spe, contabilidade_gestora, credito_terreno, credito_obra';
-- Universidade MonÃ­: casas e mÃ³dulos do tabuleiro
-- (numeraÃ§Ã£o 178+ â€” evita colisÃ£o com migrations legadas 016*.)

create table if not exists public.uni_casas (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  numero      int not null,
  titulo      text not null,
  descricao   text,
  cor_tema    text,
  ativa       boolean default true,
  criado_em   timestamptz default now()
);

create table if not exists public.uni_modulos (
  id          uuid primary key default gen_random_uuid(),
  casa_id     uuid not null references public.uni_casas(id) on delete cascade,
  tipo        text not null check (tipo in ('video','checklist','quiz','template','leitura')),
  titulo      text not null,
  conteudo    jsonb,
  ordem       int not null,
  obrigatorio boolean default true,
  criado_em   timestamptz default now()
);

create index if not exists idx_uni_modulos_casa_ordem on public.uni_modulos (casa_id, ordem);
create index if not exists idx_uni_casas_numero on public.uni_casas (numero);
create index if not exists idx_uni_casas_ativa on public.uni_casas (ativa) where ativa = true;
-- Texto opcional por item de progresso (ex.: score 0â€“100 em item_id quiz_score na Casa 1).
-- SÃ³ roda se a tabela jÃ¡ existir (pode ser criada por migration posterior com timestamp em clones novos).
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'franqueado_onboarding_progresso'
  ) then
    alter table public.franqueado_onboarding_progresso
      add column if not exists conteudo text;
    comment on column public.franqueado_onboarding_progresso.conteudo is
      'Valor textual por item (ex.: quiz_score com nota do quiz no onboarding Casa 1).';
  end if;
end $$;
-- Universidade MonÃ­: progresso, entregas, biblioteca e certificados

create table if not exists public.uni_progresso (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  modulo_id    uuid not null references public.uni_modulos(id) on delete cascade,
  casa_id      uuid references public.uni_casas(id),
  status       text not null default 'pendente' check (status in ('pendente','em_progresso','concluido')),
  dados        jsonb,
  nota         int check (nota between 0 and 100),
  concluido_em timestamptz,
  criado_em    timestamptz default now(),
  unique(user_id, modulo_id)
);

create table if not exists public.uni_entregas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  casa_id      uuid references public.uni_casas(id),
  modulo_id    uuid references public.uni_modulos(id),
  tipo         text check (tipo in ('arquivo','link','texto')),
  valor        text,
  aprovado     boolean,
  aprovado_por uuid references auth.users(id),
  criado_em    timestamptz default now()
);

create table if not exists public.uni_biblioteca (
  id           uuid primary key default gen_random_uuid(),
  categoria    text not null,
  titulo       text not null,
  descricao    text,
  tipo         text check (tipo in ('arquivo','link','video')),
  url          text,
  tags         text[],
  visivel_para text[] default '{frank,team,admin}',
  criado_em    timestamptz default now()
);

create table if not exists public.uni_certificados (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nivel       int not null check (nivel between 1 and 5),
  titulo      text not null,
  emitido_em  timestamptz default now(),
  unique(user_id, nivel)
);

create index if not exists idx_uni_progresso_user on public.uni_progresso (user_id);
create index if not exists idx_uni_progresso_modulo on public.uni_progresso (modulo_id);
create index if not exists idx_uni_entregas_user on public.uni_entregas (user_id);
create index if not exists idx_uni_entregas_aprovado_null on public.uni_entregas (aprovado) where aprovado is null;
create index if not exists idx_uni_biblioteca_categoria on public.uni_biblioteca (categoria);
create index if not exists idx_uni_certificados_user on public.uni_certificados (user_id);
-- RLS Universidade + sincronizaÃ§Ã£o de certificados (sem INSERT direto para franqueado)

-- Garante casa_id a partir do mÃ³dulo
create or replace function public.uni_progresso_set_casa_id()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.casa_id is null and new.modulo_id is not null then
    select m.casa_id into new.casa_id from public.uni_modulos m where m.id = new.modulo_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_uni_progresso_set_casa on public.uni_progresso;
create trigger tr_uni_progresso_set_casa
  before insert or update of modulo_id, casa_id on public.uni_progresso
  for each row
  execute procedure public.uni_progresso_set_casa_id();

-- Sincroniza certificados nÃ­veis 1â€“5 conforme conclusÃ£o das casas (obrigatÃ³rios)
create or replace function public.uni_sync_certificados(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  my_role text;
  l1 boolean;
  l2 boolean;
  l3 boolean;
  l4 boolean;
  l5 boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  my_role := public.get_my_role();
  if auth.uid() <> p_user_id and my_role not in ('admin', 'team') then
    raise exception 'forbidden';
  end if;

  select
    not exists (
      select 1
      from public.uni_modulos m
      join public.uni_casas c on c.id = m.casa_id and c.numero = 0 and c.ativa = true
      where m.obrigatorio = true
        and not exists (
          select 1 from public.uni_progresso p
          where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
        )
    )
    and not exists (
      select 1
      from public.uni_modulos m
      join public.uni_casas c on c.id = m.casa_id and c.numero = 1 and c.ativa = true
      where m.obrigatorio = true
        and not exists (
          select 1 from public.uni_progresso p
          where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
        )
    )
  into l1;

  select not exists (
    select 1
    from public.uni_modulos m
    join public.uni_casas c on c.id = m.casa_id and c.numero = 2 and c.ativa = true
    where m.obrigatorio = true
      and not exists (
        select 1 from public.uni_progresso p
        where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
      )
  ) into l2;

  select not exists (
    select 1
    from public.uni_modulos m
    join public.uni_casas c on c.id = m.casa_id and c.numero = 3 and c.ativa = true
    where m.obrigatorio = true
      and not exists (
        select 1 from public.uni_progresso p
        where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
      )
  ) into l3;

  select
    not exists (
      select 1
      from public.uni_modulos m
      join public.uni_casas c on c.id = m.casa_id and c.numero = 4 and c.ativa = true
      where m.obrigatorio = true
        and not exists (
          select 1 from public.uni_progresso p
          where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
        )
    )
    and not exists (
      select 1
      from public.uni_modulos m
      join public.uni_casas c on c.id = m.casa_id and c.numero = 5 and c.ativa = true
      where m.obrigatorio = true
        and not exists (
          select 1 from public.uni_progresso p
          where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
        )
    )
  into l4;

  select
    not exists (
      select 1
      from public.uni_modulos m
      join public.uni_casas c on c.id = m.casa_id and c.numero in (6, 7, 8, 9) and c.ativa = true
      where m.obrigatorio = true
        and not exists (
          select 1 from public.uni_progresso p
          where p.user_id = p_user_id and p.modulo_id = m.id and p.status = 'concluido'
        )
    )
  into l5;

  if l1 then
    insert into public.uni_certificados (user_id, nivel, titulo)
    values (p_user_id, 1, 'Fundamentos')
    on conflict (user_id, nivel) do nothing;
  end if;
  if l2 then
    insert into public.uni_certificados (user_id, nivel, titulo)
    values (p_user_id, 2, 'Step One')
    on conflict (user_id, nivel) do nothing;
  end if;
  if l3 then
    insert into public.uni_certificados (user_id, nivel, titulo)
    values (p_user_id, 3, 'BCA e hipÃ³tese')
    on conflict (user_id, nivel) do nothing;
  end if;
  if l4 then
    insert into public.uni_certificados (user_id, nivel, titulo)
    values (p_user_id, 4, 'NegociaÃ§Ã£o')
    on conflict (user_id, nivel) do nothing;
  end if;
  if l5 then
    insert into public.uni_certificados (user_id, nivel, titulo)
    values (p_user_id, 5, 'OperaÃ§Ã£o completa')
    on conflict (user_id, nivel) do nothing;
  end if;
end;
$$;

grant execute on function public.uni_sync_certificados(uuid) to authenticated;

-- RLS
alter table public.uni_casas enable row level security;
alter table public.uni_modulos enable row level security;
alter table public.uni_progresso enable row level security;
alter table public.uni_entregas enable row level security;
alter table public.uni_biblioteca enable row level security;
alter table public.uni_certificados enable row level security;

-- uni_casas
drop policy if exists uni_casas_select_auth on public.uni_casas;
create policy uni_casas_select_auth on public.uni_casas for select to authenticated using (true);

drop policy if exists uni_casas_write_staff on public.uni_casas;
create policy uni_casas_write_staff on public.uni_casas for all to authenticated
  using (public.get_my_role() in ('admin', 'team'))
  with check (public.get_my_role() in ('admin', 'team'));

-- uni_modulos
drop policy if exists uni_modulos_select_auth on public.uni_modulos;
create policy uni_modulos_select_auth on public.uni_modulos for select to authenticated using (true);

drop policy if exists uni_modulos_write_staff on public.uni_modulos;
create policy uni_modulos_write_staff on public.uni_modulos for all to authenticated
  using (public.get_my_role() in ('admin', 'team'))
  with check (public.get_my_role() in ('admin', 'team'));

-- uni_progresso
drop policy if exists uni_progresso_select_own on public.uni_progresso;
create policy uni_progresso_select_own on public.uni_progresso for select to authenticated
  using (user_id = auth.uid());

drop policy if exists uni_progresso_select_staff on public.uni_progresso;
create policy uni_progresso_select_staff on public.uni_progresso for select to authenticated
  using (public.get_my_role() in ('admin', 'team'));

drop policy if exists uni_progresso_insert_own on public.uni_progresso;
create policy uni_progresso_insert_own on public.uni_progresso for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists uni_progresso_update_own on public.uni_progresso;
create policy uni_progresso_update_own on public.uni_progresso for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- uni_entregas
drop policy if exists uni_entregas_select_own on public.uni_entregas;
create policy uni_entregas_select_own on public.uni_entregas for select to authenticated
  using (user_id = auth.uid());

drop policy if exists uni_entregas_select_staff on public.uni_entregas;
create policy uni_entregas_select_staff on public.uni_entregas for select to authenticated
  using (public.get_my_role() in ('admin', 'team'));

drop policy if exists uni_entregas_insert_own on public.uni_entregas;
create policy uni_entregas_insert_own on public.uni_entregas for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists uni_entregas_update_staff on public.uni_entregas;
create policy uni_entregas_update_staff on public.uni_entregas for update to authenticated
  using (public.get_my_role() in ('admin', 'team'))
  with check (public.get_my_role() in ('admin', 'team'));

-- uni_biblioteca (visivel_para guarda papÃ©is: frank, team, admin)
drop policy if exists uni_biblioteca_select on public.uni_biblioteca;
create policy uni_biblioteca_select on public.uni_biblioteca for select to authenticated
  using (
    public.get_my_role() in ('admin', 'team')
    or public.get_my_role()::text = any (coalesce(visivel_para, array[]::text[]))
  );

drop policy if exists uni_biblioteca_write_staff on public.uni_biblioteca;
create policy uni_biblioteca_write_staff on public.uni_biblioteca for all to authenticated
  using (public.get_my_role() in ('admin', 'team'))
  with check (public.get_my_role() in ('admin', 'team'));

-- uni_certificados: sÃ³ leitura do dono; inserts via uni_sync_certificados (definer)
drop policy if exists uni_certificados_select_own on public.uni_certificados;
create policy uni_certificados_select_own on public.uni_certificados for select to authenticated
  using (user_id = auth.uid());

drop policy if exists uni_certificados_select_staff on public.uni_certificados;
create policy uni_certificados_select_staff on public.uni_certificados for select to authenticated
  using (public.get_my_role() in ('admin', 'team'));
-- 181: Renomear kanban Â«Funil MonÃ­ INCÂ» â†’ Â«Funil LoteadoresÂ» (rÃ³tulo e registro em produÃ§Ã£o).
UPDATE public.kanbans
SET
  nome = 'Funil Loteadores',
  descricao = 'Funil de qualificaÃ§Ã£o â€” loteadores'
WHERE nome = 'Funil MonÃ­ INC';
-- 182: Garante o time MonÃ­ Â«PortfÃ³lioÂ» em kanban_times (novo chamado / atividades em todos os funis).
INSERT INTO public.kanban_times (id, nome)
SELECT gen_random_uuid(), 'PortfÃ³lio'
WHERE NOT EXISTS (SELECT 1 FROM public.kanban_times WHERE nome = 'PortfÃ³lio');
-- 183: Documentos internos na biblioteca (slug + ativo) e Carta FianÃ§a (pre-obra).

alter table public.uni_biblioteca
  add column if not exists slug text,
  add column if not exists ativo boolean not null default true;

alter table public.uni_biblioteca drop constraint if exists uni_biblioteca_tipo_check;

alter table public.uni_biblioteca
  add constraint uni_biblioteca_tipo_check
  check (tipo in ('arquivo', 'link', 'video', 'documento-interno'));

create unique index if not exists idx_uni_biblioteca_slug_unique
  on public.uni_biblioteca (slug)
  where slug is not null and btrim(slug) <> '';

comment on column public.uni_biblioteca.slug is
  'Rota interna em /universidade/ferramentas/[slug] quando tipo = documento-interno.';

comment on column public.uni_biblioteca.ativo is
  'false oculta o item na biblioteca (mantÃ©m histÃ³rico).';

insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, slug, tags, visivel_para, ativo)
select
  'pre-obra',
  'Carta FianÃ§a',
  'Entenda como a Carta FianÃ§a se encaixa na operaÃ§Ã£o e como a MonÃ­ pode recomendar formas de viabilizÃ¡-la. Cobre: o que Ã©, quando contratar, como viabilizar o pagamento e o impacto no VGV.',
  'documento-interno',
  null,
  'carta-fianca',
  array['pre-obra', 'carta-fianca', 'funding', 'garantia', 'vgv'],
  array['frank', 'team', 'admin']::text[],
  true
where not exists (
  select 1 from public.uni_biblioteca where slug = 'carta-fianca'
);
-- 184: Documento interno MonÃ­ Capital (pre-obra).

insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, slug, tags, visivel_para, ativo)
select
  'pre-obra',
  'MonÃ­ Capital',
  'CaptaÃ§Ã£o de recursos para o seu projeto sem tirar dinheiro do bolso. ConheÃ§a a plataforma de captaÃ§Ã£o privada da rede MonÃ­: contexto, regras, passo a passo e materiais necessÃ¡rios.',
  'documento-interno',
  null,
  'moni-capital',
  array['pre-obra', 'moni-capital', 'captaÃ§Ã£o', 'funding', 'spe'],
  array['frank', 'team', 'admin']::text[],
  true
where not exists (
  select 1 from public.uni_biblioteca where slug = 'moni-capital'
);
-- Dados do NegÃ³cio no modal Kanban: links e anexos em processo_step_one.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS link_bca TEXT,
  ADD COLUMN IF NOT EXISTS link_mapa_competidores TEXT,
  ADD COLUMN IF NOT EXISTS link_acoplamento TEXT,
  ADD COLUMN IF NOT EXISTS link_apresentacao_comite TEXT,
  ADD COLUMN IF NOT EXISTS anexo_opcao_permuta_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_contrato_permuta_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_seguro_garantia_path TEXT;

COMMENT ON COLUMN public.processo_step_one.link_bca IS 'Link do BCA (dados do negÃ³cio).';
COMMENT ON COLUMN public.processo_step_one.link_mapa_competidores IS 'Link do mapa de competidores.';
COMMENT ON COLUMN public.processo_step_one.link_acoplamento IS 'Link de acoplamento.';
COMMENT ON COLUMN public.processo_step_one.link_apresentacao_comite IS 'Link da apresentaÃ§Ã£o do comitÃª.';
COMMENT ON COLUMN public.processo_step_one.anexo_opcao_permuta_path IS 'Storage path (processo-docs) â€” opÃ§Ã£o de permuta.';
COMMENT ON COLUMN public.processo_step_one.anexo_contrato_permuta_path IS 'Storage path (processo-docs) â€” contrato de permuta.';
COMMENT ON COLUMN public.processo_step_one.anexo_seguro_garantia_path IS 'Storage path (processo-docs) â€” seguro garantia.';
-- Dados do NegÃ³cio: links e comentÃ¡rios MonÃ­ Capital.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS link_moni_capital_seguro_garantia TEXT,
  ADD COLUMN IF NOT EXISTS comentario_moni_capital_seguro_garantia TEXT,
  ADD COLUMN IF NOT EXISTS link_moni_capital_gastos_aporte_inicial TEXT,
  ADD COLUMN IF NOT EXISTS comentario_moni_capital_gastos_aporte_inicial TEXT;

COMMENT ON COLUMN public.processo_step_one.link_moni_capital_seguro_garantia IS 'Link MonÃ­ Capital â€” seguro garantia.';
COMMENT ON COLUMN public.processo_step_one.comentario_moni_capital_seguro_garantia IS 'ComentÃ¡rios sobre MonÃ­ Capital â€” seguro garantia.';
COMMENT ON COLUMN public.processo_step_one.link_moni_capital_gastos_aporte_inicial IS 'Link MonÃ­ Capital â€” gastos de aporte inicial.';
COMMENT ON COLUMN public.processo_step_one.comentario_moni_capital_gastos_aporte_inicial IS 'ComentÃ¡rios sobre MonÃ­ Capital â€” gastos de aporte inicial.';
-- Snapshot de indicadores atingÃ­veis (substitui schema legado periodo_id + conquista da 090).
-- Idempotente: adiciona colunas usadas pelo Gantt/Conquistas sem dropar dados antigos.

ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas(id) ON DELETE CASCADE;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS unidade text;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS prazo_original text;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS data_conclusao timestamptz DEFAULT now();
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS semana_conclusao int;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS ano_iso_conclusao int;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS ultimo_valor text;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS no_prazo boolean DEFAULT true;

UPDATE indicador_conquistas ic
SET nome = COALESCE(ic.nome, ic.conquista, 'Indicador')
WHERE ic.nome IS NULL;

UPDATE indicador_conquistas ic
SET area_id = i.area_id
FROM indicadores i
WHERE ic.indicador_id = i.id AND ic.area_id IS NULL AND i.area_id IS NOT NULL;

UPDATE indicador_conquistas
SET data_conclusao = COALESCE(data_conclusao, criado_em, now())
WHERE data_conclusao IS NULL;

UPDATE indicador_conquistas
SET semana_conclusao = COALESCE(semana_conclusao, 1)
WHERE semana_conclusao IS NULL;

UPDATE indicador_conquistas
SET no_prazo = COALESCE(no_prazo, true)
WHERE no_prazo IS NULL;

ALTER TABLE indicador_conquistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "indicador_conquistas_select" ON indicador_conquistas;
DROP POLICY IF EXISTS "indicador_conquistas_insert" ON indicador_conquistas;
DROP POLICY IF EXISTS "Allow all for authenticated" ON indicador_conquistas;

CREATE POLICY "indicador_conquistas_select" ON indicador_conquistas FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "indicador_conquistas_insert" ON indicador_conquistas FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "indicador_conquistas_update" ON indicador_conquistas FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "indicador_conquistas_delete" ON indicador_conquistas FOR DELETE TO authenticated, anon USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE indicador_conquistas TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
-- Status de Preenchimento â€” registros semanais por Ã¡rea e usuÃ¡rio
CREATE TABLE IF NOT EXISTS status_preenchimento_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id),
  usuario_id uuid NOT NULL REFERENCES auth.users(id),
  semana_iso int NOT NULL,
  ano int NOT NULL,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('ok', 'nok')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_preenchimento_area_semana
  ON status_preenchimento_registros (area_id, semana_iso, ano);

CREATE INDEX IF NOT EXISTS idx_status_preenchimento_usuario
  ON status_preenchimento_registros (usuario_id, semana_iso, ano);

ALTER TABLE status_preenchimento_registros ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON status_preenchimento_registros TO authenticated;
GRANT SELECT ON status_preenchimento_registros TO anon;

DROP POLICY IF EXISTS "select_all" ON status_preenchimento_registros;
DROP POLICY IF EXISTS "insert_authenticated" ON status_preenchimento_registros;

CREATE POLICY "select_all" ON status_preenchimento_registros
  FOR SELECT USING (true);

CREATE POLICY "insert_authenticated" ON status_preenchimento_registros
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
-- Permite exclusÃ£o (desfazer registro) para usuÃ¡rios autenticados
GRANT DELETE ON status_preenchimento_registros TO authenticated;

DROP POLICY IF EXISTS "delete_authenticated" ON status_preenchimento_registros;

CREATE POLICY "delete_authenticated" ON status_preenchimento_registros
  FOR DELETE USING (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
-- JurÃ­dico: identificaÃ§Ãµes no planejamento Gantt
CREATE TABLE IF NOT EXISTS juridico_identificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('franqueado', 'candidato', 'inc_nuvem', 'interno')),
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS juridico_identificacao_id uuid REFERENCES juridico_identificacoes(id),
  ADD COLUMN IF NOT EXISTS juridico_tipo text CHECK (
    juridico_tipo IS NULL OR
    juridico_tipo IN ('franqueado', 'candidato', 'inc_nuvem', 'interno')
  );

ALTER TABLE juridico_identificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "juridico_identificacoes_select" ON juridico_identificacoes;
DROP POLICY IF EXISTS "juridico_identificacoes_insert" ON juridico_identificacoes;
DROP POLICY IF EXISTS "juridico_identificacoes_update" ON juridico_identificacoes;
CREATE POLICY "juridico_identificacoes_select" ON juridico_identificacoes FOR SELECT USING (true);
CREATE POLICY "juridico_identificacoes_insert" ON juridico_identificacoes FOR INSERT WITH CHECK (true);
CREATE POLICY "juridico_identificacoes_update" ON juridico_identificacoes FOR UPDATE USING (true);

NOTIFY pgrst, 'reload schema';
CREATE TABLE IF NOT EXISTS controladoria_cnpjs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  descritivo text NOT NULL,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS controladoria_cnpj_id uuid REFERENCES controladoria_cnpjs(id);

GRANT ALL ON TABLE controladoria_cnpjs TO anon;
GRANT ALL ON TABLE controladoria_cnpjs TO authenticated;

ALTER TABLE controladoria_cnpjs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_controladoria_cnpjs" ON controladoria_cnpjs;
CREATE POLICY "allow_all_controladoria_cnpjs"
  ON controladoria_cnpjs FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
CREATE TABLE IF NOT EXISTS acoplamento_franqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

GRANT ALL ON TABLE acoplamento_franqueados TO anon;
GRANT ALL ON TABLE acoplamento_franqueados TO authenticated;

ALTER TABLE acoplamento_franqueados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_acoplamento_franqueados" ON acoplamento_franqueados;
CREATE POLICY "allow_all_acoplamento_franqueados"
  ON acoplamento_franqueados FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
-- Franqueados por Ã¡rea (listas independentes; Acoplamento permanece em acoplamento_franqueados)

CREATE TABLE IF NOT EXISTS executivos_locais_franqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wayzer_nath_franqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wayzer_rafa_franqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

GRANT ALL ON TABLE executivos_locais_franqueados TO anon;
GRANT ALL ON TABLE executivos_locais_franqueados TO authenticated;
ALTER TABLE executivos_locais_franqueados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_executivos_locais_franqueados" ON executivos_locais_franqueados;
CREATE POLICY "allow_all_executivos_locais_franqueados"
  ON executivos_locais_franqueados FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE wayzer_nath_franqueados TO anon;
GRANT ALL ON TABLE wayzer_nath_franqueados TO authenticated;
ALTER TABLE wayzer_nath_franqueados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_wayzer_nath_franqueados" ON wayzer_nath_franqueados;
CREATE POLICY "allow_all_wayzer_nath_franqueados"
  ON wayzer_nath_franqueados FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE wayzer_rafa_franqueados TO anon;
GRANT ALL ON TABLE wayzer_rafa_franqueados TO authenticated;
ALTER TABLE wayzer_rafa_franqueados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_wayzer_rafa_franqueados" ON wayzer_rafa_franqueados;
CREATE POLICY "allow_all_wayzer_rafa_franqueados"
  ON wayzer_rafa_franqueados FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
CREATE TABLE IF NOT EXISTS comercial_candidatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

GRANT ALL ON TABLE comercial_candidatos TO anon;
GRANT ALL ON TABLE comercial_candidatos TO authenticated;

ALTER TABLE comercial_candidatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_comercial_candidatos" ON comercial_candidatos;
CREATE POLICY "allow_all_comercial_candidatos"
  ON comercial_candidatos FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS comercial_candidato_id uuid REFERENCES comercial_candidatos(id);

NOTIFY pgrst, 'reload schema';
CREATE TABLE IF NOT EXISTS portfolio_franqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

GRANT ALL ON TABLE portfolio_franqueados TO anon;
GRANT ALL ON TABLE portfolio_franqueados TO authenticated;

ALTER TABLE portfolio_franqueados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_portfolio_franqueados" ON portfolio_franqueados;
CREATE POLICY "allow_all_portfolio_franqueados"
  ON portfolio_franqueados FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS portfolio_franqueado_id uuid REFERENCES portfolio_franqueados(id);

NOTIFY pgrst, 'reload schema';
-- Migration 196: correcoes pos-deploy Carometro PROD
-- Aplicadas manualmente no iad-prod em 22/05/2026
-- Documentadas aqui para rastreabilidade

-- recorrencias_atividade: tabela faltando na migration 090
CREATE TABLE IF NOT EXISTS recorrencias_atividade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid REFERENCES acoes(id) ON DELETE CASCADE,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE,
  criado_em timestamptz DEFAULT now(),
  ordem int DEFAULT 0,
  descricao text,
  ativo boolean DEFAULT true
);
GRANT ALL ON TABLE recorrencias_atividade TO anon, authenticated;
ALTER TABLE recorrencias_atividade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_recorrencias_atividade" ON recorrencias_atividade;
CREATE POLICY "allow_all_recorrencias_atividade" ON recorrencias_atividade FOR ALL USING (true) WITH CHECK (true);

-- objetivos: colunas faltando
ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS concluido_em timestamptz;
ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS comentario_conclusao text;
ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo';

-- indicadores: colunas faltando
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'quantitativo';
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo';
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS regra_verde_escuro numeric;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS regra_verde_claro numeric;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS regra_amarelo numeric;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS regra_verde_escuro_op text;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS regra_verde_claro_op text;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS regra_amarelo_op text;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS semaforo_faixas jsonb;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS objetivo_id uuid REFERENCES objetivos(id) ON DELETE SET NULL;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS meta_ciclo_tipo text;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS meta_unidade text;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS concluido_em timestamptz;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS comentario_conclusao text;

-- tarefas: colunas faltando
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS objetivo_id uuid REFERENCES objetivos(id) ON DELETE SET NULL;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS caneta_verde text DEFAULT 'nao';
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS recorrencia text;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS multiplicador_valor numeric;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS multiplicador_tipo text;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS tipo_atividade text;

-- gantt_planejamento: colunas faltando
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS adm_cnpj_id uuid;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS wayzer_nath_franqueado_id uuid;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS wayzer_rafa_franqueado_id uuid;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS executivos_locais_franqueado_id uuid;

-- multiplicador_tipos: colunas faltando
ALTER TABLE multiplicador_tipos ADD COLUMN IF NOT EXISTS codigo text;
ALTER TABLE multiplicador_tipos ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;
ALTER TABLE multiplicador_tipos ADD COLUMN IF NOT EXISTS ordem int DEFAULT 0;
UPDATE multiplicador_tipos SET codigo = LOWER(REPLACE(nome, ' ', '_')) WHERE codigo IS NULL;

NOTIFY pgrst, 'reload schema';
-- =============================================================================
-- Pastelaria â€” cards, horas semanais, reclassificaÃ§Ãµes e log (Gantt / CarÃ´metro)
-- Execute no Supabase â†’ SQL Editor â†’ Run (uma vez).
-- PrÃ©-requisito: tabela `areas` existente.
-- Depois: NOTIFY pgrst, 'reload schema';
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pastelaria_cards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                text NOT NULL,
  area_id             uuid REFERENCES areas(id) ON DELETE SET NULL,
  estimativa_valor    numeric NOT NULL DEFAULT 1,
  estimativa_unidade  text NOT NULL DEFAULT 'h'
                        CHECK (estimativa_unidade IN ('h','min')),
  coluna              text NOT NULL DEFAULT 'mapped'
                        CHECK (coluna IN ('inbox','mapped','doing','done')),
  semana_origem       text NOT NULL,
  source              text,
  opened_by           text,
  completed_week      text,
  reclassificado              boolean DEFAULT false,
  reclassificado_em           timestamptz,
  reclassificado_destino      text,
  reclassificado_justificativa text,
  responsavel_id      uuid REFERENCES area_pessoas(id) ON DELETE SET NULL,
  responsavel_nome    text,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pastelaria_horas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    uuid NOT NULL REFERENCES pastelaria_cards(id) ON DELETE CASCADE,
  semana     text NOT NULL,
  seg        numeric DEFAULT 0,
  ter        numeric DEFAULT 0,
  qua        numeric DEFAULT 0,
  qui        numeric DEFAULT 0,
  sex        numeric DEFAULT 0,
  unidade    text DEFAULT 'h' CHECK (unidade IN ('h','min')),
  seg_unidade text DEFAULT 'h' CHECK (seg_unidade IN ('h','min')),
  ter_unidade text DEFAULT 'h' CHECK (ter_unidade IN ('h','min')),
  qua_unidade text DEFAULT 'h' CHECK (qua_unidade IN ('h','min')),
  qui_unidade text DEFAULT 'h' CHECK (qui_unidade IN ('h','min')),
  sex_unidade text DEFAULT 'h' CHECK (sex_unidade IN ('h','min')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(card_id, semana)
);

CREATE TABLE IF NOT EXISTS pastelaria_reclassificacoes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id              uuid REFERENCES pastelaria_cards(id) ON DELETE SET NULL,
  action               text NOT NULL CHECK (action IN ('redirect','return')),
  destino              text,
  justificativa        text NOT NULL,
  reclassificado_por   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pastelaria_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    uuid REFERENCES pastelaria_cards(id) ON DELETE SET NULL,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acao       text NOT NULL CHECK (acao IN (
    'criado', 'coluna_alterada', 'aceito', 'reclassificado',
    'horas_registradas', 'editado', 'excluido', 'pessoa_adicionada'
  )),
  detalhes   jsonb,
  created_at timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. Ãndices
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_area     ON pastelaria_cards(area_id);
CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_coluna   ON pastelaria_cards(coluna);
CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_semana   ON pastelaria_cards(completed_week);
CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_reclass ON pastelaria_cards(reclassificado);
CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_responsavel ON pastelaria_cards(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_pastelaria_horas_card     ON pastelaria_horas(card_id);
CREATE INDEX IF NOT EXISTS idx_pastelaria_horas_semana   ON pastelaria_horas(semana);
CREATE INDEX IF NOT EXISTS idx_pastelaria_log_card       ON pastelaria_log(card_id);
CREATE INDEX IF NOT EXISTS idx_pastelaria_log_created    ON pastelaria_log(created_at);

-- -----------------------------------------------------------------------------
-- 3. Triggers updated_at (mesmo padrÃ£o de supabase/migrations/103_atividades_kanban.sql)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_pastelaria_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pastelaria_cards_updated_at ON pastelaria_cards;
CREATE TRIGGER trigger_update_pastelaria_cards_updated_at
  BEFORE UPDATE ON pastelaria_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_pastelaria_cards_updated_at();

CREATE OR REPLACE FUNCTION update_pastelaria_horas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pastelaria_horas_updated_at ON pastelaria_horas;
CREATE TRIGGER trigger_update_pastelaria_horas_updated_at
  BEFORE UPDATE ON pastelaria_horas
  FOR EACH ROW
  EXECUTE FUNCTION update_pastelaria_horas_updated_at();

-- -----------------------------------------------------------------------------
-- 4. RLS (padrÃ£o supabase-gantt-planejamento-rls.sql / supabase-comentarios-rls.sql)
-- -----------------------------------------------------------------------------

ALTER TABLE pastelaria_cards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastelaria_horas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastelaria_reclassificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastelaria_log              ENABLE ROW LEVEL SECURITY;

-- pastelaria_cards e pastelaria_horas: autenticados podem tudo (polÃ­ticas permissivas)
DROP POLICY IF EXISTS "pastelaria_cards_select" ON pastelaria_cards;
DROP POLICY IF EXISTS "pastelaria_cards_insert" ON pastelaria_cards;
DROP POLICY IF EXISTS "pastelaria_cards_update" ON pastelaria_cards;
DROP POLICY IF EXISTS "pastelaria_cards_delete" ON pastelaria_cards;

CREATE POLICY "pastelaria_cards_select" ON pastelaria_cards FOR SELECT USING (true);
CREATE POLICY "pastelaria_cards_insert" ON pastelaria_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "pastelaria_cards_update" ON pastelaria_cards FOR UPDATE USING (true);
CREATE POLICY "pastelaria_cards_delete" ON pastelaria_cards FOR DELETE USING (true);

DROP POLICY IF EXISTS "pastelaria_horas_select" ON pastelaria_horas;
DROP POLICY IF EXISTS "pastelaria_horas_insert" ON pastelaria_horas;
DROP POLICY IF EXISTS "pastelaria_horas_update" ON pastelaria_horas;
DROP POLICY IF EXISTS "pastelaria_horas_delete" ON pastelaria_horas;

CREATE POLICY "pastelaria_horas_select" ON pastelaria_horas FOR SELECT USING (true);
CREATE POLICY "pastelaria_horas_insert" ON pastelaria_horas FOR INSERT WITH CHECK (true);
CREATE POLICY "pastelaria_horas_update" ON pastelaria_horas FOR UPDATE USING (true);
CREATE POLICY "pastelaria_horas_delete" ON pastelaria_horas FOR DELETE USING (true);

-- pastelaria_reclassificacoes e pastelaria_log: INSERT autenticado, SELECT sÃ³ service_role
DROP POLICY IF EXISTS "pastelaria_reclassificacoes_insert" ON pastelaria_reclassificacoes;
DROP POLICY IF EXISTS "pastelaria_reclassificacoes_select" ON pastelaria_reclassificacoes;

CREATE POLICY "pastelaria_reclassificacoes_insert" ON pastelaria_reclassificacoes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "pastelaria_reclassificacoes_select" ON pastelaria_reclassificacoes
  FOR SELECT USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "pastelaria_log_insert" ON pastelaria_log;
DROP POLICY IF EXISTS "pastelaria_log_select" ON pastelaria_log;

CREATE POLICY "pastelaria_log_insert" ON pastelaria_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "pastelaria_log_select" ON pastelaria_log
  FOR SELECT USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 4.1 GRANTs (obrigatÃ³rio com RLS â€” sem isso: "permission denied for table")
-- PadrÃ£o: supabase/migrations/187_indicador_conquistas_snapshot.sql
-- -----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pastelaria_cards TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pastelaria_horas TO anon, authenticated;
GRANT INSERT ON TABLE public.pastelaria_reclassificacoes TO authenticated;
GRANT INSERT ON TABLE public.pastelaria_log TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. View pastelaria_gantt_semanas (bloco de visualizaÃ§Ã£o no Gantt)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.pastelaria_gantt_semanas AS
WITH cards_ativos AS (
  SELECT
    c.id,
    c.nome,
    c.coluna,
    c.completed_week,
    c.semana_origem,
    c.responsavel_id,
    c.responsavel_nome,
    a.nome AS area_nome,
    ap.nome AS responsavel_pessoa_nome
  FROM pastelaria_cards c
  LEFT JOIN areas a ON a.id = c.area_id
  LEFT JOIN area_pessoas ap ON ap.id = c.responsavel_id
  WHERE c.coluna IN ('done', 'doing')
    AND COALESCE(c.reclassificado, false) = false
),
base AS (
  SELECT
    COALESCE(h.semana, ca.semana_origem) AS semana,
    ca.id,
    ca.nome,
    ca.area_nome,
    ca.coluna,
    ca.completed_week,
    COALESCE(ca.responsavel_pessoa_nome, ca.responsavel_nome) AS responsavel_nome,
    jsonb_build_object(
      'seg', COALESCE(h.seg, 0),
      'ter', COALESCE(h.ter, 0),
      'qua', COALESCE(h.qua, 0),
      'qui', COALESCE(h.qui, 0),
      'sex', COALESCE(h.sex, 0)
    ) AS horas_por_semana,
    (
      COALESCE(h.seg, 0) + COALESCE(h.ter, 0) + COALESCE(h.qua, 0)
      + COALESCE(h.qui, 0) + COALESCE(h.sex, 0)
    ) AS total_horas_semana
  FROM cards_ativos ca
  LEFT JOIN pastelaria_horas h ON h.card_id = ca.id
)
SELECT
  semana,
  COUNT(*)::bigint AS total_cards,
  SUM(total_horas_semana) AS total_horas,
  jsonb_agg(
    jsonb_build_object(
      'id', id,
      'nome', nome,
      'area_nome', area_nome,
      'coluna', coluna,
      'completed_week', completed_week,
      'responsavel_nome', responsavel_nome,
      'horas_por_semana', horas_por_semana,
      'total_horas_semana', total_horas_semana
    )
    ORDER BY nome
  ) AS cards
FROM base
GROUP BY semana
ORDER BY semana;

GRANT SELECT ON public.pastelaria_gantt_semanas TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- ConferÃªncia no SQL Editor (opcional):
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name LIKE 'pastelaria%'
--   ORDER BY table_name;
-- SELECT table_name FROM information_schema.views
--   WHERE table_schema = 'public' AND table_name = 'pastelaria_gantt_semanas';
-- SELECT policyname, cmd FROM pg_policies
--   WHERE tablename LIKE 'pastelaria%' ORDER BY tablename, policyname;
-- -----------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
-- Documento de nÃºmero de franquia (bucket rede-attachments)
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_numero_franquia_path TEXT;

COMMENT ON COLUMN public.rede_franqueados.anexo_numero_franquia_path IS
  'Caminho no bucket rede-attachments para o documento do nÃºmero de franquia';
-- Ao excluir rede_franqueados, desvincular kanban_cards (ON DELETE SET NULL).
-- Em alguns ambientes a FK foi criada sem essa aÃ§Ã£o e o Table Editor bloqueia o DELETE.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'kanban_cards'
      AND constraint_name = 'kanban_cards_rede_franqueado_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.kanban_cards DROP CONSTRAINT kanban_cards_rede_franqueado_id_fkey';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kanban_cards'
      AND column_name = 'rede_franqueado_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.kanban_cards
      ADD CONSTRAINT kanban_cards_rede_franqueado_id_fkey
      FOREIGN KEY (rede_franqueado_id) REFERENCES public.rede_franqueados(id) ON DELETE SET NULL';
  END IF;
END $$;
-- Documento de nÃºmero de franquia (idempotente + funÃ§Ã£o para o app corrigir schema em produÃ§Ã£o)
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_numero_franquia_path TEXT;

COMMENT ON COLUMN public.rede_franqueados.anexo_numero_franquia_path IS
  'Caminho no bucket rede-attachments para o documento do nÃºmero de franquia';

CREATE OR REPLACE FUNCTION public.ensure_rede_anexo_numero_franquia_column()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE public.rede_franqueados
    ADD COLUMN IF NOT EXISTS anexo_numero_franquia_path TEXT;
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_rede_anexo_numero_franquia_column() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_rede_anexo_numero_franquia_column() TO service_role;
