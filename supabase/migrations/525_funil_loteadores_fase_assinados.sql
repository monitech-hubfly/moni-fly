-- 525: Funil Loteadores — fase terminal Assinados (conclusão).
-- Passagem para Waysers e Cto de Parceria deixam de ser a última coluna.
-- Idempotente. Não move cards.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome IN ('Funil Loteadores', 'Funil Moní INC')
    ORDER BY CASE WHEN nome = 'Funil Loteadores' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '525: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fases (
    kanban_id, nome, slug, ordem, sla_dias, sla_tipo, ativo, instrucoes, materiais, fase_conversao
  )
  SELECT
    v_kanban_id,
    'Assinados',
    'assinados_moni_inc',
    21,
    NULL,
    NULL,
    true,
    'Fase de conclusão do Funil Loteadores. Cards aqui podem ser finalizados.',
    '[]'::jsonb,
    false
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug = 'assinados_moni_inc'
  );

  UPDATE public.kanban_fases
  SET
    nome = 'Assinados',
    ordem = 21,
    sla_dias = NULL,
    ativo = true,
    fase_conversao = false
  WHERE kanban_id = v_kanban_id
    AND slug = 'assinados_moni_inc';
END $$;

NOTIFY pgrst, 'reload schema';
