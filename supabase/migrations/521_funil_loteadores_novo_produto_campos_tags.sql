-- 521: Funil Loteadores — fase Novo Produto + campo Viabilidade + Memorial Gbox + tags dependencia.
-- Idempotente. Não move cards. Não remove tags/itens existentes.
-- Reversão (manual): ver bloco no final do arquivo.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  v_fase_id UUID;
  v_item_id UUID;
  r RECORD;
  v_instr_viab TEXT :=
    E'A ação central é compreender se temos casas para a parceria ou se precisa de apoio de produto.\n'
    '1. Mapa de Competidores.\n'
    '2. Preencher BCA.\n'
    '3. Preparar 3 ofertas — uma delas deve incluir o showroom.\n'
    '4. Simular planilhas.\n'
    '5. Definir o produto do showroom, demais produtos que podem ser ofertados + gadgets.\n'
    '6. Patrocínio.\n'
    '7. Como será o pagamento e crédito.';
  v_instr_novo TEXT :=
    E'Entrada: Carteira existente avaliada como incompatível com as necessidades do loteador.\n'
    'Saída: Novo produto definido e validado → avança para Viabilidade / Premissas.';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    RAISE NOTICE '521: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  -- ─── 1) Fase Novo Produto (entre Aguardando Ficha e Viabilidade) ──────────
  INSERT INTO public.kanban_fases (
    kanban_id, nome, slug, ordem, sla_dias, sla_tipo, ativo, instrucoes, materiais
  )
  SELECT
    v_kanban_id,
    'Novo Produto',
    'novo_produto_moni_inc',
    6,
    20,
    'uteis',
    true,
    v_instr_novo,
    '[]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug = 'novo_produto_moni_inc'
  );

  UPDATE public.kanban_fases
  SET nome = 'Novo Produto',
      sla_dias = 20,
      sla_tipo = 'uteis',
      ativo = true,
      instrucoes = v_instr_novo
  WHERE kanban_id = v_kanban_id
    AND slug = 'novo_produto_moni_inc';

  -- Reordenar esteira canônica 1–20 (valores absolutos — re-run seguro).
  -- Não altera ativo das demais fases; não toca slugs legado (loteador_cadastro etc.).
  FOR r IN
    SELECT * FROM (VALUES
      ('primeiro_contato_moni_inc'::text, 1),
      ('r1_conceito_moni_inc', 2),
      ('nda_moni_inc', 3),
      ('opcao_moni_inc', 4),
      ('aguardando_ficha_moni_inc', 5),
      ('novo_produto_moni_inc', 6),
      ('viabilidade_moni_inc', 7),
      ('acoplamento_moni_inc', 8),
      ('execucao_material_moni_inc', 9),
      ('validacao_moni_inc', 10),
      ('r2_plano_teorico_moni_inc', 11),
      ('revisoes_moni_inc', 12),
      ('acoplamento_gbox_moni_inc', 13),
      ('comite_moni_inc', 14),
      ('revisoes_pos_comite_moni_inc', 15),
      ('cto_precedentes_moni_inc', 16),
      ('diligencia_moni_inc', 17),
      ('cto_showroom_moni_inc', 18),
      ('passagem_waysers_moni_inc', 19),
      ('contrato_parceria_moni_inc', 20)
    ) AS t(slug, ordem)
  LOOP
    UPDATE public.kanban_fases
    SET ordem = r.ordem
    WHERE kanban_id = v_kanban_id AND slug = r.slug;
  END LOOP;

  -- ─── 2) Viabilidade / Premissas — instrução + campo ───────────────────────
  UPDATE public.kanban_fases
  SET instrucoes = v_instr_viab
  WHERE kanban_id = v_kanban_id
    AND slug = 'viabilidade_moni_inc';

  -- ─── 3) Campos: Produto escolhido + Memorial descritivo ───────────────────
  FOR r IN
    SELECT * FROM (VALUES
      ('viabilidade_moni_inc'::text, 1, 'Produto escolhido', 'texto_curto', 'produto_escolhido'),
      ('acoplamento_gbox_moni_inc', 1, 'Memorial descritivo', 'url', 'memorial_descritivo')
    ) AS t(fase_slug, ordem, label, tipo, campo_slug)
  LOOP
    SELECT id INTO v_fase_id
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = r.fase_slug
    LIMIT 1;
    IF v_fase_id IS NULL THEN CONTINUE; END IF;

    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = r.campo_slug
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = r.ordem,
          label = r.label,
          tipo = r.tipo,
          obrigatorio = false,
          visivel_candidato = true,
          config_json = (COALESCE(config_json, '{}'::jsonb) - 'oculto_ui')
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, r.ordem, r.label, r.tipo, false, true, r.campo_slug, '{}'::jsonb
      );
    END IF;
  END LOOP;

  -- ─── 4) Tags de dependência financeira ────────────────────────────────────
  INSERT INTO public.kanban_tags (kanban_id, nome, cor)
  SELECT v_kanban_id, t.nome, t.cor
  FROM (VALUES
    ('dependencia:moni-capital'::text, '#D4AD68'),
    ('dependencia:divida', '#D4AD68'),
    ('dependencia:comite', '#D4AD68')
  ) AS t(nome, cor)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_tags existing
    WHERE existing.kanban_id = v_kanban_id
      AND existing.nome = t.nome
  );

  RAISE NOTICE '521: Novo Produto + campos Viabilidade/Gbox + tags dependencia aplicados.';
END $$;

NOTIFY pgrst, 'reload schema';

-- Reversão (não executar no UP):
-- 1) DELETE FROM kanban_tags WHERE kanban_id = '3e7b6ec7-…' AND nome IN
--    ('dependencia:moni-capital','dependencia:divida','dependencia:comite');
-- 2) Restaurar instrucoes de viabilidade_moni_inc (sem a 1ª linha nova).
-- 3) Ocultar/remover itens produto_escolhido e memorial_descritivo se sem respostas.
-- 4) DELETE fase novo_produto_moni_inc somente se COUNT(cards)=0; restaurar ordem 1–19.
