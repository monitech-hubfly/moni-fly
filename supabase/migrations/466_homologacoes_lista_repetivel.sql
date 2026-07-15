-- 466: Homologações — tipo genérico lista_repetivel + ajustes checklist (anexo_multiplo / lista_repetivel).
-- Abordagem (a): tipo reutilizável com colunas em config_json.colunas.
-- Idempotente. Não aplica em PROD sem confirmação.

-- ─── Constraint: adicionar lista_repetivel ───────────────────────────────────
ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'texto_curto'::text,
    'texto_longo'::text,
    'email'::text,
    'telefone'::text,
    'numero'::text,
    'url'::text,
    'anexo'::text,
    'anexo_multiplo'::text,
    'anexo_template'::text,
    'checkbox'::text,
    'data'::text,
    'hora'::text,
    'select'::text,
    'usuario'::text,
    'cnpj'::text,
    'catalog_casa'::text,
    'calculado'::text,
    'moeda'::text,
    'faixa_moeda'::text,
    'faixa_numero'::text,
    'tabela'::text,
    'lista_repetivel'::text,
    'condominio'::text,
    'pesquisa_condominio'::text,
    'lotes_condominio'::text,
    'listagem_casas_zap'::text,
    'dados_cidade_ibge'::text,
    'mapa_praca'::text,
    'configurador_casas_ranking'::text,
    'bca_simulador'::text,
    'bca_condominio'::text,
    'rede_loteador'::text
  ]));

-- ─── Homologações: migrar itens híbridos tabela+modo → lista_repetivel ───────
UPDATE public.kanban_fase_checklist_itens i
SET
  tipo = 'lista_repetivel',
  config_json = COALESCE(i.config_json, '{}'::jsonb) || '{"modo":"repetivel"}'::jsonb
FROM public.kanban_fases f
WHERE i.fase_id = f.id
  AND f.kanban_id = '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid
  AND i.campo_slug IN (
    'homolog_itens_produto',
    'homolog_insumos_adicionais',
    'homolog_mao_obra_instalacao'
  )
  AND i.tipo = 'tabela';

-- Anexos de referência → anexo_multiplo (conforme spec)
UPDATE public.kanban_fase_checklist_itens i
SET tipo = 'anexo_multiplo'
FROM public.kanban_fases f
WHERE i.fase_id = f.id
  AND f.kanban_id = '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid
  AND i.campo_slug = 'homolog_anexos_referencia'
  AND i.tipo = 'anexo';

-- Garantir config_json.colunas nos itens lista_repetivel (idempotente se já existir)
UPDATE public.kanban_fase_checklist_itens i
SET config_json = jsonb_build_object(
  'modo', 'repetivel',
  'colunas', '[
    {"key":"nome","label":"Nome","tipo":"texto_curto"},
    {"key":"unidade","label":"Unidade de medida","tipo":"texto_curto"},
    {"key":"valor_unitario","label":"Valor unitário","tipo":"numero"},
    {"key":"consumo","label":"Consumo","tipo":"numero"}
  ]'::jsonb
)
FROM public.kanban_fases f
WHERE i.fase_id = f.id
  AND f.kanban_id = '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid
  AND i.campo_slug = 'homolog_itens_produto'
  AND (
    i.config_json IS NULL
    OR i.config_json->'colunas' IS NULL
    OR jsonb_typeof(i.config_json->'colunas') <> 'array'
  );

UPDATE public.kanban_fase_checklist_itens i
SET config_json = jsonb_build_object(
  'modo', 'repetivel',
  'colunas', '[
    {"key":"nome","label":"Nome","tipo":"texto_curto"},
    {"key":"unidade","label":"Unidade","tipo":"texto_curto"},
    {"key":"valor","label":"Valor","tipo":"numero"},
    {"key":"consumo","label":"Consumo","tipo":"numero"},
    {"key":"fornecedor","label":"Fornecedor consultado","tipo":"texto_curto"},
    {"key":"anexo_orcamento","label":"Anexo do orçamento","tipo":"anexo"}
  ]'::jsonb
)
FROM public.kanban_fases f
WHERE i.fase_id = f.id
  AND f.kanban_id = '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid
  AND i.campo_slug = 'homolog_insumos_adicionais'
  AND (
    i.config_json IS NULL
    OR i.config_json->'colunas' IS NULL
    OR jsonb_typeof(i.config_json->'colunas') <> 'array'
  );

UPDATE public.kanban_fase_checklist_itens i
SET config_json = jsonb_build_object(
  'modo', 'repetivel',
  'colunas', '[
    {"key":"unidade","label":"Unidade","tipo":"texto_curto"},
    {"key":"valor","label":"Valor","tipo":"numero"},
    {"key":"consumo","label":"Consumo","tipo":"numero"},
    {"key":"fornecedor","label":"Fornecedor consultado","tipo":"texto_curto"},
    {"key":"anexo_orcamento","label":"Anexo do orçamento","tipo":"anexo"}
  ]'::jsonb
)
FROM public.kanban_fases f
WHERE i.fase_id = f.id
  AND f.kanban_id = '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid
  AND i.campo_slug = 'homolog_mao_obra_instalacao'
  AND (
    i.config_json IS NULL
    OR i.config_json->'colunas' IS NULL
    OR jsonb_typeof(i.config_json->'colunas') <> 'array'
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('466', 'homologacoes_lista_repetivel')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
