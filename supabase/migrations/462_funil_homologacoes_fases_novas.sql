-- 462: Funil Homologações — substitui fases legadas hom_* pelas 4 fases homolog_* + checklist.
-- UUID: 69bf5668-7749-476a-a834-962a0bb0eef7 (KANBAN_IDS.HDM_HOMOLOGACOES)
-- Segurança: só desativa fases legadas se count(cards nas fases hom_*) = 0.

DO $$
DECLARE
  v_kanban_id uuid := '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid;
  v_cards_legado int := 0;
BEGIN
  SELECT COUNT(*)::int INTO v_cards_legado
  FROM public.kanban_cards c
  WHERE c.fase_id IN (
    SELECT f.id
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_kanban_id
      AND f.slug IN (
        'hom_candidatura',
        'hom_documentacao',
        'hom_tecnica',
        'hom_negociacao',
        'hom_aprovado',
        'hom_reprovado'
      )
  );

  RAISE NOTICE
    '[462] Funil Homologações — cards nas fases legadas hom_*: %',
    v_cards_legado;

  IF v_cards_legado = 0 THEN
    UPDATE public.kanban_fases
    SET ativo = false
    WHERE kanban_id = v_kanban_id
      AND slug IN (
        'hom_candidatura',
        'hom_documentacao',
        'hom_tecnica',
        'hom_negociacao',
        'hom_aprovado',
        'hom_reprovado'
      )
      AND COALESCE(ativo, true) = true;

    RAISE NOTICE '[462] Fases legadas hom_* desativadas (ativo=false).';
  ELSE
    RAISE NOTICE
      '[462] Pulando desativação das fases legadas — há % card(s). Aplicar manualmente após migração dos cards.',
      v_cards_legado;
  END IF;
END $$;

-- ─── 4 fases novas ───────────────────────────────────────────────────────────
INSERT INTO public.kanban_fases (
  kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
)
SELECT
  v_kanban_id,
  f.nome,
  f.slug,
  f.ordem,
  f.sla_dias,
  'uteis',
  f.fase_conversao,
  true,
  NULL,
  '[]'::jsonb
FROM (SELECT '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid AS v_kanban_id) k
CROSS JOIN (
  VALUES
    ('Novas Homologações',              'homolog_novas_homologacoes',     1, 3,  false),
    ('Buscar Fornecedores',             'homolog_buscar_fornecedores',    2, 10, false),
    ('Definir Composição do Produto',   'homolog_definir_composicao',     3, 3,  false),
    ('Criar Produto no Database',       'homolog_criar_produto_database', 4, 1,  true)
) AS f(nome, slug, ordem, sla_dias, fase_conversao)
WHERE EXISTS (
  SELECT 1 FROM public.kanbans kb WHERE kb.id = k.v_kanban_id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.kanban_fases kf
  WHERE kf.kanban_id = k.v_kanban_id
    AND kf.slug = f.slug
);

UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = 'uteis',
  fase_conversao = v.fase_conversao,
  ativo = true
FROM (
  VALUES
    ('homolog_novas_homologacoes',     'Novas Homologações',            1, 3,  false),
    ('homolog_buscar_fornecedores',    'Buscar Fornecedores',           2, 10, false),
    ('homolog_definir_composicao',     'Definir Composição do Produto', 3, 3,  false),
    ('homolog_criar_produto_database', 'Criar Produto no Database',     4, 1,  true)
) AS v(slug, nome, ordem, sla_dias, fase_conversao)
WHERE kf.kanban_id = '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid
  AND kf.slug = v.slug;

-- ─── Checklist — Novas Homologações ──────────────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, i.config_json::jsonb, i.placeholder
FROM public.kanban_fases f
CROSS JOIN (
  VALUES
    (1, 'Nome do produto a ser homologado', 'texto_curto', true,
     'homolog_nome_produto', '{}', NULL),
    (2, 'Grupo de fornecimento', 'texto_curto', true,
     'homolog_grupo_fornecimento', '{}', NULL),
    (3, 'Tipo de demanda', 'select', true,
     'homolog_tipo_demanda',
     '{"opcoes": ["Produto novo", "Atualização de produto"]}', NULL),
    (4, 'Descrição do produto e do uso', 'texto_longo', true,
     'homolog_descricao_produto', '{}', NULL),
    (5, 'Fornecedores já contatados', 'texto_longo', false,
     'homolog_fornecedores_contatados', '{}', NULL),
    (6, 'Estimativa de valor', 'numero', false,
     'homolog_estimativa_valor', '{}', NULL),
    (7, 'Anexos - imagens e projetos de referência', 'anexo', false,
     'homolog_anexos_referencia', '{}', NULL)
) AS i(ordem, label, tipo, obrigatorio, campo_slug, config_json, placeholder)
WHERE f.kanban_id = '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid
  AND f.slug = 'homolog_novas_homologacoes'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Checklist — Definir Composição do Produto ───────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, i.config_json::jsonb, i.placeholder
FROM public.kanban_fases f
CROSS JOIN (
  VALUES
    (1, 'Nome do Produto composto', 'texto_curto', true,
     'homolog_nome_produto_composto', '{}', NULL),
    (2, 'Itens do produto', 'tabela', false,
     'homolog_itens_produto',
     '{"modo":"repetivel","colunas":[{"key":"nome","label":"Nome","tipo":"texto_curto"},{"key":"unidade","label":"Unidade de medida","tipo":"texto_curto"},{"key":"valor_unitario","label":"Valor unitário","tipo":"numero"},{"key":"consumo","label":"Consumo","tipo":"numero"}]}',
     NULL),
    (3, 'Insumos adicionais', 'tabela', false,
     'homolog_insumos_adicionais',
     '{"modo":"repetivel","colunas":[{"key":"nome","label":"Nome","tipo":"texto_curto"},{"key":"unidade","label":"Unidade","tipo":"texto_curto"},{"key":"valor","label":"Valor","tipo":"numero"},{"key":"consumo","label":"Consumo","tipo":"numero"},{"key":"fornecedor","label":"Fornecedor consultado","tipo":"texto_curto"},{"key":"anexo_orcamento","label":"Anexo do orçamento","tipo":"anexo"}]}',
     NULL),
    (4, 'Frete - valor unitário', 'numero', false,
     'homolog_frete_valor_unitario', '{}', NULL),
    (5, 'Mão de obra de instalação', 'tabela', false,
     'homolog_mao_obra_instalacao',
     '{"modo":"repetivel","colunas":[{"key":"unidade","label":"Unidade","tipo":"texto_curto"},{"key":"valor","label":"Valor","tipo":"numero"},{"key":"consumo","label":"Consumo","tipo":"numero"},{"key":"fornecedor","label":"Fornecedor consultado","tipo":"texto_curto"},{"key":"anexo_orcamento","label":"Anexo do orçamento","tipo":"anexo"}]}',
     NULL)
) AS i(ordem, label, tipo, obrigatorio, campo_slug, config_json, placeholder)
WHERE f.kanban_id = '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid
  AND f.slug = 'homolog_definir_composicao'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Checklist — Criar Produto no Database ───────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, i.config_json::jsonb, i.placeholder
FROM public.kanban_fases f
CROSS JOIN (
  VALUES
    (1, 'Categoria do produto no database', 'texto_curto', true,
     'homolog_categoria_database', '{}', NULL)
) AS i(ordem, label, tipo, obrigatorio, campo_slug, config_json, placeholder)
WHERE f.kanban_id = '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid
  AND f.slug = 'homolog_criar_produto_database'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Responsável da fase (padrão oculto_ui) nas fases novas ──────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
)
SELECT
  f.id, -2, 'Responsável da fase — tipo', 'select', false, false,
  'responsavel_da_fase_tipo',
  '{"oculto_ui": true, "opcoes": ["Franqueado", "Moní"]}'::jsonb
FROM public.kanban_fases f
WHERE f.kanban_id = '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid
  AND f.slug LIKE 'homolog_%'
  AND COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.campo_slug = 'responsavel_da_fase_tipo'
  );

INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
)
SELECT
  f.id, -1, 'Responsável da fase — usuário Moní', 'usuario', false, false,
  'responsavel_da_fase_usuario',
  '{"oculto_ui": true}'::jsonb
FROM public.kanban_fases f
WHERE f.kanban_id = '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid
  AND f.slug LIKE 'homolog_%'
  AND COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.campo_slug = 'responsavel_da_fase_usuario'
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('462', 'funil_homologacoes_fases_novas')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
