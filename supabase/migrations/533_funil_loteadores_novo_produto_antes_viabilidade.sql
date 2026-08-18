-- 533: Funil Loteadores — Novo Produto antes de Viabilidade / Premissas.
-- Reverte a ordem relativa da 531. Idempotente. Não move cards entre fases.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  r RECORD;
  v_instr_novo TEXT :=
    E'Entrada: Carteira existente avaliada como incompatível com as necessidades do loteador.\n'
    'Saída: Novo produto definido e validado → avança para Viabilidade / Premissas.';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome IN ('Funil Loteadores', 'Funil Moní INC')
    ORDER BY CASE WHEN nome = 'Funil Loteadores' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '533: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  -- Reordenar esteira canônica 1–21 (valores absolutos — re-run seguro).
  FOR r IN
    SELECT * FROM (VALUES
      ('primeiro_contato_moni_inc'::text, 1),
      ('loteador_cadastro', 1), -- legado / alias primeira fase
      ('r1_conceito_moni_inc', 2),
      ('nda_moni_inc', 3),
      ('opcao_moni_inc', 4),
      ('aguardando_ficha_moni_inc', 5),
      ('novo_produto_moni_inc', 6),
      ('viabilidade_moni_inc', 7),
      ('dados_loteador_moni_inc', 7), -- legado Viabilidade
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
      ('contrato_parceria_moni_inc', 20),
      ('assinados_moni_inc', 21)
    ) AS t(slug, ordem)
  LOOP
    UPDATE public.kanban_fases
    SET ordem = r.ordem
    WHERE kanban_id = v_kanban_id AND slug = r.slug;
  END LOOP;

  UPDATE public.kanban_fases
  SET instrucoes = v_instr_novo
  WHERE kanban_id = v_kanban_id
    AND slug = 'novo_produto_moni_inc';

  RAISE NOTICE '533: Novo Produto (ordem 6) antes de Viabilidade / Premissas (ordem 7).';
END $$;

NOTIFY pgrst, 'reload schema';
