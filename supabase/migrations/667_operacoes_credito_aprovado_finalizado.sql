-- 667: Funil Pré Obra e Obra — fase Crédito Aprovado após Aguardando Crédito.
-- Flag credito_finalizado no card (substitui o bastão credito_obra_ok).
-- Não move cards. Idempotente.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS credito_finalizado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.kanban_cards.credito_finalizado IS
  'Pré Obra e Obra: Crédito Finalizado. Marcada na primeira entrada do filho Crédito Obra em Concluídos.';

DO $$
DECLARE
  v_kanban uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
  v_fase uuid := 'c4e8a1b2-7f41-4d9c-8e26-3a9f5b7c1d21'::uuid;
  v_ord_ag int;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    SELECT id INTO v_kanban
    FROM public.kanbans
    WHERE nome IN ('Funil Pré Obra e Obra', 'Funil Operações')
    ORDER BY CASE WHEN nome = 'Funil Pré Obra e Obra' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_kanban IS NULL THEN
    RAISE NOTICE '667: Funil Pré Obra e Obra não encontrado — pulando fase.';
    RETURN;
  END IF;

  SELECT f.ordem
  INTO v_ord_ag
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_kanban
    AND f.slug = 'aguardando_credito'
  ORDER BY f.ativo DESC, f.ordem
  LIMIT 1;

  INSERT INTO public.kanban_fases (
    id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
  )
  SELECT
    v_fase,
    v_kanban,
    'Crédito Aprovado',
    'credito_aprovado',
    COALESCE(v_ord_ag, 90) + 1,
    NULL,
    'corridos',
    false,
    true,
    'Crédito de obra aprovado. O card chega aqui quando o Funil Crédito Obra entra em FUP Cartório pela primeira vez.',
    '[]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_kanban
      AND f.slug = 'credito_aprovado'
  );

  UPDATE public.kanban_fases
  SET
    nome = 'Crédito Aprovado',
    ativo = true,
    sla_dias = NULL,
    sla_tipo = 'corridos',
    fase_conversao = false,
    instrucoes = 'Crédito de obra aprovado. O card chega aqui quando o Funil Crédito Obra entra em FUP Cartório pela primeira vez.'
  WHERE kanban_id = v_kanban
    AND slug = 'credito_aprovado';

  IF v_ord_ag IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.kanban_fases f
       WHERE f.kanban_id = v_kanban
         AND f.ordem = v_ord_ag + 1
         AND f.slug <> 'credito_aprovado'
     )
  THEN
    UPDATE public.kanban_fases
    SET ordem = ordem + 1
    WHERE kanban_id = v_kanban
      AND ordem > v_ord_ag
      AND slug <> 'credito_aprovado';
  END IF;

  IF v_ord_ag IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET ordem = v_ord_ag + 1
    WHERE kanban_id = v_kanban
      AND slug = 'credito_aprovado';
  END IF;

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id
    FROM (
      VALUES
        (1, 'planialtimetrico'),
        (2, 'projeto_legal'),
        (3, 'aprovacao_condominio'),
        (4, 'comunique_se_condominio'),
        (5, 'aprovacao_prefeitura'),
        (6, 'comunique_se_prefeitura'),
        (7, 'revisao_bca'),
        (8, 'comite_ops_aprovado'),
        (9, 'instrumento_garantidor'),
        (10, 'processos_cartorarios'),
        (11, 'aguardando_credito'),
        (12, 'credito_aprovado'),
        (13, 'em_obra'),
        (14, 'operacoes_entregue')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf
      ON kf.kanban_id = v_kanban
     AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases
    SET ordem = v_ord, ativo = true
    WHERE id = r.id;
  END LOOP;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT f.id, 0, 'Responsável do card', 'usuario', false, false, 'responsavel_fase', '{"oculto_ui": true}'::jsonb
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_kanban
    AND f.slug = 'credito_aprovado'
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_fase'
    );

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT
    f.id,
    -2,
    'Responsável da fase',
    'select',
    false,
    false,
    'responsavel_da_fase',
    '{"oculto_ui": true, "opcoes": ["Franqueado", "Loteador", "Moní"]}'::jsonb
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_kanban
    AND f.slug = 'credito_aprovado'
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_da_fase'
    );
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('667', 'operacoes_credito_aprovado_finalizado')
ON CONFLICT (version) DO NOTHING;
