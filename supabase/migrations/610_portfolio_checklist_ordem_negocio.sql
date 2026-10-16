-- 610: ordem dos campos de Dados do Negócio no checklist do Funil Portfólio.
-- Idempotente. Não altera valores, só a sequência de exibição.

UPDATE public.kanban_fase_checklist_itens i
SET ordem = v.ordem
FROM public.kanban_fases kf,
     (VALUES
       ('tipo_aquisicao_terreno', 10),
       ('link_pasta_drive', 11),
       ('valor_terreno', 12),
       ('pct_compra_parcial_terreno', 13),
       ('pct_vgv_terrenista', 14),
       ('divida_terreno', 15),
       ('m2_terreno', 16),
       ('link_opcao_permuta', 17),
       ('prazo_opcao', 18),
       ('obs_opcao', 19),
       ('data_ass_opcao_terreno', 20),
       ('produto_modelo_casa', 21),
       ('extrato_modelo_configurado', 22),
       ('m2_casa', 23),
       ('custo_obra', 24),
       ('divida_obra', 25),
       ('link_bca', 26),
       ('link_mapa_competidores', 27),
       ('vgv_pretendido', 28),
       ('valor_recompra', 29),
       ('link_acoplamento', 30),
       ('link_gbox', 31),
       ('link_apresentacao_comite', 32),
       ('data_aprovacao_comite', 33),
       ('prazo_instrumento_garantidor', 34),
       ('obs_instrumento_garantidor', 35),
       ('data_ass_contrato_terreno', 36)
     ) AS v(campo_slug, ordem)
WHERE kf.kanban_id = 'c57120a0-991c-422b-8def-4d16a9411d45'
  AND i.fase_id = kf.id
  AND i.campo_slug = v.campo_slug
  AND i.ordem IS DISTINCT FROM v.ordem;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('610', 'portfolio_checklist_ordem_negocio')
ON CONFLICT (version) DO NOTHING;
