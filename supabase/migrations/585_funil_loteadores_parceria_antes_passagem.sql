-- 585: Funil Loteadores — Cto de Parceria fica antes de Passagem IMOB.
-- Só troca a ordem das colunas. Cards permanecem na fase em que estão.
-- Idempotente.

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
    RAISE NOTICE '585: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases AS f
  SET ordem = v.ordem
  FROM (
    VALUES
      ('contrato_parceria_moni_inc', 12),
      ('passagem_waysers_moni_inc', 13)
  ) AS v(slug, ordem)
  WHERE f.kanban_id = v_kanban_id
    AND f.slug = v.slug
    AND f.ordem IS DISTINCT FROM v.ordem;

  RAISE NOTICE '585: Cto de Parceria antes de Passagem IMOB.';
END $$;

NOTIFY pgrst, 'reload schema';
