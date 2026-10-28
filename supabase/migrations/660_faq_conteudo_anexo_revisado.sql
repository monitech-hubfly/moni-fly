-- 660: substitui a Central de Ajuda e a Gestão FAQ pelo texto anexo.
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

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
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Fluxo financeiro, funding e responsabilidades', 'fluxo-financeiro-funding-e-responsabilidades', NULL, 'DollarSign', 13, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Contratos com terrenistas — prazos e modalidades', 'contratos-com-terrenistas-prazos-e-modalidades', NULL, 'FileSignature', 14, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Garantias e seguro do terreno', 'garantias-e-seguro-do-terreno', NULL, 'Stamp', 15, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Portfólio, Comitê, catálogo e projetos locais', 'portfolio-comite-catalogo-e-projetos-locais', NULL, 'ClipboardList', 16, true);
INSERT INTO public.faq_categories (name, slug, description, icon, display_order, is_active)
VALUES ('Atuação profissional, fornecedores e suporte', 'atuacao-profissional-fornecedores-e-suporte', NULL, 'Handshake', 17, true);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'institucional'),
  $faq001$Quanto tempo tem a Casa MONÍ?$faq001$,
  'cm-faq-001',
  NULL,
  $faq001$A Casa Moní foi fundada em abril de 2022. Seu aniversário é celebrado em 22 de abril, Dia da Terra, data alinhada ao propósito de desenvolver casas de luxo com foco em soluções sustentáveis.$faq001$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq002$A Casa MONÍ atua em quais regiões?$faq002$,
  'cm-faq-002',
  NULL,
  $faq002$Atuamos via franquias em todo o Brasil e agora inciando nossas operações nos EUA, por hora somente com loja própria.$faq002$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq003$Há um estudo de mercado para seleção da regiões?$faq003$,
  'cm-faq-003',
  NULL,
  $faq003$Sim. Cada região possui características próprias de mercado, que influenciam o tipo de produto, os preços, os kits de acabamento e o potencial de vendas. A análise regional também orienta a definição do valor da taxa de franquia e o limite de franqueados por perímetro. Algumas regiões já atingiram a capacidade definida pela Franqueadora.$faq003$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq004$O que é COF (Circular de Oferta de Franquia)?$faq004$,
  'cm-faq-004',
  NULL,
  $faq004$é um documento obrigatório e que segue um conjunto de informações padronizadas previstas na lei de franquias. Tem o objetivo de estabelecer com clareza como a nossa relação vai funcionar em termos práticos, direiros e obrigações, etc. Se você quiser podemos enviar uma cópia, ela é absolutamente padrão para todos os franqueados.$faq004$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq005$O que é Contrato de Franquia$faq005$,
  'cm-faq-005',
  NULL,
  $faq005$contrato firma nossa relação franqueadora - franqueado, nele estarão contidos os detalhes juridicos e comerciais que estamos acordando - quais são as figuras juridicas envolvidas, multas, valores, formas de pagamento, foro escolhido para eventuais pleitos etc$faq005$,
  'published', 4, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq006$Quais mercados a MONÍ está visando?$faq006$,
  'cm-faq-006',
  NULL,
  $faq006$A estratégia geral da moní e empoderar micro-incorporadores globalmente através de sua marca de eco-smart homes. Apesar de tecnicamente já ter nascido embaixo de uma estrutura nos EUA escolhemos inicialmente atuar no estado de são paulo (BR), hoje estamos expandindo para todo o Brasil e iniciando nossas primeiras operações nos EUA$faq006$,
  'published', 5, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq007$Como a MONÍ avalia locais potenciais?$faq007$,
  'cm-faq-007',
  NULL,
  $faq007$O mercado residencial de Luxo, ao contrário do que se pensa, está muito desabastecido, existem inúmeros locais onde clientes de alto potencial estão morando em casas muito abaixo de suas expectativas. O que procuramos identificar através de dados são locais onde existe evidência dessa demanda reprimida.$faq007$,
  'published', 6, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq008$O que o candidato deve saber para ser um Frank MONÍ?$faq008$,
  'cm-faq-008',
  NULL,
  $faq008$o franqueado da casa moní, ou simplesmente FRANK como chamamos aqui, tem 2 grandes papéis: encontrar boas oportunidades para desenvolver casas de luxo com alta rentabilidade e liquidez gerenciar a execução da casa.$faq008$,
  'published', 7, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-expansao'),
  $faq009$A área de atuação do franqueado é exclusiva? Como é definida a quantidade de franqueados por região?$faq009$,
  'cm-faq-009',
  NULL,
  $faq009$Não. A área de atuação do franqueado não é exclusiva. A Franqueadora define a quantidade de franqueados admitidos em cada perímetro com base na análise do mercado local. São considerados o perfil de demanda, o potencial de vendas, os produtos adequados, os preços e os kits de acabamento. A disponibilidade de novas unidades depende do dimensionamento realizado para cada região.$faq009$,
  'published', 8, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-remuneracao'),
  $faq010$A Moní participa do lucro da venda do empreendimento?$faq010$,
  'cm-faq-010',
  NULL,
  $faq010$Não. todo o resultado do empreendimento pertence ao franqueado; a Moní não participa como sócia e fornece tecnologia, processos, suporte operacional e os serviços contratados.$faq010$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-remuneracao'),
  $faq011$Como funciona a taxa de franquia de R$ 700 mil e o abatimento por início de obras?$faq011$,
  'cm-faq-011',
  NULL,
  $faq011$A taxa total, na condição comercial apresentada, é de R$ 700.000. A entrada de R$ 100.000 é composta por R$ 25.000 na assinatura e R$ 75.000 em 24 parcelas mensais de R$ 3.125. A cada obra iniciada, são cobrados R$ 60.000 em seis parcelas, debitadas da remuneração de gestão, até completar dez obras e o saldo da taxa. Há abatimento de R$ 200.000 quando forem iniciadas seis obras em 24 meses, no ritmo de duas obras por semestre durante três semestres consecutivos. O abatimento está vinculado ao início das obras, não à assinatura de contratos, à venda ou à conclusão. As condições aplicáveis devem estar previstas no contrato de franquia.$faq011$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-remuneracao'),
  $faq012$Qual é a diferença entre a remuneração pela gestão da obra e a taxa da plataforma?$faq012$,
  'cm-faq-012',
  NULL,
  $faq012$A remuneração pela gestão da obra corresponde a 8% do custo da construção e é destinada ao franqueado. A taxa de 7% é destinada à Franqueadora pelos serviços de plataforma digital, tecnologia, processos e backoffice. São parcelas distintas da remuneração total de 15% sobre o custo da obra; a taxa de 7% não é descontada dos 8%.$faq012$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'franquia-e-remuneracao'),
  $faq013$O que determina o resultado financeiro que fica com o franqueado?$faq013$,
  'cm-faq-013',
  NULL,
  $faq013$O resultado do empreendimento pertence ao franqueado e não é dividido com a Moní como sócia. Para verificar o resultado efetivamente disponível, devem ser consideradas as receitas, os custos de terreno e obra, tributos, despesas financeiras e demais itens discriminados no BCA de cada projeto.$faq013$,
  'published', 4, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'credito-e-funding'),
  $faq014$Existe garantia de aprovação de crédito para os empreendimentos?$faq014$,
  'cm-faq-014',
  NULL,
  $faq014$A aprovação de crédito não é automática. Durante a viabilidade e o Pré-Comitê, o franqueado conta com um concierge especializado para estruturar e avaliar o projeto. O Comitê atua como filtro técnico: historicamente, aproximadamente 50% dos empreendimentos submetidos são aprovados. Projetos reprovados não são encaminhados aos veículos de crédito. Se o projeto for aprovado, mas não houver disponibilidade de crédito, a Moní disponibiliza uma ferramenta de captação fracionada junto a investidores pessoas físicas. Mesmo após aprovação pelo Comitê do Fundo, a liberação de recursos exige o cumprimento dos procedimentos e requisitos aplicáveis.$faq014$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'credito-e-funding'),
  $faq015$Quais informações são necessárias para iniciar a pré-análise de crédito?$faq015$,
  'cm-faq-015',
  NULL,
  $faq015$Para iniciar a pré-análise de crédito, o franqueado deve apresentar as informações cadastrais e financeiras dos sócios finais da SPE, os dados do terreno e, quando aplicável, a documentação da pessoa jurídica que constitui sua principal fonte de renda. A Moní também prepara um resumo do projeto com os principais dados da viabilidade econômica e do empreendimento.$faq015$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'credito-e-funding'),
  $faq016$Quais documentos dos sócios são solicitados para a pré-análise de crédito?$faq016$,
  'cm-faq-016',
  NULL,
  $faq016$São solicitados: documento de identificação (CPF, RG ou CNH), comprovante de estado civil, comprovante de endereço emitido nos últimos 90 dias, declaração de Imposto de Renda da Pessoa Física do último ano, e-mail e telefone de contato. A documentação deve corresponder aos sócios finais da SPE.$faq016$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'credito-e-funding'),
  $faq017$Quais informações do terreno são necessárias para a pré-análise de crédito?$faq017$,
  'cm-faq-017',
  NULL,
  $faq017$Devem ser apresentados a matrícula atualizada do imóvel, fotografias internas e externas do terreno e o documento de IPTU que contenha a metragem do imóvel.$faq017$,
  'published', 4, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'credito-e-funding'),
  $faq018$Quando é necessário apresentar documentos de uma empresa para a análise de crédito?$faq018$,
  'cm-faq-018',
  NULL,
  $faq018$Quando a principal fonte de renda do franqueado provém de uma empresa da qual ele é sócio, também são solicitados documentos dessa pessoa jurídica: última alteração contratual, faturamento dos últimos 12 meses, demonstrações contábeis ou declaração de IRPJ conforme solicitado, extratos bancários dos seis meses das contas de maior movimentação e comprovante de endereço da empresa emitido nos últimos 90 dias.$faq018$,
  'published', 5, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'credito-e-funding'),
  $faq019$Quais dados do empreendimento integram a apresentação inicial para análise de crédito?$faq019$,
  'cm-faq-019',
  NULL,
  $faq019$A apresentação inicial preparada pela Moní reúne um resumo da viabilidade econômica, a localização do empreendimento, a previsão de início e entrega da obra, a área da casa e a área do terreno.$faq019$,
  'published', 6, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'credito-e-funding'),
  $faq020$Preciso reenviar documentos que já encaminhei durante o atendimento comercial?$faq020$,
  'cm-faq-020',
  NULL,
  $faq020$Não é necessário encaminhar novamente documentos que já tenham sido recebidos e estejam disponíveis para a análise. O franqueado poderá ser solicitado a complementar apenas os itens pendentes ou desatualizados.$faq020$,
  'published', 7, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq021$Como preencher o campo de título aquisitivo no contrato de permuta?$faq021$,
  'cm-faq-021',
  NULL,
  $faq021$O que é "título aquisitivo"? Título aquisitivo é o nome dado ao documento legal que comprova a aquisição da propriedade de um bem imóvel. Ele é a base jurídica da propriedade e precisa estar registrado no Cartório de Registro de Imóveis competente. Exemplos comuns de título aquisitivo: Escritura pública de compra e venda registrada; Formal de partilha (no caso de herança ou divórcio); Contrato de compra e venda com quitação (em certos casos, quando a escritura ainda não foi lavrada, mas a posse já está regular); Carta de arrematação (após leilão judicial); Doação (com escritura pública e registro); Usucapião (sentença judicial ou extrajudicial com registro); Instrumento particular de cessão de direitos, em alguns casos específicos (ex: imóveis em regularização). Como preencher essa cláusula corretamente? Se, por exemplo, o imóvel foi comprado normalmente com escritura, você escreveria: "O imóvel foi adquirido pelo vendedor nos termos da escritura pública de compra e venda lavrada em [data], registrada sob o nº [matrícula] no Cartório de Registro de Imóveis da [cidade/UF]."$faq021$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq022$Quais padrão de documentos o frank tem que pedir pro terrenista pra preencher o contrato de opção e permuta padrão moní$faq022$,
  'cm-faq-022',
  NULL,
  $faq022$-cópia dos documentos dos proprietários (RG, cpf, comprovante de endereço, certidão de casamento ou nascimento) -cnpj do proprietário se houver -cópia da matrícula do imóvel + carta de cessão de posse -número de inscrição de IPTU -declaração negativa de débitos condominiais -profissão do proprietário$faq022$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq023$Como é calculada a remuneração de 5% pela intermediação do lote em operações que a prevejam?$faq023$,
  'cm-faq-023',
  NULL,
  $faq023$Nas operações em que essa remuneração estiver contratualmente prevista, os 5% incidem uma única vez sobre o Valor Base do Lote. Exemplo: para valor-base de R$ 4.000.000, a remuneração é de R$ 200.000; em dois lotes de R$ 2.000.000, equivale a R$ 100.000 por lote. O pagamento é movimentado pela SPE, integra o custo do lote no BCA e independe da origem dos recursos. Pode ocorrer na transferência do terreno à SPE ou na venda do imóvel, conforme o acordo formalizado.$faq023$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq024$Quem assume IPTU, ITU, condomínio e encargos do terreno?$faq024$,
  'cm-faq-024',
  NULL,
  $faq024$Em regra, a SPE assume IPTU ou ITU, despesas condominiais, taxas e demais encargos a partir da lavratura da escritura de transferência, ressalvadas condições específicas negociadas no contrato. Esses custos devem ser provisionados no capital de giro do BCA e não são cobertos pela Moní ou pelo fundo. Não há valor fixo: os montantes variam conforme o município, o imóvel e o condomínio.$faq024$,
  'published', 4, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq025$Como funcionam a entrada de 30%, o saldo de 70% e a remuneração de 15% ao ano em uma aquisição de terreno?$faq025$,
  'cm-faq-025',
  NULL,
  $faq025$Em uma das estruturas possíveis de aquisição, 30% do Valor Base do Lote são pagos na escritura, e os 70% restantes são quitados na venda do imóvel ou até o prazo máximo contratual, de 24 meses no exemplo apresentado. Sobre o saldo devedor incidem juros compostos de 15% ao ano desde o marco estabelecido no contrato até a quitação. Se houver pagamento antecipado, os juros deixam de incidir sobre a parcela quitada. Trata-se de uma estrutura negociável, não de uma regra obrigatória para todas as operações.$faq025$,
  'published', 5, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq026$Quem contrata e paga o instrumento garantidor do saldo do terreno?$faq026$,
  'cm-faq-026',
  NULL,
  $faq026$O custo do instrumento garantidor é suportado pelo tomador, normalmente o incorporador/franqueado, e deve estar previsto no BCA. A estimativa apresentada é de 2% a 6% do saldo do terreno, variando conforme prazo e condições de contratação; para planejamento, recomenda-se provisionar o limite superior. O beneficiário é o terrenista. Se ele ingressar como cotista da SPE, a dispensa do instrumento poderá ser negociada, mas dependerá de concordância das partes e formalização contratual.$faq026$,
  'published', 6, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq027$Quais despesas podem ocorrer antes da transferência definitiva do terreno?$faq027$,
  'cm-faq-027',
  NULL,
  $faq027$Conforme a etapa, o franqueado pode assumir diligência, constituição de empresas, contas, taxas de funding, RRT, aprovações, topografia e sondagem, instrumento garantidor, ITBI, escritura, cartório e encargos. Projetos legais e executivos podem ser pagos no primeiro desembolso do crédito, conforme o modelo descrito. Cada operação deve ter sua previsão no BCA.$faq027$,
  'published', 7, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq028$Quem paga o registro da opção na matrícula do imóvel?$faq028$,
  'cm-faq-028',
  NULL,
  $faq028$O registro é facultativo na minuta examinada e, se realizado, seu custo é suportado pela SPE/adquirente. O registro da opção não transfere, por si só, propriedade ou posse.$faq028$,
  'published', 8, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq029$Qual é o papel da Moní no contrato de opção de compra do terreno?$faq029$,
  'cm-faq-029',
  NULL,
  $faq029$A Moní pode figurar como interveniente anuente, sem ser adquirente ou transmitente. A aquisição cabe à SPE do franqueado ou ao adquirente que posteriormente cederá os direitos e obrigações à SPE, conforme as condições contratuais.$faq029$,
  'published', 9, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq030$Quais modelos de negociação com o terrenista são admitidos?$faq030$,
  'cm-faq-030',
  NULL,
  $faq030$Há estruturas de permuta integral por valor fixo ou percentual do VGV, compra parcial com entrada e saldo fixo ou percentual do VGV, além de condições negociadas entre as partes. Cada proposta depende da análise do BCA e das garantias aplicáveis.$faq030$,
  'published', 10, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'terrenos-e-permuta'),
  $faq031$É possível oferecer ao terrenista entrada de 20% e saldo em 18 parcelas mensais?$faq031$,
  'cm-faq-031',
  NULL,
  $faq031$Não é uma condição padrão. O saldo do terreno deve observar a estrutura de pagamento negociada e formalizada no contrato aplicável, inclusive os marcos de pagamento e o prazo máximo previsto.$faq031$,
  'published', 11, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq033$A recompra do imóvel pela Moní é automática após 11 meses sem venda?$faq033$,
  'cm-faq-033',
  NULL,
  $faq033$Não. A Moní possui o direito de opção de recompra, mas seu exercício não é automático nem obrigatório após 11 meses sem venda. A decisão é exclusiva da Franqueadora e considera a análise técnica, financeira e mercadológica de cada empreendimento. O prazo aplicável é definido em Comitê com base na curva de juros e nas condições do projeto. A partir desse marco, a Moní poderá exercer a opção nos termos contratuais.$faq033$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq034$O franqueado pode prorrogar o prazo de comercialização?$faq034$,
  'cm-faq-034',
  NULL,
  $faq034$A avaliação da prorrogação considera a curva de juros e a perspectiva financeira do projeto. Se o empreendimento passar a apresentar perspectiva financeira negativa, a prorrogação deixa de fazer sentido. A decisão sobre o exercício da opção de recompra compete exclusivamente à Moní.$faq034$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq035$Como é definido e pago o valor de eventual recompra?$faq035$,
  'cm-faq-035',
  NULL,
  $faq035$O valor é definido individualmente no Comitê, considerando a possibilidade de recirculação do ativo, a viabilidade para novos investidores e a cobertura das obrigações com credores. O preço não corresponde necessariamente à soma de todos os desembolsos realizados pelo franqueado. O pagamento é realizado à vista, diretamente aos credores envolvidos. Se o valor superar os compromissos financeiros, poderá existir saldo remanescente para o franqueado. O valor e as condições são apresentados para aceite formal, considerando que a SPE é de titularidade do franqueado.$faq035$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq036$Quais parceiros podem participar da recompra?$faq036$,
  'cm-faq-036',
  NULL,
  $faq036$A Moní trabalha com parceiros especializados em imóveis estressados e family offices que investem em imóveis destinados à geração de renda. O exercício da opção de recompra depende da análise individual e das condições estabelecidas para o empreendimento.$faq036$,
  'published', 4, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq037$Quantos empreendimentos já passaram por recompra?$faq037$,
  'cm-faq-037',
  NULL,
  $faq037$Até a última atualização informada, nenhum empreendimento havia precisado ser recomprado, pois os imóveis haviam sido comercializados antes do acionamento desse mecanismo.$faq037$,
  'published', 5, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'recompra-e-liquidacao'),
  $faq038$O mecanismo de recompra pode ser utilizado como garantia ao terrenista?$faq038$,
  'cm-faq-038',
  NULL,
  $faq038$Não. o direito de opção de recompra não constitui garantia automática e não deve compor o estudo de viabilidade nem ser apresentado como argumento de garantia ao terrenista. O projeto deve se sustentar nos cenários do BCA.$faq038$,
  'published', 6, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'estrutura-societaria-e-contratos'),
  $faq039$Qual deve ser a estrutura jurídica do Frank?$faq039$,
  'cm-faq-039',
  NULL,
  $faq039$2 CNPs (1Empresa Incorporadora + 1 Empresa Gestora) + 1 SPE por empreendimento aprovado$faq039$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'estrutura-societaria-e-contratos'),
  $faq040$Por que são necessários 2 CNPJ? Um Incorporador e um Gestor$faq040$,
  'cm-faq-040',
  NULL,
  $faq040$Não é obrigatório abrir uma empresa Gestora, caso o Franqueado já tenha uma aberta ou case contrate uma empresa para fazer a Gestão da Obra Caso já tenha: a taxa de adm da obra será direcionada da spe para empresa gestora do Frank Caso contrate: a taxa de adm da obra será direcionada da spe para o fornecedor contratado, de acordo com NFe emitida por ele.$faq040$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'estrutura-societaria-e-contratos'),
  $faq041$O que é SPE?$faq041$,
  'cm-faq-041',
  NULL,
  $faq041$SPE significa Sociedade de Propósito Específico. É uma pessoa jurídica constituída para desenvolver um empreendimento determinado. Na operação, a SPE concentra as obrigações, receitas, custos e movimentações financeiras daquele projeto. Sua estrutura e encerramento dependem dos atos societários e das obrigações legais aplicáveis.$faq041$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'estrutura-societaria-e-contratos'),
  $faq042$Esclarecimentos sobre a franquia podem integrar um aditivo contratual?$faq042$,
  'cm-faq-042',
  NULL,
  $faq042$Sim. Os esclarecimentos podem ser formalizados em aditivo contratual e integrar a documentação da relação entre franqueadora e franqueado.$faq042$,
  'published', 4, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq043$Por que o banco não permite abrir a conta da SPE quando a incorporadora é dona, e solicita uma pessoa física responsável?$faq043$,
  'cm-faq-043',
  NULL,
  $faq043$A SPE é uma empresa constituída como pessoa jurídica e não possui sócios pessoas físicas diretamente. Sua única sócia é a incorporadora, que também é uma pessoa jurídica. Por isso, quando se abre uma conta em nome da SPE, o banco precisa identificar a pessoa física que exerce controle sobre a empresa (o chamado “beneficiário final”) e registrar quem será responsável por operar a conta da SPE. Essa exigência está de acordo com a regulamentação do Banco Central (Circular Bacen nº 3.978/2020). A incorporadora, por meio de seu administrador (pessoa física) indicado no contrato social, deve emitir uma procuração autorizando o administrador, conforme contrato social,a representar a SPE no banco. É recomendável consultar o gerente para seguir as exigências específicas de cada instituição.$faq043$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq044$Emissão de Nota FIscal para Serviços$faq044$,
  'cm-faq-044',
  NULL,
  $faq044$As contratações de produtos e serviços da obra devem ser documentadas com a nota fiscal adequada, emitida em nome da SPE quando ela for a contratante. A documentação fiscal permite comprovar despesas, registrar os custos na contabilidade e atender aos controles exigidos pelos parceiros de crédito. Pagamentos sem comprovação fiscal podem impedir a liberação de recursos e gerar riscos contábeis e tributários. O tipo de documento exigível deve ser confirmado conforme a operação e o fornecedor.$faq044$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq045$Quais regimes tributários são normalmente utilizados pela Gestora e Incorporadora?$faq045$,
  'cm-faq-045',
  NULL,
  $faq045$Em linhas gerais, a Empresa Gestora costuma operar no Simples Nacional e a Incorporadora no Lucro Presumido. Esses enquadramentos não são obrigatórios. O regime mais adequado deve ser definido pelo contador do franqueado ou por contador homologado, cuja contratação é facultativa. A Moní orienta a estrutura societária e as atividades econômicas necessárias à operação.$faq045$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq046$Quem recolhe INSS e ISS da obra e como os valores são orçados?$faq046$,
  'cm-faq-046',
  NULL,
  $faq046$A SPE é responsável pelos recolhimentos de INSS e ISS relacionados à obra, utilizando seu CNPJ. A Gestora pode operacionalizar esses pagamentos. As estimativas devem constar das linhas de taxas e impostos do BCA. Bases de cálculo, alíquotas e momento de recolhimento precisam ser confirmados conforme as características do empreendimento e a legislação aplicável.$faq046$,
  'published', 4, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq047$Como a Gestora recebe e documenta a taxa de gestão de obra?$faq047$,
  'cm-faq-047',
  NULL,
  $faq047$A Empresa Gestora recebe a remuneração pela prestação de serviços de gestão de obras à SPE, mediante emissão de Nota Fiscal de Serviços Eletrônica (NFS-e). O enquadramento tributário e eventuais retenções dependem do regime fiscal e das regras aplicáveis ao serviço.$faq047$,
  'published', 5, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq048$Onde são apresentados os tributos e o resultado líquido esperado do empreendimento?$faq048$,
  'cm-faq-048',
  NULL,
  $faq048$O BCA apresenta as receitas, os custos, os tributos e as demais despesas previstos para o empreendimento. Essas informações permitem avaliar o resultado líquido estimado da operação. A tributação efetiva deve ser validada pelo contador responsável e os valores realizados podem variar em relação às estimativas.$faq048$,
  'published', 6, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq049$Qual carga tributária de referência foi indicada para a Gestora?$faq049$,
  'cm-faq-049',
  NULL,
  $faq049$estimativa de 6% a 12% sobre a receita de gestão de obra quando enquadrada no Simples Nacional. A carga efetiva depende do regime, da atividade e da situação fiscal da empresa.$faq049$,
  'published', 7, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'tributacao-e-contabilidade'),
  $faq050$Qual carga tributária de referência foi indicada para a Incorporadora?$faq050$,
  'cm-faq-050',
  NULL,
  $faq050$A carga efetiva estimada é de 3% a 5% sobre o VGV no Lucro Presumido. É uma estimativa, não uma alíquota universal, e exige confirmação pelo contador.$faq050$,
  'published', 8, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq051$As casas do catálogo tem: rampa, calçada e muros?$faq051$,
  'cm-faq-051',
  NULL,
  $faq051$Não, os produtos são dispostos no catálogo sem interferência de nenhum lote. Atributos do lote são pensados posteriormente, após a submissão das hipóteses$faq051$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq052$Qual é o método de construção?$faq052$,
  'cm-faq-052',
  NULL,
  $faq052$Construção metálica, pré-fabricada/modular somado à Griffon wall (wood wall)$faq052$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq053$Cada modelo de casa do catálogo é construído exataente igual?$faq053$,
  'cm-faq-053',
  NULL,
  $faq053$Cada modelo possui opções de layout, fachada e adicionais para viabilizar os acoplamentos nos lotes. Sendo assim, a estética de cada produto não se restringe à uma opção, mas sim a mais de um padrão já préviamente cetado pela Franqueadora$faq053$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq054$O cliente final pode customizar a Casa que ele compra?$faq054$,
  'cm-faq-054',
  NULL,
  $faq054$A depender da etapa de obra e das opções de Customização pré estabelecidas pela Franqueadora$faq054$,
  'published', 4, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq055$Como o produto é escolhido para cada lote?$faq055$,
  'cm-faq-055',
  NULL,
  $faq055$Os produtos são escolhidos no processo de viabilidade por meio do mapas de compeditores, questionários, conversas com a rede do franqueados que resultam em escolhas de lotes para análise de BCAs, Batalhas de Casas, esses materiais somam os aspectos dos produtos do catálogo à características de localização e preços praticados, resultando em formalização de boas Hipóteses, as quais serão negociadas com os terrenistas. A escolha dos produtos resultam de uma análise em conjunto com Localização e Preço.$faq055$,
  'published', 5, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq056$Posso utilizar o projeto que eu já tenho e que não é o da MONÍ?$faq056$,
  'cm-faq-056',
  NULL,
  $faq056$Não, a Fraqnueadora Casa Moní atua com seus franqueados apenas com casas do Catálogo Moní$faq056$,
  'published', 6, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq057$O Frank pode fazer alterações na configuração da planta base da Casa MONÍ?$faq057$,
  'cm-faq-057',
  NULL,
  $faq057$Não é autorizado alterar a configuração da planta base da Casa Moní para além do que a Franqueado estabeleça como permitido. Em geral, layouts e tamanhos de ambientes não são aterados, é possível acrescentar cômodos para elaboração do acoplamento, no entando isso deve ser dividido e aprovado pela Franqueadora, durante o Processo de Viabilidade$faq057$,
  'published', 7, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq058$Quem faz e como são feitas as implantações?$faq058$,
  'cm-faq-058',
  NULL,
  $faq058$As implantações são feitas durante o Processo de Viabilidade, utiliza-se a planta padrão do produto escolhido, somada aos adicionais escolhidos e uma possível primeira possibilidade de impantação enviada pelo Frank. O Time da Moní compreende tecnicamente a viabilidade e depois desenha enquanto Desenho Técnico$faq058$,
  'published', 8, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'produto-e-catalogo'),
  $faq059$Qual é a fonte oficial para consultar os custos dos produtos?$faq059$,
  'cm-faq-059',
  NULL,
  $faq059$O configurador online é a ferramenta oficial para consulta dos custos dos produtos.$faq059$,
  'published', 9, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fornecedores'),
  $faq060$Todos os fornecedores de produtos e serviços são Homologados MONÍ?$faq060$,
  'cm-faq-060',
  NULL,
  $faq060$A Moní estabelece ao Franqueado Fornecedores Homologados Obrigatórios (Loja Moní) para alguns produtos e serviços, assim como há processos que possuem Fornecedores Homologados Não Obrigatórios, que ficam a crivo do Franqueado escolher contratar/ comprar sim ou não. E por fim, há Fornecedores Não Homologados, de responsabilidade do Franqueado comprar o produto ou contratar o serviço. Todos são descritos durante a apresentação da Franqueadora e Operação$faq060$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fornecedores'),
  $faq061$A MONÍ indica fornecedores?$faq061$,
  'cm-faq-061',
  NULL,
  $faq061$Fornecedores Não Homologados não são indicados pela Moní$faq061$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fornecedores'),
  $faq062$Como o Frank contrata Fornecedores Homologados MONÍ?$faq062$,
  'cm-faq-062',
  NULL,
  $faq062$A Moní deve descrrver ao Frank o processo de conttratação de cada Fornecedor, a depender da etapa em que o Fraqnueado esteja.$faq062$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'operacoes-e-obra'),
  $faq063$A Franqueadors disponibiliza domínio de e-mail "moni" ao Franqueado?$faq063$,
  'cm-faq-063',
  NULL,
  $faq063$Hoje a Moni não disponibiliza e-mails @moni para franqueados. Como as unidades são operações independentes, cada franqueado utiliza seu próprio e-mail para comunicação, enquanto os canais institucionais da Moni ficam centralizados na franqueadora.$faq063$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'operacoes-e-obra'),
  $faq064$Quanto tempo demora para aprovar o projeto no Condomínio e na Prefeitura?$faq064$,
  'cm-faq-064',
  NULL,
  $faq064$Varia, essas informações devem ser consultadas por empreendimento em cada respectivos condomínios e prefeituras, assim como o prazo para atendimento de Comunique-ses$faq064$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'comercializacao'),
  $faq065$Em que momento a casa pode ser vendida?$faq065$,
  'cm-faq-065',
  NULL,
  $faq065$A Casa pode ser anunciada como "Breve Lançamento" após a assinatura do Contrato do Lote até a Liberação do Alvarão de obra. E ela passa a ser anunciada como "Lançamento" e pode ser vendida após a Emissão do Alvará de Obra.$faq065$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fluxo-financeiro-funding-e-responsabilidades'),
  $faq066$Quais alternativas existem para financiar a aquisição do terreno?$faq066$,
  'cm-faq-066',
  NULL,
  $faq066$A estruturação pode envolver parceiros institucionais, investidores pessoa física e soluções de financiamento desenvolvidas no ecossistema Moní. A disponibilidade depende de análise e aprovação de cada operação ou do êxito da captação. A existência dessas alternativas não representa garantia de recursos para todos os empreendimentos.$faq066$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fluxo-financeiro-funding-e-responsabilidades'),
  $faq067$O franqueado pode apresentar investidores para um empreendimento?$faq067$,
  'cm-faq-067',
  NULL,
  $faq067$Sim. O franqueado pode contribuir com a identificação de investidores interessados, em conjunto com a equipe Moní. A participação e a captação dependem das condições e dos procedimentos aplicáveis à operação.$faq067$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fluxo-financeiro-funding-e-responsabilidades'),
  $faq068$Em nome de qual empresa são realizados os contratos e pagamentos da obra?$faq068$,
  'cm-faq-068',
  NULL,
  $faq068$Os contratos com fornecedores e os pagamentos relacionados ao empreendimento são realizados pela SPE, que concentra a operação de incorporação. O franqueado é responsável por acompanhar a gestão financeira, fiscal e operacional das empresas sob sua responsabilidade.$faq068$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fluxo-financeiro-funding-e-responsabilidades'),
  $faq069$Como funciona a aprovação dos pagamentos aos fornecedores?$faq069$,
  'cm-faq-069',
  NULL,
  $faq069$O franqueado registra as solicitações de pagamento na plataforma. Os recursos de obra são administrados em conta vinculada (escrow), e a Moní participa da verificação e aprovação das solicitações antes da liberação, conforme os procedimentos da operação.$faq069$,
  'published', 4, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fluxo-financeiro-funding-e-responsabilidades'),
  $faq070$Quem assina o contrato de venda com o cliente final?$faq070$,
  'cm-faq-070',
  NULL,
  $faq070$A comercialização do imóvel é realizada pela SPE responsável pelo empreendimento, que figura como parte no contrato de venda com o cliente final.$faq070$,
  'published', 5, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fluxo-financeiro-funding-e-responsabilidades'),
  $faq071$Como é paga a remuneração de gestão de obra?$faq071$,
  'cm-faq-071',
  NULL,
  $faq071$A remuneração de gestão corresponde a 8% do custo orçado da casa e é paga ao CNPJ responsável pela gestão ao longo da execução da obra, conforme o fluxo financeiro previsto para o empreendimento.$faq071$,
  'published', 6, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fluxo-financeiro-funding-e-responsabilidades'),
  $faq072$Quando é cobrada a taxa de plataforma de 7%?$faq072$,
  'cm-faq-072',
  NULL,
  $faq072$A taxa de plataforma corresponde a 7% do custo orçado da casa e é devida quando a obra é iniciada. Sua cobrança ocorre ao longo do período de execução, conforme o fluxo previsto para a operação.$faq072$,
  'published', 7, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fluxo-financeiro-funding-e-responsabilidades'),
  $faq073$O franqueado precisa ter escritório físico ou número mínimo de funcionários?$faq073$,
  'cm-faq-073',
  NULL,
  $faq073$Não há exigência geral de unidade física nem de quantidade mínima de funcionários para a operação descrita. A estrutura deve permitir que o franqueado cumpra suas responsabilidades de gestão e execução.$faq073$,
  'published', 8, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fluxo-financeiro-funding-e-responsabilidades'),
  $faq074$O treinamento pode ser realizado remotamente?$faq074$,
  'cm-faq-074',
  NULL,
  $faq074$Sim. Os treinamentos podem ser realizados online, sem exigência geral de deslocamento presencial ou número mínimo formal de participantes.$faq074$,
  'published', 9, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'fluxo-financeiro-funding-e-responsabilidades'),
  $faq075$O franqueado pode utilizar contador ou assessoria própria para abrir suas empresas?$faq075$,
  'cm-faq-075',
  NULL,
  $faq075$Sim. A constituição das empresas pode ser conduzida por assessoria contábil ou jurídica escolhida pelo franqueado, com apoio e orientação da Moní sobre a estrutura operacional necessária.$faq075$,
  'published', 10, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'contratos-com-terrenistas-prazos-e-modalidades'),
  $faq076$Como funciona a compra parcial do terreno com pagamento futuro?$faq076$,
  'cm-faq-076',
  NULL,
  $faq076$Nessa modalidade, o terrenista recebe uma parcela inicial de 30% do Valor Base na escritura pública de transferência para a SPE. O saldo de 70% é pago em parcela única, acrescido da remuneração contratualmente prevista. O cronograma e as garantias devem ser confirmados no instrumento firmado para cada operação.$faq076$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'contratos-com-terrenistas-prazos-e-modalidades'),
  $faq077$Quando são pagos os 30% iniciais na compra parcial?$faq077$,
  'cm-faq-077',
  NULL,
  $faq077$O pagamento inicial ocorre na lavratura da escritura pública de transferência do terreno para a SPE. Na estrutura apresentada, a escritura é prevista em até 90 dias corridos após a emissão do alvará de construção, condicionada à constituição da garantia contratada.$faq077$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'contratos-com-terrenistas-prazos-e-modalidades'),
  $faq078$Quando são pagos os 70% restantes na compra parcial?$faq078$,
  'cm-faq-078',
  NULL,
  $faq078$O saldo é pago em parcela única, na data acordada entre as partes, respeitado o prazo máximo de 24 meses contado da assinatura do Contrato de Opção na modalidade apresentada. A contagem do prazo e as condições de vencimento devem estar expressas no contrato aplicável.$faq078$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'contratos-com-terrenistas-prazos-e-modalidades'),
  $faq079$A partir de quando é calculada a remuneração de 15% ao ano do saldo?$faq079$,
  'cm-faq-079',
  NULL,
  $faq079$Na estrutura de compra parcial apresentada, a remuneração incide sobre o saldo de 70% a partir da assinatura do Contrato Definitivo até o pagamento efetivo, proporcionalmente ao período transcorrido (pro rata temporis). A metodologia de cálculo deve seguir a cláusula contratual da operação.$faq079$,
  'published', 4, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'contratos-com-terrenistas-prazos-e-modalidades'),
  $faq080$O que é o Valor Base do Lote?$faq080$,
  'cm-faq-080',
  NULL,
  $faq080$É o valor do terreno acordado entre as partes e registrado nos instrumentos contratuais. Serve de referência para calcular os pagamentos ao terrenista e as remunerações que incidam sobre esse valor, conforme a modalidade escolhida.$faq080$,
  'published', 5, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'contratos-com-terrenistas-prazos-e-modalidades'),
  $faq081$Quais modalidades de negociação podem ser apresentadas ao terrenista?$faq081$,
  'cm-faq-081',
  NULL,
  $faq081$Entre as estruturas tratadas pela Moní estão a permuta vinculada ao VGV, a compra com pagamento futuro, a compra parcial com entrada e saldo futuro e a alternativa de participação do terrenista na SPE. Prazos, índices, percentuais e garantias variam conforme a modalidade e precisam constar dos contratos efetivamente aprovados.$faq081$,
  'published', 6, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'contratos-com-terrenistas-prazos-e-modalidades'),
  $faq082$O que acontece se o prazo de pagamento do terreno vencer sem quitação?$faq082$,
  'cm-faq-082',
  NULL,
  $faq082$A situação deve ser analisada à luz das cláusulas de vencimento, inadimplemento e rescisão do contrato específico. Não há uma consequência única que possa ser aplicada indistintamente a todas as modalidades ou causas de atraso.$faq082$,
  'published', 7, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'contratos-com-terrenistas-prazos-e-modalidades'),
  $faq083$O que são condições precedentes em um contrato de terreno?$faq083$,
  'cm-faq-083',
  NULL,
  $faq083$São exigências que precisam ser atendidas para que a operação avance, como a conclusão de diligência jurídica e a regularidade documental do imóvel. Em uma estrutura contratual utilizada, prevê-se prazo de 30 dias para entrega de documentos, 30 dias para análise e 15 dias para saneamento de riscos identificados. Esses prazos dependem da redação contratual adotada.$faq083$,
  'published', 8, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'contratos-com-terrenistas-prazos-e-modalidades'),
  $faq084$Como funciona o exercício da opção de compra do terreno?$faq084$,
  'cm-faq-084',
  NULL,
  $faq084$O exercício da opção é a comunicação formal de que o adquirente pretende prosseguir com a aquisição, conforme a forma e os prazos previstos no contrato. A assinatura do instrumento definitivo e os efeitos da comunicação devem observar as condições específicas pactuadas.$faq084$,
  'published', 9, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'contratos-com-terrenistas-prazos-e-modalidades'),
  $faq085$Qual é o papel da Moní como interveniente anuente?$faq085$,
  'cm-faq-085',
  NULL,
  $faq085$A Moní pode figurar como interveniente anuente para registrar sua ciência e concordância com os termos e com a aderência da operação aos padrões da rede. Essa participação não equivale, por si só, à condição de compradora, fiadora ou garantidora das obrigações da SPE.$faq085$,
  'published', 10, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'contratos-com-terrenistas-prazos-e-modalidades'),
  $faq086$Para que serve a procuração concedida pelo terrenista?$faq086$,
  'cm-faq-086',
  NULL,
  $faq086$Em algumas modalidades, a procuração permite a prática de atos específicos necessários à aprovação de projetos e à obtenção de licenças perante os órgãos competentes. Seu alcance, prazo de validade e eventual renovação devem ser verificados no instrumento outorgado.$faq086$,
  'published', 11, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'contratos-com-terrenistas-prazos-e-modalidades'),
  $faq087$Quais documentos iniciais devem ser solicitados ao terrenista?$faq087$,
  'cm-faq-087',
  NULL,
  $faq087$Em geral, são solicitados matrícula atualizada do imóvel, documentos de identificação e estado civil dos proprietários, dados cadastrais e tributários do lote, informações sobre ônus e certidões necessárias à diligência. A relação pode ser ampliada pela equipe jurídica conforme as características do imóvel e dos titulares.$faq087$,
  'published', 12, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'contratos-com-terrenistas-prazos-e-modalidades'),
  $faq088$Como funciona a confidencialidade na negociação do terreno?$faq088$,
  'cm-faq-088',
  NULL,
  $faq088$Os instrumentos podem prever obrigação de sigilo sobre preços, condições comerciais e demais informações da negociação. A duração da obrigação e as consequências de eventual descumprimento são aquelas previstas no contrato assinado.$faq088$,
  'published', 13, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'garantias-e-seguro-do-terreno'),
  $faq089$O que é o seguro-garantia na compra do terreno?$faq089$,
  'cm-faq-089',
  NULL,
  $faq089$É um instrumento contratado para garantir obrigações especificadas na apólice, tendo o terrenista como beneficiário. Sua cobertura depende dos riscos segurados, limites, condições e exclusões contratadas; não significa que a Moní seja garantidora direta do pagamento.$faq089$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'garantias-e-seguro-do-terreno'),
  $faq090$A Moní é garantidora das obrigações da SPE perante o terrenista?$faq090$,
  'cm-faq-090',
  NULL,
  $faq090$Não. A Moní não assume a condição de garantidora das obrigações financeiras da SPE apenas por participar da estruturação ou por figurar como interveniente anuente.$faq090$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'garantias-e-seguro-do-terreno'),
  $faq091$Como é escolhida a seguradora para a operação?$faq091$,
  'cm-faq-091',
  NULL,
  $faq091$A Moní pode indicar um corretor para avaliar as alternativas disponíveis de seguradora e produto, considerando o perfil do franqueado, das empresas e do negócio. A contratação e a aceitação do risco dependem da análise da seguradora.$faq091$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'garantias-e-seguro-do-terreno'),
  $faq092$O franqueado pode apresentar seguradora indicada pelo terrenista?$faq092$,
  'cm-faq-092',
  NULL,
  $faq092$Sim. A seguradora sugerida pode ser submetida à análise do corretor indicado, sem garantia de aceitação. O franqueado também pode conduzir a negociação sem utilizar o corretor indicado, observados os requisitos do contrato e da operação.$faq092$,
  'published', 4, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'garantias-e-seguro-do-terreno'),
  $faq093$É possível compartilhar a apólice de outro empreendimento?$faq093$,
  'cm-faq-093',
  NULL,
  $faq093$Apólices de outras SPEs podem conter informações comerciais e contratuais confidenciais. Qualquer compartilhamento deve ser previamente autorizado e limitado ao que puder ser divulgado sem violar deveres de sigilo.$faq093$,
  'published', 5, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'garantias-e-seguro-do-terreno'),
  $faq094$Qual é o custo estimado do seguro-garantia e quem o paga?$faq094$,
  'cm-faq-094',
  NULL,
  $faq094$Como referência de planejamento, foi indicada faixa de 2% a 6% do valor segurado, variável conforme o risco, a seguradora e o prazo. A despesa cabe ao franqueado/SPE e deve ser prevista no BCA; o preço efetivo depende de cotação e contratação.$faq094$,
  'published', 6, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'portfolio-comite-catalogo-e-projetos-locais'),
  $faq095$O que fazer quando o custo da casa aumenta depois do BCA inicial?$faq095$,
  'cm-faq-095',
  NULL,
  $faq095$O BCA deve ser atualizado com os valores vigentes do catálogo/configurador antes da apresentação ao Comitê e reavaliado ao longo da operação. Se a atualização comprometer a viabilidade, o franqueado deve procurar seu consultor de Novos Negócios para avaliar alternativas.$faq095$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'portfolio-comite-catalogo-e-projetos-locais'),
  $faq096$Qual preço deve ser usado no BCA apresentado ao Comitê?$faq096$,
  'cm-faq-096',
  NULL,
  $faq096$Devem ser utilizados os preços vigentes no catálogo/configurador na data da apresentação ao Comitê. O BCA precisa refletir os valores atualizados para que a análise financeira seja realizada sobre a base correta.$faq096$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'portfolio-comite-catalogo-e-projetos-locais'),
  $faq097$Como é definido o sistema de fundação em terrenos com desnível?$faq097$,
  'cm-faq-097',
  NULL,
  $faq097$A solução de fundação é avaliada em Projetos Locais, considerando as características do terreno e as necessidades técnicas da implantação. A escolha não deve ser feita apenas por comparação genérica de custos.$faq097$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'portfolio-comite-catalogo-e-projetos-locais'),
  $faq098$A solução de fundação pode alterar o custo previsto no BCA?$faq098$,
  'cm-faq-098',
  NULL,
  $faq098$Sim. A solução técnica adotada pode modificar os custos de implantação e construção, que devem ser refletidos no BCA após a análise de Projetos Locais.$faq098$,
  'published', 4, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'portfolio-comite-catalogo-e-projetos-locais'),
  $faq099$Como obter plantas de modelos que não aparecem no configurador?$faq099$,
  'cm-faq-099',
  NULL,
  $faq099$Consulte as plantas disponibilizadas no configurador. Quando determinado modelo não apresentar a documentação necessária, solicite o material ao seu consultor de Novos Negócios.$faq099$,
  'published', 5, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'portfolio-comite-catalogo-e-projetos-locais'),
  $faq100$Como solicitar informações sobre projetos já viabilizados fora do catálogo padrão?$faq100$,
  'cm-faq-100',
  NULL,
  $faq100$Projetos específicos ou customizados devem ser avaliados caso a caso com o consultor de Novos Negócios. A existência de um projeto anterior não significa que ele esteja automaticamente disponível para nova contratação.$faq100$,
  'published', 6, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'portfolio-comite-catalogo-e-projetos-locais'),
  $faq101$O que fazer se não consigo acessar o catálogo, o configurador ou o BCA?$faq101$,
  'cm-faq-101',
  NULL,
  $faq101$Entre em contato com seu consultor de Novos Negócios e informe qual ferramenta está indisponível, bem como a mensagem de erro ou dificuldade encontrada.$faq101$,
  'published', 7, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'portfolio-comite-catalogo-e-projetos-locais'),
  $faq102$Quais critérios são avaliados pelo Comitê?$faq102$,
  'cm-faq-102',
  NULL,
  $faq102$A avaliação considera o mercado e o condomínio, a localização e as características do lote, a adequação do produto, o preço de venda, a negociação com o terrenista e a viabilidade financeira demonstrada no BCA e nas análises de concorrência.$faq102$,
  'published', 8, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'portfolio-comite-catalogo-e-projetos-locais'),
  $faq103$Quais materiais devem estar preparados para o Comitê?$faq103$,
  'cm-faq-103',
  NULL,
  $faq103$A apresentação deve reunir dados da cidade, condomínio e lote; BCA atualizado; proposta de negociação com o terrenista; mapa de competidores; Batalha de Casas com informações de giro do condomínio; e o modelo de casa selecionado.$faq103$,
  'published', 9, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'portfolio-comite-catalogo-e-projetos-locais'),
  $faq104$Como o franqueado recebe o resultado do Comitê?$faq104$,
  'cm-faq-104',
  NULL,
  $faq104$O retorno é realizado pelo gestor de Novos Negócios. O projeto pode ser aprovado, aprovado com ressalvas que precisam ser atendidas ou reprovado, com orientação sobre os próximos passos pertinentes.$faq104$,
  'published', 10, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'portfolio-comite-catalogo-e-projetos-locais'),
  $faq105$O franqueado participa diretamente da reunião do Comitê?$faq105$,
  'cm-faq-105',
  NULL,
  $faq105$O Comitê é uma instância interna de avaliação da Moní. O franqueado recebe o retorno por meio do gestor de Novos Negócios, que conduz os encaminhamentos necessários.$faq105$,
  'published', 11, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'atuacao-profissional-fornecedores-e-suporte'),
  $faq106$O franqueado pode atuar como arquiteto em projetos independentes?$faq106$,
  'cm-faq-106',
  NULL,
  $faq106$A atuação profissional independente pode ser permitida, desde que respeitados os compromissos contratuais, a marca e o conhecimento proprietário da rede. Projetos próprios não devem utilizar indevidamente os projetos padrão, processos ou materiais exclusivos da Moní.$faq106$,
  'published', 1, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'atuacao-profissional-fornecedores-e-suporte'),
  $faq107$O franqueado pode solicitar a homologação de um novo fornecedor?$faq107$,
  'cm-faq-107',
  NULL,
  $faq107$Sim. O franqueado pode solicitar a avaliação de fornecedores pelos canais de atendimento, por exemplo em situações de preço, logística ou indisponibilidade de materiais. A utilização depende das regras de homologação e das exigências aplicáveis ao item.$faq107$,
  'published', 2, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'atuacao-profissional-fornecedores-e-suporte'),
  $faq108$Quem responde por problemas de um fornecedor contratado pela SPE?$faq108$,
  'cm-faq-108',
  NULL,
  $faq108$A responsabilidade primária pelo cumprimento do contrato é do fornecedor contratado. A Moní pode atuar em conjunto com o franqueado para apoiar a cobrança e a resolução, especialmente quando se tratar de fornecedor homologado. As garantias devem ser verificadas no contrato e nas condições de fornecimento.$faq108$,
  'published', 3, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'atuacao-profissional-fornecedores-e-suporte'),
  $faq109$Quem é responsável pelos seguros e pela execução da obra?$faq109$,
  'cm-faq-109',
  NULL,
  $faq109$O franqueado é responsável por contratar e manter os seguros exigidos para a operação e por gerir a execução da obra, inclusive contratação e fiscalização de profissionais e fornecedores, observadas as obrigações legais e contratuais de cada parte.$faq109$,
  'published', 4, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'atuacao-profissional-fornecedores-e-suporte'),
  $faq110$O suporte da Moní tem periodicidade fixa?$faq110$,
  'cm-faq-110',
  NULL,
  $faq110$O atendimento varia conforme a fase do empreendimento e a equipe responsável, incluindo viabilidade, negociação de terreno e execução da obra. O canal é preferencialmente online e não há periodicidade geral predefinida.$faq110$,
  'published', 5, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);
INSERT INTO public.faq_articles (
  category_id, question, slug, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility
) VALUES (
  (SELECT id FROM public.faq_categories WHERE slug = 'atuacao-profissional-fornecedores-e-suporte'),
  $faq111$O franqueado pode atuar fora da sua região inicial?$faq111$,
  'cm-faq-111',
  NULL,
  $faq111$A atuação em áreas de expansão pode ser permitida, desde que alinhada com a Moní e prevista na relação contratual aplicável. A entrada de novos franqueados em uma praça considera o tamanho do mercado, a demanda e o desempenho da rede.$faq111$,
  'published', 6, NULL, '{}', '{}', false,
  ARRAY['frank','team','admin']::text[]
);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('660', 'faq_conteudo_anexo_revisado')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;

