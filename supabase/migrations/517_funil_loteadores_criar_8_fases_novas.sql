-- 517: Funil Loteadores — criar 8 fases novas + reordenar esteira canônica (1–19).
-- Idempotente: INSERT … ON CONFLICT (kanban_id, slug) DO NOTHING.
-- Coluna de posição: `ordem` (não `posicao`).

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    RAISE NOTICE '517: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  -- ─── Inserir 8 fases novas ───────────────────────────────────────────────
  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
  VALUES
    (v_kanban_id, 'NDA',                    'nda_moni_inc',                 3,  3, true),
    (v_kanban_id, 'Opção',                  'opcao_moni_inc',               4,  3, true),
    (v_kanban_id, 'Aguardando Ficha',       'aguardando_ficha_moni_inc',    5,  3, true),
    (v_kanban_id, 'Validação',              'validacao_moni_inc',           9,  1, true),
    (v_kanban_id, 'Acoplamento + Gbox',     'acoplamento_gbox_moni_inc',   12,  5, true),
    (v_kanban_id, 'Revisões',               'revisoes_pos_comite_moni_inc', 14,  2, true),
    (v_kanban_id, 'Cto c/ Precedentes',     'cto_precedentes_moni_inc',    15,  3, true),
    (v_kanban_id, 'Passagem para Waysers',  'passagem_waysers_moni_inc',   18,  1, true)
  ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

  -- Se já existiam (re-run), garantir nome / SLA / ativo das novas
  UPDATE public.kanban_fases SET nome = 'NDA',                   sla_dias = 3, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'nda_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Opção',                 sla_dias = 3, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'opcao_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Aguardando Ficha',      sla_dias = 3, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'aguardando_ficha_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Validação',             sla_dias = 1, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'validacao_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Acoplamento + Gbox',    sla_dias = 5, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'acoplamento_gbox_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Revisões',              sla_dias = 2, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_pos_comite_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Cto c/ Precedentes',    sla_dias = 3, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'cto_precedentes_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Passagem para Waysers', sla_dias = 1, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'passagem_waysers_moni_inc';

  -- ─── Reordenar todas as 19 fases canônicas ───────────────────────────────
  FOR r IN
    SELECT * FROM (VALUES
      ('primeiro_contato_moni_inc'::text, 1),
      ('r1_conceito_moni_inc', 2),
      ('nda_moni_inc', 3),
      ('opcao_moni_inc', 4),
      ('aguardando_ficha_moni_inc', 5),
      ('viabilidade_moni_inc', 6),
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

  -- Fallback: se cto_showroom ainda não existir e fechar_contrato existir, ordenar legado
  UPDATE public.kanban_fases
  SET ordem = 17, ativo = true
  WHERE kanban_id = v_kanban_id
    AND slug = 'fechar_contrato_moni_inc'
    AND NOT EXISTS (
      SELECT 1 FROM public.kanban_fases
      WHERE kanban_id = v_kanban_id AND slug = 'cto_showroom_moni_inc'
    );

  RAISE NOTICE '517: 8 fases novas + ordem canônica 1–19 aplicadas.';
END $$;
