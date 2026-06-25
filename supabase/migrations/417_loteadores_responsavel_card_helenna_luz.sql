-- 417: Funil Loteadores — corrige responsável do card Thais Kim → Helenna Luz (dados legados).
-- O campo é kanban_fase_checklist_respostas.valor (UUID do profile), não e-mail nem nome.

DO $$
DECLARE
  v_kanban_id uuid := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  v_thais_id uuid;
  v_helenna_id uuid;
  v_updated int;
BEGIN
  SELECT id INTO v_thais_id
  FROM public.profiles
  WHERE lower(trim(email)) = 'kim@moni.casa'
  LIMIT 1;

  SELECT id INTO v_helenna_id
  FROM public.profiles
  WHERE lower(trim(email)) = 'helenna.luz@moni.casa'
  LIMIT 1;

  IF v_thais_id IS NULL OR v_helenna_id IS NULL THEN
    RAISE NOTICE '417: profiles Thais Kim / Helenna Luz não encontrados; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_respostas r
  SET
    valor = v_helenna_id::text,
    preenchido_em = NOW()
  FROM public.kanban_fase_checklist_itens i
  INNER JOIN public.kanban_fases f ON f.id = i.fase_id
  WHERE r.item_id = i.id
    AND f.kanban_id = v_kanban_id
    AND EXISTS (
      SELECT 1
      FROM public.kanban_cards c
      WHERE c.id = r.card_id
        AND c.kanban_id = v_kanban_id
    )
    AND i.campo_slug IN ('responsavel_fase', 'responsavel_contato', 'responsavel_revisao')
    AND trim(r.valor) = v_thais_id::text;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '417: % resposta(s) de responsável do card atualizada(s) (Thais Kim → Helenna Luz).', v_updated;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('417', 'loteadores_responsavel_card_helenna_luz')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
