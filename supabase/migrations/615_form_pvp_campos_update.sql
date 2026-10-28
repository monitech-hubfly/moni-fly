-- Migration 615: Atualizar campos do formulário form-portfolio-validacao-praca
-- Aplicar DEV primeiro; PROD somente com confirmação explícita da Ingrid.
-- Campos da 607 nasceram com id gerado pelo banco: identificar por seção + nome, não por uuid do DEV.

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
WHERE secao_id = 'sec-pvp-perfil'
  AND nome = 'Cidade onde reside atualmente';

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
WHERE secao_id = 'sec-pvp-praca'
  AND nome = 'Em qual cidade pretende atuar com a franquia MONÍ?';

-- Transformar "Você reside ou possui relacionamento..." em select com opções
UPDATE formulario_campos
SET tipo = 'select',
    nome = 'Você reside ou possui relacionamento profissional nessa região?',
    opcoes = '["Resido", "Possuo relacionamento profissional"]'::jsonb
WHERE secao_id = 'sec-pvp-praca'
  AND nome IN (
    'Você reside ou possui relacionamento profissional nessa região?',
    'Você reside ou possui relacionamento profissional nessa região? Caso não resida, como pretende atuar presencialmente?'
  );

-- Inserir campo condicional só se a pergunta de residência existir neste banco.
INSERT INTO formulario_campos (id, secao_id, nome, tipo, ordem, obrigatorio, opcoes, condicional_campo_id, condicional_valor)
SELECT
  'campo-pvp-como-atuar',
  'sec-pvp-praca',
  'Como pretende atuar presencialmente?',
  'texto_curto',
  5,
  false,
  '[]'::jsonb,
  p.id,
  'Possuo relacionamento profissional'
FROM formulario_campos p
WHERE p.secao_id = 'sec-pvp-praca'
  AND p.nome = 'Você reside ou possui relacionamento profissional nessa região?'
  AND NOT EXISTS (SELECT 1 FROM formulario_campos WHERE id = 'campo-pvp-como-atuar')
LIMIT 1;

-- 4. REMOVER seções cond1/cond2/cond3 e seus campos
DELETE FROM formulario_campos WHERE secao_id IN ('sec-pvp-cond1', 'sec-pvp-cond2', 'sec-pvp-cond3');
DELETE FROM formulario_secoes WHERE id IN ('sec-pvp-cond1', 'sec-pvp-cond2', 'sec-pvp-cond3');

-- 5. SEÇÃO MERCADO: transformar intro em grupo_repetivel
UPDATE formulario_campos
SET tipo = 'grupo_repetivel',
    nome = 'Quais condomínios de alto padrão você considera mais interessantes para prospectar terrenos? Desejável pelo menos 3 condomínios. Se um condomínio tiver mais de uma faixa de preço, deve ser preenchido mais de uma vez, considerando um preenchimento para cada faixa de preço do condomínio.',
    config = '{
      "label_adicionar": "Incluir Condomínio",
      "campos": [
        {"key": "nome", "label": "Nome do condomínio", "tipo": "texto_curto", "obrigatorio": true},
        {"key": "faixa_preco", "label": "Faixa de preço de venda das casas", "tipo": "faixa_moeda", "obrigatorio": false},
        {"key": "giro_vendas", "label": "Giro de vendas nessa faixa: quantas casas são vendidas, em média, por ano?", "tipo": "numero", "obrigatorio": false},
        {"key": "composicao_media", "label": "Composição média das casas nessa faixa", "tipo": "titulo", "obrigatorio": false},
        {"key": "metragem_construida", "label": "Metragem construída aproximada", "tipo": "m2", "obrigatorio": false},
        {"key": "num_suites", "label": "Número de suítes", "tipo": "numero", "obrigatorio": false},
        {"key": "possui_piscina", "label": "Possui piscina?", "tipo": "select", "opcoes": ["Sim", "Não"], "obrigatorio": false},
        {"key": "vagas_cobertas", "label": "Número de vagas cobertas", "tipo": "numero", "obrigatorio": false},
        {"key": "preco_medio_venda", "label": "Preço médio de venda das casas nessa faixa", "tipo": "moeda", "obrigatorio": false}
      ]
    }'::jsonb
WHERE secao_id = 'sec-pvp-mercado'
  AND nome IN (
    'Quais condomínios de alto padrão você considera mais interessantes para prospectar terrenos? Liste pelo menos 3 e preencha as informações abaixo para cada um.',
    'Quais condomínios de alto padrão você considera mais interessantes para prospectar terrenos? Desejável pelo menos 3 condomínios.',
    'Quais condomínios de alto padrão você considera mais interessantes para prospectar terrenos? Desejável pelo menos 3 condomínios. Se um condomínio tiver mais de uma faixa de preço, deve ser preenchido mais de uma vez, considerando um preenchimento para cada faixa de preço do condomínio.'
  );

-- Ordem estável mesmo se o deslocamento tiver rodado mais de uma vez.
UPDATE public.formulario_campos AS c
SET ordem = v.ordem
FROM (
  VALUES
    ('sec-pvp-perfil', 'Nome completo', 1),
    ('sec-pvp-perfil', 'Idade', 2),
    ('sec-pvp-perfil', 'Estado aonde reside atualmente', 3),
    ('sec-pvp-perfil', 'Cidade onde reside atualmente', 4),
    ('sec-pvp-perfil', 'Profissão e atividade atual', 5),
    ('sec-pvp-perfil', 'Conte brevemente sua trajetória profissional e experiência como empreendedor ou investidor', 6),
    ('sec-pvp-perfil', 'Por que você deseja atuar como franqueado MONÍ?', 7),
    ('sec-pvp-praca', 'Estado aonde pretende atuar', 1),
    ('sec-pvp-praca', 'Em qual cidade pretende atuar com a franquia MONÍ?', 2),
    ('sec-pvp-praca', 'Por que escolheu essa cidade?', 3),
    ('sec-pvp-praca', 'Você reside ou possui relacionamento profissional nessa região?', 4),
    ('sec-pvp-praca', 'Como pretende atuar presencialmente?', 5)
) AS v(secao_id, nome, ordem)
WHERE c.secao_id = v.secao_id
  AND c.nome = v.nome
  AND c.ordem IS DISTINCT FROM v.ordem;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('615', 'form_pvp_campos_update')
ON CONFLICT (version) DO NOTHING;
