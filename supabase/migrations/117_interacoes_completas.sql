-- ─── 117: kanban_atividades — tabela central de interações ──────────────────
-- Expande kanban_atividades com múltiplos responsáveis, trava e suporte a
-- interações originadas externamente (origem_externa, solicitante_nome/email).
-- responsavel_id (legado, singular) é migrado para responsaveis_ids[].
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 — Novas colunas
-- ============================================================
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS responsaveis_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trava BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem_externa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS solicitante_nome TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_email TEXT;

COMMENT ON COLUMN public.kanban_atividades.responsaveis_ids IS
  'Lista de responsáveis pela atividade. Substitui/complementa responsavel_id singular.';
COMMENT ON COLUMN public.kanban_atividades.trava IS
  'Se true, bloqueia avanço do card até esta atividade ser concluída.';
COMMENT ON COLUMN public.kanban_atividades.origem_externa IS
  'Se true, a atividade foi criada por solicitante externo (não usuário interno).';
COMMENT ON COLUMN public.kanban_atividades.solicitante_nome IS
  'Nome do solicitante externo (quando origem_externa = true).';
COMMENT ON COLUMN public.kanban_atividades.solicitante_email IS
  'E-mail do solicitante externo (quando origem_externa = true).';

-- ============================================================
-- PARTE 2 — Migrar responsavel_id → responsaveis_ids
-- ============================================================
UPDATE public.kanban_atividades
SET responsaveis_ids = ARRAY[responsavel_id]
WHERE responsavel_id IS NOT NULL
  AND (responsaveis_ids IS NULL OR responsaveis_ids = '{}');

-- ============================================================
-- PARTE 3 — Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kanban_atividades_responsaveis
  ON public.kanban_atividades USING GIN (responsaveis_ids);

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_trava
  ON public.kanban_atividades (trava) WHERE trava = true;
