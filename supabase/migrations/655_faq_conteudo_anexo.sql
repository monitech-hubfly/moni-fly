-- 655: Central de Ajuda e Gestão FAQ passam a ter só as categorias, perguntas e respostas do anexo.
-- Remove o conteúdo anterior. Idempotente se reexecutado: apaga e regrava este conjunto.
-- DEV primeiro. PROD somente com confirmação explícita.

BEGIN;

DELETE FROM public.faq_related_articles;
DELETE FROM public.faq_articles;
DELETE FROM public.faq_categories;

INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Institucional', 'institucional', NULL, 'Landmark', 1, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Franquia e expansão', 'franquia-e-expansao', NULL, 'TrendingUp', 2, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Franquia e remuneração', 'franquia-e-remuneracao', NULL, 'DollarSign', 3, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Crédito e funding', 'credito-e-funding', NULL, 'Handshake', 4, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Terrenos e permuta', 'terrenos-e-permuta', NULL, 'MapPin', 5, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Recompra e liquidação', 'recompra-e-liquidacao', NULL, 'Repeat', 6, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Estrutura societária e contratos', 'estrutura-societaria-e-contratos', NULL, 'Scale', 7, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Tributação e contabilidade', 'tributacao-e-contabilidade', NULL, 'Calculator', 8, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Produto e catálogo', 'produto-e-catalogo', NULL, 'Home', 9, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Fornecedores', 'fornecedores', NULL, 'Truck', 10, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Operações e obra', 'operacoes-e-obra', NULL, 'HardHat', 11, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Comercialização', 'comercializacao', NULL, 'Flag', 12, true);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'institucional'),
  $faq001$Quanto tempo tem a Casa MONÍ?$faq001$,
  'cm-faq-001',
  NULL,
  $faq001$Nascemos em abril de 2022,  curiosamente comemoramos o aniversário da casa moní na mesma data do dia do planeta terra (22 de abril), uma coincidência que nos ajuda a lembrar do importante papel que exercemos liderando a revolução sustentável para o setor de casa de luxo.$faq001$,
  'published',
  1,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq002$A Casa MONÍ atua em quais regiões?$faq002$,
  'cm-faq-002',
  NULL,
  $faq002$Atuamos via franquias em todo o Brasil e agora inciando nossas operações nos EUA, por hora somente com loja própria.$faq002$,
  'published',
  1,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq003$Há um estudo de mercado para seleção da regiões?$faq003$,
  'cm-faq-003',
  NULL,
  $faq003$sem dúvida, cada região possui uma vocação de mercado, para as quais diferentes produtos, preços, kit de acabamentos, volume de vendas, etc. Se você é um candidato a franqueado isso pode te afetar principalemente quanto a dois fatores:

1. valor da taxa de franquia (quanto melhor a região, maior a taxa)
2. limite de franqueados por perímetro definido (muitos deles já estão 100% fechados)$faq003$,
  'published',
  2,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq004$O que é COF (Circular de Oferta de Franquia)?$faq004$,
  'cm-faq-004',
  NULL,
  $faq004$é um documento obrigatório e que segue um conjunto de informações padronizadas previstas na lei de franquias. Tem o objetivo de estabelecer com clareza como a nossa relação vai funcionar em termos práticos, direiros e obrigações, etc. Se você quiser podemos enviar uma cópia, ela é absolutamente padrão para todos os franqueados.$faq004$,
  'published',
  3,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq005$O que é Contrato de Franquia$faq005$,
  'cm-faq-005',
  NULL,
  $faq005$contrato firma nossa relação franqueadora - franqueado, nele estarão contidos os detalhes juridicos e comerciais que estamos acordando - quais são as figuras juridicas envolvidas, multas, valores, formas de pagamento, foro escolhido para eventuais pleitos etc$faq005$,
  'published',
  4,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq006$Quais mercados a MONÍ está visando?$faq006$,
  'cm-faq-006',
  NULL,
  $faq006$A estratégia geral da moní e empoderar micro-incorporadores globalmente através de sua marca de eco-smart homes. Apesar de tecnicamente já ter nascido embaixo de uma estrutura nos EUA escolhemos inicialmente atuar no estado de são paulo (BR), hoje estamos expandindo para todo o Brasil e iniciando nossas primeiras operações nos EUA$faq006$,
  'published',
  5,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq007$Como a MONÍ avalia locais potenciais?$faq007$,
  'cm-faq-007',
  NULL,
  $faq007$O mercado residencial de Luxo, ao contrário do que se pensa, está muito desabastecido, existem inúmeros locais onde clientes de alto potencial estão morando em casas muito abaixo de suas expectativas. O que procuramos identificar através de dados são locais onde existe evidência dessa demanda reprimida.$faq007$,
  'published',
  6,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq008$O que o candidato deve saber para ser um Frank MONÍ?$faq008$,
  'cm-faq-008',
  NULL,
  $faq008$o franqueado da casa moní, ou simplesmente FRANK como chamamos aqui,  tem 2 grandes papéis:

1. encontrar boas oportunidades para desenvolver casas de luxo com alta rentabilidade e liquidez
2. gerenciar a execução da casa.$faq008$,
  'published',
  7,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq009$A área de atuação do franqueado é exclusiva? Como é definida a quantidade de franqueados por região?$faq009$,
  'cm-faq-009',
  NULL,
  $faq009$Não. A área de atuação não é exclusiva. A quantidade de franqueados permitida em cada perímetro é dimensionada pela Franqueadora conforme a análise de mercado da região. Cada região possui características próprias, que influenciam os produtos mais adequados, os preços, os kits de acabamento e o potencial de vendas. Essa análise também pode influenciar o valor da taxa de franquia e o limite de franqueados admitidos naquele perímetro. Assim, a disponibilidade de novas franquias depende do dimensionamento estabelecido pela Franqueadora para cada mercado.$faq009$,
  'published',
  8,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-remuneracao'),
  $faq010$A Moní participa do lucro da venda do empreendimento?$faq010$,
  'cm-faq-010',
  NULL,
  $faq010$Não. Conforme o modelo informado, todo o resultado do empreendimento pertence ao franqueado; a Moní não participa como sócia e fornece tecnologia, processos, suporte operacional e os serviços contratados.$faq010$,
  'published',
  1,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-remuneracao'),
  $faq011$Como funciona a taxa de franquia de R$ 700 mil e o abatimento por início de obras?$faq011$,
  'cm-faq-011',
  NULL,
  $faq011$Na condição comercial descrita no e-mail, a taxa total é de R$ 700.000. A entrada de R$ 100.000 compreende R$ 25.000 na assinatura e R$ 75.000 em 24 parcelas mensais de R$ 3.125. Por obra iniciada, são cobrados R$ 60.000 em seis parcelas, debitados da remuneração de gestão, até completar dez obras e o saldo da taxa. O abatimento de R$ 200.000 exige o início de seis obras em 24 meses, ao ritmo de duas obras por semestre durante três semestres consecutivos. O benefício é vinculado ao início, não à venda ou conclusão, e foi informado como contratualmente formalizado.$faq011$,
  'published',
  2,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-remuneracao'),
  $faq012$Qual é a diferença entre a remuneração pela gestão da obra e a taxa da plataforma?$faq012$,
  'cm-faq-012',
  NULL,
  $faq012$A remuneração pela gestão da obra corresponde a 8% do custo da construção e é destinada ao franqueado. A taxa de 7% é destinada à Franqueadora pelos serviços de plataforma digital, tecnologia, processos e backoffice. São parcelas distintas da remuneração total de 15% sobre o custo da obra; a taxa de 7% não é descontada dos 8%.$faq012$,
  'published',
  3,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-remuneracao'),
  $faq013$Quanto o franqueado recebe pela gestão em uma obra de R$ 1 milhão?$faq013$,
  'cm-faq-013',
  NULL,
  $faq013$Para custo de obra de R$ 1.000.000, a remuneração de gestão é de R$ 80.000 (8%). A parcela de plataforma e backoffice corresponde a R$ 70.000 (7%). Somadas, totalizam R$ 150.000 (15%). Esses valores ilustram a distribuição informada e não representam o lucro líquido da incorporação.$faq013$,
  'published',
  4,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-remuneracao'),
  $faq014$O que determina o resultado financeiro que fica com o franqueado?$faq014$,
  'cm-faq-014',
  NULL,
  $faq014$O resultado do empreendimento pertence ao franqueado e não é dividido com a Moní como sócia. Para verificar o resultado efetivamente disponível, devem ser consideradas as receitas, os custos de terreno e obra, tributos, despesas financeiras e demais itens discriminados no BCA de cada projeto.$faq014$,
  'published',
  5,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-remuneracao'),
  $faq015$Como é paga a entrada de R$ 100 mil da franquia?$faq015$,
  'cm-faq-015',
  NULL,
  $faq015$Na condição comercial apresentada, R$ 25.000 são pagos na assinatura e R$ 75.000 são distribuídos em 24 parcelas mensais de R$ 3.125.$faq015$,
  'published',
  6,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-remuneracao'),
  $faq016$Quando é cobrada a parcela de R$ 60 mil por obra?$faq016$,
  'cm-faq-016',
  NULL,
  $faq016$A condição descrita prevê cobrança de R$ 60.000 a cada obra iniciada, dividida em seis parcelas e debitada diretamente da remuneração de gestão da obra, independentemente do resultado financeiro do empreendimento.$faq016$,
  'published',
  7,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-remuneracao'),
  $faq017$O desconto de R$ 200 mil depende da venda ou da conclusão das casas?$faq017$,
  'cm-faq-017',
  NULL,
  $faq017$Não. Segundo a condição comercial informada, o benefício depende do início de seis obras em 24 meses, observando o ritmo mínimo de duas obras por semestre durante três semestres consecutivos. Não está vinculado à assinatura de contratos, à entrega nem à venda das casas.$faq017$,
  'published',
  8,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'credito-e-funding'),
  $faq018$Existe garantia de aprovação de crédito para os empreendimentos?$faq018$,
  'cm-faq-018',
  NULL,
  $faq018$Na etapa de viabilidade e Pré-Comitê, um concierge especializado auxilia na estruturação e avaliação preliminar. Historicamente, segundo a resposta fornecida, 50% dos empreendimentos submetidos ao Comitê são aprovados. Empreendimentos não aprovados não seguem para veículos de crédito. Se aprovados em Comitê mas sem disponibilidade de crédito, a Moní disponibiliza ferramenta de captação fracionada junto a investidores pessoa física.$faq018$,
  'published',
  1,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'credito-e-funding'),
  $faq019$Como são liberados os recursos de crédito para construção?$faq019$,
  'cm-faq-019',
  NULL,
  $faq019$O crédito para construção é liberado em parcelas (tranches), conforme a evolução da obra, apresentação de evidências e validação pelo sistema de acompanhamento. A disponibilização após aprovação no Comitê do Fundo depende do cumprimento dos procedimentos e requisitos mínimos.$faq019$,
  'published',
  2,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'credito-e-funding'),
  $faq020$O que acontece antes de um projeto ser enviado ao Comitê?$faq020$,
  'cm-faq-020',
  NULL,
  $faq020$Durante a viabilidade e o Pré-Comitê, o franqueado conta com apoio de concierge especializado para estruturar e avaliar preliminarmente o empreendimento. Essa etapa permite antecipar riscos e obter uma perspectiva inicial de aprovação, sem constituir garantia de crédito.$faq020$,
  'published',
  3,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'credito-e-funding'),
  $faq021$Qual é o papel do Comitê na aprovação do empreendimento?$faq021$,
  'cm-faq-021',
  NULL,
  $faq021$O Comitê funciona como filtro técnico da operação. A resposta recebida informa que, historicamente, cerca de 50% dos projetos que chegam a essa etapa são aprovados. Projetos não aprovados não seguem para os veículos de crédito.$faq021$,
  'published',
  4,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'credito-e-funding'),
  $faq022$O que acontece se o projeto for aprovado em Comitê, mas não houver crédito disponível?$faq022$,
  'cm-faq-022',
  NULL,
  $faq022$É disponibilizada uma ferramenta de captação fracionada junto a investidores pessoas físicas como alternativa para projetos aprovados em Comitê sem disponibilidade de crédito.$faq022$,
  'published',
  5,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'credito-e-funding'),
  $faq023$O financiamento de obra é liberado integralmente no início?$faq023$,
  'cm-faq-023',
  NULL,
  $faq023$Não. A resposta documental informa que os recursos do crédito para construção são liberados em tranches, de acordo com a evolução da obra, mediante apresentação de evidências e validação do acompanhamento previsto na operação.$faq023$,
  'published',
  6,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq024$Como preencher o campo de título aquisitivo no contrato de permuta?$faq024$,
  'cm-faq-024',
  NULL,
  $faq024$O que é "título aquisitivo"?
Título aquisitivo é o nome dado ao documento legal que comprova a aquisição da propriedade de um bem imóvel. Ele é a base jurídica da propriedade e precisa estar registrado no Cartório de Registro de Imóveis competente.

Exemplos comuns de título aquisitivo:

- Escritura pública de compra e venda registrada;
- Formal de partilha (no caso de herança ou divórcio);
- Contrato de compra e venda com quitação (em certos casos, quando a escritura ainda não foi lavrada, mas a posse já está regular);
- Carta de arrematação (após leilão judicial);
- Doação (com escritura pública e registro);
- Usucapião (sentença judicial ou extrajudicial com registro);
- Instrumento particular de cessão de direitos, em alguns casos específicos (ex: imóveis em regularização).

Como preencher essa cláusula corretamente?
Se, por exemplo, o imóvel foi comprado normalmente com escritura, você escreveria:

"O imóvel foi adquirido pelo vendedor nos termos da escritura pública de compra e venda lavrada em [data], registrada sob o nº [matrícula] no Cartório de Registro de Imóveis da [cidade/UF]."$faq024$,
  'published',
  1,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq025$Quais padrão de documentos o frank tem que pedir pro terrenista pra preencher o contrato de opção e permuta padrão moní$faq025$,
  'cm-faq-025',
  NULL,
  $faq025$-cópia dos documentos dos proprietários (RG, cpf, comprovante de endereço, certidão de casamento ou nascimento)
-cnpj do proprietário se houver
-cópia da matrícula do imóvel + carta de cessão de posse
-número de inscrição de IPTU
-declaração negativa de débitos condominiais
-profissão do proprietário$faq025$,
  'published',
  2,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq026$Como é calculada a remuneração de 5% pela intermediação do lote em operações que a prevejam?$faq026$,
  'cm-faq-026',
  NULL,
  $faq026$No exemplo documental, a remuneração de 5% incide uma única vez sobre o Valor Base do Lote; para R$ 4 milhões, equivale a R$ 200 mil. É movimentada pela SPE, integra o custo do lote no BCA e independe da origem do funding. O pagamento pode ocorrer na transferência à SPE ou na venda, conforme pactuado. A previsão precisa constar do instrumento aplicável.$faq026$,
  'published',
  3,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq027$Quem assume IPTU, ITU, condomínio e encargos do terreno?$faq027$,
  'cm-faq-027',
  NULL,
  $faq027$O padrão contratual indicado transfere a responsabilidade à SPE na lavratura da escritura, sujeito às condições negociadas. As despesas são da SPE e devem ser provisionadas no capital de giro do BCA; não são cobertas pela Moní ou pelo fundo. Os valores variam conforme imóvel, município e condomínio.$faq027$,
  'published',
  4,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq029$Como funcionam a entrada de 30%, o saldo de 70% e a remuneração de 15% ao ano em uma aquisição de terreno?$faq029$,
  'cm-faq-029',
  NULL,
  $faq029$Na estrutura contratual exemplificada, 30% do valor-base são pagos na escritura e os 70% restantes são quitados na venda ou no prazo máximo contratual de 24 meses. A remuneração de 15% ao ano é calculada por juros compostos sobre o saldo devedor, até a quitação; antecipar o pagamento reduz a remuneração acumulada. Essa é uma estrutura específica, não regra universal para toda permuta.$faq029$,
  'published',
  6,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq030$Quem contrata e paga o instrumento garantidor do saldo do terreno?$faq030$,
  'cm-faq-030',
  NULL,
  $faq030$O tomador/incorporador-franqueado assume o custo, que deve ser previsto no BCA. O documento informa referência de 2% a 6% do saldo remanescente, recomendando provisionar 6%. O beneficiário é o terrenista. Eventual dispensa, se ele integrar a SPE, depende de negociação e formalização contratual.$faq030$,
  'published',
  7,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq031$Quais despesas podem ocorrer antes da transferência definitiva do terreno?$faq031$,
  'cm-faq-031',
  NULL,
  $faq031$Conforme a etapa, o franqueado pode assumir diligência, constituição de empresas, contas, taxas de funding, RRT, aprovações, topografia e sondagem, instrumento garantidor, ITBI, escritura, cartório e encargos. Projetos legais e executivos podem ser pagos no primeiro desembolso do crédito, conforme o modelo descrito. Cada operação deve ter sua previsão no BCA.$faq031$,
  'published',
  8,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq032$Quem paga o registro da opção na matrícula do imóvel?$faq032$,
  'cm-faq-032',
  NULL,
  $faq032$O registro é facultativo na minuta examinada e, se realizado, seu custo é suportado pela SPE/adquirente. O registro da opção não transfere, por si só, propriedade ou posse.$faq032$,
  'published',
  9,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq033$Qual é o papel da Moní no contrato de opção de compra do terreno?$faq033$,
  'cm-faq-033',
  NULL,
  $faq033$A Moní pode figurar como interveniente anuente, sem ser adquirente ou transmitente. A aquisição cabe à SPE do franqueado ou ao adquirente que posteriormente cederá os direitos e obrigações à SPE, conforme o instrumento.$faq033$,
  'published',
  10,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq034$Quais modelos de negociação com o terrenista são admitidos?$faq034$,
  'cm-faq-034',
  NULL,
  $faq034$O documento descreve estruturas de permuta integral por valor fixo ou percentual do VGV, compra parcial com entrada e saldo fixo ou percentual do VGV, além de condições negociadas entre as partes. Cada proposta depende da análise do BCA e das garantias aplicáveis.$faq034$,
  'published',
  11,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq035$É possível oferecer ao terrenista entrada de 20% e saldo em 18 parcelas mensais?$faq035$,
  'cm-faq-035',
  NULL,
  $faq035$Essa condição foi informada incorretamente e posteriormente corrigida como inviável no caso analisado. O saldo seria pago na venda da casa, respeitando o prazo contratual.$faq035$,
  'published',
  12,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq036$Sobre qual valor incidem os 5% de intermediação do lote?$faq036$,
  'cm-faq-036',
  NULL,
  $faq036$Na operação exemplificada no questionário, os 5% incidem uma única vez sobre o Valor Base do Lote. Com valor-base de R$ 4.000.000, o total é R$ 200.000; em dois lotes de R$ 2.000.000, são R$ 100.000 por lote. Trata-se de uma condição específica da minuta analisada.$faq036$,
  'published',
  13,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq037$Quem paga a remuneração de intermediação do lote?$faq037$,
  'cm-faq-037',
  NULL,
  $faq037$A movimentação é feita pela SPE do franqueado. O valor deve integrar o custo do lote no BCA, inclusive quando a aquisição for financiada com recursos de fundo ou investidor parceiro.$faq037$,
  'published',
  14,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq038$Quando a remuneração de intermediação é paga?$faq038$,
  'cm-faq-038',
  NULL,
  $faq038$A resposta à minuta prevê pagamento na transferência do terreno para a SPE ou na venda do imóvel, conforme o que for acordado entre as partes.$faq038$,
  'published',
  15,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq039$Os 5% de intermediação são cobrados mais de uma vez?$faq039$,
  'cm-faq-039',
  NULL,
  $faq039$Não. Na condição analisada, o percentual incide uma única vez sobre o Valor Base do Lote.$faq039$,
  'published',
  16,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq040$Quando IPTU, condomínio e demais encargos passam a ser da SPE?$faq040$,
  'cm-faq-040',
  NULL,
  $faq040$O padrão informado estabelece a transferência da responsabilidade a partir da lavratura da escritura, podendo haver ajuste conforme a negociação e o contrato aplicável. Antes da escritura, é necessário verificar as condições específicas do instrumento.$faq040$,
  'published',
  17,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq041$A Moní ou o fundo paga IPTU e condomínio do terreno?$faq041$,
  'cm-faq-041',
  NULL,
  $faq041$Não, segundo o questionário. Esses valores são despesas da SPE do franqueado e precisam ser provisionados no capital de giro do BCA.$faq041$,
  'published',
  18,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq042$Existe um valor fixo de IPTU, condomínio e taxas por projeto?$faq042$,
  'cm-faq-042',
  NULL,
  $faq042$Não. Os custos variam conforme o município, o imóvel e o condomínio. A estimativa deve ser confirmada durante a análise de cada empreendimento e incorporada ao BCA.$faq042$,
  'published',
  19,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq043$Os R$ 105 mil de quitação de terreno se aplicam a todas as operações?$faq043$,
  'cm-faq-043',
  NULL,
  $faq043$Não. O valor citado é uma necessidade excepcional de quitação de saldo de terreno de uma oportunidade específica, e não uma reserva padrão por unidade.$faq043$,
  'published',
  20,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq044$Os juros de 15% ao ano do saldo do terreno são simples ou compostos?$faq044$,
  'cm-faq-044',
  NULL,
  $faq044$Na estrutura exemplificada, a remuneração de 15% ao ano é calculada com juros compostos sobre o saldo devedor, desde o marco contratual indicado até a efetiva quitação. A base diminui quando são realizados pagamentos.$faq044$,
  'published',
  21,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq045$Se o terreno for quitado antes dos 24 meses, os juros param antes?$faq045$,
  'cm-faq-045',
  NULL,
  $faq045$Sim. Conforme a resposta documental, os juros são calculados até a data do pagamento efetivo; a quitação antecipada reduz a remuneração acumulada.$faq045$,
  'published',
  22,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq046$Qual é o custo estimado do instrumento garantidor do terreno?$faq046$,
  'cm-faq-046',
  NULL,
  $faq046$O documento apresenta referência de 2% a 6% do saldo remanescente, dependendo do prazo e das condições. Para planejamento, recomenda provisionar o limite superior de 6%, sujeito à contratação efetiva.$faq046$,
  'published',
  23,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq047$Quem é beneficiário do seguro-garantia ou carta-fiança do terreno?$faq047$,
  'cm-faq-047',
  NULL,
  $faq047$O beneficiário do instrumento garantidor é o terrenista; o custo de contratação é atribuído ao tomador/incorporador-franqueado, devendo compor o planejamento financeiro da operação.$faq047$,
  'published',
  24,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq048$O instrumento garantidor pode ser dispensado se o terrenista entrar na SPE?$faq048$,
  'cm-faq-048',
  NULL,
  $faq048$A documentação menciona possibilidade de negociação da dispensa quando o terrenista aceita participar da SPE como cotista. Não é automática: depende de concordância das partes e formalização no contrato definitivo.$faq048$,
  'published',
  25,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq049$O registro da opção de compra transfere a propriedade do lote?$faq049$,
  'cm-faq-049',
  NULL,
  $faq049$Não. A minuta analisada informa que o registro da opção na matrícula é facultativo e não transfere, por si só, propriedade ou posse. Se realizado, o custo cabe à SPE/adquirente.$faq049$,
  'published',
  26,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq050$A recompra do imóvel pela Moní é automática após 11 meses sem venda?$faq050$,
  'cm-faq-050',
  NULL,
  $faq050$Não. O exercício da opção de recompra é decisão exclusiva da Moní, tomada após análise individual do empreendimento, considerando critérios técnicos, financeiros e de mercado. O prazo de comercialização é estabelecido em Comitê conforme a curva de juros. A Moní poderá exercer a opção a partir do prazo definido, nos termos contratuais.$faq050$,
  'published',
  1,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq051$O franqueado pode prorrogar o prazo de comercialização?$faq051$,
  'cm-faq-051',
  NULL,
  $faq051$A avaliação da prorrogação considera a curva de juros e a perspectiva financeira do projeto. Se o empreendimento passar a apresentar perspectiva financeira negativa, a prorrogação deixa de fazer sentido. A decisão sobre o exercício da opção de recompra compete exclusivamente à Moní.$faq051$,
  'published',
  2,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq052$Como é definido e pago o valor de eventual recompra?$faq052$,
  'cm-faq-052',
  NULL,
  $faq052$O valor é definido individualmente para cada empreendimento em Comitê, buscando permitir a recirculação do ativo, adequar a operação aos instrumentos financeiros disponíveis e cobrir compromissos com credores. Poderá existir saldo remanescente ao franqueado após a quitação. O pagamento é à vista, diretamente aos credores envolvidos. As condições são apresentadas ao franqueado para aceite formal, considerando a titularidade da SPE.$faq052$,
  'published',
  3,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq053$Quais parceiros podem participar da recompra?$faq053$,
  'cm-faq-053',
  NULL,
  $faq053$A Moní utiliza parceiros especializados em imóveis estressados e family offices com perfil de investimento em imóveis destinados à geração de renda. Não foi informado limite de recompras simultâneas nem reserva financeira específica.$faq053$,
  'published',
  4,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq054$Quantos empreendimentos já passaram por recompra?$faq054$,
  'cm-faq-054',
  NULL,
  $faq054$Conforme a resposta fornecida, nenhum empreendimento havia precisado ser recomprado: todos haviam sido comercializados antes da necessidade de acionamento do mecanismo.$faq054$,
  'published',
  5,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq055$O mecanismo de recompra pode ser utilizado como garantia ao terrenista?$faq055$,
  'cm-faq-055',
  NULL,
  $faq055$Não. O documento de esclarecimentos informa que o direito de opção de recompra não constitui garantia automática e não deve compor o estudo de viabilidade nem ser apresentado como argumento de garantia ao terrenista. O projeto deve se sustentar nos cenários do BCA.$faq055$,
  'published',
  6,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq056$A Moní é obrigada a recomprar o imóvel após 11 meses sem venda?$faq056$,
  'cm-faq-056',
  NULL,
  $faq056$Não. O exercício da opção de recompra é decisão exclusiva da Moní, tomada após análise individual do empreendimento. O mecanismo é uma opção contratual e não uma garantia automática de recompra.$faq056$,
  'published',
  7,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq057$Quais critérios são considerados para eventual recompra?$faq057$,
  'cm-faq-057',
  NULL,
  $faq057$A decisão leva em conta critérios técnicos, financeiros e de mercado da viabilidade de cada empreendimento. O prazo de comercialização também considera a curva de juros e a perspectiva financeira da operação.$faq057$,
  'published',
  8,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq058$O franqueado pode exigir prorrogação do prazo de comercialização?$faq058$,
  'cm-faq-058',
  NULL,
  $faq058$A resposta fornecida não prevê decisão unilateral do franqueado. O prazo é definido considerando a curva de juros; quando a prorrogação torna o cenário financeiramente negativo, ela pode deixar de ser adequada. A decisão de exercer a opção cabe à Moní, conforme as condições pactuadas.$faq058$,
  'published',
  9,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq059$Quando o valor de eventual recompra é apresentado ao franqueado?$faq059$,
  'cm-faq-059',
  NULL,
  $faq059$Na reunião de Comitê, são apresentados o valor de referência para eventual recompra e as condições aplicáveis, que exigem aceite formal do franqueado.$faq059$,
  'published',
  10,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq060$Como é definido o valor de recompra?$faq060$,
  'cm-faq-060',
  NULL,
  $faq060$O valor é individualizado por empreendimento e busca permitir a recirculação do ativo, adequar-se aos instrumentos financeiros disponíveis e cobrir compromissos com credores. Não foi indicado que o preço corresponda automaticamente ao custo total incorrido.$faq060$,
  'published',
  11,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq061$O valor da recompra garante a quitação de todas as despesas e o retorno integral do franqueado?$faq061$,
  'cm-faq-061',
  NULL,
  $faq061$A resposta indica que o preço é estruturado para cobrir compromissos financeiros com credores e pode superar as obrigações, deixando saldo ao franqueado. Não afirma garantia irrestrita de recuperação de todo o capital, taxas e despesas em qualquer cenário.$faq061$,
  'published',
  12,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq062$Como é feito o pagamento da eventual recompra?$faq062$,
  'cm-faq-062',
  NULL,
  $faq062$O pagamento é realizado à vista, diretamente aos credores envolvidos na operação. Havendo saldo remanescente após a liquidação das obrigações, ele pode ficar disponível ao franqueado.$faq062$,
  'published',
  13,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq063$De onde vêm os recursos para eventuais recompras?$faq063$,
  'cm-faq-063',
  NULL,
  $faq063$A resposta menciona parceiros especializados em imóveis estressados e family offices com perfil de investimento em imóveis destinados à geração de renda. Não informa reserva financeira segregada nem limite de recompras simultâneas.$faq063$,
  'published',
  14,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq064$Quantos imóveis já precisaram ser recomprados?$faq064$,
  'cm-faq-064',
  NULL,
  $faq064$Nenhum empreendimento havia precisado ser recomprado até a data daquela resposta; os empreendimentos mencionados haviam sido comercializados antes do acionamento do mecanismo.$faq064$,
  'published',
  15,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'estrutura-societaria-e-contratos'),
  $faq065$Qual deve ser a estrutura jurídica do Frank?$faq065$,
  'cm-faq-065',
  NULL,
  $faq065$2 CNPs (1Empresa Incorporadora + 1 Empresa Gestora) + 1 SPE por empreendimento aprovado$faq065$,
  'published',
  1,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'estrutura-societaria-e-contratos'),
  $faq066$Por que são necessários 2 CNPJ? Um Incorporador e um Gestor$faq066$,
  'cm-faq-066',
  NULL,
  $faq066$Não é obrigatório abrir uma empresa Gestora, caso o Franqueado já tenha uma aberta ou case contrate uma empresa para fazer a Gestão da Obra
Caso já tenha: a taxa de adm da obra será direcionada da spe para empresa gestora do Frank
Caso contrate: a taxa de adm da obra será direcionada da spe para o fornecedor contratado, de acordo com NFe emitida por ele.$faq066$,
  'published',
  2,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'estrutura-societaria-e-contratos'),
  $faq067$O que é SPE?$faq067$,
  'cm-faq-067',
  NULL,
  $faq067$"SPE, ou Sociedade de Propósito Específico, é uma empresa criada para um objetivo único e limitado, como uma incorporação, servindo para concentrar recursos, compartilhar riscos e oferecer segurança jurídica, pois o patrimônio dos sócios fica protegido, e a SPE é dissolvida após a conclusão do projeto, sendo comum no setor imobiliário."$faq067$,
  'published',
  3,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'estrutura-societaria-e-contratos'),
  $faq068$Esclarecimentos sobre a franquia podem integrar um aditivo contratual?$faq068$,
  'cm-faq-068',
  NULL,
  $faq068$Sim. Os esclarecimentos podem ser formalizados em aditivo contratual e integrar a documentação da relação entre franqueadora e franqueado.$faq068$,
  'published',
  4,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq069$Por que o banco não permite abrir a conta da SPE quando a incorporadora é dona, e solicita uma pessoa física responsável?$faq069$,
  'cm-faq-069',
  NULL,
  $faq069$A SPE é uma empresa constituída como pessoa jurídica e não possui sócios pessoas físicas diretamente. Sua única sócia é a incorporadora, que também é uma pessoa jurídica. Por isso, quando se abre uma conta em nome da SPE, o banco precisa identificar a pessoa física que exerce controle sobre a empresa (o chamado “beneficiário final”) e registrar quem será responsável por operar a conta da SPE. Essa exigência está de acordo com a regulamentação do Banco Central (Circular Bacen nº 3.978/2020).

A incorporadora, por meio de seu administrador (pessoa física) indicado no contrato social, deve emitir uma procuração autorizando o administrador, conforme contrato social,a representar a SPE no banco. É recomendável consultar o gerente para seguir as exigências específicas de cada instituição.$faq069$,
  'published',
  1,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq070$Emissão de Nota FIscal para Serviços$faq070$,
  'cm-faq-070',
  NULL,
  $faq070$Obrigação legal:
Qualquer prestação de serviço ou fornecimento de produto a uma empresa deve ser documentado por NF (eletrônica ou avulsa, conforme o caso). Sem nota, não há comprovação contábil, fiscal e jurídica da despesa. Isso pode configurar sonegação ou até fraude tributária.

Segurança para a SPE e a incorporadora:
A obra será auditada (parceiros de crédito), sem NF, não há como comprovar que o direcionamento do dinheiro foi para fins da obra, logo o crédito não é liberado para pagamento do fornecedor contratado.

Proteção do franqueado:
Sem NF, a despesa não entra na contabilidade da SPE, não deduz imposto, não compõe custo comprovado,... Sem nota fiscal, o fornecedor recebe sem declarar e isso pode ser visto como ganho ilegal. Além disso, se der problema no serviço ou no material, o franqueado não terá documento oficial para cobrar seus direitos.

Proteção da franqueadora e do sistema:
Como o dinheiro é liberado pelo parceiro de crédito e passa pela conta escrow da franqueadora, permitir pagamento sem NF pode caracterizar conivência com fraude e prejudicar toda a rede em fiscalização.

Emissão contra a SPE.$faq070$,
  'published',
  2,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq071$Quais regimes tributários são normalmente utilizados pela Gestora e Incorporadora?$faq071$,
  'cm-faq-071',
  NULL,
  $faq071$Em linhas gerais, a Gestora costuma operar no Simples Nacional e a Incorporadora no Lucro Presumido. Não são regimes obrigatórios: a definição cabe ao contador do franqueado ou a contador homologado, cuja contratação não é obrigatória. A Moní fornece a estrutura societária e os CNAEs necessários.$faq071$,
  'published',
  3,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq072$Quem recolhe INSS e ISS da obra e como os valores são orçados?$faq072$,
  'cm-faq-072',
  NULL,
  $faq072$A SPE é responsável pelos recolhimentos em seu CNPJ. Os tributos são considerados nas taxas e impostos do BCA e sua operacionalização ocorre com apoio da Gestora. Bases, alíquotas e momento de recolhimento devem ser confirmados para o caso concreto.$faq072$,
  'published',
  4,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq073$Como a Gestora recebe e documenta a taxa de gestão de obra?$faq073$,
  'cm-faq-073',
  NULL,
  $faq073$A remuneração é recebida pelo CNPJ da Empresa Gestora, em razão da prestação de serviços à SPE, mediante emissão de Nota Fiscal de Serviços Eletrônica (NFS-e). A tributação e eventuais retenções dependem do regime fiscal e da legislação aplicável.$faq073$,
  'published',
  5,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq074$Onde são apresentados os tributos e o resultado líquido esperado do empreendimento?$faq074$,
  'cm-faq-074',
  NULL,
  $faq074$O BCA apresenta receitas, custos, impostos e demais despesas da operação, permitindo analisar o resultado líquido estimado antes da contratação. O regime tributário e a carga efetiva devem ser confirmados pelo contador responsável.$faq074$,
  'published',
  6,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq075$Qual empresa recebe a remuneração de gestão de obras?$faq075$,
  'cm-faq-075',
  NULL,
  $faq075$A taxa de gestão de obras é recebida pelo CNPJ da Empresa Gestora do franqueado, em razão de prestação de serviços à SPE.$faq075$,
  'published',
  7,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq076$Qual nota fiscal deve ser emitida pela Gestora?$faq076$,
  'cm-faq-076',
  NULL,
  $faq076$A documentação informa a emissão de Nota Fiscal de Serviços Eletrônica (NFS-e) pela Empresa Gestora para recebimento da taxa de gestão.$faq076$,
  'published',
  8,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq077$Quem define o regime tributário da Gestora e da Incorporadora?$faq077$,
  'cm-faq-077',
  NULL,
  $faq077$O contador do franqueado, ou contador homologado facultativo, deve definir o enquadramento. Simples Nacional para a Gestora e Lucro Presumido para a Incorporadora são práticas comuns, não obrigações.$faq077$,
  'published',
  9,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq078$Qual carga tributária de referência foi indicada para a Gestora?$faq078$,
  'cm-faq-078',
  NULL,
  $faq078$O questionário apresenta estimativa de 6% a 12% sobre a receita de gestão de obra quando enquadrada no Simples Nacional. A carga efetiva depende do regime, da atividade e da situação fiscal da empresa.$faq078$,
  'published',
  10,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq079$Qual carga tributária de referência foi indicada para a Incorporadora?$faq079$,
  'cm-faq-079',
  NULL,
  $faq079$A carga efetiva estimada é de 3% a 5% sobre o VGV no Lucro Presumido. É uma referência documental, não uma alíquota universal, e exige confirmação pelo contador.$faq079$,
  'published',
  11,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq080$Quem recolhe INSS e ISS relacionados à construção?$faq080$,
  'cm-faq-080',
  NULL,
  $faq080$A documentação atribui o recolhimento à SPE, pelo CNPJ da SPE, com operacionalização pela Gestora. Os valores devem estar contemplados nas taxas e impostos do BCA. A apuração e o momento de recolhimento precisam ser confirmados pelo responsável contábil conforme a legislação aplicável.$faq080$,
  'published',
  12,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq081$Os tributos da obra devem constar no BCA?$faq081$,
  'cm-faq-081',
  NULL,
  $faq081$Sim. O questionário informa que INSS e ISS da construção estão previstos na linha de taxas e impostos do orçamento do empreendimento.$faq081$,
  'published',
  13,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq082$O BCA apresenta o resultado antes ou depois dos tributos previstos?$faq082$,
  'cm-faq-082',
  NULL,
  $faq082$Segundo as respostas documentais, o BCA discrimina receitas, custos e tributos estimados de cada projeto para permitir a análise do resultado líquido esperado. Os valores efetivos dependem da execução da operação.$faq082$,
  'published',
  14,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq083$As casas do catálogo tem: rampa, calçada e muros?$faq083$,
  'cm-faq-083',
  NULL,
  $faq083$Não, os produtos são dispostos no catálogo sem interferência de nenhum lote. Atributos do lote são pensados posteriormente, após a submissão das hipóteses$faq083$,
  'published',
  1,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq084$Qual é o método de construção?$faq084$,
  'cm-faq-084',
  NULL,
  $faq084$Construção metálica, pré-fabricada/modular somado à Griffon wall (wood wall)$faq084$,
  'published',
  2,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq085$Cada modelo de casa do catálogo é construído exataente igual?$faq085$,
  'cm-faq-085',
  NULL,
  $faq085$Cada modelo possui opções de layout, fachada e adicionais para viabilizar os acoplamentos nos lotes. Sendo assim, a estética de cada produto não se restringe à uma opção, mas sim a mais de um padrão já préviamente cetado pela Franqueadora$faq085$,
  'published',
  3,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq086$O cliente final pode customizar a Casa que ele compra?$faq086$,
  'cm-faq-086',
  NULL,
  $faq086$A depender da etapa de obra e das opções de Customização pré estabelecidas pela Franqueadora$faq086$,
  'published',
  4,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq087$Como o produto é escolhido para cada lote?$faq087$,
  'cm-faq-087',
  NULL,
  $faq087$Os produtos são escolhidos no processo de viabilidade por meio do mapas de compeditores, questionários, conversas com a rede do franqueados que resultam em escolhas de lotes para análise de BCAs, Batalhas de Casas, esses materiais somam os aspectos dos produtos do catálogo à características de localização e preços praticados, resultando em formalização de boas Hipóteses, as quais serão negociadas com os terrenistas. A escolha dos produtos resultam de uma análise em conjunto com Localização e Preço.$faq087$,
  'published',
  5,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq088$Posso utilizar o projeto que eu já tenho e que não é o da MONÍ?$faq088$,
  'cm-faq-088',
  NULL,
  $faq088$Não, a Fraqnueadora Casa Moní atua com seus franqueados apenas com casas do Catálogo Moní$faq088$,
  'published',
  6,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq089$O Frank pode fazer alterações na configuração da planta base da Casa MONÍ?$faq089$,
  'cm-faq-089',
  NULL,
  $faq089$Não é autorizado alterar a configuração da planta base da Casa Moní para além do que a Franqueado estabeleça como permitido. Em geral, layouts e tamanhos de ambientes não são aterados, é possível acrescentar cômodos para elaboração do acoplamento, no entando isso deve ser dividido e aprovado pela Franqueadora, durante o Processo de Viabilidade$faq089$,
  'published',
  7,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq090$Quem faz e como são feitas as implantações?$faq090$,
  'cm-faq-090',
  NULL,
  $faq090$As implantações são feitas durante o Processo de Viabilidade, utiliza-se a planta padrão do produto escolhido, somada aos adicionais escolhidos e uma possível primeira possibilidade de impantação enviada pelo Frank. O Time da Moní compreende tecnicamente a viabilidade e depois desenha enquanto Desenho Técnico$faq090$,
  'published',
  8,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq091$Qual é a fonte oficial para consultar os custos dos produtos?$faq091$,
  'cm-faq-091',
  NULL,
  $faq091$O configurador online é indicado como referência oficial de custos.$faq091$,
  'published',
  9,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fornecedores'),
  $faq092$Todos os fornecedores de produtos e serviços são Homologados MONÍ?$faq092$,
  'cm-faq-092',
  NULL,
  $faq092$A Moní estabelece ao Franqueado Fornecedores Homologados Obrigatórios (Loja Moní) para alguns produtos e serviços, assim como há processos que possuem Fornecedores Homologados Não Obrigatórios, que ficam a crivo do Franqueado escolher contratar/ comprar sim ou não. E por fim, há Fornecedores Não Homologados, de responsabilidade do Franqueado comprar o produto ou contratar o serviço. Todos são descritos durante a apresentação da Franqueadora e Operação$faq092$,
  'published',
  1,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fornecedores'),
  $faq093$A MONÍ indica fornecedores?$faq093$,
  'cm-faq-093',
  NULL,
  $faq093$Fornecedores Não Homologados não são indicados pela Moní$faq093$,
  'published',
  2,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fornecedores'),
  $faq094$Como o Frank contrata Fornecedores Homologados MONÍ?$faq094$,
  'cm-faq-094',
  NULL,
  $faq094$A Moní deve descrrver ao Frank o processo de conttratação de cada Fornecedor, a depender da etapa em que o Fraqnueado esteja.$faq094$,
  'published',
  3,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'operacoes-e-obra'),
  $faq095$A Franqueadors disponibiliza domínio de e-mail "moni" ao Franqueado?$faq095$,
  'cm-faq-095',
  NULL,
  $faq095$Hoje a Moni não disponibiliza e-mails @moni para franqueados. Como as unidades são operações independentes, cada franqueado utiliza seu próprio e-mail para comunicação, enquanto os canais institucionais da Moni ficam centralizados na franqueadora.$faq095$,
  'published',
  1,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'operacoes-e-obra'),
  $faq096$Quanto tempo demora para aprovar o projeto no Condomínio e na Prefeitura?$faq096$,
  'cm-faq-096',
  NULL,
  $faq096$Varia, essas informações devem ser consultadas por empreendimento em cada respectivos condomínios e prefeituras, assim como o prazo para atendimento de Comunique-ses$faq096$,
  'published',
  2,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
)
VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'comercializacao'),
  $faq097$Em que momento a casa pode ser vendida?$faq097$,
  'cm-faq-097',
  NULL,
  $faq097$A Casa pode ser anunciada como "Breve Lançamento" após a assinatura do Contrato do Lote até a Liberação do Alvarão de obra. E ela passa a ser anunciada como "Lançamento" e pode ser vendida após a Emissão do Alvará de Obra.$faq097$,
  'published',
  1,
  NULL,
  '{}',
  '{}',
  false,
  ARRAY['frank','team','admin']::text[]
);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('655', 'faq_conteudo_anexo')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;

