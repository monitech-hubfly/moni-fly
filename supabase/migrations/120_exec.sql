DROP VIEW IF EXISTS public.v_atividades_unificadas;

ALTER TABLE public.kanban_atividades
  DROP CONSTRAINT IF EXISTS kanban_atividades_origem_check;

ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_origem_check
  CHECK (origem IN ('nativo', 'legado', 'sirene', 'externo'));

ALTER TABLE public.kanban_atividades
  ALTER COLUMN card_id DROP NOT NULL;

INSERT INTO public.kanban_atividades (
  titulo,
  descricao,
  tipo,
  status,
  trava,
  origem,
  criado_por,
  created_at,
  updated_at
)
SELECT
  sc.incendio                          AS titulo,
  sc.resolucao_pontual                 AS descricao,
  CASE sc.tipo
    WHEN 'hdm' THEN 'chamado_hdm'
    ELSE           'chamado_padrao'
  END                                  AS tipo,
  CASE sc.status
    WHEN 'nao_iniciado'                 THEN 'pendente'
    WHEN 'em_andamento'                 THEN 'em_andamento'
    WHEN 'concluido'                    THEN 'concluida'
    WHEN 'aguardando_aprovacao_criador' THEN 'em_andamento'
    ELSE                                     'pendente'
  END                                  AS status,
  sc.trava                             AS trava,
  'sirene'                             AS origem,
  sc.aberto_por                        AS criado_por,
  sc.created_at,
  sc.updated_at
FROM public.sirene_chamados sc
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_atividades ka
  WHERE ka.origem     = 'sirene'
    AND ka.criado_por = sc.aberto_por
    AND ka.created_at = sc.created_at
);

CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.card_id,

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
    FROM   public.kanban_times t
    WHERE  t.id = ANY (a.times_ids)
    ORDER  BY t.nome
  ) AS times_nomes,

  COALESCE(fp_card.full_name, fp_card.email, fp_leg.full_name, fp_leg.email) AS franqueado_nome,

  a.created_at AS criado_em,

  CASE
    WHEN a.data_vencimento IS NULL        THEN NULL::text
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::text AS sla_status

FROM public.kanban_atividades a
LEFT JOIN public.kanban_cards kc
  ON kc.id = a.card_id
 AND a.origem = 'nativo'
LEFT JOIN public.v_processo_como_kanban_cards vmap
  ON vmap.id = a.card_id
 AND a.origem = 'legado'
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
  (a.origem = 'nativo'  AND kc.id   IS NOT NULL)
  OR (a.origem = 'legado'   AND vmap.id IS NOT NULL)
  OR  a.origem = 'sirene'
  OR  a.origem = 'externo';

COMMENT ON VIEW public.v_atividades_unificadas IS
  'Interações (kanban_atividades): cards nativos, legados (processo_step_one), '
  'chamados Sirene (origem=sirene) e interações externas (origem=externo). '
  'Mesmas colunas da migration 116.';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;
