-- 419: Funil Funding — kanban + 7 fases + colunas específicas em kanban_cards (sem tabela kanban_funding).

-- ─── Colunas Funding em kanban_cards ─────────────────────────────────────────
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS funding_tipo text,
  ADD COLUMN IF NOT EXISTS funding_localizacao text,
  ADD COLUMN IF NOT EXISTS funding_descritivo text,
  ADD COLUMN IF NOT EXISTS funding_proxima_atividade text,
  ADD COLUMN IF NOT EXISTS funding_prazo_atividade date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kanban_cards_funding_tipo_check'
  ) THEN
    ALTER TABLE public.kanban_cards
      ADD CONSTRAINT kanban_cards_funding_tipo_check
      CHECK (funding_tipo IS NULL OR funding_tipo IN ('Investidor', 'Broker'));
  END IF;
END $$;

COMMENT ON COLUMN public.kanban_cards.funding_tipo IS 'Funil Funding — Investidor ou Broker.';
COMMENT ON COLUMN public.kanban_cards.funding_localizacao IS 'Funil Funding — localização.';
COMMENT ON COLUMN public.kanban_cards.funding_descritivo IS 'Funil Funding — descritivo.';
COMMENT ON COLUMN public.kanban_cards.funding_proxima_atividade IS 'Funil Funding — próxima atividade.';
COMMENT ON COLUMN public.kanban_cards.funding_prazo_atividade IS 'Funil Funding — prazo da próxima atividade.';

-- ─── Kanban Funding (UUID fixo — alinhado a kanban-ids.ts) ───────────────────
INSERT INTO public.kanbans (id, nome, descricao, ativo)
SELECT
  '7c9e4a21-6b3d-4f82-a591-0d8e6f4b2c19'::uuid,
  'Funding',
  'Captação via investidores e brokers',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans
  WHERE id = '7c9e4a21-6b3d-4f82-a591-0d8e6f4b2c19'::uuid
     OR nome = 'Funding'
);

-- ─── Fases (7 etapas, sla_tipo = uteis) ─────────────────────────────────────
INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  f.sla_dias,
  'uteis',
  f.fase_conversao,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Leads / Captados',  'funding_leads',    1, 2, false),
    ('R1',                'funding_r1',       2, 3, false),
    ('Evento Realizado',  'funding_evento',   3, 5, false),
    ('Lead Qualificado',  'funding_qualif',   4, 3, true),
    ('Desenhar Modelo',   'funding_modelo',   5, 5, false),
    ('Organizar Docs',    'funding_docs',     6, 5, false),
    ('Assinar Contrato',  'funding_contrato', 7, 5, true)
) AS f(nome, slug, ordem, sla_dias, fase_conversao)
WHERE k.nome = 'Funding'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.slug = f.slug
  );

UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = 'uteis',
  fase_conversao = v.fase_conversao,
  ativo = true
FROM public.kanbans k,
  (VALUES
    ('funding_leads',    'Leads / Captados',  1, 2, false),
    ('funding_r1',       'R1',                2, 3, false),
    ('funding_evento',   'Evento Realizado',  3, 5, false),
    ('funding_qualif',   'Lead Qualificado',  4, 3, true),
    ('funding_modelo',   'Desenhar Modelo',   5, 5, false),
    ('funding_docs',     'Organizar Docs',    6, 5, false),
    ('funding_contrato', 'Assinar Contrato',  7, 5, true)
  ) AS v(slug, nome, ordem, sla_dias, fase_conversao)
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funding'
  AND kf.slug = v.slug;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('419', 'kanban_funding')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
