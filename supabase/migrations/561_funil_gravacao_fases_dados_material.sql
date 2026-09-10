-- 561: Funil Gravação de Vídeos Externos — Caixa de Entrada + pós-Organização
-- + coluna mkt_tipo_material nos 3 funis marketing.
-- Idempotente.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS mkt_tipo_material text;

DO $$
DECLARE
  v_kanban_id uuid := 'e8a14c2b-7d53-4f91-a6c0-2b9e5d8f1a47'::uuid;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    RAISE NOTICE '561: Funil Gravação não encontrado — pulando fases.';
    RETURN;
  END IF;

  -- Caixa de Entrada (antes de Planejamento)
  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, ativo, fase_conversao)
  SELECT '1b46b4bb-8615-4ecc-9087-b86880b48254'::uuid, v_kanban_id, 'Caixa de Entrada', 'mkt_grav_caixa_entrada', 90, NULL, 'uteis', true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'mkt_grav_caixa_entrada'
  );

  -- Decupagem → Organização (mantém slug mkt_grav_decupagem + checklist)
  UPDATE public.kanban_fases
  SET
    nome = 'Organização',
    fase_conversao = false,
    ativo = true,
    instrucoes = E'SLA: 30 minutos a 1 hora.\nResponsável: João Paulo.\nOrganizar o material gravado. Selecionar o aproveitado. Preparar pastas para edição.'
  WHERE kanban_id = v_kanban_id AND slug = 'mkt_grav_decupagem';

  -- Novas fases após Organização
  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, ativo, fase_conversao)
  SELECT '157386fa-7833-49ec-b1f8-4692a1ea9735'::uuid, v_kanban_id, 'Edição', 'mkt_grav_edicao', 91, 1, 'uteis', true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'mkt_grav_edicao'
  );

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, ativo, fase_conversao)
  SELECT '39e390be-072d-4eab-9502-1ff57d826a44'::uuid, v_kanban_id, 'Aprovação', 'mkt_grav_aprovacao', 92, 1, 'uteis', true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'mkt_grav_aprovacao'
  );

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, ativo, fase_conversao)
  SELECT 'd495e043-4404-43c0-b6d7-8e80a4bbe753'::uuid, v_kanban_id, 'Revisão', 'mkt_grav_revisao', 93, 1, 'uteis', true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'mkt_grav_revisao'
  );

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, ativo, fase_conversao)
  SELECT 'c02147f5-5474-4630-9206-afedc24534d1'::uuid, v_kanban_id, 'Vídeos Concluídos', 'mkt_grav_videos_concluidos', 94, NULL, 'uteis', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'mkt_grav_videos_concluidos'
  );

  UPDATE public.kanban_fases
  SET nome = 'Vídeos Concluídos', fase_conversao = true, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'mkt_grav_videos_concluidos';

  -- Ordem canônica
  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id FROM (
      VALUES
        (1, 'mkt_grav_caixa_entrada'),
        (2, 'mkt_grav_planejamento'),
        (3, 'mkt_grav_in_loco'),
        (4, 'mkt_grav_decupagem'),
        (5, 'mkt_grav_edicao'),
        (6, 'mkt_grav_aprovacao'),
        (7, 'mkt_grav_revisao'),
        (8, 'mkt_grav_videos_concluidos')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf ON kf.kanban_id = v_kanban_id AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases SET ordem = v_ord, ativo = true WHERE id = r.id;
  END LOOP;

  UPDATE public.kanbans
  SET descricao = 'Pontual. Entrada: Caixa de Entrada. Saída: Vídeos Concluídos após edição/aprovação/revisão.'
  WHERE id = v_kanban_id;
END $$;

NOTIFY pgrst, 'reload schema';
