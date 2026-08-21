-- 524: Funil Loteadores — primeira fase passa a se chamar Novo Loteador.
-- Cobre o slug canônico e o legado ainda ativo em DEV (`loteador_cadastro`).
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
    RAISE NOTICE '524: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET nome = 'Novo Loteador'
  WHERE kanban_id = v_kanban_id
    AND slug IN ('primeiro_contato_moni_inc', 'loteador_cadastro')
    AND nome IS DISTINCT FROM 'Novo Loteador';
END $$;

NOTIFY pgrst, 'reload schema';
