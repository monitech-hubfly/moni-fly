-- Funil Loteadores: aplicar migrations 307–313 em produção (SQL Editor Supabase).
-- Idempotente — pode rodar mais de uma vez.
-- Após executar, recarregue /loteadores (Ctrl+Shift+R).

-- ─── 307: Abertura SPE ───────────────────────────────────────────────────────

DO $$
DECLARE
  v_kanban_id UUID;
  v_ordem_r3 INT;
  v_sla_dias INT;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome IN ('Funil Loteadores', 'Funil Moní INC')
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '307: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'abertura_spe_moni_inc'
  ) THEN
    RAISE NOTICE '307: fase Abertura SPE já existe; pulando.';
    RETURN;
  END IF;

  SELECT ordem, sla_dias INTO v_ordem_r3, v_sla_dias
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'r3_ajustes_finais_moni_inc' AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_ordem_r3 IS NULL THEN
    RAISE NOTICE '307: fase R3 não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id AND ordem > v_ordem_r3 AND COALESCE(ativo, true) = true;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
  VALUES (v_kanban_id, 'Abertura SPE', 'abertura_spe_moni_inc', v_ordem_r3 + 1, COALESCE(v_sla_dias, 7), true, NULL, '[]'::jsonb);
END;
$$;

-- ─── 308: Moní Capital ───────────────────────────────────────────────────────

DO $$
DECLARE
  v_kanban_id UUID;
  v_ordem_fechar INT;
  v_sla_dias INT;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid OR nome IN ('Funil Loteadores', 'Funil Moní INC')
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END LIMIT 1;
  IF v_kanban_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'moni_capital_moni_inc') THEN RETURN; END IF;

  SELECT ordem, sla_dias INTO v_ordem_fechar, v_sla_dias FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'fechar_contrato_moni_inc' AND COALESCE(ativo, true) = true LIMIT 1;
  IF v_ordem_fechar IS NULL THEN RETURN; END IF;

  UPDATE public.kanban_fases SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id AND ordem > v_ordem_fechar AND COALESCE(ativo, true) = true;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
  VALUES (v_kanban_id, 'Moní Capital', 'moni_capital_moni_inc', v_ordem_fechar + 1, COALESCE(v_sla_dias, 7), true, NULL, '[]'::jsonb);
END;
$$;

-- ─── 309: Dados do Loteador ──────────────────────────────────────────────────

DO $$
DECLARE
  v_kanban_id UUID;
  v_ordem_r1 INT;
  v_sla_dias INT;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid OR nome IN ('Funil Loteadores', 'Funil Moní INC')
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END LIMIT 1;
  IF v_kanban_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'dados_loteador_moni_inc') THEN RETURN; END IF;

  SELECT ordem, sla_dias INTO v_ordem_r1, v_sla_dias FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'r1_conceito_moni_inc' AND COALESCE(ativo, true) = true LIMIT 1;
  IF v_ordem_r1 IS NULL THEN RETURN; END IF;

  UPDATE public.kanban_fases SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id AND ordem > v_ordem_r1 AND COALESCE(ativo, true) = true;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
  VALUES (v_kanban_id, 'Dados do Loteador', 'dados_loteador_moni_inc', v_ordem_r1 + 1, COALESCE(v_sla_dias, 7), true, NULL, '[]'::jsonb);
END;
$$;

-- ─── 310: Comitê ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_kanban_id UUID;
  v_ordem_r2 INT;
  v_sla_dias INT;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid OR nome IN ('Funil Loteadores', 'Funil Moní INC')
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END LIMIT 1;
  IF v_kanban_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'comite_moni_inc') THEN RETURN; END IF;

  SELECT ordem, sla_dias INTO v_ordem_r2, v_sla_dias FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'r2_plano_teorico_moni_inc' AND COALESCE(ativo, true) = true LIMIT 1;
  IF v_ordem_r2 IS NULL THEN RETURN; END IF;

  UPDATE public.kanban_fases SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id AND ordem > v_ordem_r2 AND COALESCE(ativo, true) = true;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
  VALUES (v_kanban_id, 'Comitê', 'comite_moni_inc', v_ordem_r2 + 1, COALESCE(v_sla_dias, 7), true, NULL, '[]'::jsonb);
END;
$$;

-- ─── 311: Contrato de Parceria ───────────────────────────────────────────────

DO $$
DECLARE
  v_kanban_id UUID;
  v_ordem_moni_capital INT;
  v_sla_dias INT;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid OR nome IN ('Funil Loteadores', 'Funil Moní INC')
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END LIMIT 1;
  IF v_kanban_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'contrato_parceria_moni_inc') THEN RETURN; END IF;

  SELECT ordem, sla_dias INTO v_ordem_moni_capital, v_sla_dias FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'moni_capital_moni_inc' AND COALESCE(ativo, true) = true LIMIT 1;
  IF v_ordem_moni_capital IS NULL THEN RETURN; END IF;

  UPDATE public.kanban_fases SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id AND ordem > v_ordem_moni_capital AND COALESCE(ativo, true) = true;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
  VALUES (v_kanban_id, 'Contrato de Parceria', 'contrato_parceria_moni_inc', v_ordem_moni_capital + 1, COALESCE(v_sla_dias, 7), true, NULL, '[]'::jsonb);
END;
$$;

-- ─── 312: Acoplamento ────────────────────────────────────────────────────────

DO $$
DECLARE
  v_kanban_id UUID;
  v_ordem_anchor INT;
  v_sla_dias INT := 5;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid OR nome IN ('Funil Loteadores', 'Funil Moní INC')
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END LIMIT 1;
  IF v_kanban_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'acoplamento_moni_inc') THEN RETURN; END IF;

  SELECT ordem INTO v_ordem_anchor FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'dados_loteador_moni_inc' AND COALESCE(ativo, true) = true LIMIT 1;

  IF v_ordem_anchor IS NULL THEN
    SELECT ordem INTO v_ordem_anchor FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'r1_conceito_moni_inc' AND COALESCE(ativo, true) = true LIMIT 1;
  END IF;

  IF v_ordem_anchor IS NULL THEN RETURN; END IF;

  UPDATE public.kanban_fases SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id AND ordem > v_ordem_anchor AND COALESCE(ativo, true) = true;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
  VALUES (v_kanban_id, 'Acoplamento', 'acoplamento_moni_inc', v_ordem_anchor + 1, v_sla_dias, true, NULL, '[]'::jsonb);
END;
$$;

-- ─── 313: ordem e SLAs ───────────────────────────────────────────────────────

DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid OR nome IN ('Funil Loteadores', 'Funil Moní INC')
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END LIMIT 1;
  IF v_kanban_id IS NULL THEN RETURN; END IF;

  UPDATE public.kanban_fases AS kf
  SET ordem = v.ordem, sla_dias = COALESCE(v.sla_dias, kf.sla_dias)
  FROM (VALUES
    ('primeiro_contato_moni_inc', 1, 2),
    ('r1_conceito_moni_inc', 2, 5),
    ('dados_loteador_moni_inc', 3, 3),
    ('acoplamento_moni_inc', 4, 5),
    ('r2_plano_teorico_moni_inc', 5, 2),
    ('comite_moni_inc', 6, 3),
    ('r3_ajustes_finais_moni_inc', 7, 2),
    ('abertura_spe_moni_inc', 8, 3),
    ('fechar_contrato_moni_inc', 9, 5),
    ('moni_capital_moni_inc', 10, NULL::integer),
    ('contrato_parceria_moni_inc', 11, NULL::integer)
  ) AS v(slug, ordem, sla_dias)
  WHERE kf.kanban_id = v_kanban_id AND kf.slug = v.slug AND COALESCE(kf.ativo, true) = true;
END;
$$;

-- Conferência
SELECT ordem, nome, slug, sla_dias
FROM public.kanban_fases
WHERE kanban_id = (
  SELECT id FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid OR nome = 'Funil Loteadores'
  LIMIT 1
)
AND COALESCE(ativo, true) = true
ORDER BY ordem;
