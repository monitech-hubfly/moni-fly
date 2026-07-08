-- 437: Funil Motor 01 — dividir Custom Track 1 em 1.1 + 1.2
--   • m1_custom_track1 → «Custom Track 1.1», SLA 10 úteis (slug mantém)
--   • nova m1_custom_track1_2 → «Custom Track 1.2», SLA 10 úteis, mesmas instruções
--   • ordem entre track1 e track2; m1_custom_0 inalterado; fases após track2 deslocadas +1
-- Idempotente. Sem checklist items.

DO $$
DECLARE
  v_kanban_id uuid;
  v_ordem_track2 int;
  v_instrucoes text;
BEGIN
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '202527ea-d284-4c49-94f5-e75b25d6910e'::uuid
     OR nome = 'Funil Motor 01'
  ORDER BY CASE WHEN id = '202527ea-d284-4c49-94f5-e75b25d6910e'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '437: kanban Funil Motor 01 não encontrado.';
    RETURN;
  END IF;

  SELECT instrucoes INTO v_instrucoes
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'm1_custom_track1'
  LIMIT 1;

  UPDATE public.kanban_fases
  SET
    nome = 'Custom Track 1.1',
    sla_dias = 10,
    sla_tipo = 'uteis',
    ativo = true
  WHERE kanban_id = v_kanban_id
    AND slug = 'm1_custom_track1'
    AND (
      nome IS DISTINCT FROM 'Custom Track 1.1'
      OR sla_dias IS DISTINCT FROM 10
      OR sla_tipo IS DISTINCT FROM 'uteis'
    );

  IF EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'm1_custom_track1_2'
  ) THEN
    UPDATE public.kanban_fases AS t2
    SET instrucoes = t1.instrucoes
    FROM public.kanban_fases AS t1
    WHERE t2.kanban_id = v_kanban_id
      AND t2.slug = 'm1_custom_track1_2'
      AND t1.kanban_id = v_kanban_id
      AND t1.slug = 'm1_custom_track1'
      AND t2.instrucoes IS DISTINCT FROM t1.instrucoes;
    RETURN;
  END IF;

  SELECT ordem INTO v_ordem_track2
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'm1_custom_track2'
  LIMIT 1;

  IF v_ordem_track2 IS NULL THEN
    RAISE NOTICE '437: fase m1_custom_track2 não encontrada; pulando insert.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id
    AND ordem >= v_ordem_track2;

  INSERT INTO public.kanban_fases (
    kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
  )
  VALUES (
    v_kanban_id,
    'Custom Track 1.2',
    'm1_custom_track1_2',
    v_ordem_track2,
    10,
    'uteis',
    false,
    true,
    v_instrucoes,
    '[]'::jsonb
  );
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('437', 'funil_motor01_custom_track1_split')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
