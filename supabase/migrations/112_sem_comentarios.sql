ALTER TABLE public.kanban_fases
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_fases_kanban_slug
  ON public.kanban_fases (kanban_id, slug)
  WHERE slug IS NOT NULL;

INSERT INTO kanban_fases (kanban_id, nome, slug, ordem)
SELECT k.id, fase.nome, fase.slug, fase.ordem
FROM kanbans k
CROSS JOIN (VALUES
  ('Incorporadora', 'contabilidade_incorporadora', 1),
  ('SPE', 'contabilidade_spe', 2),
  ('Gestora', 'contabilidade_gestora', 3)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'Contabilidade'
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

INSERT INTO kanban_fases (kanban_id, nome, slug, ordem)
SELECT k.id, fase.nome, fase.slug, fase.ordem
FROM kanbans k
CROSS JOIN (VALUES
  ('Crédito Terreno', 'credito_terreno', 1),
  ('Crédito Obra', 'credito_obra', 2)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'Crédito'
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

INSERT INTO kanban_fases (kanban_id, nome, slug, ordem)
SELECT k.id, fase.nome, fase.slug, fase.ordem
FROM kanbans k
CROSS JOIN (VALUES
  ('Dados do Negócio',       'step_2',                    1),
  ('Aprovação Moní',         'aprovacao_moni_novo_negocio',2),
  ('Documentação',           'step_3',                    3),
  ('Acoplamento',            'acoplamento',               4),
  ('Step 4',                 'step_4',                    5),
  ('Step 5',                 'step_5',                    6),
  ('Step 6',                 'step_6',                    7),
  ('Step 7',                 'step_7',                    8),
  ('Passagem Wayser',        'passagem_wayser',           9),
  ('Planialtimétrico',       'planialtimetrico',          10),
  ('Sondagem',               'sondagem',                  11),
  ('Projeto Legal',          'projeto_legal',             12),
  ('Aprovação Condomínio',   'aprovacao_condominio',      13),
  ('Aprovação Prefeitura',   'aprovacao_prefeitura',      14),
  ('Revisão BCA',            'revisao_bca',               15),
  ('Processos Cartorários',  'processos_cartorarios',     16),
  ('Aguardando Crédito',     'aguardando_credito',        17),
  ('Em Obra',                'em_obra',                   18),
  ('Moni Care',              'moni_care',                 19)
) AS fase(nome, slug, ordem)
WHERE k.nome IN ('Portfolio', 'Operações')
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

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
  'legado'       AS origem
FROM processo_step_one p
JOIN kanban_fases kf ON kf.slug = p.etapa_painel
JOIN kanbans k       ON k.id   = kf.kanban_id
WHERE k.nome IN ('Portfolio', 'Operações', 'Contabilidade', 'Crédito')
  AND p.cancelado_em IS NULL
  AND p.removido_em  IS NULL;

GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;

SELECT k.nome, COUNT(*)
FROM v_processo_como_kanban_cards v
JOIN kanbans k ON k.id = v.kanban_id
GROUP BY k.nome;
