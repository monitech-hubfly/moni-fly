-- 626: GBOX Ozempic em Dados do Negócio e checklist do Funil Acoplamento.
-- Acoplamento, sondagem, pranchas, imagens, vídeo e metragens nas fases
-- Modelagem da Casa, Gbox e Alterações. Gbox e Versão Ozempic em Gbox e Alterações.
-- Obrigatórios nessas fases. Idempotente. Não move cards.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS link_gbox_ozempic text;

COMMENT ON COLUMN public.processo_step_one.link_gbox_ozempic IS
  'Link do GBOX Ozempic. Espelhado no checklist via negocio:link_gbox_ozempic.';

DO $$
DECLARE
  v_kanban uuid := '15847602-231d-4937-a06f-82027eb87ef3'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    SELECT id INTO v_kanban
    FROM public.kanbans
    WHERE nome = 'Funil Acoplamento'
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban IS NULL THEN
    RAISE NOTICE '626: kanban Funil Acoplamento não encontrado; pulando.';
    RETURN;
  END IF;

  CREATE TEMP TABLE _acop (
    fase_slug text,
    campo_slug text,
    label text,
    tipo text,
    chave text,
    ordem int
  ) ON COMMIT DROP;

  INSERT INTO _acop (fase_slug, campo_slug, label, tipo, chave, ordem)
  VALUES
    ('modelagem_casa_gbox', 'link_acoplamento', 'Acoplamento', 'url', 'negocio:link_acoplamento', 10),
    ('gbox_acoplamento', 'link_acoplamento', 'Acoplamento', 'url', 'negocio:link_acoplamento', 10),
    ('alteracoes_acoplamento', 'link_acoplamento', 'Acoplamento', 'url', 'negocio:link_acoplamento', 10),
    ('modelagem_casa_gbox', 'acoplamento_pontos_sondagem', 'Acoplamento com os pontos de sondagem', 'texto_longo', 'acoplamento:acoplamento_pontos_sondagem', 11),
    ('gbox_acoplamento', 'acoplamento_pontos_sondagem', 'Acoplamento com os pontos de sondagem', 'texto_longo', 'acoplamento:acoplamento_pontos_sondagem', 11),
    ('alteracoes_acoplamento', 'acoplamento_pontos_sondagem', 'Acoplamento com os pontos de sondagem', 'texto_longo', 'acoplamento:acoplamento_pontos_sondagem', 11),
    ('modelagem_casa_gbox', 'pranchas_pdf', 'Pranchas em PDF (plantas e cortes)', 'url', 'acoplamento:pranchas_pdf', 12),
    ('gbox_acoplamento', 'pranchas_pdf', 'Pranchas em PDF (plantas e cortes)', 'url', 'acoplamento:pranchas_pdf', 12),
    ('alteracoes_acoplamento', 'pranchas_pdf', 'Pranchas em PDF (plantas e cortes)', 'url', 'acoplamento:pranchas_pdf', 12),
    ('modelagem_casa_gbox', 'imagens_3d', 'Imagens 3D', 'url', 'acoplamento:imagens_3d', 13),
    ('gbox_acoplamento', 'imagens_3d', 'Imagens 3D', 'url', 'acoplamento:imagens_3d', 13),
    ('alteracoes_acoplamento', 'imagens_3d', 'Imagens 3D', 'url', 'acoplamento:imagens_3d', 13),
    ('modelagem_casa_gbox', 'video_360_acoplamento', 'Vídeo 360 do acoplamento', 'url', 'acoplamento:video_360_acoplamento', 14),
    ('gbox_acoplamento', 'video_360_acoplamento', 'Vídeo 360 do acoplamento', 'url', 'acoplamento:video_360_acoplamento', 14),
    ('alteracoes_acoplamento', 'video_360_acoplamento', 'Vídeo 360 do acoplamento', 'url', 'acoplamento:video_360_acoplamento', 14),
    ('modelagem_casa_gbox', 'tabela_metragens', 'Tabela de metragens (área útil e total de venda)', 'url', 'acoplamento:tabela_metragens', 15),
    ('gbox_acoplamento', 'tabela_metragens', 'Tabela de metragens (área útil e total de venda)', 'url', 'acoplamento:tabela_metragens', 15),
    ('alteracoes_acoplamento', 'tabela_metragens', 'Tabela de metragens (área útil e total de venda)', 'url', 'acoplamento:tabela_metragens', 15),
    ('gbox_acoplamento', 'link_gbox', 'Gbox', 'url', 'negocio:link_gbox', 16),
    ('alteracoes_acoplamento', 'link_gbox', 'Gbox', 'url', 'negocio:link_gbox', 16),
    ('gbox_acoplamento', 'link_gbox_ozempic', 'Gbox — Versão Ozempic', 'url', 'negocio:link_gbox_ozempic', 17),
    ('alteracoes_acoplamento', 'link_gbox_ozempic', 'Gbox — Versão Ozempic', 'url', 'negocio:link_gbox_ozempic', 17);

  UPDATE public.kanban_fase_checklist_itens i
  SET
    label = n.label,
    tipo = n.tipo,
    obrigatorio = true,
    visivel_candidato = true,
    campo_slug = n.campo_slug,
    chave_compartilhada = n.chave,
    ordem = n.ordem,
    placeholder = CASE WHEN n.tipo = 'url' THEN 'https://…' ELSE NULL END
  FROM _acop n
  JOIN public.kanban_fases kf
    ON kf.kanban_id = v_kanban
   AND kf.slug = n.fase_slug
  WHERE i.fase_id = kf.id
    AND (
      i.campo_slug = n.campo_slug
      OR regexp_replace(lower(trim(i.label)), '[—–-]', '-', 'g')
       = regexp_replace(lower(trim(n.label)), '[—–-]', '-', 'g')
    );

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, chave_compartilhada, placeholder
  )
  SELECT
    kf.id,
    n.ordem,
    n.label,
    n.tipo,
    true,
    true,
    n.campo_slug,
    '{}'::jsonb,
    n.chave,
    CASE WHEN n.tipo = 'url' THEN 'https://…' ELSE NULL END
  FROM _acop n
  JOIN public.kanban_fases kf
    ON kf.kanban_id = v_kanban
   AND kf.slug = n.fase_slug
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = kf.id
      AND (
        i.campo_slug = n.campo_slug
        OR regexp_replace(lower(trim(i.label)), '[—–-]', '-', 'g')
         = regexp_replace(lower(trim(n.label)), '[—–-]', '-', 'g')
      )
  );

  INSERT INTO public.kanban_card_checklist_compartilhado (card_id, chave, valor, atualizado_em)
  SELECT DISTINCT ON (r.card_id, i.chave_compartilhada)
    r.card_id,
    i.chave_compartilhada,
    to_jsonb(trim(r.valor)),
    NOW()
  FROM public.kanban_fase_checklist_respostas r
  JOIN public.kanban_fase_checklist_itens i ON i.id = r.item_id
  JOIN public.kanban_fases f ON f.id = i.fase_id
  WHERE f.kanban_id = v_kanban
    AND i.chave_compartilhada IS NOT NULL
    AND NULLIF(trim(r.valor), '') IS NOT NULL
  ORDER BY r.card_id, i.chave_compartilhada, r.preenchido_em DESC NULLS LAST
  ON CONFLICT (card_id, chave) DO NOTHING;

  UPDATE public.processo_step_one p
  SET link_acoplamento = src.valor
  FROM (
    SELECT c.processo_step_one_id AS pid, comp.valor #>> '{}' AS valor
    FROM public.kanban_card_checklist_compartilhado comp
    JOIN public.kanban_cards c ON c.id = comp.card_id
    WHERE comp.chave = 'negocio:link_acoplamento'
      AND c.processo_step_one_id IS NOT NULL
  ) src
  WHERE p.id = src.pid
    AND NULLIF(trim(COALESCE(p.link_acoplamento, '')), '') IS NULL
    AND NULLIF(trim(COALESCE(src.valor, '')), '') IS NOT NULL;

  UPDATE public.processo_step_one p
  SET link_gbox = src.valor
  FROM (
    SELECT c.processo_step_one_id AS pid, comp.valor #>> '{}' AS valor
    FROM public.kanban_card_checklist_compartilhado comp
    JOIN public.kanban_cards c ON c.id = comp.card_id
    WHERE comp.chave = 'negocio:link_gbox'
      AND c.processo_step_one_id IS NOT NULL
  ) src
  WHERE p.id = src.pid
    AND NULLIF(trim(COALESCE(p.link_gbox, '')), '') IS NULL
    AND NULLIF(trim(COALESCE(src.valor, '')), '') IS NOT NULL;

  UPDATE public.processo_step_one p
  SET link_gbox_ozempic = src.valor
  FROM (
    SELECT c.processo_step_one_id AS pid, comp.valor #>> '{}' AS valor
    FROM public.kanban_card_checklist_compartilhado comp
    JOIN public.kanban_cards c ON c.id = comp.card_id
    WHERE comp.chave = 'negocio:link_gbox_ozempic'
      AND c.processo_step_one_id IS NOT NULL
  ) src
  WHERE p.id = src.pid
    AND NULLIF(trim(COALESCE(p.link_gbox_ozempic, '')), '') IS NULL
    AND NULLIF(trim(COALESCE(src.valor, '')), '') IS NOT NULL;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('626', 'acoplamento_checklist_gbox_ozempic')
ON CONFLICT (version) DO NOTHING;
