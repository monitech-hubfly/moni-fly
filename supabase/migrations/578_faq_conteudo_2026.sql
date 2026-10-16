-- 578_faq_conteudo_2026.sql
-- Conteudo FAQ 2026 adaptado ao schema fisico (name, question, visibility text[], slug).
-- Origem: Claude outputs/CasaMoni-FAQ-Migration-2026.sql
-- DEV apenas ate confirmacao explicita para PROD.
-- Idempotente.

-- CasaMoni-FAQ-Migration-2026.sql
-- Gerado: 2026-09-17 | Revisado: 2026-09-23
-- Aplicar DEV primeiro (bgaadvfucnrkpimaszjv.supabase.co), PROD somente com confirmação explícita.
-- Idempotente: seguro reexecutar.

BEGIN;

CREATE OR REPLACE FUNCTION public.faq_article_slug_if_null()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base text;
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    base := left(
      trim(both '-' from regexp_replace(lower(unaccent(coalesce(NEW.question, 'artigo'))), '[^a-z0-9]+', '-', 'g')),
      72
    );
    IF base = '' THEN
      base := 'artigo';
    END IF;
    NEW.slug := base || '-' || substr(md5(coalesce(NEW.question, '')), 1, 8);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_faq_article_slug_if_null ON public.faq_articles;
CREATE TRIGGER tr_faq_article_slug_if_null
  BEFORE INSERT ON public.faq_articles
  FOR EACH ROW
  EXECUTE PROCEDURE public.faq_article_slug_if_null();


-- ============================================================
-- PART 1: Renomear categorias existentes e alinhar slugs
UPDATE faq_categories
SET name = 'Tecnologia e Hub Fly',
    slug = 'tecnologia'
WHERE name = 'Hub Fly' OR slug = 'hub-fly';

UPDATE faq_categories
SET name = 'Moní Care',
    slug = 'monicare'
WHERE name = 'Pós-venda e Moní Care' OR slug = 'pos-venda-e-moni-care';

UPDATE faq_categories
SET slug = 'aprovacoes'
WHERE name = 'Aprovações e Pré-Obra'
  AND slug IS DISTINCT FROM 'aprovacoes';

UPDATE faq_categories
SET slug = 'contratos'
WHERE name = 'Contratos e Garantias'
  AND slug IS DISTINCT FROM 'contratos';

-- ============================================================
-- PART 2: Novas categorias
INSERT INTO faq_categories (name, slug, icon, display_order, is_active)
SELECT 'Entrega e Pós-Obra', 'entrega', '🔑', 15, true
WHERE NOT EXISTS (
  SELECT 1 FROM faq_categories WHERE name = 'Entrega e Pós-Obra' OR slug = 'entrega'
);

INSERT INTO faq_categories (name, slug, icon, display_order, is_active)
SELECT 'Licenciamento e Marca', 'marca', '®️', 16, true
WHERE NOT EXISTS (
  SELECT 1 FROM faq_categories WHERE name = 'Licenciamento e Marca' OR slug = 'marca'
);

INSERT INTO faq_categories (name, slug, icon, display_order, is_active)
SELECT 'Suporte e Comunidade', 'suporte', '🤝', 17, true
WHERE NOT EXISTS (
  SELECT 1 FROM faq_categories WHERE name = 'Suporte e Comunidade' OR slug = 'suporte'
);

-- ============================================================
-- PART 3: Novos artigos (39 no total, 8 categorias)
-- ============================================================

-- TERRENOS (6 artigos)

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Terrenos' LIMIT 1),
  'Quais são os critérios mínimos para um terreno ser considerado elegível pela Moní?',
  'Um terreno elegível pela Moní precisa atender a critérios mínimos de área, frente, zoneamento, documentação e localização. O BCA valida a viabilidade financeira antes de qualquer avanço no funil.',
  $faq$## Critérios mínimos de elegibilidade de terreno

Para que um terreno entre no funil Moní, ele precisa atender a um conjunto de critérios técnicos, jurídicos e financeiros avaliados em etapas progressivas.

### Critérios físicos

| Critério | Mínimo referência |
|----------|-------------------|
| Área total | ≥ 300 m² (varia conforme tipologia de produto) |
| Testada (frente) | ≥ 10 m |
| Formato | Retangular ou próximo — terrenos com geometria irregular exigem análise adicional |
| Topografia | Declividade aceitável pelo produto (planialtimétrico obrigatório quando necessário) |

> Esses valores são referências — cada produto e município pode ter parâmetros específicos.

### Critérios de zoneamento e uso

- Zona residencial ou mista compatível com o produto Casa Moní
- Gabarito de altura e coeficiente de aproveitamento que viabilizem o projeto
- Sem restrição de Área de Preservação Permanente (APP) na área de construção

### Critérios documentais (matrícula e certidões)

- Matrícula atualizada, sem averbação de ônus impeditivos (penhora, hipoteca ativa)
- Terrenista com capacidade civil para contratar
- Sem litígios ativos relacionados ao imóvel

### Critérios financeiros (BCA)

Mesmo atendendo os critérios físicos e documentais, o terreno precisa gerar viabilidade financeira comprovada pelo **Business Case Analysis (BCA)**:

- VGV mínimo compatível com o produto
- Índice de permuta dentro do padrão Moní
- Margem operacional positiva após custos de construção, projeto legal e garantias

### Quem avalia

A avaliação inicial é feita pelo franqueado no funil **Step One**, com apoio da equipe Moní. O BCA é gerado internamente e passa pelo **Comitê Moní** antes de avançar para Portfólio.

> **Dúvidas?** Abra um chamado no Sirene ou consulte seu executivo de novos negócios.$faq$,
  'published', 1, 'Operações',
  ARRAY['critérios terreno','elegibilidade terreno','área mínima','frente mínima','documentação terreno','matrícula'],
  ARRAY['requisitos do terreno','terreno aceito pela Moní','critério de avaliação de lote'],
  true, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Terrenos' LIMIT 1)
  AND question = 'Quais são os critérios mínimos para um terreno ser considerado elegível pela Moní?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Terrenos' LIMIT 1),
  'Como funciona a prospecção de terrenos no modelo Moní?',
  'O franqueado prospecta terrenos dentro de seu território exclusivo, utilizando o funil Step One no Hub Fly para organizar e avançar cada oportunidade. A Moní apoia com critérios, ferramentas e formação.',
  $faq$## Como funciona a prospecção de terrenos

O franqueado Moní é o protagonista da prospecção de terrenos dentro do seu **território exclusivo** (definido no COF). O processo é estruturado pelo funil **Step One** no Hub Fly.

### Onde prospectar

- Condomínios horizontais fechados ou abertos dentro do território
- Loteamentos com potencial de implantação de casas Casa Moní
- Lotes individuais em regiões com demanda por produto de médio-alto padrão

### Ferramentas e apoio

| Ferramenta | Uso |
|------------|-----|
| **Funil Step One** | Registro e avanço de cada oportunidade |
| **Mapa de competidores** | Análise de mercado local |
| **BCA (Business Case Analysis)** | Validação financeira do terreno |
| **Treinamento Moní** | Capacitação para abordagem ao terrenista |

### Etapas de prospecção no Step One

1. **Cadastro da oportunidade** — dados do terreno, condomínio e terrenista
2. **Mapa de competidores** — análise de mercado
3. **Pré-batalha** — ranking de compatibilidade do produto com o terreno
4. **BCA** — validação financeira
5. **Comitê** — aprovação Moní para avançar para Portfólio

### Território exclusivo

O Comunicado de Uso (COF) define a área exclusiva do franqueado. Antes de prospectar um terreno, verifique se ele está dentro do seu território via Hub Fly — a plataforma sinaliza conflitos de sobreposição.

> **Dúvidas?** Abra um chamado no Sirene ou fale com seu executivo de novos negócios.$faq$,
  'published', 2, 'Operações',
  ARRAY['prospecção terreno','funil step one','terrenista','território franqueado','mapa competidores','lead terreno'],
  ARRAY['busca de terrenos','como encontrar terrenos','captação de terrenos'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Terrenos' LIMIT 1)
  AND question = 'Como funciona a prospecção de terrenos no modelo Moní?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Terrenos' LIMIT 1),
  'O que é o BCA e como ele avalia a viabilidade do terreno?',
  'O BCA (Business Case Analysis) é o modelo financeiro que valida se um terreno é viável para o produto Moní. Ele calcula VGV, permuta, custos e margem, e é apresentado ao Comitê Moní antes do avanço para Portfólio.',
  $faq$## O que é o BCA e como ele avalia a viabilidade do terreno?

O **BCA (Business Case Analysis)** é o modelo financeiro padrão Moní que determina se um terreno tem viabilidade para o desenvolvimento de um empreendimento.

### O que o BCA calcula

| Variável | Descrição |
|----------|-----------|
| **VGV** | Valor Geral de Vendas estimado para as unidades |
| **Permuta** | Quantidade de unidades a serem entregues ao terrenista |
| **Custo de construção** | Estimativa por m² de acordo com o produto |
| **Custo de projeto e aprovação** | Projeto legal, ART, taxas municipais |
| **Margem operacional** | Resultado líquido do empreendimento |

### Quem preenche

O BCA é gerado a partir dos dados cadastrados pelo franqueado no funil **Step One** (etapas 8–10). A plataforma Hub Fly processa os inputs e gera o relatório automaticamente.

### O que acontece após o BCA

1. O franqueado apresenta o BCA ao terrenista como argumento de negociação
2. O BCA é submetido ao **Comitê Moní** para aprovação
3. Com aprovação, o negócio avança para o **Funil Portfólio**

### BCA e negociação com o terrenista

O BCA é também a principal ferramenta de transparência com o terrenista — ele mostra claramente quantas unidades o dono do terreno receberá e qual o valor estimado dessas unidades.

> **Importante:** O BCA é uma estimativa — valores reais podem variar conforme projeto executivo e condições de mercado.

> **Dúvidas?** Abra um chamado no Sirene ou consulte seu executivo de novos negócios.$faq$,
  'published', 3, 'Operações',
  ARRAY['BCA','business case analysis','viabilidade terreno','VGV','permuta casas','comitê','modelo financeiro'],
  ARRAY['análise de viabilidade','estudo financeiro terreno','relatório BCA'],
  true, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Terrenos' LIMIT 1)
  AND question = 'O que é o BCA e como ele avalia a viabilidade do terreno?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Terrenos' LIMIT 1),
  'Quais certidões e documentos o terrenista precisa apresentar?',
  'O terrenista precisa apresentar documentos pessoais, certidões do imóvel e certidões negativas para que o Jurídico Moní realize a due diligence antes da assinatura do contrato de permuta.',
  $faq$## Documentos e certidões exigidos do terrenista

Antes da assinatura do Instrumento de Permuta, o time Jurídico Moní realiza uma due diligence do terreno e do terrenista. O checklist abaixo é a referência padrão.

### Documentos pessoais do terrenista (pessoa física)

- RG e CPF (ou CNH)
- Comprovante de estado civil (certidão de casamento, se aplicável)
- Comprovante de residência atualizado
- Se casado: documentos do cônjuge e regime de bens

### Documentos pessoais do terrenista (pessoa jurídica)

- Contrato social ou estatuto atualizado
- CNPJ
- Documentos dos sócios administradores

### Documentos do imóvel

| Documento | Objetivo |
|-----------|----------|
| **Matrícula atualizada** (≤ 30 dias) | Confirmar propriedade e ônus |
| **Certidão de ônus reais** | Checar hipotecas, penhoras |
| **IPTU atualizado** | Confirmar área e proprietário |
| **Certidão de quitação de débitos municipais** | Ausência de dívidas |

### Certidões negativas do terrenista

- Certidão negativa de débitos federais (Receita Federal)
- Certidão negativa de débitos estaduais
- Certidão negativa de ações cíveis e criminais
- Certidão negativa de protesto

### Como entregar

Os documentos são enviados pelo checklist legal do Hub Fly (funil Portfólio, fase de assinatura de contratos). O Jurídico Moní analisa e retorna com eventuais pendências via Sirene.

> **Importante:** A lista pode variar conforme o município e o tipo de terrenista. O Jurídico Moní orienta caso a caso.$faq$,
  'published', 4, 'Jurídico',
  ARRAY['certidões terrenista','documentos terreno','matrícula','certidão negativa','checklist terrenista','documentação contrato'],
  ARRAY['papéis do dono do terreno','documentos necessários para permuta','certidões imóvel'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Terrenos' LIMIT 1)
  AND question = 'Quais certidões e documentos o terrenista precisa apresentar?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Terrenos' LIMIT 1),
  'O que pode desqualificar um terreno no processo Moní?',
  'Problemas físicos (APP, topografia extrema), jurídicos (litígios, ônus ativos) ou financeiros (VGV inviável, permuta desequilibrada) podem desqualificar um terreno. A desqualificação pode ocorrer em qualquer etapa do funil.',
  $faq$## O que pode desqualificar um terreno no processo Moní?

A desqualificação pode ocorrer em qualquer etapa — desde a prospecção inicial até a aprovação no Comitê. Conheça os principais motivos.

### Problemas físicos

| Problema | Impacto |
|----------|---------|
| Área ou testada abaixo do mínimo | Produto não se enquadra |
| APP (Área de Preservação Permanente) | Restrição legal de construção |
| Declividade excessiva | Custo de terraplanagem inviabiliza o BCA |
| Formato muito irregular | Projeto técnico comprometido |

### Problemas jurídicos

- **Litígio ativo** — disputa de posse ou propriedade em andamento
- **Penhora ou hipoteca ativa** não removível antes da permuta
- **Terrenista sem capacidade civil** ou representação inadequada (PJ sem poderes suficientes)
- **Dívidas de IPTU ou condomínio** não regularizadas
- **Inventário em aberto** sem conclusão prevista

### Problemas de zoneamento

- Zona incompatível com uso residencial multifamiliar
- Gabarito insuficiente para o produto
- Plano Diretor municipal com restrições específicas

### Problemas financeiros (BCA)

- VGV insuficiente para cobrir custos + margem mínima
- Permuta exigida pelo terrenista acima do padrão viável
- Custo de aprovação ou adequação do projeto muito alto

### O que acontece quando o terreno é desqualificado

O card no funil Step One é arquivado com o motivo registrado. O terrenista é comunicado pelo franqueado. Em alguns casos, uma revisão das condições (menor exigência de permuta, resolução jurídica) pode reabrir a negociação.

> **Dúvidas?** Abra um chamado no Sirene ou consulte o time Jurídico.$faq$,
  'published', 5, 'Operações',
  ARRAY['desqualificação terreno','terreno inviável','app preservação permanente','zoneamento','litígio imóvel','pendência jurídica terreno'],
  ARRAY['terreno reprovado','por que terreno não passa','impedimento de terreno'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Terrenos' LIMIT 1)
  AND question = 'O que pode desqualificar um terreno no processo Moní?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Terrenos' LIMIT 1),
  'O que é o Comunicado de Uso e como ele afeta a prospecção?',
  'O Comunicado de Uso é o documento que define o território exclusivo do franqueado. Ele delimita a área onde o franqueado pode prospectar e garante proteção contra sobreposição de outros franqueados.',
  $faq$## O que é o Comunicado de Uso?

O **Comunicado de Uso** é o documento contratual que formaliza o **território exclusivo** do franqueado dentro da rede Moní. Ele é parte integrante do COF (Contrato de Operação de Franquia).

### O que ele define

- **Área geográfica exclusiva** — bairros, setores ou polígonos onde o franqueado tem direito de prospectar e operar
- **Proteção territorial** — outro franqueado Moní não pode prospectar ou fechar negócio dentro desse território
- **Restrições** — em alguns casos, o Comunicado pode excluir determinados condomínios ou loteamentos já comprometidos com outra operação

### Como ele afeta a prospecção

1. **Antes de abordar um terrenista**, verifique se o terreno está dentro do seu território via Hub Fly
2. O Hub Fly sinaliza **conflitos de sobreposição** automaticamente quando dois franqueados tentam prospectar o mesmo endereço
3. Terrenos fora do território **não podem ser prospectados** sem autorização expressa da Moní

### O que fazer se identificar um conflito

- Abra um chamado no **Sirene** com o endereço do terreno e o número do seu Comunicado de Uso
- O time Moní analisa e emite orientação formal sobre qual franqueado tem precedência

### Ampliação de território

É possível solicitar ampliação de território conforme disponibilidade na rede. Consulte seu executivo de novos negócios para verificar áreas disponíveis.

> **Dúvidas?** Abra um chamado no Sirene ou envie mensagem para o time Jurídico via Hub Fly.$faq$,
  'published', 6, 'Jurídico',
  ARRAY['comunicado de uso','território franqueado','COF','exclusividade territorio','sobreposição franquias','restrição prospecção'],
  ARRAY['mapa de território','área de atuação franquia','exclusividade de território'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Terrenos' LIMIT 1)
  AND question = 'O que é o Comunicado de Uso e como ele afeta a prospecção?'
);

-- APROVAÇÕES E PRÉ-OBRA (5 artigos)

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Aprovações e Pré-Obra' LIMIT 1),
  'O que é o Projeto Legal e qual é o papel do franqueado nessa etapa?',
  'O Projeto Legal é o conjunto de documentos técnicos submetidos à prefeitura para aprovação da construção. O franqueado acompanha o andamento no Hub Fly, mas a execução é feita pelo time técnico Moní e pelos escritórios de projeto parceiros.',
  $faq$## O que é o Projeto Legal?

O **Projeto Legal** é o conjunto de documentos técnicos exigidos pela prefeitura para licenciar a construção do empreendimento. Sem ele aprovado, a obra não pode começar legalmente.

### O que compõe o Projeto Legal

| Documento | Descrição |
|-----------|-----------|
| **Planta arquitetônica** | Layout, dimensões, implantação |
| **Memorial descritivo** | Especificações técnicas da obra |
| **ART ou RRT** | Anotação/Registro de Responsabilidade Técnica do engenheiro/arquiteto |
| **Levantamento planialtimétrico** | Quando exigido pela topografia ou município |
| **Documentação do terreno** | Matrícula, IPTU, quitação de débitos |

### Qual é o papel do franqueado

O franqueado **não executa** o Projeto Legal — essa função é dos escritórios técnicos parceiros da Moní. O papel do franqueado é:

1. **Acompanhar o progresso** pelo funil **Projeto Legal** no Hub Fly
2. **Responder chamados** do Sirene quando documentos do terrenista forem necessários
3. **Comunicar ao terrenista** sobre prazos e eventuais exigências da prefeitura

### Como acompanhar no Hub Fly

O card no funil **Projeto Legal** avança por fases conforme o processo na prefeitura. Cada fase tem SLA definido — o Hub Fly sinaliza atrasos automaticamente.

### Quanto tempo leva

O prazo varia conforme o município. Em média, de **30 a 120 dias** após o protocolo. Municípios com alvará por risco podem ser mais ágeis.

> **Dúvidas?** Abra um chamado no Sirene ou acompanhe pelo card no funil Projeto Legal.$faq$,
  'published', 1, 'Operações',
  ARRAY['projeto legal','aprovação prefeitura','planta obra','ART','RRT','memorial descritivo','funil projeto legal'],
  ARRAY['aprovação de projeto','licença de construção','projeto arquitetônico aprovação'],
  true, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Aprovações e Pré-Obra' LIMIT 1)
  AND question = 'O que é o Projeto Legal e qual é o papel do franqueado nessa etapa?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Aprovações e Pré-Obra' LIMIT 1),
  'Como funciona a aprovação pelo condomínio e qual é o prazo típico?',
  'Antes de protocolar o projeto na prefeitura, é necessário obter a anuência do condomínio (síndico ou assembleia). O franqueado apoia na negociação, mas o time técnico Moní conduz a apresentação do projeto.',
  $faq$## Aprovação pelo condomínio

Em empreendimentos dentro de condomínios fechados, é obrigatório obter a **anuência do condomínio** antes de protocolar o projeto na prefeitura.

### Por que é necessário

O condomínio tem convenção própria que pode impor padrões construtivos, restrições de gabarito, cores de fachada ou exigir aprovação em assembleia. Sem essa anuência, a prefeitura geralmente não aprova o projeto.

### Como funciona

1. O time técnico Moní prepara uma **apresentação do projeto** adaptada ao padrão do condomínio
2. O franqueado (ou o próprio terrenista) agenda a apresentação com o síndico
3. O síndico emite a **carta de anuência** ou convoca assembleia para deliberação
4. Com a carta em mãos, o projeto segue para a prefeitura

### Qual é o papel do franqueado

- Facilitar o contato com o síndico e o terrenista
- Apoiar a negociação de eventuais ajustes solicitados pelo condomínio
- Registrar a aprovação no Hub Fly (upload da carta de anuência)

### Prazo típico

| Cenário | Prazo estimado |
|---------|----------------|
| Síndico com autonomia para aprovar | 7 a 21 dias |
| Exige assembleia ordinária | 30 a 60 dias |
| Exige assembleia extraordinária | 15 a 30 dias (convocação + realização) |

### E se o condomínio negar?

A negativa do condomínio pode inviabilizar o empreendimento. Nesse caso, o card no funil Operações é arquivado com o motivo. Consulte o time Moní antes de comunicar o terrenista.

> **Dúvidas?** Abra um chamado no Sirene.$faq$,
  'published', 2, 'Operações',
  ARRAY['aprovação condomínio','síndico','anuência condomínio','assembleia','padrão construtivo','aprovação interna'],
  ARRAY['ok do condomínio','aprovação pelo síndico','anuência do condomínio'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Aprovações e Pré-Obra' LIMIT 1)
  AND question = 'Como funciona a aprovação pelo condomínio e qual é o prazo típico?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Aprovações e Pré-Obra' LIMIT 1),
  'Quanto tempo leva para obter o alvará de construção?',
  'O prazo para obtenção do alvará varia conforme o município e a modalidade de aprovação. Em média, de 30 a 120 dias após o protocolo do projeto legal. Municípios com alvará por risco podem ser mais ágeis.',
  $faq$## Prazo para obtenção do alvará de construção

O **alvará de construção** é a autorização emitida pela prefeitura para início da obra. O prazo para sua obtenção varia conforme o município e a modalidade de aprovação.

### Modalidades de aprovação

| Modalidade | Descrição | Prazo típico |
|------------|-----------|--------------|
| **Aprovação convencional** | Análise completa pela prefeitura | 60 a 120 dias |
| **Alvará por risco** | Responsabilidade técnica do autor do projeto | 7 a 30 dias |
| **Protocolo eletrônico** | Sistemas digitais de prefeituras avançadas | 30 a 60 dias |

> A disponibilidade do alvará por risco depende do município e da legislação local vigente.

### Fatores que influenciam o prazo

- **Volume de processos na prefeitura** — municípios maiores podem ter filas mais longas
- **Exigências de complementação** — prefeitura pode solicitar documentos adicionais
- **Ajustes no projeto** — exigências técnicas podem exigir revisão das plantas
- **Regularidade documental do terreno** — pendências de IPTU ou matrícula travam o processo

### Como acompanhar

O funil **Projeto Legal** no Hub Fly registra cada etapa do processo na prefeitura. O card avança conforme o protocolo, análise e emissão do alvará.

### Quando a obra pode começar

A obra só pode ser iniciada após a **emissão do alvará de construção** e a **liberação do crédito de obra** pelo parceiro financeiro (Cash Me). Ambos precisam estar concluídos.

> **Dúvidas sobre o andamento?** Abra um chamado no Sirene para o time de Operações.$faq$,
  'published', 3, 'Operações',
  ARRAY['alvará construção','prazo aprovação','prefeitura','projeto legal aprovado','licença obra','alvará por risco'],
  ARRAY['licença para construir','autorização de obra','tempo de aprovação prefeitura'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Aprovações e Pré-Obra' LIMIT 1)
  AND question = 'Quanto tempo leva para obter o alvará de construção?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Aprovações e Pré-Obra' LIMIT 1),
  'O que é o Planialtimétrico e quando ele é necessário?',
  'O planialtimétrico é o levantamento topográfico do terreno que mapeia cotas, declividades e limites com precisão. É exigido quando o terreno tem declividade significativa ou quando o município o exige como parte do projeto legal.',
  $faq$## O que é o Planialtimétrico?

O **levantamento planialtimétrico** é um mapa técnico do terreno que registra:

- **Cotas altimétricas** — alturas em relação ao nível de referência
- **Declividades** — inclinações do terreno
- **Limites exatos** — confrontações com vizinhos, logradouros e fundos
- **Infraestrutura existente** — redes de água, esgoto, energia no entorno

### Quando é necessário

| Situação | Necessidade |
|----------|-------------|
| Terreno com declividade > 5% | Obrigatório para projeto e corte/aterro |
| Município exige para aprovação | Verificar legislação local |
| Projeto exige terraplanagem significativa | Necessário para orçamento preciso |
| Terreno com formato irregular | Recomendado para implantação correta |

### Quem executa

O planialtimétrico é contratado pela operação Moní e executado por topógrafo habilitado. O franqueado não precisa contratar por conta própria.

### Onde aparece no funil

A fase **Planialtimétrico** está no funil **Operações** no Hub Fly. Ela precisa ser concluída antes do avanço para as fases de aprovação do condomínio e da prefeitura.

### Impacto no BCA

A declividade identificada no planialtimétrico pode alterar o custo de terraplanagem e, consequentemente, a viabilidade do BCA. Em casos extremos, um terreno inicialmente viável pode ser descartado após o levantamento.

> **Dúvidas?** Abra um chamado no Sirene ou acompanhe pelo card no funil Operações.$faq$,
  'published', 4, 'Operações',
  ARRAY['planialtimétrico','levantamento topográfico','topografia terreno','cotas terreno','declividade','projeto legal'],
  ARRAY['levantamento do terreno','topo do lote','estudo topográfico'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Aprovações e Pré-Obra' LIMIT 1)
  AND question = 'O que é o Planialtimétrico e quando ele é necessário?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Aprovações e Pré-Obra' LIMIT 1),
  'Quando a Moní aciona a garantidora e como o crédito de obra é liberado para início de obra?',
  'O crédito de obra é liberado pelo parceiro Cash Me após a aprovação do projeto legal e do alvará. A garantidora emite a Carta Fiança junto com o contrato de permuta. O processo é coordenado pelo time Moní no funil Crédito Obra.',
  $faq$## Como o crédito de obra é liberado?

A liberação do crédito de obra envolve dois processos paralelos: a **contratação da garantia** e a **aprovação do financiamento** pelo parceiro Cash Me.

### Pré-requisitos para liberação do crédito

Antes de acionar o Cash Me, os seguintes itens precisam estar concluídos:

- ✅ Projeto Legal aprovado pela prefeitura
- ✅ Alvará de construção emitido
- ✅ Contrato de Permuta assinado com o terrenista
- ✅ Carta Fiança emitida pela garantidora
- ✅ Documentação completa do terrenista e do imóvel

### Como funciona o funil Crédito Obra (Cash Me)

1. O card no funil **Crédito Obra** é criado automaticamente pelo Hub Fly quando o card de Operações atinge a fase de crédito
2. O time Moní coordena o envio de documentos ao Cash Me
3. O Cash Me realiza due diligence e aprova a operação
4. O crédito é liberado em **tranches** conforme o avanço da obra

### Quando a garantidora é acionada

A **Carta Fiança** é contratada junto com o Instrumento de Permuta — antes do início das obras. A garantidora (Seven Garantias, LS Garantidora ou outra parceira) emite o documento que protege o terrenista durante todo o período do contrato.

### Primeira tranche

Após a aprovação pelo Cash Me, a primeira tranche é liberada para início das fundações. As tranches seguintes são liberadas conforme marcos de obra comprovados.

### Papel do franqueado

O franqueado **não negocia diretamente** com o Cash Me. Seu papel é acompanhar o card no funil Crédito Obra, responder chamados do Sirene com documentos complementares e manter o terrenista informado.

> **Dúvidas?** Abra um chamado no Sirene ou acompanhe pelo card no funil Crédito Obra.$faq$,
  'published', 5, 'Operações',
  ARRAY['crédito obra','cash me','tranche','liberação obra','financiamento obra','início de obra'],
  ARRAY['liberação de financiamento','crédito para construção','aprovação de crédito de obra'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Aprovações e Pré-Obra' LIMIT 1)
  AND question = 'Quando a Moní aciona a garantidora e como o crédito de obra é liberado para início de obra?'
);

-- OBRA (5 artigos)

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Obra' LIMIT 1),
  'Qual é o cronograma típico de uma obra Moní e quais são as etapas?',
  'Uma obra Moní tem duração média de 4 meses, dividida em etapas de fundação, estrutura, alvenaria, cobertura, instalações e acabamento. O cronograma detalhado é acompanhado pelo time de Operações no Hub Fly.',
  $faq$## Cronograma típico de uma obra Moní

O prazo médio de uma obra Moní é de **aproximadamente 4 meses**, podendo variar conforme o produto, o número de unidades e as condições locais.

### Etapas da obra

| Etapa | Duração estimada | O que acontece |
|-------|-----------------|----------------|
| **Fundação** | 2–3 semanas | Estacas, radier ou sapatas conforme o solo |
| **Estrutura** | 2–4 semanas | Vigas, pilares, lajes |
| **Alvenaria** | 2–3 semanas | Paredes externas e internas |
| **Cobertura** | 1–2 semanas | Telhado e impermeabilização |
| **Instalações** | 2–3 semanas | Elétrica, hidráulica, esgoto |
| **Acabamento** | 3–4 semanas | Revestimentos, pintura, louças, metais |
| **Limpeza e vistoria** | 1 semana | Preparação para entrega |

> Os prazos são estimativas — condições climáticas, disponibilidade de materiais e especificidades do terreno podem alterar o cronograma.

### Como o cronograma é acompanhado

O andamento da obra é registrado no funil **Operações** do Hub Fly. Cada tranche liberada pelo Cash Me corresponde a um marco de obra verificado.

### Liberação de tranches

| Tranche | Marco correspondente |
|---------|---------------------|
| 1ª | Início de obra (fundação) |
| 2ª | Estrutura concluída |
| 3ª | Cobertura concluída |
| 4ª | Instalações concluídas |
| 5ª | Acabamento concluído |
| 6ª | Obra finalizada e vistoria |

### Responsável pela gestão da obra

A execução e o gerenciamento técnico são responsabilidade da **Wayser** (parceira de gestão de obras Moní). O franqueado acompanha pelo Hub Fly e mantém contato com o terrenista.

> **Dúvidas?** Abra um chamado no Sirene ou acompanhe pelo card no funil Operações.$faq$,
  'published', 1, 'Operações',
  ARRAY['cronograma obra','etapas obra','duração obra','fundação','alvenaria','acabamento','4 meses obra'],
  ARRAY['fases da construção','tempo de obra','prazo de construção'],
  true, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Obra' LIMIT 1)
  AND question = 'Qual é o cronograma típico de uma obra Moní e quais são as etapas?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Obra' LIMIT 1),
  'Quem contrata e gerencia os fornecedores durante a obra?',
  'A gestão técnica da obra é responsabilidade da Wayser, parceira de gerenciamento de obras da Moní. O franqueado não contrata fornecedores diretamente — seu papel é acompanhar o progresso pelo Hub Fly e manter o terrenista informado.',
  $faq$## Quem gerencia os fornecedores da obra?

A **Wayser** é a empresa parceira da Moní responsável pelo gerenciamento técnico das obras. Ela cuida de toda a cadeia de fornecedores e execução.

### O que a Wayser faz

- Contratação de empreiteiras e subempreiteiros
- Gestão de materiais e insumos
- Fiscalização técnica da execução
- Controle de qualidade em cada etapa
- Coordenação com o escritório de projetos

### O que o franqueado NÃO deve fazer

- ❌ Contratar fornecedores por conta própria
- ❌ Negociar com empreiteiros diretamente
- ❌ Autorizar alterações de projeto sem comunicar a Wayser
- ❌ Fazer pagamentos a fornecedores sem autorização da operação

### Qual é o papel do franqueado

O franqueado tem papel de **acompanhamento e relacionamento**, não de execução técnica:

1. Acompanhar o card no funil **Operações** no Hub Fly
2. Ser o ponto de contato com o terrenista sobre andamento da obra
3. Comunicar ao Sirene qualquer intercorrência identificada
4. Participar de vistorias quando solicitado pela Wayser

### E se houver problema com um fornecedor?

Qualquer problema técnico ou de prazo com fornecedores deve ser reportado ao time Moní via Sirene. A Wayser é responsável pela resolução.

> **Dúvidas?** Abra um chamado no Sirene para o time de Operações.$faq$,
  'published', 2, 'Operações',
  ARRAY['fornecedores obra','empreiteira','wayser','gestão de obra','contratação construção','quem gerencia a obra'],
  ARRAY['quem cuida da obra','responsável pela construção','gestão de empreiteira'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Obra' LIMIT 1)
  AND question = 'Quem contrata e gerencia os fornecedores durante a obra?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Obra' LIMIT 1),
  'O que acontece se a obra atrasar? Quais são os impactos e como é tratado?',
  'Atrasos de obra são gerenciados pela Wayser e pelo time de Operações Moní. O franqueado deve comunicar o terrenista e registrar a ocorrência no Sirene. A Carta Fiança protege o terrenista durante o período do contrato.',
  $faq$## O que acontece se a obra atrasar?

Atrasos podem ocorrer por fatores técnicos, climáticos ou regulatórios. O importante é que existem processos definidos para gerenciar cada situação.

### Causas comuns de atraso

- Chuvas intensas e condições climáticas adversas
- Atraso na entrega de materiais por fornecedores
- Exigências adicionais da prefeitura no processo de aprovação
- Problemas técnicos no solo ou na estrutura identificados na execução
- Atraso na liberação de tranches de crédito

### Como o atraso é tratado

| Responsável | Ação |
|-------------|------|
| **Wayser** | Gestão técnica, replanejamento de prazo, comunicação com equipe de obra |
| **Operações Moní** | Atualização do card no Hub Fly, comunicação interna |
| **Franqueado** | Comunicação ao terrenista, registro no Sirene |

### Impactos do atraso

- **Para o terrenista:** recebe as unidades com prazo maior, mas a **Carta Fiança** garante sua proteção durante todo o período do contrato
- **Para o crédito:** o Cash Me é notificado sobre o atraso; as tranches seguem o marco de obra, não o calendário
- **Para o BCA:** atrasos significativos podem afetar o resultado financeiro da operação

### O que o franqueado deve fazer

1. Comunicar o atraso ao terrenista com transparência e sem alarmar
2. Registrar a ocorrência no **Sirene** com detalhes do motivo
3. Acompanhar o card no funil **Operações** para o novo prazo estimado
4. Nunca prometer datas sem validação prévia com a Wayser e a Moní

### Proteção do terrenista

A **Carta Fiança** emitida no início do contrato cobre o período até a entrega das unidades, independentemente de atrasos dentro do prazo contratual.

> **Dúvidas?** Abra um chamado no Sirene para o time de Operações.$faq$,
  'published', 3, 'Operações',
  ARRAY['atraso de obra','paralisação obra','cronograma atrasado','carta fiança','impacto atraso','comunicação terrenista'],
  ARRAY['obra parada','obra atrasada','atraso na construção'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Obra' LIMIT 1)
  AND question = 'O que acontece se a obra atrasar? Quais são os impactos e como é tratado?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Obra' LIMIT 1),
  'Como funciona o acompanhamento da obra pelo Hub Fly?',
  'O acompanhamento da obra no Hub Fly é feito pelo funil Operações. Cada card representa um empreendimento e avança por fases conforme o progresso da obra. O franqueado acompanha status, tranches e SLA diretamente na plataforma.',
  $faq$## Acompanhamento da obra pelo Hub Fly

O Hub Fly centraliza o acompanhamento de todas as obras em andamento no funil **Operações**.

### O que o card de Operações mostra

- **Fase atual** — em que etapa a obra está (aprovação, em obra, aguardando tranche, etc.)
- **SLA** — prazo esperado para a fase atual, com alertas de atraso
- **Chips paralelas** — status de Crédito Obra, Jurídico, Projeto Legal vinculados
- **Checklist da fase** — itens obrigatórios para avançar para a próxima fase

### Fases do funil Operações (principais)

| Fase | O que significa |
|------|----------------|
| Planialtimétrico | Levantamento topográfico em andamento |
| Projeto Legal | Projeto na prefeitura |
| Aprovação Condomínio | Anuência do condomínio |
| Aprovação Prefeitura | Alvará em análise |
| Aguardando Crédito | Cash Me em processo de aprovação |
| Em Obra | Construção em andamento |
| Habite-se | Solicitação de certificado de conclusão |
| Entregue | Unidades entregues ao terrenista |

### Notificações

O Hub Fly envia alertas automáticos quando um card está com SLA vencendo ou já vencido. O franqueado também recebe notificações via Sirene em casos de intercorrência.

### Como acessar

Acesse pelo menu lateral do Hub Fly → **Operações**. Os cards ativos do franqueado aparecem na coluna da fase atual.

> **Dúvidas sobre o status da sua obra?** Abra um chamado no Sirene para o time de Operações.$faq$,
  'published', 4, 'Operações',
  ARRAY['acompanhamento obra','hub fly obra','funil operações','card operações','status obra','notificação obra'],
  ARRAY['como ver minha obra','como acompanhar a construção','status da obra hub fly'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Obra' LIMIT 1)
  AND question = 'Como funciona o acompanhamento da obra pelo Hub Fly?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Obra' LIMIT 1),
  'O que é o Habite-se e como ele é obtido?',
  'O Habite-se é o documento emitido pela prefeitura que certifica que a construção foi concluída conforme o projeto aprovado e está apta para habitação. Ele é emitido após vistoria da prefeitura e é pré-requisito para averbação e venda das unidades.',
  $faq$## O que é o Habite-se?

O **Habite-se** (ou Auto de Conclusão de Obras) é o documento emitido pela prefeitura que atesta que a obra foi concluída de acordo com o projeto aprovado e está em condições para ser habitada.

### Por que o Habite-se é importante

- Sem ele, o imóvel não pode ser **averbado** na matrícula
- Sem averbação, as unidades não podem ser vendidas com financiamento bancário convencional
- É a prova formal de que a obra está legalmente concluída

### Como é obtido

1. A obra é concluída e passa por **vistoria interna** da Wayser
2. É solicitada a **vistoria da prefeitura** (Corpo de Bombeiros e órgão de obras)
3. A prefeitura emite o Habite-se após aprovação da vistoria

### Documentos geralmente necessários

- Projeto aprovado e alvará de construção
- ART/RRT de conclusão de obra
- Laudo de vistoria do Corpo de Bombeiros (quando aplicável)
- Declaração de conformidade do responsável técnico

### Prazo típico

Varia conforme o município — de **15 a 60 dias** após a solicitação. O Hub Fly registra a fase **Habite-se** no funil Operações com SLA definido.

### Próximos passos após o Habite-se

1. **Averbação** da construção na matrícula do imóvel (cartório)
2. **Vistoria de entrega** com o terrenista
3. **Protocolo de entrega** das unidades permutadas
4. **Encerramento do card** no funil Operações

> **Dúvidas?** Abra um chamado no Sirene ou acompanhe pelo card no funil Operações.$faq$,
  'published', 5, 'Operações',
  ARRAY['habite-se','conclusão de obra','certificado obra','averbação','prefeitura habite-se','registro imóvel'],
  ARRAY['certificado de conclusão','licença de habitação','auto de conclusão'],
  true, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Obra' LIMIT 1)
  AND question = 'O que é o Habite-se e como ele é obtido?'
);

-- TECNOLOGIA E HUB FLY (5 artigos)

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Tecnologia e Hub Fly' LIMIT 1),
  'Como faço para acessar o Hub Fly pela primeira vez?',
  'O acesso ao Hub Fly é feito por convite enviado pela Moní por e-mail. Após aceitar o convite e criar sua senha, você acessa a plataforma em hubfly.moni.casa com seu e-mail e senha cadastrados.',
  $faq$## Como acessar o Hub Fly pela primeira vez

O Hub Fly é a plataforma operacional exclusiva para franqueados e time Moní. O acesso é feito **por convite** — você não pode se cadastrar de forma autônoma.

### Passo a passo

1. **Receba o convite por e-mail** — enviado pelo time Moní após a formalização do franqueado
2. **Clique no link do convite** — ele tem validade limitada (verifique o prazo no e-mail)
3. **Crie sua senha** — mínimo 8 caracteres, recomendado uso de letras, números e caracteres especiais
4. **Acesse a plataforma** — [hubfly.moni.casa](https://hubfly.moni.casa) com seu e-mail e senha

### O que fazer se o convite expirou

- Abra um chamado no **Sirene** solicitando novo convite, ou
- Entre em contato com seu executivo de novos negócios Moní

### O que fazer se não recebeu o e-mail

1. Verifique a pasta de spam/lixo eletrônico
2. Confirme com a Moní o e-mail cadastrado
3. Solicite reenvio via Sirene ou pelo WhatsApp do seu executivo

### Primeiro acesso — o que você verá

Após o login, você terá acesso ao **Portal Frank**, com os módulos disponíveis para sua fase no funil. O acesso se expande conforme o avanço da operação.

### Dificuldades técnicas

Se o login falhar mesmo com as credenciais corretas, tente:
- Limpar o cache do navegador (Ctrl + Shift + Delete)
- Usar o modo anônimo/privado
- Tentar outro navegador (Chrome recomendado)

> **Ainda com problema?** Abra um chamado no Sirene com o assunto "Problema de acesso Hub Fly".$faq$,
  'published', 1, 'Tecnologia',
  ARRAY['primeiro acesso hub fly','login hub fly','convite hub fly','senha hub fly','acesso plataforma'],
  ARRAY['como entrar no hub fly','cadastro hub fly','criar conta hub fly'],
  true, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Tecnologia e Hub Fly' LIMIT 1)
  AND question = 'Como faço para acessar o Hub Fly pela primeira vez?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Tecnologia e Hub Fly' LIMIT 1),
  'Como funciona o Kanban no Hub Fly e o que os cards representam?',
  'O Kanban do Hub Fly organiza as operações em colunas (fases) e cards (negócios individuais). Cada card representa um empreendimento ou processo e avança pelas fases conforme o progresso das atividades.',
  $faq$## Como funciona o Kanban no Hub Fly

O Kanban é o sistema de gestão visual que organiza todas as operações do Hub Fly. Funciona como um quadro dividido em **colunas (fases)** e **cards (negócios/processos)**.

### O que é um card

Cada **card** representa um negócio ou processo individual — por exemplo:
- Um terreno em prospecção (funil Step One)
- Um empreendimento em andamento (funil Portfólio)
- Uma obra em execução (funil Operações)

### O que são as fases (colunas)

As fases representam o **estágio atual** do processo. Cada funil tem suas próprias fases com SLA definido (prazo máximo recomendado para permanência na fase).

### Como ler um card

| Elemento | Significado |
|----------|-------------|
| **Título** | Nome do negócio (terreno/condomínio) |
| **Bolinha colorida** | Status do SLA (verde = ok, amarelo = atenção, vermelho = atrasado) |
| **Chips paralelas** | Status de processos paralelos (Acoplamento, Crédito, Jurídico, etc.) |
| **Data** | Data de entrada na fase atual |

### Funis disponíveis para o franqueado

- **Step One** — prospecção e viabilidade
- **Portfólio** — negócios aprovados e em desenvolvimento
- **Operações** — obras em andamento
- **Acoplamento** — modelagem financeira

### Como mover um card

Cards são movidos pelas fases conforme você completa as atividades e checklists de cada fase. Algumas fases exigem aprovação da Moní para avançar.

> **Dúvida sobre um card específico?** Abra um chamado no Sirene ou clique no card para ver as instruções da fase atual.$faq$,
  'published', 2, 'Tecnologia',
  ARRAY['kanban hub fly','card negócio','funil','fase kanban','sla kanban','checklist fase'],
  ARRAY['quadro de negócios','painel kanban','cards hub fly','como funciona o kanban'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Tecnologia e Hub Fly' LIMIT 1)
  AND question = 'Como funciona o Kanban no Hub Fly e o que os cards representam?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Tecnologia e Hub Fly' LIMIT 1),
  'O que é o Sirene e quando devo usá-lo?',
  'O Sirene é a central de chamados do Hub Fly. Use-o para tirar dúvidas, reportar problemas, solicitar documentos ou escalar qualquer situação para o time Moní. É o canal oficial de comunicação entre franqueado e Moní.',
  $faq$## O que é o Sirene?

O **Sirene** é a central de chamados integrada ao Hub Fly. É o canal oficial de comunicação entre o franqueado e o time Moní para qualquer assunto operacional, jurídico, técnico ou de suporte.

### Quando usar o Sirene

| Situação | Use o Sirene |
|----------|--------------|
| Dúvida sobre um processo | ✅ Sim |
| Problema técnico no Hub Fly | ✅ Sim |
| Solicitar documento do Jurídico | ✅ Sim |
| Reportar intercorrência na obra | ✅ Sim |
| Solicitar revisão de prazo | ✅ Sim |
| Urgências operacionais | ✅ Sim, com classificação adequada |

### Como abrir um chamado

1. Acesse o **Sirene** pelo menu lateral do Hub Fly
2. Clique em **Novo Chamado**
3. Escolha a categoria e descreva o assunto com detalhes
4. Anexe documentos se necessário
5. Envie — o time Moní receberá e responderá dentro do SLA

### Como acompanhar

Todos os chamados abertos ficam visíveis no Sirene com status e histórico de respostas. Você recebe notificações no Hub Fly quando há atualização.

### Por que usar o Sirene e não o WhatsApp

O Sirene garante **rastreabilidade**, **SLA definido** e **histórico permanente** de toda comunicação. Chamados no Sirene têm prioridade sobre mensagens informais.

> **Dica:** Quanto mais detalhada a descrição do chamado, mais rápida e precisa será a resposta do time Moní.$faq$,
  'published', 3, 'Tecnologia',
  ARRAY['sirene','chamado','suporte hub fly','central de atendimento','abrir chamado','comunicação moní'],
  ARRAY['como abrir chamado','suporte moní','onde pedir ajuda','central de chamados'],
  true, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Tecnologia e Hub Fly' LIMIT 1)
  AND question = 'O que é o Sirene e quando devo usá-lo?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Tecnologia e Hub Fly' LIMIT 1),
  'Como atualizo meus dados de perfil no Hub Fly?',
  'Você pode atualizar foto, nome de exibição e informações de contato no seu perfil do Hub Fly. Para alterar o e-mail de login ou dados cadastrais formais, é necessário solicitar via Sirene ao time Moní.',
  $faq$## Como atualizar seu perfil no Hub Fly

### O que você pode atualizar diretamente

Acesse **Perfil** pelo menu lateral do Hub Fly:

- **Foto de perfil** — clique na foto atual e faça upload da nova imagem
- **Nome de exibição** — nome como aparece para o time Moní
- **Informações de contato** — telefone, WhatsApp

### O que requer solicitação via Sirene

| Dado | Como alterar |
|------|--------------|
| **E-mail de login** | Abrir chamado no Sirene — requer validação |
| **CPF/CNPJ** | Abrir chamado no Sirene — dado cadastral formal |
| **Papel/perfil de acesso** | Não alterado pelo franqueado — solicitação pela Moní |

### E se minha conta estiver bloqueada?

Contas são bloqueadas em casos específicos (inatividade, pendência contratual, erro de segurança). Para reativação:

1. Tente fazer login — se a mensagem indicar bloqueio, prossiga
2. Entre em contato com seu executivo Moní ou abra chamado no Sirene
3. O time Moní verificará o motivo e orientará os próximos passos

### E se esqueci minha senha?

Na tela de login do Hub Fly, clique em **"Esqueci minha senha"** e siga o fluxo de redefinição por e-mail.

> **Ainda com problema?** Abra um chamado no Sirene com o assunto "Problema de perfil/acesso".$faq$,
  'published', 4, 'Tecnologia',
  ARRAY['perfil hub fly','atualizar dados','foto perfil','email login','configurações hub fly','conta bloqueada'],
  ARRAY['meus dados hub fly','editar perfil','como mudar meu nome hub fly'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Tecnologia e Hub Fly' LIMIT 1)
  AND question = 'Como atualizo meus dados de perfil no Hub Fly?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Tecnologia e Hub Fly' LIMIT 1),
  'Não consigo acessar um funil ou card no Hub Fly — o que fazer?',
  'Problemas de acesso a funis ou cards podem ter diversas causas: permissão de acesso, card arquivado, filtro ativo ou problema técnico. Siga o diagnóstico abaixo antes de abrir um chamado no Sirene.',
  $faq$## Não consigo acessar um funil ou card — o que fazer?

Antes de abrir um chamado, faça o diagnóstico rápido abaixo.

### O funil não aparece no menu

| Causa possível | Verificação |
|----------------|-------------|
| Funil não liberado para seu perfil | Verifique com o time Moní quais funis estão disponíveis para sua fase |
| Funil interno (só para time Moní) | Normal — alguns funis são exclusivos do time operacional |
| Problema de cache/navegador | Tente Ctrl+F5 ou abra em aba anônima |

### O card sumiu ou não aparece

1. **Verifique os filtros** — o board pode estar com filtro de status que oculta cards arquivados ou concluídos
2. **Busque pelo nome** — use a busca do funil com o nome do condomínio ou terreno
3. **O card pode ter sido arquivado** — um card arquivado não aparece na view padrão; solicite ao time Moní que verifique o histórico

### Erro de permissão ao tentar abrir o card

Seu perfil pode não ter permissão para acessar aquele card específico. Isso ocorre quando:
- O card pertence a outro franqueado
- Sua permissão foi alterada recentemente

Abra um chamado no Sirene descrevendo o card e o erro.

### Bug ou tela em branco

1. Atualize a página (F5 ou Ctrl+R)
2. Limpe o cache do navegador
3. Tente outro navegador (Chrome recomendado)
4. Se o problema persistir, abra um chamado no Sirene com o assunto **"Bug Hub Fly"** e descreva o comportamento

### Como reportar um bug

No Sirene, crie um chamado com:
- URL da página com problema
- Descrição do que aconteceu e o que esperava
- Screenshot se possível

> **Time de suporte técnico:** responde chamados de bug com prioridade — descreva o problema com o máximo de detalhes.$faq$,
  'published', 5, 'Tecnologia',
  ARRAY['acesso hub fly','erro hub fly','funil não aparece','card sumiu','permissão hub fly','bug hub fly'],
  ARRAY['não consigo entrar no hub fly','problema de acesso','hub fly não funciona'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Tecnologia e Hub Fly' LIMIT 1)
  AND question = 'Não consigo acessar um funil ou card no Hub Fly — o que fazer?'
);

-- ENTREGA E PÓS-OBRA (5 artigos)

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Entrega e Pós-Obra' LIMIT 1),
  'Como funciona o protocolo de entrega das unidades ao terrenista?',
  'A entrega das unidades ao terrenista segue um protocolo formal com vistoria, assinatura do Termo de Recebimento e entrega das chaves. O processo é coordenado pela Moní e deve ser registrado no Hub Fly.',
  $faq$## Protocolo de entrega das unidades ao terrenista

A entrega das unidades é o momento de conclusão da permuta — o terrenista recebe as casas prometidas no contrato.

### Pré-requisitos para a entrega

Antes de agendar a entrega, verifique que todos os itens abaixo estão concluídos:

- ✅ Habite-se emitido pela prefeitura
- ✅ Averbação da construção na matrícula
- ✅ Vistoria técnica da Wayser concluída
- ✅ Unidades limpas e prontas para habitação
- ✅ Documentação do empreendimento regularizada

### Etapas do protocolo de entrega

1. **Agendamento** — a Moní agenda a data com o terrenista e o franqueado
2. **Vistoria acompanhada** — terrenista visita cada unidade com representante Moní/Wayser
3. **Registro de pendências** — eventuais ajustes são documentados e prazo acordado
4. **Assinatura do Termo de Recebimento** — documento formal de aceite
5. **Entrega das chaves** — registro fotográfico e protocolo assinado
6. **Atualização no Hub Fly** — card avança para fase "Entregue"

### E se o terrenista recusar a entrega?

Recusas devem ser documentadas com precisão. O Jurídico Moní deve ser acionado via Sirene para orientação. Nunca entregue chaves sem o Termo de Recebimento assinado.

### Papel do franqueado na entrega

O franqueado deve estar presente na entrega como ponto de relacionamento. Após a entrega, a responsabilidade de assistência técnica passa para o **Moní Care**.

> **Dúvidas sobre o protocolo?** Abra um chamado no Sirene para o time de Operações.$faq$,
  'published', 1, 'Operações',
  ARRAY['entrega unidades','protocolo entrega','vistoria entrega','termo de recebimento','chave terrenista','conclusão permuta'],
  ARRAY['entregar casas ao terrenista','finalização do negócio','entrega das casas'],
  true, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Entrega e Pós-Obra' LIMIT 1)
  AND question = 'Como funciona o protocolo de entrega das unidades ao terrenista?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Entrega e Pós-Obra' LIMIT 1),
  'O que é averbação e por que é necessária antes da venda das unidades?',
  'A averbação é o registro da construção concluída na matrícula do imóvel no cartório. Ela atualiza o histórico legal do imóvel e é obrigatória para que as unidades possam ser vendidas com financiamento bancário.',
  $faq$## O que é averbação e por que é necessária?

A **averbação** é o ato de registrar na matrícula do imóvel qualquer alteração em sua condição — neste caso, a conclusão da construção das unidades.

### Por que a averbação é obrigatória

- Sem a averbação, a matrícula ainda registra o imóvel como terreno (sem construção)
- Bancos exigem matrícula atualizada com a construção averbada para conceder financiamento
- O terrenista não consegue vender as unidades com financiamento bancário sem a averbação
- A averbação é prova legal de que o imóvel existe fisicamente conforme descrito

### O que é necessário para averbar

| Documento | Descrição |
|-----------|-----------|
| **Habite-se** | Emitido pela prefeitura — pré-requisito |
| **ART/RRT de conclusão** | Assinado pelo responsável técnico |
| **Certidão negativa de débitos** | Confirma regularidade do proprietário |
| **Requerimento ao cartório** | Solicitação formal de averbação |

### Quem faz a averbação

A averbação é solicitada ao **Cartório de Registro de Imóveis** da comarca do imóvel. O processo é conduzido pelo time Jurídico Moní, com suporte do franqueado para documentação do terrenista.

### Prazo típico

De **15 a 45 dias** após o protocolo no cartório, dependendo da comarca.

### Impacto no terrenista

Informe ao terrenista que a averbação é necessária antes de qualquer venda com financiamento. Unidades podem ser negociadas com promessa de compra e venda antes da averbação, mas a escritura definitiva exige o imóvel regular.

> **Dúvidas?** Abra um chamado no Sirene para o time Jurídico.$faq$,
  'published', 2, 'Jurídico',
  ARRAY['averbação','matrícula atualizada','cartório','habite-se','venda unidade','registro obra'],
  ARRAY['registrar obra no cartório','averbação de construção','como averbar imóvel'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Entrega e Pós-Obra' LIMIT 1)
  AND question = 'O que é averbação e por que é necessária antes da venda das unidades?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Entrega e Pós-Obra' LIMIT 1),
  'Quais são os prazos de garantia das casas entregues?',
  'As casas Moní seguem os prazos de garantia previstos na NBR 15575 e no Código de Defesa do Consumidor, que variam de 1 a 5 anos conforme o tipo de sistema construtivo. O Moní Care é o canal para acionar a garantia após a entrega.',
  $faq$## Prazos de garantia das casas entregues

As garantias das casas Moní seguem as normas técnicas brasileiras (ABNT NBR 15575) e o Código de Defesa do Consumidor (CDC).

### Prazos de garantia por sistema

| Sistema | Prazo |
|---------|-------|
| **Estrutura** (fundação, pilares, lajes) | 5 anos |
| **Impermeabilização** (lajes, terraços, áreas molhadas) | 5 anos |
| **Cobertura** (telhado, rufos, calhas) | 3 anos |
| **Instalações hidráulicas e elétricas** | 2 anos |
| **Revestimentos** (cerâmicas, pinturas externas) | 1 a 3 anos |
| **Acabamentos internos** (pintura interna, pisos) | 1 ano |

> Os prazos acima são referências gerais — o Memorial de Garantias entregue na conclusão do empreendimento detalha os prazos específicos de cada item.

### O que a garantia cobre

A garantia cobre **vícios construtivos** — defeitos originados na construção ou nos materiais utilizados, desde que a unidade tenha sido usada conforme sua finalidade.

### O que a garantia NÃO cobre

- ❌ Danos por mau uso ou modificações feitas pelo proprietário
- ❌ Desgaste natural por uso ao longo do tempo
- ❌ Danos causados por eventos externos (enchentes, vendavais, etc.)
- ❌ Falta de manutenção preventiva pelo proprietário

### Como acionar a garantia

O terrenista ou comprador da unidade deve entrar em contato com o **Moní Care** — o canal oficial de pós-entrega. O franqueado pode apoiar no encaminhamento, mas o Moní Care é o responsável pela análise e resolução.

> **Dúvidas sobre garantia?** Acione o Moní Care pelo Hub Fly ou via Sirene.$faq$,
  'published', 3, 'Operações',
  ARRAY['garantia casas','prazo garantia','NBR 15575','CDC','vícios construtivos','defeito obra','garantia 5 anos'],
  ARRAY['tempo de garantia','garantia da construção','defeito após entrega'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Entrega e Pós-Obra' LIMIT 1)
  AND question = 'Quais são os prazos de garantia das casas entregues?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Entrega e Pós-Obra' LIMIT 1),
  'O que acontece com o acerto financeiro após a entrega das unidades?',
  'Após a entrega das unidades, a operação passa pela fase de fechamento financeiro, com liquidação do crédito de obra, apuração do resultado e distribuição aos envolvidos. O processo é coordenado pelo time Financeiro e Contabilidade Moní.',
  $faq$## Acerto financeiro após a entrega das unidades

Com as unidades entregues ao terrenista, a operação entra na fase de **fechamento financeiro**, que envolve a liquidação do crédito e a apuração do resultado.

### Etapas do fechamento financeiro

1. **Liquidação do crédito de obra (Cash Me)** — o saldo devedor do financiamento é quitado com os recursos da venda das unidades que não foram para permuta
2. **Apuração do resultado** — receitas menos custos totais da operação
3. **Fechamento da SPE** (quando aplicável) — encerramento da Sociedade de Propósito Específico criada para a operação
4. **Distribuição do resultado** — conforme contrato, entre franqueado e Moní
5. **Encerramento contábil** — baixa dos registros na contabilidade do empreendimento

### Quanto tempo leva

O processo de fechamento financeiro pode levar de **2 a 6 meses** após a entrega das unidades, dependendo da velocidade de venda das unidades não permutadas e dos processos cartorários.

### Qual é o papel do franqueado

- Acompanhar o card no funil Operações até o encerramento
- Responder chamados do time Financeiro/Contabilidade sobre documentação
- Não realizar pagamentos ou recebimentos sem autorização da operação

### Como acompanhar

O funil **Contabilidade** no Hub Fly registra o andamento do fechamento financeiro. O time Financeiro Moní coordena e informa o franqueado sobre o resultado.

> **Dúvidas sobre o fechamento?** Abra um chamado no Sirene para o time Financeiro ou Contabilidade.$faq$,
  'published', 4, 'Financeiro',
  ARRAY['acerto financeiro','resultado empreendimento','liquidação crédito','fechamento spe','retorno franqueado','contabilidade pós-obra'],
  ARRAY['fechamento financeiro','quanto recebo como franqueado','resultado do negócio'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Entrega e Pós-Obra' LIMIT 1)
  AND question = 'O que acontece com o acerto financeiro após a entrega das unidades?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Entrega e Pós-Obra' LIMIT 1),
  'O terrenista pode vender a unidade recebida antes do Habite-se?',
  'Antes do Habite-se, as unidades não podem ser vendidas com escritura pública definitiva. É possível celebrar Promessa de Compra e Venda, mas a venda formal com financiamento bancário exige a regularização completa do imóvel.',
  $faq$## O terrenista pode vender antes do Habite-se?

Essa é uma dúvida frequente do terrenista após a entrega física das unidades. A resposta depende do tipo de transação.

### O que é possível antes do Habite-se

| Tipo de transação | Possível? |
|-------------------|-----------|
| **Promessa de Compra e Venda (PCV)** | ✅ Sim — contrato particular válido |
| **Cessão de direitos** | ✅ Sim — com orientação jurídica |
| **Venda à vista com escritura** | ⚠️ Tecnicamente possível, mas sem garantias ao comprador |
| **Venda com financiamento bancário** | ❌ Não — bancos exigem matrícula com averbação |

### Riscos da venda antes do Habite-se

- O comprador não consegue registrar o imóvel em seu nome antes da averbação
- Em caso de problemas, o comprador tem menos proteção legal
- Alguns municípios restringem a ocupação antes do Habite-se

### Orientação ao terrenista

Se o terrenista quiser negociar a unidade antes do Habite-se, recomende:

1. Celebrar uma **Promessa de Compra e Venda** formal com cláusula de entrega da escritura após averbação
2. Consultar um advogado de sua confiança para revisão do contrato
3. Informar ao comprador sobre o prazo estimado do Habite-se

### Qual é o papel do franqueado

O franqueado **não orienta juridicamente** o terrenista sobre contratos de venda — esse papel é de advogado particular do terrenista. O franqueado pode indicar o time Jurídico Moní para dúvidas sobre o processo de regularização do empreendimento.

> **Dúvidas sobre o processo de regularização?** Abra um chamado no Sirene para o time Jurídico.$faq$,
  'published', 5, 'Jurídico',
  ARRAY['venda antes habite-se','terrenista vender casa','promessa compra venda','escritura imóvel','financiamento habite-se'],
  ARRAY['posso vender antes do habite-se','vender unidade antes de terminar','negociar casa em construção'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Entrega e Pós-Obra' LIMIT 1)
  AND question = 'O terrenista pode vender a unidade recebida antes do Habite-se?'
);

-- MONÍ CARE (4 artigos)

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Moní Care' LIMIT 1),
  'O que é o Moní Care e como ele funciona?',
  'O Moní Care é o serviço de assistência técnica pós-entrega da Casa Moní. Ele atende solicitações de garantia e reparos das unidades entregues aos terrenistas, dentro dos prazos previstos na NBR 15575 e no contrato.',
  $faq$## O que é o Moní Care?

O **Moní Care** é o serviço de pós-entrega da Casa Moní, responsável por atender solicitações de garantia, assistência técnica e reparos nas unidades já entregues aos terrenistas.

### Para que serve

- Atender **vícios construtivos** identificados após a entrega
- Realizar **vistorias técnicas** quando solicitado
- Coordenar **reparos** dentro do prazo de garantia
- Manter o **relacionamento pós-entrega** com o terrenista

### Como funciona

1. O terrenista (ou comprador da unidade) identifica um problema
2. Aciona o Moní Care pelo canal definido (Sirene ou canal específico do produto)
3. O time Moní Care faz a **triagem do chamado**
4. Uma vistoria técnica é agendada quando necessário
5. O reparo é coordenado e executado dentro do prazo acordado

### O que o Moní Care cobre

O Moní Care atende solicitações dentro dos prazos de garantia definidos pela NBR 15575. Veja os prazos no artigo "Quais são os prazos de garantia das casas entregues?".

### O que o Moní Care NÃO cobre

- ❌ Danos por mau uso ou modificações do proprietário
- ❌ Itens fora do prazo de garantia
- ❌ Desgaste natural por uso
- ❌ Danos por eventos externos (enchentes, impactos, etc.)

### Qual é o papel do franqueado

O franqueado pode apoiar o terrenista no **encaminhamento** da solicitação ao Moní Care, mas não é o responsável técnico pela resolução. O time Moní Care cuida da análise e execução.

> **Para acionar o Moní Care:** abra um chamado no Sirene com o assunto "Moní Care — [endereço da unidade]".$faq$,
  'published', 1, 'Operações',
  ARRAY['moní care','pós-entrega','garantia pós-obra','suporte terrenista','vistoria garantia','reparo pós-obra'],
  ARRAY['atendimento pós-entrega','suporte de garantia','assistência técnica moní'],
  true, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Moní Care' LIMIT 1)
  AND question = 'O que é o Moní Care e como ele funciona?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Moní Care' LIMIT 1),
  'Como o terrenista deve acionar o Moní Care após problemas na unidade?',
  'O terrenista deve reportar o problema ao franqueado, que abre um chamado no Sirene para o Moní Care. O chamado deve incluir descrição detalhada do problema, fotos e endereço da unidade.',
  $faq$## Como acionar o Moní Care após problemas na unidade

### Quem pode acionar

- O **terrenista** que recebeu as unidades no contrato de permuta
- O **comprador da unidade** (se o terrenista já vendeu), dentro do prazo de garantia
- O **franqueado**, em apoio ao terrenista

### Como acionar — passo a passo

1. **Documente o problema** — tire fotos claras do defeito e anote a descrição
2. **Entre em contato com o franqueado** — o franqueado é o ponto de entrada preferencial
3. **O franqueado abre chamado no Sirene** — com os dados abaixo
4. **Aguarde o contato do Moní Care** — o time retornará para triagem e agendamento de vistoria

### Informações obrigatórias no chamado

| Campo | Exemplo |
|-------|---------|
| Endereço completo da unidade | Rua X, nº 10, Unidade 2, Condomínio Y |
| Descrição do problema | "Infiltração no teto do banheiro após chuva" |
| Quando foi identificado | Data aproximada |
| Fotos | Pelo menos 2 fotos do defeito |
| Contato do terrenista | Nome e telefone |

### Prazos de resposta

O Moní Care tem SLA definido para cada tipo de chamado — **urgências estruturais** têm prioridade. Veja os prazos no artigo sobre SLA do Sirene.

### E se o problema for urgente?

Problemas que oferecem risco à segurança (fissuras estruturais, vazamento elétrico, inundação) devem ser marcados como **urgentes** no chamado. O franqueado deve acionar o Sirene imediatamente.

> **Para acionar o Moní Care:** abra um chamado no Sirene com assunto "Moní Care — URGENTE" ou "Moní Care — [tipo do problema]".$faq$,
  'published', 2, 'Operações',
  ARRAY['acionar garantia','como reclamar problema','chamado pós-entrega','vistoria garantia','terrenista problema'],
  ARRAY['como pedir reparo moní','problema na casa entregue','reclamação pós-obra'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Moní Care' LIMIT 1)
  AND question = 'Como o terrenista deve acionar o Moní Care após problemas na unidade?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Moní Care' LIMIT 1),
  'O franqueado tem alguma responsabilidade no pós-entrega?',
  'O franqueado tem papel de relacionamento e intermediação no pós-entrega, não de responsabilidade técnica. Ele apoia o terrenista no acionamento do Moní Care e mantém o relacionamento para futuras oportunidades.',
  $faq$## Responsabilidade do franqueado no pós-entrega

O franqueado não tem responsabilidade técnica direta pelos reparos pós-entrega — essa responsabilidade é da **operação Moní (Moní Care)**. Mas ele tem um papel importante no relacionamento.

### O que é responsabilidade do franqueado

| Atividade | Responsabilidade |
|-----------|-----------------|
| Atender o terrenista quando reportar problema | ✅ Franqueado |
| Abrir chamado no Sirene para o Moní Care | ✅ Franqueado |
| Manter contato durante o processo de resolução | ✅ Franqueado |
| Garantir a satisfação do terrenista com a Moní | ✅ Franqueado |

### O que NÃO é responsabilidade do franqueado

| Atividade | Responsável correto |
|-----------|---------------------|
| Executar reparos técnicos | Moní Care / Wayser |
| Avaliar tecnicamente o defeito | Equipe técnica Moní |
| Autorizar ou negar chamados de garantia | Moní Care |
| Pagar reparos por conta própria | Jamais — acione o Sirene |

### Por que o relacionamento pós-entrega importa

O terrenista satisfeito é uma referência para novas oportunidades de terreno. O franqueado que mantém contato pós-entrega tem:

- Maior chance de novas indicações de terrenos
- Reputação positiva no território
- Base de relacionamento para futuras operações

### Cuidados importantes

- **Nunca prometa prazos** de reparo sem consultar o Moní Care
- **Nunca autorize reparos** fora do fluxo oficial
- **Nunca pague reparos** diretamente — todo processo passa pelo Moní Care

> **Dúvidas sobre responsabilidades?** Abra um chamado no Sirene para o time de Operações.$faq$,
  'published', 3, 'Operações',
  ARRAY['responsabilidade franqueado pós-entrega','papel franqueado garantia','relacionamento pós-obra','terrenista satisfeito'],
  ARRAY['o que o franqueado faz depois da entrega','franqueado e garantia','responsabilidade após obra'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Moní Care' LIMIT 1)
  AND question = 'O franqueado tem alguma responsabilidade no pós-entrega?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Moní Care' LIMIT 1),
  'O Moní Care cobre problemas causados por inquilinos ou compradores das unidades?',
  'O Moní Care atende solicitações de garantia técnica, independentemente de quem ocupa a unidade, desde que o problema seja um vício construtivo dentro do prazo de garantia e não causado por mau uso.',
  $faq$## O Moní Care cobre problemas de inquilinos ou compradores?

Essa é uma questão frequente quando o terrenista vende ou aluga a unidade recebida na permuta.

### Regra geral

O Moní Care cobre **vícios construtivos** — problemas originados na construção — independentemente de quem ocupa a unidade, desde que:

1. O problema esteja **dentro do prazo de garantia**
2. O defeito seja de origem **construtiva** (não causado por mau uso ou modificações)
3. A unidade não tenha passado por **reformas que alterem o sistema com problema**

### Quando a garantia se transfere

A garantia da construção acompanha o imóvel, não o proprietário original. Portanto:

| Situação | Garantia válida? |
|----------|-----------------|
| Terrenista vendeu a unidade | ✅ Sim — a garantia passa ao comprador |
| Terrenista alugou a unidade | ✅ Sim — o proprietário (terrenista) pode acionar |
| Comprador fez reforma no sistema afetado | ⚠️ Depende — avaliação técnica necessária |
| Problema causado por mau uso do inquilino | ❌ Não — não é vício construtivo |

### Como o novo proprietário aciona

O novo proprietário (comprador da unidade) deve entrar em contato com o **Moní Care** apresentando:
- Prova de aquisição do imóvel
- Descrição do problema com fotos
- Endereço completo da unidade

O franqueado pode apoiar no encaminhamento, mas o Moní Care atende diretamente.

### Dúvidas jurídicas sobre a garantia

Para questões mais complexas sobre transferência de garantia e responsabilidade, consulte o time Jurídico Moní via Sirene.

> **Para acionar:** abra um chamado no Sirene com assunto "Moní Care — [endereço da unidade]".$faq$,
  'published', 4, 'Jurídico',
  ARRAY['garantia inquilino','quem tem direito garantia','moní care quem pode usar','transferência garantia','venda unidade garantia'],
  ARRAY['garantia para comprador','locatário e garantia','responsabilidade pós-venda unidade'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Moní Care' LIMIT 1)
  AND question = 'O Moní Care cobre problemas causados por inquilinos ou compradores das unidades?'
);

-- LICENCIAMENTO E MARCA (4 artigos)

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Licenciamento e Marca' LIMIT 1),
  'O franqueado pode usar a marca Moní em suas comunicações e materiais?',
  'Sim, o franqueado pode usar a marca Moní em suas comunicações, desde que siga o Manual de Identidade Visual Moní e obtenha aprovação prévia para materiais novos. O uso indevido da marca pode violar o COF.',
  $faq$## Uso da marca Moní pelo franqueado

O franqueado tem **licença de uso** da marca Moní, mas esse uso é regulado pelo COF e pelo Manual de Identidade Visual.

### O que o franqueado pode fazer

- ✅ Usar o logotipo Moní em seus materiais de prospecção (cartões, apresentações, e-mails)
- ✅ Apresentar-se como "Franqueado Moní" ou "Parceiro Moní" nas abordagens
- ✅ Usar os materiais de marketing padronizados fornecidos pela Moní
- ✅ Mencionar a marca Moní em redes sociais pessoais e profissionais

### O que o franqueado NÃO pode fazer

- ❌ Criar materiais com o logotipo sem seguir o Manual de Identidade Visual
- ❌ Alterar cores, proporções ou tipografia do logotipo
- ❌ Usar a marca em contextos que não estejam relacionados à operação Moní
- ❌ Criar sites ou perfis de redes sociais como se fossem canais oficiais Moní

### Manual de Identidade Visual

O manual detalha as regras de uso do logotipo, paleta de cores, tipografia e aplicações corretas da marca. Solicite acesso via Sirene ou consulte o material disponibilizado pelo time de Marketing Moní.

### Aprovação prévia

Para materiais novos (banners, vídeos, apresentações customizadas), envie o arquivo para aprovação pelo time de Marketing Moní antes de publicar ou distribuir.

> **Dúvidas sobre uso da marca?** Abra um chamado no Sirene para o time de Marketing.$faq$,
  'published', 1, 'Marketing',
  ARRAY['uso da marca moní','logotipo moní','identidade visual','manual de marca','material marketing','franqueado marca'],
  ARRAY['posso usar a marca moní','como usar o logo moní','comunicação com a marca'],
  true, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Licenciamento e Marca' LIMIT 1)
  AND question = 'O franqueado pode usar a marca Moní em suas comunicações e materiais?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Licenciamento e Marca' LIMIT 1),
  'Como funciona o licenciamento da marca e o que diz o COF sobre isso?',
  'O COF (Contrato de Operação de Franquia) concede ao franqueado a licença de uso da marca Moní durante a vigência do contrato, dentro do território definido. O licenciamento é exclusivo para fins operacionais da franquia e não é transferível.',
  $faq$## Licenciamento da marca no COF

O **COF (Contrato de Operação de Franquia)** é o documento que formaliza todos os direitos e obrigações do franqueado, incluindo o uso da marca Moní.

### O que o COF estabelece sobre a marca

| Ponto | Disposição típica |
|-------|------------------|
| **Licença de uso** | Não exclusiva, limitada ao território e à vigência do contrato |
| **Finalidade** | Exclusivamente para operação da franquia Moní |
| **Transferência** | Não transferível sem autorização expressa da Moní |
| **Encerramento** | Com o término do contrato, o franqueado deve cessar todo uso da marca |

### Propriedade da marca

A marca Moní é registrada no **INPI (Instituto Nacional da Propriedade Industrial)** em nome da franqueadora. O franqueado tem licença de uso, não propriedade.

### O que acontece ao encerrar o contrato

Com o encerramento do COF, o franqueado deve:
- ❌ Cessar imediatamente o uso do logotipo e da marca em todos os materiais
- ❌ Retirar materiais físicos com a marca Moní
- ❌ Desativar ou transferir perfis de redes sociais com a marca
- ✅ Manter confidencialidade sobre know-how e processos Moní

### Uso indevido — consequências

O uso da marca fora dos termos do COF pode resultar em notificação extrajudicial e ação de danos. Em caso de dúvida sobre o que é permitido, consulte o time Jurídico Moní antes de agir.

> **Dúvidas jurídicas sobre o licenciamento?** Abra um chamado no Sirene para o time Jurídico.$faq$,
  'published', 2, 'Jurídico',
  ARRAY['licenciamento marca','COF franquia','contrato franquia marca','INPI','encerramento contrato marca','uso autorizado marca'],
  ARRAY['licença de uso da marca','direito de usar o nome moní','contrato de marca franquia'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Licenciamento e Marca' LIMIT 1)
  AND question = 'Como funciona o licenciamento da marca e o que diz o COF sobre isso?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Licenciamento e Marca' LIMIT 1),
  'Posso criar redes sociais com a marca Moní para minha unidade?',
  'O franqueado pode criar perfis locais nas redes sociais usando a marca Moní, desde que siga as diretrizes do Manual de Identidade Visual e informe o time de Marketing Moní. O perfil deve deixar claro que é uma unidade franqueada, não a Moní oficial.',
  $faq$## Criação de redes sociais com a marca Moní

### O que é permitido

O franqueado pode criar perfis nas redes sociais para sua unidade, desde que:

- ✅ O perfil seja identificado como unidade local (ex.: "Moní — [Cidade/Bairro]" ou "Moní Franqueado [Nome]")
- ✅ O visual siga o Manual de Identidade Visual Moní (cores, fontes, logotipo)
- ✅ O time de Marketing Moní seja informado sobre a criação do perfil
- ✅ O conteúdo seja relacionado exclusivamente à operação Moní

### O que NÃO é permitido

- ❌ Usar nome de usuário que pareça ser o canal oficial da Moní (ex.: @moni_oficial, @moni_brasil)
- ❌ Publicar conteúdo que não tenha relação com a operação Moní
- ❌ Compartilhar informações confidenciais de outros franqueados ou da franqueadora
- ❌ Postar preços, promoções ou condições sem aprovação prévia

### Como criar o perfil corretamente

1. Defina o nome de usuário como "@moni.[cidade]" ou similar (consulte o time de Marketing sobre convenção)
2. Use o logotipo e as cores corretas (solicite os arquivos ao time de Marketing)
3. Na bio, identifique claramente que é uma unidade franqueada
4. Informe o time de Marketing via Sirene sobre a criação do perfil

### Suporte do time de Marketing

O time de Marketing Moní pode fornecer:
- Templates de posts e stories padronizados
- Arquivos do logotipo em alta resolução
- Diretrizes de conteúdo e tom de voz
- Revisão de materiais antes da publicação

> **Para solicitar materiais ou aprovação:** abra um chamado no Sirene para o time de Marketing.$faq$,
  'published', 3, 'Marketing',
  ARRAY['redes sociais moní','instagram moní franqueado','perfil local moní','marketing digital franquia','publicar moní'],
  ARRAY['criar instagram moní','fazer redes sociais como franqueado','social media moní'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Licenciamento e Marca' LIMIT 1)
  AND question = 'Posso criar redes sociais com a marca Moní para minha unidade?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Licenciamento e Marca' LIMIT 1),
  'O franqueado pode fazer campanhas de mídia paga usando a marca Moní?',
  'Sim, o franqueado pode fazer campanhas de mídia paga (Google Ads, Meta Ads) usando a marca Moní para prospecção de terrenistas, desde que siga as diretrizes de uso da marca e obtenha aprovação prévia do time de Marketing Moní.',
  $faq$## Campanhas de mídia paga com a marca Moní

O franqueado pode investir em mídia paga para prospecção de terrenistas dentro do seu território, usando a marca Moní conforme as diretrizes.

### O que é permitido

- ✅ Campanhas de Google Ads segmentadas para o território do franqueado
- ✅ Campanhas no Meta Ads (Facebook/Instagram) com criativo aprovado
- ✅ Anúncios focados em prospecção de terrenistas e proprietários de terrenos
- ✅ Uso do logotipo Moní nos criativos (dentro das diretrizes do Manual de Identidade Visual)

### O que requer aprovação prévia

Antes de veicular qualquer anúncio pago com a marca Moní:

1. Envie o criativo (arte ou texto do anúncio) para o time de Marketing via Sirene
2. Aguarde a aprovação — o time responde dentro do SLA
3. Só veicule após confirmação escrita de aprovação

### O que NÃO é permitido

- ❌ Campanhas fora do território definido no COF
- ❌ Anúncios que prometam condições, valores ou prazos não autorizados pela Moní
- ❌ Uso de imagens ou textos não aprovados pelo time de Marketing
- ❌ Campanhas que possam gerar confusão com os canais oficiais da Moní

### Orientações de segmentação

Para prospecção de terrenistas, as campanhas mais eficazes costumam segmentar por:
- Localização (dentro do território)
- Interesses relacionados a imóveis e investimentos
- Dados demográficos de proprietários (faixa etária, poder aquisitivo)

### Budget e retorno

A Moní não financia campanhas de mídia paga do franqueado. O investimento é por conta do franqueado. O time de Marketing pode orientar sobre estratégias e boas práticas.

> **Para aprovação de criativos:** abra um chamado no Sirene para o time de Marketing.$faq$,
  'published', 4, 'Marketing',
  ARRAY['mídia paga moní','anúncio franqueado','google ads moní','meta ads franquia','campanha local','prospecção terrenista ads'],
  ARRAY['fazer anúncios moní','publicidade paga franquia','impulsionar posts moní'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Licenciamento e Marca' LIMIT 1)
  AND question = 'O franqueado pode fazer campanhas de mídia paga usando a marca Moní?'
);

-- SUPORTE E COMUNIDADE (5 artigos)

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Suporte e Comunidade' LIMIT 1),
  'Quais são os canais oficiais de suporte da Moní para o franqueado?',
  'O canal oficial de suporte é o Sirene, integrado ao Hub Fly. Para urgências, existe também o WhatsApp do executivo de novos negócios. Todos os registros formais devem passar pelo Sirene para garantir rastreabilidade e SLA.',
  $faq$## Canais oficiais de suporte da Moní

### Canal principal: Sirene

O **Sirene** (dentro do Hub Fly) é o canal oficial para toda comunicação operacional, jurídica, técnica e de suporte. Use-o para:

- Dúvidas sobre processos e funis
- Solicitações de documentos
- Reporte de problemas técnicos
- Escalada de situações críticas

### Canais complementares

| Canal | Uso |
|-------|-----|
| **WhatsApp do executivo** | Comunicação ágil com seu executivo de novos negócios; não substitui o Sirene para registros formais |
| **E-mail** | Comunicações formais quando solicitado pelo time Moní |
| **Comunidade franqueados** | Troca entre franqueados — não é canal de suporte oficial |

### Por que o Sirene é prioritário

- **Rastreabilidade:** todo chamado fica registrado com histórico
- **SLA definido:** prazo de resposta acordado e monitorado
- **Time certo:** chamados são direcionados ao especialista correto
- **Evidência:** em caso de dúvida futura, o Sirene é a prova do que foi comunicado

### O que NÃO é canal oficial

- ❌ Mensagens em grupos de WhatsApp gerais
- ❌ Comentários em redes sociais
- ❌ Contato direto com funcionários da Moní fora do contexto do Sirene

> **Regra de ouro:** se é importante, registra no Sirene.$faq$,
  'published', 1, 'Operações',
  ARRAY['canais suporte moní','sirene suporte','whatsapp moní','contato moní','como falar com a moní'],
  ARRAY['como entrar em contato com a moní','telefone moní','suporte franqueado moní'],
  true, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Suporte e Comunidade' LIMIT 1)
  AND question = 'Quais são os canais oficiais de suporte da Moní para o franqueado?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Suporte e Comunidade' LIMIT 1),
  'Existe uma comunidade de franqueados Moní e como me engajo?',
  'Sim, a Moní mantém uma comunidade de franqueados com grupos de troca, eventos e convenções. O Hub Fly tem um módulo de Comunidade com conteúdos e espaços de interação. O engajamento é incentivado pela Moní como parte da cultura da rede.',
  $faq$## Comunidade de franqueados Moní

A rede Moní tem uma comunidade ativa de franqueados que se apoia, compartilha experiências e cresce junto. Existem diferentes canais de engajamento.

### Hub Fly — Módulo Comunidade

Dentro do Hub Fly, o módulo **Comunidade** oferece:
- Conteúdos exclusivos para franqueados
- Fóruns de discussão por tema
- Material de capacitação e boas práticas
- Acesso a documentos e templates compartilhados

### Grupos de troca

A Moní pode manter grupos específicos para franqueados por região, fase de operação ou tema. Consulte seu executivo de novos negócios sobre grupos disponíveis.

### Convenção Moní

A Moní realiza eventos periódicos (convenções, encontros regionais) para:
- Apresentação de novidades e estratégias
- Reconhecimento de franqueados destaques
- Troca de experiências entre a rede
- Formação e capacitação

### Como se engajar

1. Acesse o módulo **Comunidade** no Hub Fly
2. Participe das discussões e compartilhe suas experiências
3. Esteja presente nos eventos e convenções
4. Conecte-se com outros franqueados da sua região

### Boas práticas na comunidade

- Compartilhe aprendizados, não reclamações sem proposta de solução
- Respeite a confidencialidade de informações operacionais
- Use os canais oficiais (Sirene) para suporte — a comunidade não é canal de suporte técnico

> **Para saber sobre próximos eventos:** fique atento às notificações no Hub Fly ou pergunte ao seu executivo.$faq$,
  'published', 2, 'Operações',
  ARRAY['comunidade franqueados','rede moní','grupos whatsapp moní','convenção moní','hub fly comunidade','troca franqueados'],
  ARRAY['fórum franqueados moní','grupos moní','rede de franqueados'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Suporte e Comunidade' LIMIT 1)
  AND question = 'Existe uma comunidade de franqueados Moní e como me engajo?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Suporte e Comunidade' LIMIT 1),
  'Como reporto um bug ou sugestão de melhoria para o Hub Fly?',
  'Bugs devem ser reportados via Sirene com descrição detalhada e, se possível, screenshot. Sugestões de melhoria também podem ser enviadas pelo Sirene — o time de Produto Moní analisa e prioriza as solicitações da rede.',
  $faq$## Como reportar bugs e sugestões no Hub Fly

### Reportando um bug

Um bug é qualquer comportamento inesperado da plataforma — botão que não funciona, tela em branco, dado incorreto, etc.

**Como reportar:**

1. Abra um chamado no **Sirene** com assunto: **"Bug Hub Fly — [descrição breve]"**
2. Inclua as seguintes informações:
   - URL da página onde o bug ocorreu
   - O que você fez (ação que causou o problema)
   - O que esperava acontecer
   - O que aconteceu de fato
   - Screenshot ou vídeo curto (muito útil!)
   - Navegador e sistema operacional

3. Se o bug impede uma atividade crítica (ex.: não consigo mover um card), marque como **urgente**

### Enviando uma sugestão de melhoria

Tem uma ideia para tornar o Hub Fly melhor? A Moní quer ouvir!

**Como enviar:**

1. Abra um chamado no Sirene com assunto: **"Sugestão Hub Fly — [tema]"**
2. Descreva:
   - Qual problema você está tentando resolver
   - Como a plataforma poderia resolver esse problema
   - Com que frequência você enfrenta essa situação

### O que acontece com a sugestão

O time de Produto Moní analisa todas as sugestões recebidas. As mais solicitadas e com maior impacto operacional são priorizadas no roadmap de desenvolvimento. Você pode não receber resposta imediata para sugestões, mas elas são lidas e consideradas.

> **Tip:** sugestões que resolveriam um problema para muitos franqueados têm mais chance de ser priorizadas — mencione se acredita que outros colegas enfrentam o mesmo problema.$faq$,
  'published', 3, 'Tecnologia',
  ARRAY['bug hub fly','reportar problema','sugestão hub fly','melhoria plataforma','erro hub fly','feedback hub fly'],
  ARRAY['reportar erro hub fly','como melhorar hub fly','bug no sistema'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Suporte e Comunidade' LIMIT 1)
  AND question = 'Como reporto um bug ou sugestão de melhoria para o Hub Fly?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Suporte e Comunidade' LIMIT 1),
  'Qual é o SLA de resposta do time Moní para chamados no Sirene?',
  'O SLA varia conforme a urgência e a área do chamado. Chamados urgentes têm prioridade de atendimento. O SLA padrão para chamados comuns é de 1 a 3 dias úteis, conforme a categoria.',
  $faq$## SLA de resposta do time Moní no Sirene

O SLA (Service Level Agreement) é o prazo máximo de resposta para cada tipo de chamado. Ele varia conforme a urgência e a área responsável.

### SLA por urgência

| Nível | Definição | Prazo de primeira resposta |
|-------|-----------|---------------------------|
| **Urgente** | Impede atividade crítica da operação | Até 4 horas úteis |
| **Alta** | Problema significativo com impacto operacional | Até 1 dia útil |
| **Média** | Dúvida ou solicitação que pode aguardar | Até 2 dias úteis |
| **Baixa** | Sugestão, melhoria ou questão não urgente | Até 3 dias úteis |

> Os prazos acima são referências — o SLA oficial pode ser atualizado pela Moní. Verifique as instruções no próprio Sirene ao abrir o chamado.

### SLA por área

| Área | SLA típico |
|------|-----------|
| Jurídico | 2–3 dias úteis (análise de documentos pode levar mais) |
| Operações | 1–2 dias úteis |
| Tecnologia (bugs) | 1 dia útil para urgentes; 3–5 dias para não urgentes |
| Marketing (aprovação de material) | 2–3 dias úteis |
| Financeiro/Contabilidade | 3–5 dias úteis |

### Como escalar um chamado

Se o prazo SLA passou e você ainda não recebeu resposta:

1. Responda ao chamado existente no Sirene com "Escalada — SLA vencido"
2. Se não houver resposta em 24h, entre em contato com seu executivo de novos negócios

### Dicas para resposta mais rápida

- Seja específico na descrição do problema
- Inclua dados relevantes (número do card, nome do terreno, data)
- Classifique a urgência corretamente — urgências mal classificadas podem atrasar a triagem

> **Lembre:** o Sirene é o canal com SLA garantido. Mensagens por WhatsApp não têm SLA formal.$faq$,
  'published', 4, 'Operações',
  ARRAY['SLA sirene','prazo resposta moní','tempo de atendimento','urgente sirene','escalar chamado','SLA jurídico'],
  ARRAY['quanto tempo para responder','prazo de atendimento moní','SLA de chamado'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Suporte e Comunidade' LIMIT 1)
  AND question = 'Qual é o SLA de resposta do time Moní para chamados no Sirene?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Suporte e Comunidade' LIMIT 1),
  'Posso indicar outro franqueado para a rede Moní e existe algum benefício por isso?',
  'Sim, o franqueado pode indicar candidatos para a rede Moní. Consulte seu executivo sobre o programa de indicação vigente e eventuais benefícios. Indicações devem ser feitas pelo canal oficial para serem reconhecidas.',
  $faq$## Indicação de novos franqueados para a rede Moní

### Como funciona

O franqueado pode indicar pessoas ou empresas interessadas em se tornar franqueados Moní. Isso fortalece a rede e pode gerar benefícios para o indicador.

### Quem pode ser indicado

- Empreendedores com perfil para o modelo de negócio Moní
- Pessoas com acesso a terrenos ou rede de terrenistas
- Empresas do setor imobiliário interessadas na operação franqueada

### Como fazer a indicação

1. Converse com o candidato sobre o modelo Moní e seu interesse
2. Informe seu executivo de novos negócios sobre a indicação
3. Solicite ao candidato que mencione seu nome no processo seletivo
4. O time Moní conduz o processo seletivo de forma independente

> **Importante:** a indicação precisa ser comunicada ao executivo **antes** de o candidato entrar no processo seletivo para ser reconhecida.

### Programa de indicação

Consulte seu executivo de novos negócios sobre o programa de indicação vigente — pode haver benefícios para o franqueado que indica um candidato que se torna franqueado ativo.

### O que o franqueado NÃO deve fazer

- ❌ Prometer ao candidato condições comerciais ou aprovação garantida
- ❌ Cobrar qualquer valor pela indicação
- ❌ Agir como representante comercial da Moní no processo seletivo

### Múltiplas indicações

Não há limite de indicações por franqueado. Quanto mais franqueados qualificados entram na rede, mais forte e apoiada fica a comunidade.

> **Para registrar uma indicação:** fale com seu executivo de novos negócios ou abra um chamado no Sirene com o assunto "Indicação de novo franqueado".$faq$,
  'published', 5, 'Operações',
  ARRAY['indicar franqueado','programa indicação','indicação moní','expansão franquia','benefício indicação'],
  ARRAY['recomendar franqueado moní','indicar parceiro moní','programa de referral moní'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Suporte e Comunidade' LIMIT 1)
  AND question = 'Posso indicar outro franqueado para a rede Moní e existe algum benefício por isso?'
);

-- ============================================================
-- PART 4: Artigos revisados (2 UPDATE + fallback INSERT)
-- ============================================================

-- Artigo 1 revisado: Contratos e Garantias — Seguro Garantia → Carta Fiança
UPDATE faq_articles SET
  question = 'A Moní ainda utiliza Seguro Garantia? Qual é a garantia atual entregue ao terrenista?',
  short_answer = 'A Moní não utiliza mais Seguro Garantia. A garantia atual entregue ao terrenista é a Carta Fiança, contratada via Seven Garantias, LS Garantidora ou outra garantidora habilitada.',
  answer = $faq$## Qual é a garantia atual entregue ao terrenista?

A Moní **não utiliza mais Seguro Garantia** como instrumento garantidor. Essa modalidade foi descontinuada.

### Instrumento atual: Carta Fiança

A garantia atualmente adotada é a **Carta Fiança Bancária** (ou equivalente emitida por garantidora), que funciona da seguinte forma:

- **O que é:** Documento emitido por uma instituição financeira ou garantidora que assegura ao terrenista o recebimento das unidades previstas no contrato, mesmo que o empreendimento não seja concluído.
- **Quem emite:** Garantidoras habilitadas parceiras da Moní — atualmente **Seven Garantias** e **LS Garantidora** são as indicadas.
- **Quando é entregue:** A Carta Fiança é entregue ao terrenista junto com o Instrumento de Permuta, na fase de assinatura do contrato.
- **Validade:** Cobre o período do contrato até a entrega das unidades permutadas.

### Por que mudou?

O Seguro Garantia na modalidade imobiliária apresentou limitações operacionais e foi descontinuado como solução padrão Moní. A Carta Fiança oferece maior solidez, liquidez e aceitação pelo mercado.

### Como contratar

O time Moní orientará o franqueado sobre o contato com a garantidora no momento oportuno do funil (fase de assinatura de contratos no Portfólio). Não é necessário contratar de forma independente — o processo é coordenado centralmente.

> **Dúvidas?** Abra um chamado no Sirene ou envie uma mensagem para o time Jurídico via Hub Fly.$faq$,
  keywords = ARRAY['carta fiança','seguro garantia','garantia terrenista','seven garantias','ls garantidora','instrumento garantidor','permuta garantia'],
  synonyms = ARRAY['garantia para o dono do terreno','seguro do terreno','proteção terrenista'],
  responsible_area = 'Jurídico'
WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Contratos e Garantias' LIMIT 1)
AND (
  question ILIKE '%Seguro Garantia Moní%'
  OR question = 'A Moní ainda utiliza Seguro Garantia? Qual é a garantia atual entregue ao terrenista?'
);

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Contratos e Garantias' LIMIT 1),
  'A Moní ainda utiliza Seguro Garantia? Qual é a garantia atual entregue ao terrenista?',
  'A Moní não utiliza mais Seguro Garantia. A garantia atual entregue ao terrenista é a Carta Fiança, contratada via Seven Garantias, LS Garantidora ou outra garantidora habilitada.',
  $faq$## Qual é a garantia atual entregue ao terrenista?

A Moní **não utiliza mais Seguro Garantia** como instrumento garantidor. Essa modalidade foi descontinuada.

### Instrumento atual: Carta Fiança

A garantia atualmente adotada é a **Carta Fiança Bancária** (ou equivalente emitida por garantidora), que funciona da seguinte forma:

- **O que é:** Documento emitido por uma instituição financeira ou garantidora que assegura ao terrenista o recebimento das unidades previstas no contrato, mesmo que o empreendimento não seja concluído.
- **Quem emite:** Garantidoras habilitadas parceiras da Moní — atualmente **Seven Garantias** e **LS Garantidora** são as indicadas.
- **Quando é entregue:** A Carta Fiança é entregue ao terrenista junto com o Instrumento de Permuta, na fase de assinatura do contrato.
- **Validade:** Cobre o período do contrato até a entrega das unidades permutadas.

### Por que mudou?

O Seguro Garantia na modalidade imobiliária apresentou limitações operacionais e foi descontinuado como solução padrão Moní. A Carta Fiança oferece maior solidez, liquidez e aceitação pelo mercado.

### Como contratar

O time Moní orientará o franqueado sobre o contato com a garantidora no momento oportuno do funil (fase de assinatura de contratos no Portfólio). Não é necessário contratar de forma independente — o processo é coordenado centralmente.

> **Dúvidas?** Abra um chamado no Sirene ou envie uma mensagem para o time Jurídico via Hub Fly.$faq$,
  'published', 99, 'Jurídico',
  ARRAY['carta fiança','seguro garantia','garantia terrenista','seven garantias','ls garantidora','instrumento garantidor','permuta garantia'],
  ARRAY['garantia para o dono do terreno','seguro do terreno','proteção terrenista'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Contratos e Garantias' LIMIT 1)
  AND (
    question ILIKE '%Seguro Garantia Moní%'
    OR question = 'A Moní ainda utiliza Seguro Garantia? Qual é a garantia atual entregue ao terrenista?'
  )
);

-- Artigo 2 revisado: Permuta — remover referência a "seguro garantia imobiliária"
UPDATE faq_articles SET
  short_answer = 'O terrenista recebe como garantia a Carta Fiança, um documento emitido por uma garantidora que assegura o recebimento das unidades mesmo que o empreendimento não seja concluído. É a proteção mais sólida disponível no mercado.',
  answer = $faq$## Como explicar de forma simples a segurança do terrenista?

O terrenista é o dono do terreno que aceita receber **unidades do empreendimento** (casas prontas) em vez de dinheiro imediato. Para ele ter segurança nessa troca, a Moní entrega um instrumento de garantia no momento da assinatura do contrato.

### O que é a Carta Fiança?

É um documento emitido por uma **garantidora** (ex.: Seven Garantias, LS Garantidora) que funciona como uma "fiança bancária":

- Se o empreendimento não for entregue, **a garantidora indeniza** o terrenista.
- É aceita como garantia sólida no mercado imobiliário.
- Tem validade durante todo o período do contrato.

### Argumento simples para o terrenista

> *"Você não está apostando no sucesso do projeto — você tem uma garantia formal emitida por uma empresa especializada. Se algo der errado, você é indenizado. Funciona como uma fiança: alguém está comprometido a honrar o acordo com você."*

### O que o terrenista assina?

1. **Instrumento de Permuta** — o contrato principal que descreve as unidades que receberá.
2. **Carta Fiança** — o documento de garantia emitido pela garantidora parceira da Moní.

### Pontos importantes

- A Carta Fiança é entregue simultaneamente ao contrato — não é prometida para depois.
- O custo da garantia é da operação Moní, não do terrenista.
- Dúvidas técnicas do terrenista podem ser encaminhadas ao time Jurídico via Sirene.

> **Lembre:** nunca prometa valores exatos de indenização sem consultar o Jurídico — cada contrato tem suas especificidades.$faq$,
  keywords = ARRAY['carta fiança','segurança terrenista','garantia permuta','seven garantias','instrumento garantidor','argumento terrenista'],
  synonyms = ARRAY['proteção do dono do terreno','garantia ao proprietário','fiança imobiliária'],
  responsible_area = 'Jurídico'
WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Permuta' LIMIT 1)
AND question ILIKE '%segurança do terrenista%';

INSERT INTO faq_articles (
  category_id, question, short_answer, answer,
  status, display_order, responsible_area, keywords, synonyms,
  is_featured, visibility, review_due_at
)
SELECT
  (SELECT id FROM faq_categories WHERE name = 'Permuta' LIMIT 1),
  'Como explicar de forma simples a segurança do terrenista no negócio?',
  'O terrenista recebe como garantia a Carta Fiança, um documento emitido por uma garantidora que assegura o recebimento das unidades mesmo que o empreendimento não seja concluído. É a proteção mais sólida disponível no mercado.',
  $faq$## Como explicar de forma simples a segurança do terrenista?

O terrenista é o dono do terreno que aceita receber **unidades do empreendimento** (casas prontas) em vez de dinheiro imediato. Para ele ter segurança nessa troca, a Moní entrega um instrumento de garantia no momento da assinatura do contrato.

### O que é a Carta Fiança?

É um documento emitido por uma **garantidora** (ex.: Seven Garantias, LS Garantidora) que funciona como uma "fiança bancária":

- Se o empreendimento não for entregue, **a garantidora indeniza** o terrenista.
- É aceita como garantia sólida no mercado imobiliário.
- Tem validade durante todo o período do contrato.

### Argumento simples para o terrenista

> *"Você não está apostando no sucesso do projeto — você tem uma garantia formal emitida por uma empresa especializada. Se algo der errado, você é indenizado. Funciona como uma fiança: alguém está comprometido a honrar o acordo com você."*

### O que o terrenista assina?

1. **Instrumento de Permuta** — o contrato principal que descreve as unidades que receberá.
2. **Carta Fiança** — o documento de garantia emitido pela garantidora parceira da Moní.

### Pontos importantes

- A Carta Fiança é entregue simultaneamente ao contrato — não é prometida para depois.
- O custo da garantia é da operação Moní, não do terrenista.
- Dúvidas técnicas do terrenista podem ser encaminhadas ao time Jurídico via Sirene.

> **Lembre:** nunca prometa valores exatos de indenização sem consultar o Jurídico — cada contrato tem suas especificidades.$faq$,
  'published', 99, 'Jurídico',
  ARRAY['carta fiança','segurança terrenista','garantia permuta','seven garantias','instrumento garantidor','argumento terrenista'],
  ARRAY['proteção do dono do terreno','garantia ao proprietário','fiança imobiliária'],
  false, ARRAY['frank','team','admin']::text[], '2027-09-18'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM faq_articles
  WHERE category_id = (SELECT id FROM faq_categories WHERE name = 'Permuta' LIMIT 1)
  AND question ILIKE '%segurança do terrenista%'
);


DROP TRIGGER IF EXISTS tr_faq_article_slug_if_null ON public.faq_articles;
DROP FUNCTION IF EXISTS public.faq_article_slug_if_null();

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('578', 'faq_conteudo_2026')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
