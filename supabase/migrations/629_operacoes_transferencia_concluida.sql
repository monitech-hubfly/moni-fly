-- 629: Funil Pré Obra e Obra — checkbox Transferência Concluída
-- na fase Transferência do Terreno (slug processos_cartorarios).
-- Idempotente. Não move cards.

DO $$
DECLARE
  v_kanban uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    SELECT id INTO v_kanban
    FROM public.kanbans
    WHERE nome IN ('Funil Pré Obra e Obra', 'Funil Operações')
    ORDER BY CASE WHEN nome = 'Funil Pré Obra e Obra' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_kanban IS NULL THEN
    RAISE NOTICE '629: Funil Pré Obra e Obra não encontrado — pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens i
  SET
    label = 'Transferência Concluída',
    tipo = 'checkbox',
    obrigatorio = false,
    visivel_candidato = false,
    ordem = 10,
    config_json = '{}'::jsonb
  FROM public.kanban_fases kf
  WHERE kf.kanban_id = v_kanban
    AND kf.slug = 'processos_cartorarios'
    AND i.fase_id = kf.id
    AND i.campo_slug = 'transferencia_concluida';

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT kf.id, 10, 'Transferência Concluída', 'checkbox', false, false, 'transferencia_concluida', '{}'::jsonb
  FROM public.kanban_fases kf
  WHERE kf.kanban_id = v_kanban
    AND kf.slug = 'processos_cartorarios'
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = kf.id
        AND i.campo_slug = 'transferencia_concluida'
    );
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('629', 'operacoes_transferencia_concluida')
ON CONFLICT (version) DO NOTHING;
