-- Migration 607: Formulário Portfólio Etapa 2 — Validação de Praça e Mercado
-- Aplicar DEV primeiro; PROD somente com "sim" explícito da Ingrid.

-- ── Formulário ───────────────────────────────────────────────────────────────
INSERT INTO formularios (id, nome, descricao, ativo, categoria, visivel_franqueado)
VALUES (
  'form-portfolio-validacao-praca',
  'Candidato à Franqueado Casa Moní | Etapa 2 — Validação de Praça e Mercado',
  'O objetivo deste formulário é conhecer melhor sua experiência, a região em que pretende atuar e sua percepção sobre o mercado imobiliário local. As informações serão utilizadas na próxima etapa do processo seletivo.',
  true,
  'Portfólio',
  false
)
ON CONFLICT (id) DO NOTHING;

-- ── Seções ───────────────────────────────────────────────────────────────────
INSERT INTO formulario_secoes (id, formulario_id, nome, ordem) VALUES
  ('sec-pvp-perfil',  'form-portfolio-validacao-praca', '1. Perfil do Candidato',          1),
  ('sec-pvp-praca',   'form-portfolio-validacao-praca', '2. Praça de Atuação',             2),
  ('sec-pvp-mercado', 'form-portfolio-validacao-praca', '3. Pesquisa de Mercado',          3),
  ('sec-pvp-cond1',   'form-portfolio-validacao-praca', 'Condomínio 1',                    4),
  ('sec-pvp-cond2',   'form-portfolio-validacao-praca', 'Condomínio 2',                    5),
  ('sec-pvp-cond3',   'form-portfolio-validacao-praca', 'Condomínio 3',                    6),
  ('sec-pvp-oport',   'form-portfolio-validacao-praca', '4. Percepção de Oportunidade',    7)
ON CONFLICT (id) DO NOTHING;

-- ── Seção 1: Perfil do Candidato ─────────────────────────────────────────────
INSERT INTO formulario_campos (secao_id, nome, tipo, ordem, obrigatorio) VALUES
  ('sec-pvp-perfil', 'Nome completo', 'texto_curto', 1, true),
  ('sec-pvp-perfil', 'Idade', 'numero', 2, true),
  ('sec-pvp-perfil', 'Cidade onde reside atualmente', 'texto_curto', 3, true),
  ('sec-pvp-perfil', 'Profissão e atividade atual', 'texto_curto', 4, true),
  ('sec-pvp-perfil', 'Conte brevemente sua trajetória profissional e experiência como empreendedor ou investidor', 'texto_longo', 5, true),
  ('sec-pvp-perfil', 'Por que você deseja atuar como franqueado MONÍ?', 'texto_longo', 6, true);

-- ── Seção 2: Praça de Atuação ────────────────────────────────────────────────
INSERT INTO formulario_campos (secao_id, nome, tipo, ordem, obrigatorio) VALUES
  ('sec-pvp-praca', 'Em qual cidade pretende atuar com a franquia MONÍ?', 'texto_curto', 1, true),
  ('sec-pvp-praca', 'Por que escolheu essa cidade?', 'texto_longo', 2, true),
  ('sec-pvp-praca', 'Você reside ou possui relacionamento profissional nessa região? Caso não resida, como pretende atuar presencialmente?', 'texto_longo', 3, true);

-- ── Seção 3: Pesquisa de Mercado (introdução) ────────────────────────────────
INSERT INTO formulario_campos (secao_id, nome, tipo, ordem, obrigatorio) VALUES
  ('sec-pvp-mercado', 'Quais condomínios de alto padrão você considera mais interessantes para prospectar terrenos? Liste pelo menos 3 e preencha as informações abaixo para cada um.', 'texto_longo', 1, true);

-- ── Seção 4: Condomínio 1 (obrigatório) ─────────────────────────────────────
INSERT INTO formulario_campos (secao_id, nome, tipo, ordem, obrigatorio) VALUES
  ('sec-pvp-cond1', 'Nome do condomínio', 'texto_curto', 1, true),
  ('sec-pvp-cond1', 'Faixa de preço de venda das casas', 'texto_curto', 2, true),
  ('sec-pvp-cond1', 'Giro de vendas: quantas casas são vendidas, em média, por ano?', 'texto_curto', 3, true),
  ('sec-pvp-cond1', 'Composição média — Metragem construída aproximada', 'texto_curto', 4, true),
  ('sec-pvp-cond1', 'Composição média — Número de suítes', 'numero', 5, true),
  ('sec-pvp-cond1', 'Composição média — Possui piscina?', 'select', 6, true),
  ('sec-pvp-cond1', 'Composição média — Número de vagas cobertas', 'numero', 7, true),
  ('sec-pvp-cond1', 'Preço médio de venda das casas nessa faixa', 'moeda', 8, true),
  ('sec-pvp-cond1', 'Metragem média dos lotes disponíveis', 'texto_curto', 9, true),
  ('sec-pvp-cond1', 'Preço médio de venda dos lotes (inclua variações por localização, tamanho ou características)', 'texto_longo', 10, true),
  ('sec-pvp-cond1', 'Onde você pesquisou essas informações? (imobiliárias, corretores, portais, visitas, contatos locais etc.)', 'texto_longo', 11, true);

UPDATE formulario_campos SET opcoes = '["Sim", "Não"]'::jsonb
WHERE secao_id = 'sec-pvp-cond1' AND nome = 'Composição média — Possui piscina?';

-- ── Seção 5: Condomínio 2 (obrigatório) ─────────────────────────────────────
INSERT INTO formulario_campos (secao_id, nome, tipo, ordem, obrigatorio) VALUES
  ('sec-pvp-cond2', 'Nome do condomínio', 'texto_curto', 1, true),
  ('sec-pvp-cond2', 'Faixa de preço de venda das casas', 'texto_curto', 2, true),
  ('sec-pvp-cond2', 'Giro de vendas: quantas casas são vendidas, em média, por ano?', 'texto_curto', 3, true),
  ('sec-pvp-cond2', 'Composição média — Metragem construída aproximada', 'texto_curto', 4, true),
  ('sec-pvp-cond2', 'Composição média — Número de suítes', 'numero', 5, true),
  ('sec-pvp-cond2', 'Composição média — Possui piscina?', 'select', 6, true),
  ('sec-pvp-cond2', 'Composição média — Número de vagas cobertas', 'numero', 7, true),
  ('sec-pvp-cond2', 'Preço médio de venda das casas nessa faixa', 'moeda', 8, true),
  ('sec-pvp-cond2', 'Metragem média dos lotes disponíveis', 'texto_curto', 9, true),
  ('sec-pvp-cond2', 'Preço médio de venda dos lotes (inclua variações por localização, tamanho ou características)', 'texto_longo', 10, true),
  ('sec-pvp-cond2', 'Onde você pesquisou essas informações? (imobiliárias, corretores, portais, visitas, contatos locais etc.)', 'texto_longo', 11, true);

UPDATE formulario_campos SET opcoes = '["Sim", "Não"]'::jsonb
WHERE secao_id = 'sec-pvp-cond2' AND nome = 'Composição média — Possui piscina?';

-- ── Seção 6: Condomínio 3 (opcional) ─────────────────────────────────────────
INSERT INTO formulario_campos (secao_id, nome, tipo, ordem, obrigatorio) VALUES
  ('sec-pvp-cond3', 'Nome do condomínio', 'texto_curto', 1, false),
  ('sec-pvp-cond3', 'Faixa de preço de venda das casas', 'texto_curto', 2, false),
  ('sec-pvp-cond3', 'Giro de vendas: quantas casas são vendidas, em média, por ano?', 'texto_curto', 3, false),
  ('sec-pvp-cond3', 'Composição média — Metragem construída aproximada', 'texto_curto', 4, false),
  ('sec-pvp-cond3', 'Composição média — Número de suítes', 'numero', 5, false),
  ('sec-pvp-cond3', 'Composição média — Possui piscina?', 'select', 6, false),
  ('sec-pvp-cond3', 'Composição média — Número de vagas cobertas', 'numero', 7, false),
  ('sec-pvp-cond3', 'Preço médio de venda das casas nessa faixa', 'moeda', 8, false),
  ('sec-pvp-cond3', 'Metragem média dos lotes disponíveis', 'texto_curto', 9, false),
  ('sec-pvp-cond3', 'Preço médio de venda dos lotes (inclua variações por localização, tamanho ou características)', 'texto_longo', 10, false),
  ('sec-pvp-cond3', 'Onde você pesquisou essas informações? (imobiliárias, corretores, portais, visitas, contatos locais etc.)', 'texto_longo', 11, false);

UPDATE formulario_campos SET opcoes = '["Sim", "Não"]'::jsonb
WHERE secao_id = 'sec-pvp-cond3' AND nome = 'Composição média — Possui piscina?';

-- ── Seção 7: Percepção de Oportunidade ──────────────────────────────────────
INSERT INTO formulario_campos (secao_id, nome, tipo, ordem, obrigatorio) VALUES
  ('sec-pvp-oport', 'Entre os condomínios pesquisados, qual você considera mais promissor para desenvolver uma Casa Moní e por quê?', 'texto_longo', 1, true),
  ('sec-pvp-oport', 'Em qual faixa de preço você identifica a melhor oportunidade de atuação? Considere a demanda, o giro de vendas e as características dos imóveis comercializados.', 'texto_longo', 2, true),
  ('sec-pvp-oport', 'Na sua percepção, existe demanda por casas novas de alto padrão nessa região? O que sustenta essa avaliação?', 'texto_longo', 3, true);

-- NOTIFY pgrst, 'reload schema';
