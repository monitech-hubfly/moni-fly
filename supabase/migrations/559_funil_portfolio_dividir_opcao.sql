-- 559: Funil Portfólio — dividir Opção em 3 fases
-- 1) Enviar Opção (slug legado step_3 — mantém instruções, checklist e cards)
-- 2) Jurídico Opção (nova)
-- 3) Assinaturas Opção (nova)
-- Idempotente. Não move cards (permanecem em step_3 / Enviar Opção).

DO $$
DECLARE
  v_kanban_id uuid := 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid;
  v_ordem_opcao int;
  v_fase_step3 uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome = 'Funil Portfólio' AND COALESCE(ativo, true)
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '559: Funil Portfólio não encontrado — pulando.';
    RETURN;
  END IF;

  SELECT id, ordem INTO v_fase_step3, v_ordem_opcao
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('step_3', 'opcao')
    AND COALESCE(ativo, true)
  ORDER BY CASE WHEN slug = 'step_3' THEN 0 ELSE 1 END, ordem
  LIMIT 1;

  IF v_fase_step3 IS NULL THEN
    RAISE NOTICE '559: fase Opção (step_3) não encontrada — pulando.';
    RETURN;
  END IF;

  -- Checklist + instruções permanecem em step_3; só o nome muda.
  UPDATE public.kanban_fases
  SET nome = 'Enviar Opção'
  WHERE id = v_fase_step3
    AND nome IS DISTINCT FROM 'Enviar Opção';

  IF EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'juridico_opcao'
  ) AND EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'assinaturas_opcao'
  ) THEN
    UPDATE public.kanban_fases
    SET nome = 'Jurídico Opção', ativo = true
    WHERE kanban_id = v_kanban_id AND slug = 'juridico_opcao';

    UPDATE public.kanban_fases
    SET nome = 'Assinaturas Opção', ativo = true
    WHERE kanban_id = v_kanban_id AND slug = 'assinaturas_opcao';

    RAISE NOTICE '559: fases já existem — nomes sincronizados.';
    RETURN;
  END IF;

  IF v_ordem_opcao IS NULL THEN
    v_ordem_opcao := 3;
  END IF;

  UPDATE public.kanban_fases
  SET ordem = ordem + 2
  WHERE kanban_id = v_kanban_id
    AND ordem > v_ordem_opcao;

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo)
  SELECT
    'f977b1f8-9946-4707-8e7c-78eabb621dbb'::uuid,
    v_kanban_id,
    'Jurídico Opção',
    'juridico_opcao',
    v_ordem_opcao + 1,
    3,
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'juridico_opcao'
  );

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo)
  SELECT
    'da0f9628-e3a5-4481-b49b-a22d30175e0f'::uuid,
    v_kanban_id,
    'Assinaturas Opção',
    'assinaturas_opcao',
    v_ordem_opcao + 2,
    3,
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'assinaturas_opcao'
  );
END $$;

NOTIFY pgrst, 'reload schema';
