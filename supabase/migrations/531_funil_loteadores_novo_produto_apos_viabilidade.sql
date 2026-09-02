-- 531: Funil Loteadores — Novo Produto após Viabilidade / Premissas.
-- Idempotente. Não move cards entre fases; só reordena `ordem` e ajusta instrução.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  r RECORD;
  v_instr_novo TEXT :=
    E'Entrada: Carteira existente avaliada como incompatível com as necessidades do loteador (após Viabilidade / Premissas).\n'
    'Saída: Novo produto definido e validado → avança para Acoplamento.';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    RAISE NOTICE '531: Funil Loteadores não encontrado — pulando.';
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
      ('viabilidade_moni_inc', 6),
      ('dados_loteador_moni_inc', 6), -- legado Viabilidade
      ('novo_produto_moni_inc', 7),
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

  RAISE NOTICE '531: Novo Produto (ordem 7) após Viabilidade / Premissas (ordem 6).';
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('531', 'funil_loteadores_novo_produto_apos_viabilidade')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
