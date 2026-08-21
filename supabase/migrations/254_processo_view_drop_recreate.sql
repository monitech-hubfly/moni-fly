-- 254: recria view legado com DROP (evita 42P16) + restaura v_atividades_unificadas

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS quadra TEXT,
  ADD COLUMN IF NOT EXISTS lote TEXT,
  ADD COLUMN IF NOT EXISTS data_reuniao date,
  ADD COLUMN IF NOT EXISTS data_followup date;

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS data_reuniao date,
  ADD COLUMN IF NOT EXISTS data_followup date;

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS numero INTEGER,
  ADD COLUMN IF NOT EXISTS time_abertura_nome TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT;

DROP VIEW IF EXISTS public.v_atividades_unificadas;
DROP VIEW IF EXISTS public.v_processo_como_kanban_cards;

CREATE VIEW public.v_processo_como_kanban_cards AS
SELECT
  p.id,
  kf.kanban_id,
  kf.id          AS fase_id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' - ', p.numero_franquia, p.nome_condominio, p.quadra, p.lote)), ''),
    'Sem título'
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
WHERE k.nome IN ('Funil Portfólio', 'Funil Operações', 'Funil Contabilidade', 'Funil Crédito')
  AND p.cancelado_em IS NULL
  AND p.removido_em  IS NULL;

GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;

CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.card_id,
  a.numero AS chamado_numero,
  COALESCE(
    kc.titulo,
    vmap.titulo,
    CASE a.origem
      WHEN 'sirene'  THEN '(chamado direto)'
      WHEN 'externo' THEN '(externo)'
      ELSE                '(sem título)'
    END
  ) AS card_titulo,
  COALESCE(kf.nome, '') AS fase_nome,
  COALESCE(
    k.nome,
    CASE a.origem
      WHEN 'sirene'  THEN 'Sirene'
      WHEN 'externo' THEN 'Externo'
      ELSE                ''
    END
  ) AS kanban_nome,
  COALESCE(kc.kanban_id, vmap.kanban_id) AS kanban_id,
  a.responsavel_id,
  COALESCE(rsp.full_name, rsp.email) AS responsavel_nome,
  a.tipo,
  a.categoria,
  a.time_abertura_nome,
  COALESCE(
    NULLIF(trim(a.titulo), ''),
    NULLIF(trim(a.descricao), ''),
    '(sem título)'
  ) AS titulo,
  a.descricao,
  a.status AS atividade_status,
  a.data_vencimento,
  a.time AS time_nome,
  a.times_ids,
  ARRAY(
    SELECT t.nome
    FROM public.kanban_times t
    WHERE t.id = ANY (a.times_ids)
    ORDER BY t.nome
  ) AS times_nomes,
  COALESCE(fp_card.full_name, fp_card.email, fp_leg.full_name, fp_leg.email) AS franqueado_nome,
  a.created_at AS criado_em,
  CASE
    WHEN a.data_vencimento IS NULL THEN NULL::text
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::text AS sla_status
FROM public.kanban_atividades a
LEFT JOIN public.kanban_cards kc
  ON kc.id = a.card_id AND a.origem = 'nativo'
LEFT JOIN public.v_processo_como_kanban_cards vmap
  ON vmap.id = a.card_id AND a.origem = 'legado'
LEFT JOIN public.kanban_fases kf
  ON kf.id = COALESCE(kc.fase_id, vmap.fase_id)
LEFT JOIN public.kanbans k
  ON k.id = COALESCE(kc.kanban_id, vmap.kanban_id)
LEFT JOIN public.profiles rsp
  ON rsp.id = a.responsavel_id
LEFT JOIN public.profiles fp_card
  ON fp_card.id = kc.franqueado_id
LEFT JOIN public.profiles fp_leg
  ON fp_leg.id = vmap.responsavel_id
WHERE
  (a.origem = 'nativo' AND kc.id IS NOT NULL)
  OR (a.origem = 'legado' AND vmap.id IS NOT NULL)
  OR a.origem = 'sirene'
  OR a.origem = 'externo';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;

SELECT pg_notify('pgrst', 'reload schema');
