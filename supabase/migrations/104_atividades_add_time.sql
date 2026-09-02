-- ========================================
-- Adiciona campo "time" (equipe) às atividades
-- ========================================

-- Adiciona coluna time (equipe/time responsável)
ALTER TABLE public.kanban_atividades
ADD COLUMN IF NOT EXISTS time TEXT;

COMMENT ON COLUMN public.kanban_atividades.time IS 'Equipe/time responsável pela atividade (comercial, operacoes, juridico, financeiro)';

-- Índice para filtrar por time
CREATE INDEX IF NOT EXISTS idx_kanban_atividades_time ON public.kanban_atividades(time);

-- ========================================
-- Atualiza atividades exemplo com times
-- ========================================

UPDATE public.kanban_atividades
SET time = CASE 
  WHEN titulo LIKE '%dados cadastrais%' THEN 'operacoes'
  WHEN titulo LIKE '%Validar informações%' THEN 'juridico'
  WHEN titulo LIKE '%reunião%' THEN 'comercial'
  WHEN titulo LIKE '%certidões%' THEN 'juridico'
  WHEN titulo LIKE '%relatório%' THEN 'operacoes'
  ELSE 'operacoes'
END
WHERE time IS NULL;

-- ========================================
-- 🎉 MIGRAÇÃO CONCLUÍDA!
-- Campo "time" adicionado à tabela kanban_atividades
-- Atividades exemplo atualizadas com times
-- ========================================
