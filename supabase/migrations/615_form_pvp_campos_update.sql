-- Migration 615: Atualizar campos do formulário form-portfolio-validacao-praca
-- Aplicar DEV primeiro; PROD somente com confirmação explícita da Ingrid.

-- 1. Coluna config e tipos usados por estado, cidade e grupo repetível.
ALTER TABLE public.formulario_campos ADD COLUMN IF NOT EXISTS config jsonb;

ALTER TABLE public.formulario_campos DROP CONSTRAINT IF EXISTS formulario_campos_tipo_chk;
ALTER TABLE public.formulario_campos
  ADD CONSTRAINT formulario_campos_tipo_chk
  CHECK (tipo IN (
    'texto_curto', 'texto_longo', 'email', 'telefone', 'moeda', 'numero',
    'data', 'link', 'arquivo_multiplo', 'link_ou_arquivo', 'select', 'checkbox',
    'select_estado', 'select_cidade', 'grupo_repetivel'
  ));

-- 2. SEÇÃO PERFIL: abrir espaço para inserir estado_perfil após Idade (ordem 2)
UPDATE formulario_campos
SET ordem = ordem + 1
WHERE secao_id = 'sec-pvp-perfil'
  AND ordem >= 3
  AND NOT EXISTS (SELECT 1 FROM formulario_campos WHERE id = 'campo-pvp-estado-perfil');

INSERT INTO formulario_campos (id, secao_id, nome, tipo, ordem, obrigatorio, opcoes)
VALUES (
  'campo-pvp-estado-perfil', 'sec-pvp-perfil',
  'Estado aonde reside atualmente', 'select_estado', 3, true, '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Transformar "Cidade onde reside" em select_cidade dependente do estado acima
UPDATE formulario_campos
SET tipo = 'select_cidade',
    config = '{"estado_campo_id": "campo-pvp-estado-perfil"}'::jsonb
WHERE id = '8dd554d2-a798-43cb-95f3-d121546d360e';

-- 3. SEÇÃO PRAÇA: abrir espaço para estado_praca antes de "Em qual cidade" (ordem 1)
UPDATE formulario_campos
SET ordem = ordem + 1
WHERE secao_id = 'sec-pvp-praca'
  AND NOT EXISTS (SELECT 1 FROM formulario_campos WHERE id = 'campo-pvp-estado-praca');

INSERT INTO formulario_campos (id, secao_id, nome, tipo, ordem, obrigatorio, opcoes)
VALUES (
  'campo-pvp-estado-praca', 'sec-pvp-praca',
  'Estado aonde pretende atuar', 'select_estado', 1, true, '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Transformar "Em qual cidade pretende atuar" em select_cidade dependente do estado acima
UPDATE formulario_campos
SET tipo = 'select_cidade',
    config = '{"estado_campo_id": "campo-pvp-estado-praca"}'::jsonb
WHERE id = '9ed0d6b0-6f1c-49cc-97cf-e8f5be2fddce';

-- Transformar "Você reside ou possui relacionamento..." em select com opções
UPDATE formulario_campos
SET tipo = 'select',
    nome = 'Você reside ou possui relacionamento profissional nessa região?',
    opcoes = '["Resido", "Possuo relacionamento profissional"]'::jsonb
WHERE id = 'd9bc5e0f-2e73-4eef-b341-dad99b35cbf7';

-- Inserir campo condicional "Como pretende atuar presencialmente?" (ordem 5)
INSERT INTO formulario_campos (id, secao_id, nome, tipo, ordem, obrigatorio, opcoes, condicional_campo_id, condicional_valor)
VALUES (
  'campo-pvp-como-atuar', 'sec-pvp-praca',
  'Como pretende atuar presencialmente?', 'texto_curto', 5, false, '[]'::jsonb,
  'd9bc5e0f-2e73-4eef-b341-dad99b35cbf7', 'Possuo relacionamento profissional'
)
ON CONFLICT (id) DO NOTHING;

-- 4. REMOVER seções cond1/cond2/cond3 e seus campos
DELETE FROM formulario_campos WHERE secao_id IN ('sec-pvp-cond1', 'sec-pvp-cond2', 'sec-pvp-cond3');
DELETE FROM formulario_secoes WHERE id IN ('sec-pvp-cond1', 'sec-pvp-cond2', 'sec-pvp-cond3');

-- 5. SEÇÃO MERCADO: transformar intro em grupo_repetivel
UPDATE formulario_campos
SET tipo = 'grupo_repetivel',
    nome = 'Quais condomínios de alto padrão você considera mais interessantes para prospectar terrenos? Desejável pelo menos 3 condomínios.',
    config = '{
      "label_adicionar": "Incluir Condomínio",
      "campos": [
        {"key": "nome", "label": "Nome do condomínio", "tipo": "texto_curto", "obrigatorio": true},
        {"key": "faixa_preco", "label": "Faixa de preço de venda das casas", "tipo": "texto_curto", "obrigatorio": false},
        {"key": "giro_vendas", "label": "Giro de vendas nessa faixa: quantas casas são vendidas, em média, por ano?", "tipo": "texto_curto", "obrigatorio": false},
        {"key": "composicao_media", "label": "Composição média das casas nessa faixa", "tipo": "texto_curto", "obrigatorio": false},
        {"key": "metragem_construida", "label": "Metragem construída aproximada", "tipo": "texto_curto", "obrigatorio": false},
        {"key": "num_suites", "label": "Número de suítes", "tipo": "numero", "obrigatorio": false},
        {"key": "possui_piscina", "label": "Possui piscina?", "tipo": "select", "opcoes": ["Sim", "Não"], "obrigatorio": false},
        {"key": "vagas_cobertas", "label": "Número de vagas cobertas", "tipo": "numero", "obrigatorio": false},
        {"key": "preco_medio_venda", "label": "Preço médio de venda das casas nessa faixa", "tipo": "moeda", "obrigatorio": false}
      ]
    }'::jsonb
WHERE id = '5dcf41cb-d1c1-4cfe-bbe5-ddde43276d06';

-- Ordem estável mesmo se o deslocamento tiver rodado mais de uma vez.
UPDATE public.formulario_campos AS c
SET ordem = v.ordem
FROM (VALUES
  ('b05d085c-ef6b-49be-9577-a88d6500ee97', 1),
  ('9c46ef2e-56c6-4b84-9039-9a8bc73b5642', 2),
  ('campo-pvp-estado-perfil', 3),
  ('8dd554d2-a798-43cb-95f3-d121546d360e', 4),
  ('78b73aa4-38e2-4c92-ac10-2ad9976423ff', 5),
  ('25bc33f9-243f-47c0-981b-fc96d46eacdf', 6),
  ('3363a45c-0055-428c-ac6a-0273462c1185', 7),
  ('campo-pvp-estado-praca', 1),
  ('9ed0d6b0-6f1c-49cc-97cf-e8f5be2fddce', 2),
  ('b3224c73-ec7d-4432-a3be-ec56b300fbe1', 3),
  ('d9bc5e0f-2e73-4eef-b341-dad99b35cbf7', 4),
  ('campo-pvp-como-atuar', 5)
) AS v(id, ordem)
WHERE c.id = v.id
  AND c.ordem IS DISTINCT FROM v.ordem;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('615', 'form_pvp_campos_update')
ON CONFLICT (version) DO NOTHING;
