-- 653: Funil Projeto Legal — tira do quadro "C: Projeto Aprovado" e
-- "Aguardando Submeter na Prefeitura". Fases ficam inativas (histórico preservado).
-- Cards que ainda estiverem nelas vão para "P: Protocolo em Andamento".
-- Aplicar DEV primeiro; PROD somente com confirmação explícita.

DO $$
DECLARE
  v_kanban uuid := '39de341d-aebf-481c-9118-ce6fc6574187'::uuid;
  v_destino uuid;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    SELECT id INTO v_kanban
    FROM public.kanbans
    WHERE nome = 'Funil Projeto Legal'
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban IS NULL THEN
    RAISE NOTICE '653: Funil Projeto Legal não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_destino
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban
    AND slug = 'pl_p_protocolo_andamento'
  LIMIT 1;

  IF v_destino IS NOT NULL THEN
    UPDATE public.kanban_cards c
    SET fase_id = v_destino,
        updated_at = now()
    FROM public.kanban_fases f
    WHERE c.fase_id = f.id
      AND f.kanban_id = v_kanban
      AND f.slug IN ('pl_c_projeto_aprovado', 'pl_aguardando_prefeitura');
  END IF;

  UPDATE public.kanban_fases
  SET ativo = false,
      ordem = CASE slug
        WHEN 'pl_c_projeto_aprovado' THEN 98
        WHEN 'pl_aguardando_prefeitura' THEN 99
        ELSE ordem
      END
  WHERE kanban_id = v_kanban
    AND slug IN ('pl_c_projeto_aprovado', 'pl_aguardando_prefeitura');

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id
    FROM (
      VALUES
        (1, 'pl_nova_demanda'),
        (2, 'pl_pontos_em_aberto'),
        (3, 'pl_em_execucao'),
        (4, 'pl_em_validacao'),
        (5, 'pl_c_protocolo_andamento'),
        (6, 'pl_c_em_comuniquese'),
        (7, 'pl_c_validacao_comuniquese'),
        (8, 'pl_p_protocolo_andamento'),
        (9, 'pl_p_em_comuniquese'),
        (10, 'pl_p_validacao_comuniquese'),
        (11, 'pl_p_projeto_aprovado'),
        (12, 'pl_pagamentos')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf
      ON kf.kanban_id = v_kanban
     AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases
    SET ordem = v_ord,
        ativo = true
    WHERE id = r.id;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('653', 'projeto_legal_remove_colunas_c_aprovado')
ON CONFLICT (version) DO NOTHING;
