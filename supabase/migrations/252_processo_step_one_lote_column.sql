-- 252: idempotente — coluna lote em processo_step_one (PROD sem 251 completa) + view título

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS quadra TEXT,
  ADD COLUMN IF NOT EXISTS lote TEXT,
  ADD COLUMN IF NOT EXISTS data_reuniao date,
  ADD COLUMN IF NOT EXISTS data_followup date;

COMMENT ON COLUMN public.processo_step_one.quadra IS 'Quadra do lote no condomínio (card legado).';
COMMENT ON COLUMN public.processo_step_one.lote IS 'Lote no condomínio (card legado).';
COMMENT ON COLUMN public.processo_step_one.data_reuniao IS 'Data planejada de reunião (processo / card legado).';
COMMENT ON COLUMN public.processo_step_one.data_followup IS 'Data de follow-up (processo / card legado).';

CREATE OR REPLACE VIEW public.v_processo_como_kanban_cards AS
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
