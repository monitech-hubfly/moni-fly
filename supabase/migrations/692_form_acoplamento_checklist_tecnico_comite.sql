-- 692: Checklist Técnico | Acoplamento para Comitê
-- Categoria Acoplamento, no Repositório de Formulários.
-- Idempotente. Aplicar em DEV. PROD só com confirmação explícita.

ALTER TABLE public.formulario_campos ADD COLUMN IF NOT EXISTS config jsonb;

ALTER TABLE public.formulario_campos DROP CONSTRAINT IF EXISTS formulario_campos_tipo_chk;
ALTER TABLE public.formulario_campos
  ADD CONSTRAINT formulario_campos_tipo_chk
  CHECK (tipo IN (
    'texto_curto', 'texto_longo', 'email', 'telefone', 'moeda', 'numero',
    'data', 'link', 'arquivo_multiplo', 'link_ou_arquivo', 'select', 'checkbox',
    'select_estado', 'select_cidade', 'grupo_repetivel', 'card_portfolio'
  ));

INSERT INTO public.formularios (id, nome, descricao, ativo, categoria, visivel_franqueado)
VALUES (
  'form-acoplamento-checklist-comite',
  'Checklist Técnico | Acoplamento para Comitê',
  'Levantamento técnico do lote para o comitê de acoplamento. O preenchimento começa pelo card do Funil Portfólio.',
  true,
  'Acoplamento',
  false
)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  ativo = EXCLUDED.ativo,
  categoria = EXCLUDED.categoria,
  visivel_franqueado = EXCLUDED.visivel_franqueado,
  updated_at = now();

INSERT INTO public.formulario_secoes (id, formulario_id, nome, ordem) VALUES
  ('sec-actc-vinculo', 'form-acoplamento-checklist-comite', 'Identificação do empreendimento', 1),
  ('sec-actc-lote', 'form-acoplamento-checklist-comite', '1. Informações do lote', 2),
  ('sec-actc-param', 'form-acoplamento-checklist-comite', '2. Parâmetros construtivos', 3),
  ('sec-actc-rest', 'form-acoplamento-checklist-comite', '3. Restrições de implantação', 4),
  ('sec-actc-padr', 'form-acoplamento-checklist-comite', '4. Padrões e regras do condomínio', 5),
  ('sec-actc-docs', 'form-acoplamento-checklist-comite', '5. Documentos de referência', 6),
  ('sec-actc-ciencia', 'form-acoplamento-checklist-comite', 'Ciência', 7)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  ordem = EXCLUDED.ordem,
  formulario_id = EXCLUDED.formulario_id;

INSERT INTO public.formulario_campos (id, secao_id, nome, tipo, ordem, obrigatorio, opcoes, config) VALUES
  (
    'campo-actc-card', 'sec-actc-vinculo', 'Card do Funil Portfólio', 'texto_curto', 1, true, '[]'::jsonb,
    '{"widget":"card_portfolio","ajuda":"Busque pelo franqueado, condomínio, cidade, quadra ou lote. Ao vincular, os dados abaixo vêm do card."}'::jsonb
  ),
  (
    'campo-actc-franqueado', 'sec-actc-vinculo', 'Franqueado', 'texto_curto', 2, false, '[]'::jsonb,
    '{"origem_card":"franqueado","somente_leitura":true}'::jsonb
  ),
  (
    'campo-actc-condominio', 'sec-actc-vinculo', 'Condomínio', 'texto_curto', 3, false, '[]'::jsonb,
    '{"origem_card":"condominio","somente_leitura":true}'::jsonb
  ),
  (
    'campo-actc-cidade', 'sec-actc-vinculo', 'Cidade / UF', 'texto_curto', 4, false, '[]'::jsonb,
    '{"origem_card":"cidade_uf","somente_leitura":true}'::jsonb
  ),
  (
    'campo-actc-quadra', 'sec-actc-vinculo', 'Quadra / Lote', 'texto_curto', 5, false, '[]'::jsonb,
    '{"origem_card":"quadra_lote","somente_leitura":true}'::jsonb
  ),
  (
    'campo-actc-casa', 'sec-actc-vinculo', 'Casa Moní selecionada', 'texto_curto', 6, false, '[]'::jsonb,
    '{"origem_card":"casa","somente_leitura":true}'::jsonb
  ),
  (
    'campo-actc-area', 'sec-actc-lote', 'Área total do terreno (m²)', 'numero', 1, true, '[]'::jsonb,
    '{"grupo":"1.1. Dimensões e levantamento","unidade":"m2","origem_card":"area_lote","ajuda":"Valor puxado da área do lote no card. Confirme ou ajuste antes de continuar."}'::jsonb
  ),
  (
    'campo-actc-frente', 'sec-actc-lote', 'Frente', 'numero', 2, true, '[]'::jsonb,
    '{"grupo":"1.1. Dimensões e levantamento","unidade":"m"}'::jsonb
  ),
  (
    'campo-actc-fundos', 'sec-actc-lote', 'Fundos', 'numero', 3, true, '[]'::jsonb,
    '{"grupo":"1.1. Dimensões e levantamento","unidade":"m"}'::jsonb
  ),
  (
    'campo-actc-lat-dir', 'sec-actc-lote', 'Lateral direita', 'numero', 4, true, '[]'::jsonb,
    '{"grupo":"1.1. Dimensões e levantamento","unidade":"m"}'::jsonb
  ),
  (
    'campo-actc-lat-esq', 'sec-actc-lote', 'Lateral esquerda', 'numero', 5, true, '[]'::jsonb,
    '{"grupo":"1.1. Dimensões e levantamento","unidade":"m"}'::jsonb
  ),
  (
    'campo-actc-planialt', 'sec-actc-lote', 'Levantamento planialtimétrico', 'arquivo_multiplo', 6, false, '[]'::jsonb,
    '{"grupo":"1.1. Dimensões e levantamento","ajuda":"Anexe um ou mais documentos ou imagens."}'::jsonb
  ),
  (
    'campo-actc-planta', 'sec-actc-lote', 'Planta do lote com medidas', 'arquivo_multiplo', 7, true, '[]'::jsonb,
    '{"grupo":"1.1. Dimensões e levantamento","ajuda":"Anexe um ou mais documentos ou imagens."}'::jsonb
  ),
  (
    'campo-actc-servidao', 'sec-actc-lote', 'O lote possui faixa de servidão de infraestrutura?', 'select', 8, true, '["Sim","Não"]'::jsonb,
    '{"grupo":"1.2. Servidão"}'::jsonb
  ),
  (
    'campo-actc-recuo-front', 'sec-actc-param', 'Recuo frontal', 'numero', 1, true, '[]'::jsonb,
    '{"grupo":"2.1. Índices urbanísticos","unidade":"m"}'::jsonb
  ),
  (
    'campo-actc-recuo-fundos', 'sec-actc-param', 'Recuo de fundos', 'numero', 2, true, '[]'::jsonb,
    '{"grupo":"2.1. Índices urbanísticos","unidade":"m"}'::jsonb
  ),
  (
    'campo-actc-recuo-dir', 'sec-actc-param', 'Recuo lateral direita', 'numero', 3, true, '[]'::jsonb,
    '{"grupo":"2.1. Índices urbanísticos","unidade":"m"}'::jsonb
  ),
  (
    'campo-actc-recuo-esq', 'sec-actc-param', 'Recuo lateral esquerda', 'numero', 4, true, '[]'::jsonb,
    '{"grupo":"2.1. Índices urbanísticos","unidade":"m"}'::jsonb
  ),
  (
    'campo-actc-to', 'sec-actc-param', 'Taxa máxima de ocupação', 'numero', 5, true, '[]'::jsonb,
    '{"grupo":"2.1. Índices urbanísticos","unidade":"%"}'::jsonb
  ),
  (
    'campo-actc-ca', 'sec-actc-param', 'Coeficiente de aproveitamento', 'numero', 6, true, '[]'::jsonb,
    '{"grupo":"2.1. Índices urbanísticos"}'::jsonb
  ),
  (
    'campo-actc-perm', 'sec-actc-param', 'Taxa mínima de permeabilidade', 'numero', 7, true, '[]'::jsonb,
    '{"grupo":"2.1. Índices urbanísticos","unidade":"%"}'::jsonb
  ),
  (
    'campo-actc-perm-regras', 'sec-actc-param', 'Regras para utilização da área permeável', 'texto_longo', 8, true, '[]'::jsonb,
    '{"grupo":"2.1. Índices urbanísticos"}'::jsonb
  ),
  (
    'campo-actc-area-min', 'sec-actc-param', 'Área mínima obrigatória de construção', 'numero', 9, true, '[]'::jsonb,
    '{"grupo":"2.1. Índices urbanísticos","unidade":"m2"}'::jsonb
  ),
  (
    'campo-actc-altura', 'sec-actc-param', 'Altura máxima permitida', 'numero', 10, true, '[]'::jsonb,
    '{"grupo":"2.2. Altura e pavimentos","unidade":"m"}'::jsonb
  ),
  (
    'campo-actc-pav', 'sec-actc-param', 'Quantidade máxima de pavimentos', 'numero', 11, true, '[]'::jsonb,
    '{"grupo":"2.2. Altura e pavimentos","inteiro":true}'::jsonb
  ),
  (
    'campo-actc-subsolo', 'sec-actc-param', 'Subsolos são permitidos?', 'select', 12, true, '["Sim","Não"]'::jsonb,
    '{"grupo":"2.2. Altura e pavimentos"}'::jsonb
  ),
  (
    'campo-actc-prefab', 'sec-actc-rest',
    'O condomínio permite edificações pré-fabricadas, em steel frame, estrutura leve de aço ou sistemas modulares?',
    'select', 1, true, '["Sim","Não"]'::jsonb,
    '{"grupo":"3.1. Sistema construtivo"}'::jsonb
  ),
  (
    'campo-actc-prefab-obs', 'sec-actc-rest', 'Observações ou restrições', 'texto_longo', 2, false, '[]'::jsonb,
    '{"grupo":"3.1. Sistema construtivo"}'::jsonb
  ),
  (
    'campo-actc-projecao', 'sec-actc-rest',
    'É permitida a projeção de coberturas ou outros elementos sobre os recuos obrigatórios?',
    'select', 3, true, '["Sim","Não"]'::jsonb,
    '{"grupo":"3.2. Projeções e recuos"}'::jsonb
  ),
  (
    'campo-actc-elementos', 'sec-actc-rest',
    'Piscinas, casas de máquinas e abrigos para carros devem respeitar os recuos gerais do terreno ou possuem regras específicas?',
    'select', 5, true,
    '["Devem respeitar os recuos gerais","Possuem regras específicas ou diferentes entre si"]'::jsonb,
    '{"grupo":"3.3. Elementos complementares"}'::jsonb
  ),
  (
    'campo-actc-edicula', 'sec-actc-rest', 'São permitidas edículas?', 'select', 9, true, '["Sim","Não"]'::jsonb,
    '{"grupo":"3.3. Elementos complementares"}'::jsonb
  ),
  (
    'campo-actc-arrimo', 'sec-actc-padr', 'Regras para muros de arrimo', 'texto_longo', 1, false, '[]'::jsonb,
    '{"grupo":"4.1. Elementos externos"}'::jsonb
  ),
  (
    'campo-actc-divisa', 'sec-actc-padr', 'Regras para muros de divisa', 'texto_longo', 2, false, '[]'::jsonb,
    '{"grupo":"4.1. Elementos externos"}'::jsonb
  ),
  (
    'campo-actc-cerca', 'sec-actc-padr', 'Regras para cercas vivas', 'texto_longo', 3, false, '[]'::jsonb,
    '{"grupo":"4.1. Elementos externos"}'::jsonb
  ),
  (
    'campo-actc-medidores', 'sec-actc-padr', 'Padrão obrigatório para abrigos e medidores', 'texto_longo', 4, true, '[]'::jsonb,
    '{"grupo":"4.2. Infraestrutura e paisagismo"}'::jsonb
  ),
  (
    'campo-actc-calcada', 'sec-actc-padr', 'Existe desenho padrão da calçada?', 'select', 5, true, '["Sim","Não"]'::jsonb,
    '{"grupo":"4.2. Infraestrutura e paisagismo"}'::jsonb
  ),
  (
    'campo-actc-arvores', 'sec-actc-padr', 'Regras para plantio de árvores', 'texto_longo', 7, true, '[]'::jsonb,
    '{"grupo":"4.2. Infraestrutura e paisagismo"}'::jsonb
  ),
  (
    'campo-actc-manual', 'sec-actc-docs', 'Manual de normas e construção do condomínio', 'arquivo_multiplo', 1, true, '[]'::jsonb,
    '{"ajuda":"Anexe um ou mais documentos."}'::jsonb
  ),
  (
    'campo-actc-codigo', 'sec-actc-docs', 'Código de Obras do município', 'arquivo_multiplo', 2, true, '[]'::jsonb,
    '{"ajuda":"Anexe um ou mais documentos."}'::jsonb
  ),
  (
    'campo-actc-ciencia', 'sec-actc-ciencia',
    'Estou ciente que as informações que estou enviando influenciam na elaboração da implantação do empreendimento, execução dos projetos locais, fluidez do processo de aprovação no condomínio e prefeitura, projetos locais e logo, execução da obra.',
    'checkbox', 1, true, '["Estou ciente"]'::jsonb, '{}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  secao_id = EXCLUDED.secao_id,
  nome = EXCLUDED.nome,
  tipo = EXCLUDED.tipo,
  ordem = EXCLUDED.ordem,
  obrigatorio = EXCLUDED.obrigatorio,
  opcoes = EXCLUDED.opcoes,
  config = EXCLUDED.config,
  condicional_campo_id = NULL,
  condicional_valor = NULL;

INSERT INTO public.formulario_campos (id, secao_id, nome, tipo, ordem, obrigatorio, opcoes, config, condicional_campo_id, condicional_valor) VALUES
  (
    'campo-actc-servidao-detalhe', 'sec-actc-lote', 'Se sim, informar a localização e as restrições', 'texto_longo', 9, true, '[]'::jsonb,
    '{"grupo":"1.2. Servidão"}'::jsonb, 'campo-actc-servidao', 'Sim'
  ),
  (
    'campo-actc-subsolo-regras', 'sec-actc-param', 'Se sim, quais são as regras?', 'texto_longo', 13, true, '[]'::jsonb,
    '{"grupo":"2.2. Altura e pavimentos"}'::jsonb, 'campo-actc-subsolo', 'Sim'
  ),
  (
    'campo-actc-projecao-regras', 'sec-actc-rest', 'Se sim, quais elementos e condições?', 'texto_longo', 4, true, '[]'::jsonb,
    '{"grupo":"3.2. Projeções e recuos"}'::jsonb, 'campo-actc-projecao', 'Sim'
  ),
  (
    'campo-actc-piscina', 'sec-actc-rest', 'Piscinas', 'texto_longo', 6, true, '[]'::jsonb,
    '{"grupo":"3.3. Elementos complementares","ajuda":"Se possuem regras específicas ou diferentes entre si, informe a regra de cada elemento."}'::jsonb,
    'campo-actc-elementos', 'Possuem regras específicas ou diferentes entre si'
  ),
  (
    'campo-actc-maquinas', 'sec-actc-rest', 'Casa de máquinas', 'texto_longo', 7, true, '[]'::jsonb,
    '{"grupo":"3.3. Elementos complementares"}'::jsonb,
    'campo-actc-elementos', 'Possuem regras específicas ou diferentes entre si'
  ),
  (
    'campo-actc-abrigo', 'sec-actc-rest', 'Abrigos para carros', 'texto_longo', 8, true, '[]'::jsonb,
    '{"grupo":"3.3. Elementos complementares"}'::jsonb,
    'campo-actc-elementos', 'Possuem regras específicas ou diferentes entre si'
  ),
  (
    'campo-actc-edicula-regras', 'sec-actc-rest', 'Se sim, quais são as regras?', 'texto_longo', 10, true, '[]'::jsonb,
    '{"grupo":"3.3. Elementos complementares"}'::jsonb, 'campo-actc-edicula', 'Sim'
  ),
  (
    'campo-actc-calcada-anexo', 'sec-actc-padr', 'Desenho padrão da calçada', 'arquivo_multiplo', 6, true, '[]'::jsonb,
    '{"grupo":"4.2. Infraestrutura e paisagismo","ajuda":"Se sim, anexe o desenho. Pode enviar mais de um documento ou imagem."}'::jsonb,
    'campo-actc-calcada', 'Sim'
  )
ON CONFLICT (id) DO UPDATE SET
  secao_id = EXCLUDED.secao_id,
  nome = EXCLUDED.nome,
  tipo = EXCLUDED.tipo,
  ordem = EXCLUDED.ordem,
  obrigatorio = EXCLUDED.obrigatorio,
  opcoes = EXCLUDED.opcoes,
  config = EXCLUDED.config,
  condicional_campo_id = EXCLUDED.condicional_campo_id,
  condicional_valor = EXCLUDED.condicional_valor;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('692', 'form_acoplamento_checklist_tecnico_comite')
ON CONFLICT (version) DO NOTHING;
