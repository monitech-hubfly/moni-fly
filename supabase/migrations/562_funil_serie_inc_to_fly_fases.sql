-- 562: Funil Série Inc. to Fly — reordenar fases, renomear (sem D1/D2/…),
-- Edição SLA 3 d.u., novas Aprovação e Revisão.
-- Idempotente.

DO $$
DECLARE
  v_kanban_id uuid := 'a2c36e4d-9f75-4b13-c8e2-4d1a7f0b3c69'::uuid;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    RAISE NOTICE '562: Funil Série Inc. to Fly não encontrado — pulando.';
    RETURN;
  END IF;

  -- Renomes + SLAs (mantém slugs/checklists)
  UPDATE public.kanban_fases
  SET nome = 'Organização', ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'mkt_inc_decupagem';

  UPDATE public.kanban_fases
  SET nome = 'Roteiro', ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'mkt_inc_d2_roteiro';

  UPDATE public.kanban_fases
  SET nome = 'Gravação extra', ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'mkt_inc_d21_extra';

  UPDATE public.kanban_fases
  SET nome = 'Storyline', ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'mkt_inc_d1_storyline';

  UPDATE public.kanban_fases
  SET nome = 'Edição', sla_dias = 3, sla_tipo = 'uteis', ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'mkt_inc_d3_edicao';

  UPDATE public.kanban_fases
  SET nome = 'Versão final', ativo = true, fase_conversao = true
  WHERE kanban_id = v_kanban_id AND slug = 'mkt_inc_d4_final';

  -- Novas fases após Edição
  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, ativo, fase_conversao)
  SELECT '44e966f8-aea4-4799-a391-e2022a70fd3c'::uuid, v_kanban_id, 'Aprovação', 'mkt_inc_aprovacao', 90, 1, 'uteis', true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'mkt_inc_aprovacao'
  );

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, ativo, fase_conversao)
  SELECT '5519a8ac-cc54-48d7-94d4-96df5daa8f31'::uuid, v_kanban_id, 'Revisão', 'mkt_inc_revisao', 91, 1, 'uteis', true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'mkt_inc_revisao'
  );

  UPDATE public.kanban_fases
  SET nome = 'Aprovação', sla_dias = 1, sla_tipo = 'uteis', ativo = true, fase_conversao = false
  WHERE kanban_id = v_kanban_id AND slug = 'mkt_inc_aprovacao';

  UPDATE public.kanban_fases
  SET nome = 'Revisão', sla_dias = 1, sla_tipo = 'uteis', ativo = true, fase_conversao = false
  WHERE kanban_id = v_kanban_id AND slug = 'mkt_inc_revisao';

  -- Ordem canônica
  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id FROM (
      VALUES
        (1, 'mkt_inc_planejamento'),
        (2, 'mkt_inc_gravacao'),
        (3, 'mkt_inc_decupagem'),
        (4, 'mkt_inc_d2_roteiro'),
        (5, 'mkt_inc_d21_extra'),
        (6, 'mkt_inc_d1_storyline'),
        (7, 'mkt_inc_d3_edicao'),
        (8, 'mkt_inc_aprovacao'),
        (9, 'mkt_inc_revisao'),
        (10, 'mkt_inc_d4_final')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf ON kf.kanban_id = v_kanban_id AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases SET ordem = v_ord, ativo = true WHERE id = r.id;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
