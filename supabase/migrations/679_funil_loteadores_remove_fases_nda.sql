-- 679: Funil Loteadores — tira as fases de NDA e manda os cards para Aguardando Ficha.
-- Idempotente. As fases saem do board com ativo = false (histórico e checklist permanecem).
-- DEV primeiro. PROD somente com confirmação explícita.

DO $$
DECLARE
  v_kanban_id uuid := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  r record;
  v_ord int;
  v_moved int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome = 'Funil Loteadores'
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '679: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_cards c
  SET fase_id = dest.id,
      entered_fase_at = now(),
      updated_at = now()
  FROM public.kanban_fases orig, public.kanban_fases dest
  WHERE c.kanban_id = v_kanban_id
    AND c.fase_id = orig.id
    AND orig.kanban_id = v_kanban_id
    AND dest.kanban_id = v_kanban_id
    AND dest.slug = 'aguardando_ficha_moni_inc'
    AND orig.slug IN (
      'nda_moni_inc',
      'assinaturas_nda_moni_inc',
      'nda_assinado_moni_inc'
    );
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE '679: cards de NDA → Aguardando Ficha: %', v_moved;

  UPDATE public.kanban_fases
  SET ativo = false,
      ordem = CASE slug
        WHEN 'nda_moni_inc' THEN 95
        WHEN 'assinaturas_nda_moni_inc' THEN 96
        WHEN 'nda_assinado_moni_inc' THEN 97
        ELSE ordem
      END
  WHERE kanban_id = v_kanban_id
    AND slug IN (
      'nda_moni_inc',
      'assinaturas_nda_moni_inc',
      'nda_assinado_moni_inc'
    );

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id
    FROM (
      VALUES
        (1,  'primeiro_contato_moni_inc'),
        (2,  'aguardando_ficha_moni_inc'),
        (3,  'novo_produto_moni_inc'),
        (4,  'viabilidade_moni_inc'),
        (5,  'validacao_moni_inc'),
        (6,  'r2_plano_teorico_moni_inc'),
        (7,  'revisoes_moni_inc'),
        (8,  'acoplamento_gbox_moni_inc'),
        (9,  'enviar_acoplamento_loteador'),
        (10, 'comite_moni_inc'),
        (11, 'revisoes_pos_comite_moni_inc'),
        (12, 'demais_comites_moni_inc'),
        (13, 'enviar_cto_parceria_moni_inc'),
        (14, 'contrato_parceria_moni_inc'),
        (15, 'assinaturas_cto_parceria_moni_inc'),
        (16, 'cto_parceria_assinado_moni_inc'),
        (17, 'passagem_waysers_moni_inc'),
        (18, 'assinados_moni_inc')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf
      ON kf.kanban_id = v_kanban_id
     AND kf.slug = t.slug
     AND kf.ativo IS TRUE
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases SET ordem = v_ord WHERE id = r.id AND ordem IS DISTINCT FROM v_ord;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('679', 'funil_loteadores_remove_fases_nda')
ON CONFLICT (version) DO NOTHING;
