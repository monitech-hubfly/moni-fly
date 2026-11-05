-- 684: Loteadores já em Jurídico Cto de Parceria sem atendimento de parceria
-- ganham o card no Funil Jurídico (Recebimento, tag Cto de Parceria).
-- Idempotente. Não move o card pai.

DO $$
DECLARE
  v_loteadores uuid := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  v_juridico uuid := '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid;
  v_fase_recebimento uuid;
  v_tag uuid;
  v_responsavel uuid;
  r record;
  v_filho uuid;
  v_criados int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_loteadores) THEN
    SELECT id INTO v_loteadores FROM public.kanbans WHERE nome = 'Funil Loteadores' LIMIT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_juridico) THEN
    SELECT id INTO v_juridico FROM public.kanbans WHERE nome = 'Funil Jurídico' LIMIT 1;
  END IF;

  SELECT f.id INTO v_fase_recebimento
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_juridico
    AND f.slug = 'juridico_recebimento'
    AND f.ativo IS NOT FALSE
  ORDER BY f.ordem
  LIMIT 1;

  IF v_loteadores IS NULL OR v_juridico IS NULL OR v_fase_recebimento IS NULL THEN
    RAISE NOTICE '684: funil ou fase Recebimento não encontrados — pulando.';
    RETURN;
  END IF;

  SELECT t.id INTO v_tag
  FROM public.kanban_tags t
  WHERE t.kanban_id = v_juridico
    AND t.nome = 'Cto de Parceria'
  LIMIT 1;

  SELECT p.id INTO v_responsavel
  FROM public.profiles p
  WHERE lower(trim(p.email)) = 'isabela.correa@moni.casa'
  LIMIT 1;

  FOR r IN
    SELECT
      c.id,
      c.titulo,
      c.projeto_id,
      c.rede_franqueado_id,
      c.franqueado_id,
      c.rede_loteador_id,
      c.nome_condominio,
      c.quadra,
      c.lote,
      c.condominio_id
    FROM public.kanban_cards c
    JOIN public.kanban_fases f ON f.id = c.fase_id
    WHERE c.kanban_id = v_loteadores
      AND f.slug = 'contrato_parceria_moni_inc'
      AND COALESCE(c.arquivado, false) = false
      AND COALESCE(c.concluido, false) = false
      AND c.franqueado_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id = c.franqueado_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.kanban_cards j
        LEFT JOIN public.kanban_fases jf ON jf.id = j.fase_id
        WHERE j.origem_card_id = c.id
          AND j.kanban_id = v_juridico
          AND j.juridico_tipo_contrato = 'parceria'
          AND COALESCE(j.arquivado, false) = false
          AND COALESCE(jf.slug, '') IS DISTINCT FROM 'juridico_atendimentos_concluidos'
      )
  LOOP
    INSERT INTO public.kanban_cards (
      kanban_id,
      fase_id,
      titulo,
      origem_card_id,
      origem_kanban_id,
      origem_kanban_nome,
      projeto_id,
      rede_franqueado_id,
      nome_condominio,
      quadra,
      lote,
      condominio_id,
      franqueado_id,
      rede_loteador_id,
      status,
      juridico_origem,
      juridico_tipo_contrato,
      juridico_bolinha_count
    )
    VALUES (
      v_juridico,
      v_fase_recebimento,
      COALESCE(NULLIF(btrim(r.titulo), ''), 'Loteador'),
      r.id,
      v_loteadores,
      'Funil Loteadores',
      r.projeto_id,
      r.rede_franqueado_id,
      r.nome_condominio,
      r.quadra,
      r.lote,
      r.condominio_id,
      r.franqueado_id,
      r.rede_loteador_id,
      'ativo',
      'loteadores',
      'parceria',
      1
    )
    RETURNING id INTO v_filho;

    INSERT INTO public.kanban_card_vinculos (
      card_origem_id, card_destino_id, tipo_vinculo, card_id, vinculado_a
    )
    VALUES (r.id, v_filho, 'originou', r.id, v_filho);

    IF v_tag IS NOT NULL THEN
      INSERT INTO public.kanban_card_tags (card_id, tag_id)
      SELECT v_filho, v_tag
      WHERE NOT EXISTS (
        SELECT 1 FROM public.kanban_card_tags ct
        WHERE ct.card_id = v_filho AND ct.tag_id = v_tag
      );
    END IF;

    INSERT INTO public.kanban_atividades (
      card_id, titulo, descricao, tipo, status, prioridade, ordem, origem, tema, times_ids
    )
    VALUES (
      v_filho,
      'Card criado por bastão automático (loteadores / contrato_parceria_moni_inc → juridico_recebimento)',
      'Origem: card ' || r.id::text || '. Reparo de quem já estava em Jurídico Cto de Parceria.',
      'atividade',
      'concluida',
      'normal',
      0,
      'nativo',
      'bastao',
      ARRAY[]::uuid[]
    );

    IF v_responsavel IS NOT NULL THEN
      INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, preenchido_em)
      SELECT i.id, v_filho, v_responsavel::text, NOW()
      FROM public.kanban_fases f
      JOIN public.kanban_fase_checklist_itens i
        ON i.fase_id = f.id
       AND i.campo_slug = 'responsavel_fase'
      WHERE f.kanban_id = v_juridico
        AND f.ativo IS NOT FALSE
      ON CONFLICT (item_id, card_id) DO NOTHING;
    END IF;

    v_criados := v_criados + 1;
  END LOOP;

  RAISE NOTICE '684: % atendimento(s) de Cto de Parceria criado(s) no Jurídico.', v_criados;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('684', 'loteadores_bastao_juridico_cto_parceria')
ON CONFLICT (version) DO NOTHING;
