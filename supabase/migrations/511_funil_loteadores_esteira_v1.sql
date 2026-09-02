-- 511: Funil Loteadores — esteira v1.0 (15 → 19 fases).
-- Premissa: nenhum card é deletado; cards de fases desativadas são reposicionados.
-- Idempotente.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  v_from UUID;
  v_to UUID;
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome IN ('Funil Loteadores', 'Funil Moní INC')
    ORDER BY CASE WHEN nome = 'Funil Loteadores' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '511: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  -- ─── Helper: garantir fase (insert se não existir) ───────────────────────
  -- Criadas abaixo via INSERT … WHERE NOT EXISTS

  -- ─── Renames de display + SLA nas fases que permanecem ───────────────────
  UPDATE public.kanban_fases SET nome = 'Primeiro Contato', sla_dias = 1, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'primeiro_contato_moni_inc';

  UPDATE public.kanban_fases SET nome = 'R1 Conceito', sla_dias = 5, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'r1_conceito_moni_inc';

  UPDATE public.kanban_fases SET nome = 'Viabilidade / Premissas', sla_dias = 1, ativo = true
  WHERE kanban_id = v_kanban_id AND slug IN ('viabilidade_moni_inc', 'dados_loteador_moni_inc');

  UPDATE public.kanban_fases SET nome = 'Acoplamento', sla_dias = 1, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'acoplamento_moni_inc';

  UPDATE public.kanban_fases SET nome = 'Executar Material', sla_dias = 1, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'execucao_material_moni_inc';

  UPDATE public.kanban_fases SET nome = 'R2 Apresentação', sla_dias = 5, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'r2_plano_teorico_moni_inc';

  UPDATE public.kanban_fases SET nome = 'Revisões + Forma Pgto', sla_dias = 2, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_moni_inc';

  UPDATE public.kanban_fases SET nome = 'Comitê', sla_dias = 3, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'comite_moni_inc';

  UPDATE public.kanban_fases SET nome = 'Diligência', sla_dias = 10, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'diligencia_moni_inc';

  UPDATE public.kanban_fases SET nome = 'Cto de Parceria', sla_dias = 3, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'contrato_parceria_moni_inc';

  -- Contrato → Cto Showroom (rename slug + display)
  UPDATE public.kanban_fases
  SET
    nome = 'Cto Showroom',
    slug = 'cto_showroom_moni_inc',
    sla_dias = 3,
    ativo = true
  WHERE kanban_id = v_kanban_id
    AND slug = 'fechar_contrato_moni_inc';

  -- Se já existir cto_showroom e ainda houver fechar_contrato (re-run parcial), unificar depois
  IF EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'cto_showroom_moni_inc'
  ) AND EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'fechar_contrato_moni_inc'
  ) THEN
    SELECT id INTO v_to FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'cto_showroom_moni_inc' LIMIT 1;
    SELECT id INTO v_from FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'fechar_contrato_moni_inc' LIMIT 1;
    IF v_from IS NOT NULL AND v_to IS NOT NULL AND v_from <> v_to THEN
      UPDATE public.kanban_cards SET fase_id = v_to WHERE fase_id = v_from;
      UPDATE public.kanban_fases SET ativo = false, ordem = 97, nome = 'Contrato (legado)'
      WHERE id = v_from;
    END IF;
  END IF;

  -- ─── Criar fases novas ───────────────────────────────────────────────────
  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
  SELECT v_kanban_id, v.nome, v.slug, v.ordem, v.sla, true
  FROM (VALUES
    ('NDA'::text, 'nda_moni_inc'::text, 3, 3),
    ('Opção', 'opcao_moni_inc', 4, 3),
    ('Aguardando Ficha', 'aguardando_ficha_moni_inc', 5, 3),
    ('Validação', 'validacao_moni_inc', 9, 1),
    ('Acoplamento + Gbox', 'acoplamento_gbox_moni_inc', 12, 5),
    ('Revisões (pós-Comitê)', 'revisoes_pos_comite_moni_inc', 14, 2),
    ('Cto c/ Precedentes', 'cto_precedentes_moni_inc', 15, 3),
    ('Passagem para Waysers', 'passagem_waysers_moni_inc', 18, 1)
  ) AS v(nome, slug, ordem, sla)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = v_kanban_id AND kf.slug = v.slug
  );

  -- Atualizar nomes/SLA se já existiam
  UPDATE public.kanban_fases SET nome = 'NDA', sla_dias = 3, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'nda_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Opção', sla_dias = 3, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'opcao_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Aguardando Ficha', sla_dias = 3, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'aguardando_ficha_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Validação', sla_dias = 1, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'validacao_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Acoplamento + Gbox', sla_dias = 5, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'acoplamento_gbox_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Revisões (pós-Comitê)', sla_dias = 2, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_pos_comite_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Cto c/ Precedentes', sla_dias = 3, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'cto_precedentes_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Passagem para Waysers', sla_dias = 1, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'passagem_waysers_moni_inc';

  -- ─── Mover cards das fases a desativar (sem deletar) ─────────────────────
  -- Batalha de Casas → Executar Material
  SELECT id INTO v_from FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'batalha_casas_moni_inc' LIMIT 1;
  SELECT id INTO v_to FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'execucao_material_moni_inc' LIMIT 1;
  IF v_from IS NOT NULL AND v_to IS NOT NULL THEN
    UPDATE public.kanban_cards SET fase_id = v_to, entered_fase_at = COALESCE(entered_fase_at, now())
    WHERE fase_id = v_from;
  END IF;

  -- R3 Ajustes Finais → Revisões + Forma Pgto
  SELECT id INTO v_from FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'r3_ajustes_finais_moni_inc' LIMIT 1;
  SELECT id INTO v_to FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_moni_inc' LIMIT 1;
  IF v_from IS NOT NULL AND v_to IS NOT NULL THEN
    UPDATE public.kanban_cards SET fase_id = v_to, entered_fase_at = COALESCE(entered_fase_at, now())
    WHERE fase_id = v_from;
  END IF;

  -- Moní Capital → Revisões + Forma Pgto
  SELECT id INTO v_from FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'moni_capital_moni_inc' LIMIT 1;
  SELECT id INTO v_to FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_moni_inc' LIMIT 1;
  IF v_from IS NOT NULL AND v_to IS NOT NULL THEN
    UPDATE public.kanban_cards SET fase_id = v_to, entered_fase_at = COALESCE(entered_fase_at, now())
    WHERE fase_id = v_from;
  END IF;

  -- Abertura da SPE → Cto Showroom
  SELECT id INTO v_from FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'abertura_spe_moni_inc' LIMIT 1;
  SELECT id INTO v_to FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'cto_showroom_moni_inc' LIMIT 1;
  IF v_from IS NOT NULL AND v_to IS NOT NULL THEN
    UPDATE public.kanban_cards SET fase_id = v_to, entered_fase_at = COALESCE(entered_fase_at, now())
    WHERE fase_id = v_from;
  END IF;

  -- Desativar fases legado
  UPDATE public.kanban_fases
  SET ativo = false, ordem = 90 + CASE slug
    WHEN 'batalha_casas_moni_inc' THEN 1
    WHEN 'r3_ajustes_finais_moni_inc' THEN 2
    WHEN 'moni_capital_moni_inc' THEN 3
    WHEN 'abertura_spe_moni_inc' THEN 4
    ELSE 5
  END
  WHERE kanban_id = v_kanban_id
    AND slug IN (
      'batalha_casas_moni_inc',
      'r3_ajustes_finais_moni_inc',
      'moni_capital_moni_inc',
      'abertura_spe_moni_inc'
    );

  -- ─── Ordem canônica 1–19 ─────────────────────────────────────────────────
  FOR r IN
    SELECT * FROM (VALUES
      ('primeiro_contato_moni_inc'::text, 1),
      ('r1_conceito_moni_inc', 2),
      ('nda_moni_inc', 3),
      ('opcao_moni_inc', 4),
      ('aguardando_ficha_moni_inc', 5),
      ('viabilidade_moni_inc', 6),
      ('dados_loteador_moni_inc', 6), -- legado: mesma ordem da Viabilidade
      ('acoplamento_moni_inc', 7),
      ('execucao_material_moni_inc', 8),
      ('validacao_moni_inc', 9),
      ('r2_plano_teorico_moni_inc', 10),
      ('revisoes_moni_inc', 11),
      ('acoplamento_gbox_moni_inc', 12),
      ('comite_moni_inc', 13),
      ('revisoes_pos_comite_moni_inc', 14),
      ('cto_precedentes_moni_inc', 15),
      ('diligencia_moni_inc', 16),
      ('cto_showroom_moni_inc', 17),
      ('passagem_waysers_moni_inc', 18),
      ('contrato_parceria_moni_inc', 19)
    ) AS t(slug, ordem)
  LOOP
    UPDATE public.kanban_fases
    SET ordem = r.ordem, ativo = true
    WHERE kanban_id = v_kanban_id AND slug = r.slug;
  END LOOP;

  -- Preferir viabilidade_moni_inc ativa; legado dados_loteador só se não houver a nova
  IF EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'viabilidade_moni_inc' AND COALESCE(ativo, true)
  ) THEN
    UPDATE public.kanban_fases
    SET ativo = false, ordem = 96, nome = COALESCE(nome, 'Viabilidade') || ' (legado)'
    WHERE kanban_id = v_kanban_id
      AND slug = 'dados_loteador_moni_inc'
      AND NOT EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.fase_id = kanban_fases.id);
  END IF;

  RAISE NOTICE '511: esteira Loteadores v1.0 aplicada no kanban %', v_kanban_id;
END $$;

-- Colunas de confirmação «Assinou?» (Loteadores)
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS loteadores_opcao_assinada boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loteadores_opcao_assinada_em timestamptz,
  ADD COLUMN IF NOT EXISTS loteadores_cto_precedentes_assinado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loteadores_cto_precedentes_assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS loteadores_cto_showroom_assinado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loteadores_cto_showroom_assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS loteadores_cto_parceria_assinado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loteadores_cto_parceria_assinado_em timestamptz;

COMMENT ON COLUMN public.kanban_cards.loteadores_opcao_assinada IS
  'Funil Loteadores — confirmação popup Opção — Assinou?';
COMMENT ON COLUMN public.kanban_cards.loteadores_cto_precedentes_assinado IS
  'Funil Loteadores — confirmação popup Cto c/ Precedentes — Assinou?';
COMMENT ON COLUMN public.kanban_cards.loteadores_cto_showroom_assinado IS
  'Funil Loteadores — confirmação popup Cto Showroom — Assinou?';
COMMENT ON COLUMN public.kanban_cards.loteadores_cto_parceria_assinado IS
  'Funil Loteadores — confirmação popup Cto de Parceria — Assinou?';

NOTIFY pgrst, 'reload schema';
