-- 223: Chamado (cabeçalho) + Atividades (operacional) — schema e migração sintética

-- ─── kanban_atividades: categoria chamado/melhoria ───────────────────────────
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'chamado';

ALTER TABLE public.kanban_atividades DROP CONSTRAINT IF EXISTS kanban_atividades_categoria_check;
ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_categoria_check
  CHECK (categoria IN ('chamado', 'melhoria'));

COMMENT ON COLUMN public.kanban_atividades.categoria IS
  'Classificação do chamado: chamado ou melhoria (cabeçalho; operacional fica em sirene_topicos).';

UPDATE public.kanban_atividades SET descricao = '' WHERE descricao IS NULL;
ALTER TABLE public.kanban_atividades
  ALTER COLUMN descricao SET DEFAULT '',
  ALTER COLUMN descricao SET NOT NULL;

-- ─── sirene_topicos: campos de atividade ─────────────────────────────────────
ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS descricao_detalhe TEXT,
  ADD COLUMN IF NOT EXISTS pastel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS historico JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.sirene_topicos.nome IS 'Nome da atividade (obrigatório em novos registros kanban).';
COMMENT ON COLUMN public.sirene_topicos.descricao_detalhe IS 'Descrição opcional da atividade.';
COMMENT ON COLUMN public.sirene_topicos.pastel IS 'Marcador Pastel — só responsável da atividade; indisponível para time Bombeiro.';
COMMENT ON COLUMN public.sirene_topicos.historico IS 'Eventos da atividade (ex.: Redirecionado).';

-- Preencher nome a partir de descricao legada
UPDATE public.sirene_topicos
SET nome = COALESCE(NULLIF(TRIM(nome), ''), NULLIF(TRIM(descricao), ''), 'Atividade')
WHERE interacao_id IS NOT NULL
  AND (nome IS NULL OR TRIM(nome) = '');

-- ─── Migração sintética: 1 atividade por chamado sem filhos ──────────────────
INSERT INTO public.sirene_topicos (
  chamado_id,
  interacao_id,
  ordem,
  nome,
  descricao,
  descricao_detalhe,
  time_responsavel,
  responsavel_id,
  responsaveis_ids,
  times_ids,
  trava,
  data_fim,
  status,
  tipo,
  pastel,
  historico
)
SELECT
  NULL,
  a.id,
  1,
  COALESCE(NULLIF(TRIM(a.titulo), ''), 'Atividade'),
  COALESCE(NULLIF(TRIM(a.titulo), ''), 'Atividade'),
  NULLIF(TRIM(a.descricao), ''),
  COALESCE(
    NULLIF(TRIM(a.time), ''),
    (
      SELECT kt.nome
      FROM public.kanban_times kt
      WHERE kt.id = ANY(COALESCE(a.times_ids, '{}'))
      LIMIT 1
    ),
    '—'
  ),
  CASE
    WHEN COALESCE(array_length(a.responsaveis_ids, 1), 0) > 0 THEN a.responsaveis_ids[1]
    ELSE a.responsavel_id
  END,
  COALESCE(a.responsaveis_ids, CASE WHEN a.responsavel_id IS NOT NULL THEN ARRAY[a.responsavel_id] ELSE '{}' END),
  COALESCE(a.times_ids, '{}'),
  COALESCE(a.trava, false),
  a.data_vencimento,
  CASE a.status
    WHEN 'em_andamento' THEN 'em_andamento'
    WHEN 'concluida' THEN 'concluido'
    WHEN 'cancelada' THEN 'concluido'
    ELSE 'nao_iniciado'
  END,
  'atividade',
  false,
  '[]'::jsonb
FROM public.kanban_atividades a
WHERE NOT EXISTS (
  SELECT 1 FROM public.sirene_topicos st WHERE st.interacao_id = a.id
)
AND (
  COALESCE(array_length(a.times_ids, 1), 0) > 0
  OR COALESCE(array_length(a.responsaveis_ids, 1), 0) > 0
  OR a.responsavel_id IS NOT NULL
  OR a.data_vencimento IS NOT NULL
  OR COALESCE(a.trava, false) = true
  OR NULLIF(TRIM(a.time), '') IS NOT NULL
);

-- Limpar campos operacionais do pai (dados agora nas atividades)
UPDATE public.kanban_atividades a
SET
  times_ids = '{}',
  responsaveis_ids = '{}',
  responsavel_id = NULL,
  responsavel_nome_texto = NULL,
  trava = false,
  data_vencimento = NULL,
  time = NULL
WHERE EXISTS (
  SELECT 1 FROM public.sirene_topicos st WHERE st.interacao_id = a.id
);

-- ─── Desativar notificações legadas em sirene_notificacoes (sininho usa alertas) ─
DROP TRIGGER IF EXISTS trg_notificar_interacao ON public.kanban_atividades;

NOTIFY pgrst, 'reload schema';
