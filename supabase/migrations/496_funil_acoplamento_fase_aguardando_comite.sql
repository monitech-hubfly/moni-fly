-- 496: Funil Acoplamento — fase «Aguardando Comitê» entre Validação e Alterações.

DO $$
DECLARE
  v_kanban_id UUID;
  v_ordem_anchor INT;
  v_sla_dias INT := 1;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '15847602-231d-4937-a06f-82027eb87ef3'::uuid
     OR nome = 'Funil Acoplamento'
  ORDER BY CASE WHEN id = '15847602-231d-4937-a06f-82027eb87ef3'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '496: kanban Funil Acoplamento não encontrado; pulando.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug = 'aguardando_comite_acoplamento'
  ) THEN
    RAISE NOTICE '496: fase Aguardando Comitê já existe; pulando.';
    RETURN;
  END IF;

  SELECT ordem
  INTO v_ordem_anchor
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'validacao_acoplamento'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_ordem_anchor IS NULL THEN
    RAISE NOTICE '496: fase validacao_acoplamento não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id
    AND ordem > v_ordem_anchor
    AND COALESCE(ativo, true) = true;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
  VALUES (
    v_kanban_id,
    'Aguardando Comitê',
    'aguardando_comite_acoplamento',
    v_ordem_anchor + 1,
    v_sla_dias,
    true,
    NULL,
    '[]'::jsonb
  );
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('496', 'funil_acoplamento_fase_aguardando_comite')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
