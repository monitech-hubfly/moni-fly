-- 494: Funil Crédito Obra — renomeia fases, remove tranches 4ª–6ª e terminais Obra Aprovada/Reprovada.
-- Fase final: co_sharepoint_3a → "Concluídos".
-- UUID: 6463af1d-850d-4958-b74c-404f8d668e21 (KANBAN_IDS.CREDITO_OBRA)
-- Cards em fases removidas são realocados; fases legadas ficam ativo=false.

DO $$
DECLARE
  v_kanban_id uuid := '6463af1d-850d-4958-b74c-404f8d668e21'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito')
    ORDER BY CASE
      WHEN nome = 'Funil Crédito Obra' THEN 0
      WHEN nome = 'Funil Cash Me' THEN 1
      ELSE 2
    END
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE EXCEPTION '[494] Kanban Funil Crédito Obra não encontrado';
  END IF;

  RAISE NOTICE '[494] Funil Crédito Obra kanban_id=%', v_kanban_id;
END $$;

-- ─── Realocar cards de fases removidas ───────────────────────────────────────
WITH co_k AS (
  SELECT k.id AS kanban_id
  FROM public.kanbans k
  WHERE k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
     OR k.nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito')
  ORDER BY CASE
    WHEN k.nome = 'Funil Crédito Obra' THEN 0
    WHEN k.nome = 'Funil Cash Me' THEN 1
    ELSE 2
  END
  LIMIT 1
),
fases AS (
  SELECT kf.id, kf.slug
  FROM public.kanban_fases kf
  INNER JOIN co_k ON co_k.kanban_id = kf.kanban_id
),
dest AS (
  SELECT
    (SELECT id FROM fases WHERE slug = 'co_necessidade_3a_tranche') AS captacao_id,
    (SELECT id FROM fases WHERE slug = 'co_sharepoint_3a') AS concluidos_id
),
map AS (
  SELECT * FROM (VALUES
    ('co_acompanhamento_3a',       'co_sharepoint_3a'),
    ('co_necessidade_4a_tranche',  'co_necessidade_3a_tranche'),
    ('co_sharepoint_4a',           'co_necessidade_3a_tranche'),
    ('co_acompanhamento_4a',       'co_necessidade_3a_tranche'),
    ('co_necessidade_5a_tranche',  'co_necessidade_3a_tranche'),
    ('co_sharepoint_5a',           'co_necessidade_3a_tranche'),
    ('co_acompanhamento_5a',       'co_necessidade_3a_tranche'),
    ('co_necessidade_6a_tranche',  'co_necessidade_3a_tranche'),
    ('co_sharepoint_6a',           'co_necessidade_3a_tranche'),
    ('co_acompanhamento_6a',       'co_necessidade_3a_tranche'),
    ('credito_obra_aprovado',      'co_sharepoint_3a')
  ) AS t(origem_slug, destino_slug)
)
UPDATE public.kanban_cards kc
SET
  fase_id = fd.id,
  entered_fase_at = COALESCE(kc.entered_fase_at, now())
FROM map m
INNER JOIN fases fo ON fo.slug = m.origem_slug
INNER JOIN fases fd ON fd.slug = m.destino_slug
WHERE kc.fase_id = fo.id;

-- ─── Nomes e ordem das fases ativas ──────────────────────────────────────────
UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_tipo = COALESCE(kf.sla_tipo, 'uteis'),
  ativo = true,
  fase_conversao = v.fase_conversao
FROM public.kanbans k,
  (VALUES
    ('co_novo_projeto',            'Novo Projeto',                    1,  false),
    ('co_book',                    'Book',                            2,  false),
    ('co_envio_cashme',            'Envio p/ Parceiros',              3,  false),
    ('co_documentacao_alvara',     'Docs Alvará e Terreno SPE',       4,  false),
    ('co_validacao_contrato',      'Validando o Contrato',            5,  false),
    ('co_contrato_assinaturas',    'Assinaturas das 3 Partes',        6,  false),
    ('co_followup_cartorio',       'FUP Cartório',                    7,  false),
    ('co_aguardando_1a_tranche',   'Aguardando Tranche',              8,  false),
    ('co_solicitacao_tranche',     'Necessidade de Tranche',          9,  false),
    ('co_sharepoint_cashme',       'SharePoint + Email',             10,  false),
    ('co_acompanhamento_tranche',  'Liberando Tranche',              11,  false),
    ('co_necessidade_3a_tranche',  'Captação adicional',             12,  false),
    ('co_sharepoint_3a',           'Concluídos',                     13,  true)
  ) AS v(slug, nome, ordem, fase_conversao)
WHERE kf.kanban_id = k.id
  AND (k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito'))
  AND kf.slug = v.slug;

-- ─── Desativar fases removidas do funil ──────────────────────────────────────
UPDATE public.kanban_fases kf
SET ativo = false
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito'))
  AND kf.slug IN (
    'co_acompanhamento_3a',
    'co_necessidade_4a_tranche',
    'co_sharepoint_4a',
    'co_acompanhamento_4a',
    'co_necessidade_5a_tranche',
    'co_sharepoint_5a',
    'co_acompanhamento_5a',
    'co_necessidade_6a_tranche',
    'co_sharepoint_6a',
    'co_acompanhamento_6a',
    'credito_obra_aprovado',
    'credito_obra_reprovado'
  );

-- ─── Instruções atualizadas ──────────────────────────────────────────────────
UPDATE public.kanban_fases kf
SET instrucoes = $instr$Primeiro envio formal do pacote do projeto aos parceiros de crédito obra (ex.: CASHME e demais).
Registrar data de envio, confirmação de recebimento e canal utilizado.

Bastão → Docs Alvará e Terreno SPE: parceiro confirmou recebimento e deu encaminhamento.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito'))
  AND kf.slug = 'co_envio_cashme';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Fase de conclusão do Funil Crédito Obra.
Registrar encerramento do processo, notificar o franqueado e marcar o bastão de volta no card pai (Operações / Portfólio).$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito'))
  AND kf.slug = 'co_sharepoint_3a';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('494', 'funil_credito_obra_simplifica_fases')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
