-- 594: Funil Loteadores — Enviar Cto de Parceria
-- imediatamente antes de Jurídico Cto de Parceria.
-- Idempotente. Não move cards.

DO $$
DECLARE
  v_kanban_id uuid := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome = 'Funil Loteadores' AND COALESCE(ativo, true)
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '594: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT 'e38561a7-b492-4fd1-a388-f5927ab1d84a'::uuid, v_kanban_id,
         'Enviar Cto de Parceria', 'enviar_cto_parceria_moni_inc', 90, 3, true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'enviar_cto_parceria_moni_inc'
  );

  UPDATE public.kanban_fases
  SET nome = 'Enviar Cto de Parceria', ativo = true, fase_conversao = false, sla_dias = COALESCE(sla_dias, 3)
  WHERE kanban_id = v_kanban_id AND slug = 'enviar_cto_parceria_moni_inc';

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id FROM (
      VALUES
        (1,  'primeiro_contato_moni_inc'),
        (2,  'nda_moni_inc'),
        (3,  'assinaturas_nda_moni_inc'),
        (4,  'nda_assinado_moni_inc'),
        (5,  'aguardando_ficha_moni_inc'),
        (6,  'novo_produto_moni_inc'),
        (7,  'viabilidade_moni_inc'),
        (8,  'validacao_moni_inc'),
        (9,  'r2_plano_teorico_moni_inc'),
        (10, 'revisoes_moni_inc'),
        (11, 'acoplamento_gbox_moni_inc'),
        (12, 'enviar_acoplamento_loteador'),
        (13, 'comite_moni_inc'),
        (14, 'revisoes_pos_comite_moni_inc'),
        (15, 'demais_comites_moni_inc'),
        (16, 'enviar_cto_parceria_moni_inc'),
        (17, 'contrato_parceria_moni_inc'),
        (18, 'assinaturas_cto_parceria_moni_inc'),
        (19, 'cto_parceria_assinado_moni_inc'),
        (20, 'passagem_waysers_moni_inc'),
        (21, 'assinados_moni_inc')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf ON kf.kanban_id = v_kanban_id AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases SET ordem = v_ord, ativo = true WHERE id = r.id;
  END LOOP;
END $$;

INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
)
SELECT f.id, 0, 'Responsável da fase', 'usuario', false, true, 'responsavel_fase', '{}'::jsonb
FROM public.kanban_fases f
WHERE f.slug = 'enviar_cto_parceria_moni_inc'
  AND COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.campo_slug = 'responsavel_fase'
  );

NOTIFY pgrst, 'reload schema';
