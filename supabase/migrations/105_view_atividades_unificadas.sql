-- ─── 105: View v_atividades_unificadas ───────────────────────────────────────
-- Unifica atividades de todos os kanbans em uma única view consultável.
-- SLA calculado a partir de data_vencimento da própria atividade.
-- security_invoker = true → view herda RLS das tabelas subjacentes.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ─── 1. Drop + Create ────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_atividades_unificadas;

CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  -- Identificadores
  a.id,
  a.card_id,

  -- Contexto do card
  c.titulo                                              AS card_titulo,
  f.nome                                                AS fase_nome,
  k.nome                                                AS kanban_nome,

  -- Responsável
  a.responsavel_id,
  COALESCE(p.full_name, p.email)                        AS responsavel_nome,

  -- Tipo de atividade
  -- kanban_atividades representa tarefas; campo expandível no futuro
  'tarefa'::TEXT                                        AS tipo,

  -- Conteúdo
  a.descricao,

  -- Timestamp
  a.created_at                                          AS criado_em,

  -- SLA calculado a partir de data_vencimento
  CASE
    WHEN a.data_vencimento IS NULL   THEN NULL
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::TEXT                                             AS sla_status

FROM public.kanban_atividades  a
JOIN public.kanban_cards        c ON c.id = a.card_id
JOIN public.kanban_fases        f ON f.id = c.fase_id
JOIN public.kanbans             k ON k.id = c.kanban_id
LEFT JOIN public.profiles       p ON p.id = a.responsavel_id;

COMMENT ON VIEW public.v_atividades_unificadas IS
  'Visão unificada de todas as atividades dos kanbans. '
  'Inclui contexto de card, fase e kanban. '
  'sla_status calculado a partir de data_vencimento da atividade: '
  'atrasado | vence_hoje | ok | null (sem prazo).';

-- ─── 2. GRANT — autenticados podem consultar ─────────────────────────────────
-- A view usa security_invoker = true, portanto as políticas RLS das tabelas
-- subjacentes (kanban_atividades, kanban_cards) continuam valendo.
GRANT SELECT ON public.v_atividades_unificadas TO authenticated;
