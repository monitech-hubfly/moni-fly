-- 453_faq_seed_conteudo.sql
-- Seed: 20 categorias da FAQ + migração do conteúdo (P&R) que vivia na casa "faq-franks" (uni_modulos).
-- Idempotente por slug. NÃO cria vínculo acadêmico (sem progresso/quiz/nota/conclusão).
-- Conteúdo preservado a partir do banco (103 perguntas).

-- 1) Categorias
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Casa Moní$n$, $s$casa-moni$s$, $i$Home$i$, 10, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Expansão e Franquia$n$, $s$expansao-e-franquia$s$, $i$TrendingUp$i$, 20, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Financeiro$n$, $s$financeiro$s$, $i$DollarSign$i$, 30, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Crédito e Financiamento$n$, $s$credito-e-financiamento$s$, $i$Landmark$i$, 40, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Produto e Catálogo$n$, $s$produto-e-catalogo$s$, $i$Package$i$, 50, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Fornecedores$n$, $s$fornecedores$s$, $i$Truck$i$, 60, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Terrenos$n$, $s$terrenos$s$, $i$MapPin$i$, 70, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Permuta$n$, $s$permuta$s$, $i$Repeat$i$, 80, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Contratos e Garantias$n$, $s$contratos-e-garantias$s$, $i$FileSignature$i$, 90, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Estrutura Jurídica$n$, $s$estrutura-juridica$s$, $i$Scale$i$, 100, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Step One$n$, $s$step-one$s$, $i$Flag$i$, 110, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Portfólio e Comitê$n$, $s$portfolio-e-comite$s$, $i$ClipboardList$i$, 120, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Operações$n$, $s$operacoes$s$, $i$Settings$i$, 130, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Aprovações e Pré-Obra$n$, $s$aprovacoes-e-pre-obra$s$, $i$Stamp$i$, 140, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Obra$n$, $s$obra$s$, $i$HardHat$i$, 150, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Venda e Imobiliária$n$, $s$venda-e-imobiliaria$s$, $i$Handshake$i$, 160, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Contabilidade e Fiscal$n$, $s$contabilidade-e-fiscal$s$, $i$Calculator$i$, 170, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Hub Fly$n$, $s$hub-fly$s$, $i$LayoutDashboard$i$, 180, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Universidade Moní$n$, $s$universidade-moni$s$, $i$GraduationCap$i$, 190, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;
insert into public.faq_categories (name, slug, icon, display_order, is_active) values ($n$Pós-venda e Moní Care$n$, $s$pos-venda-e-moni-care$s$, $i$LifeBuoy$i$, 200, true)
on conflict (slug) do update set name=excluded.name, icon=excluded.icon, display_order=excluded.display_order, is_active=true;

-- 2) Artigos (perguntas e respostas). category_id resolvido por slug da categoria.

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é a Moní?$q$, $sl$o-que-e-a-moni$sl$, $sh$A Moní é uma franqueadora de incorporação imobiliária residencial focada em condomínios fechados de alto padrão.$sh$, $ans$A Moní é uma franqueadora de incorporação imobiliária residencial focada em condomínios fechados de alto padrão. O modelo combina um produto padronizado (casas de 200–250m²) com uma estrutura financeira própria (crédito de terreno + crédito de obra) e uma plataforma de gestão (Hub Fly) para os Franqueados.$ans$,
  (select id from public.faq_categories where slug = $c$casa-moni$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é a proposta de valor da Moní para o Franqueado?$q$, $sl$qual-e-a-proposta-de-valor-da-moni-para-o-franqueado$sl$, $sh$A Moní entrega ao Franqueado: (1) produto validado e padronizado; (2) crédito de terreno e de obra sem garantias pessoais; (3) metodologia Step One para análise$sh$, $ans$A Moní entrega ao Franqueado: (1) produto validado e padronizado; (2) crédito de terreno e de obra sem garantias pessoais; (3) metodologia Step One para análise de viabilidade; (4) suporte jurídico, técnico e comercial da franqueadora; (5) plataforma Hub Fly para gestão do funil. O Frank entra com a operação local (terreno, relação com condomínio, construção e venda).$ans$,
  (select id from public.faq_categories where slug = $c$casa-moni$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quais são os diferenciais das casas Moní?$q$, $sl$quais-sao-os-diferenciais-das-casas-moni$sl$, $sh$As casas Moní são projetadas para condomínios fechados residenciais, com foco em alto padrão e construtibilidade rápida (~4 meses de obra).$sh$, $ans$As casas Moní são projetadas para condomínios fechados residenciais, com foco em alto padrão e construtibilidade rápida (~4 meses de obra). Os diferenciais do produto incluem: tipologias pré-aprovadas com projetos executivos prontos, catálogo com múltiplos modelos adaptáveis ao lote, acabamento de alto padrão, e processos de aprovação junto às prefeituras já mapeados pelo time técnico Moní.$ans$,
  (select id from public.faq_categories where slug = $c$casa-moni$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quais são os modelos de casas disponíveis no catálogo Moní?$q$, $sl$quais-sao-os-modelos-de-casas-disponiveis-no-catalogo-moni$sl$, $sh$O catálogo Moní conta com diversas tipologias — de casas compactas a modelos maiores com 4 suítes e área de lazer completa.$sh$, $ans$O catálogo Moní conta com diversas tipologias — de casas compactas a modelos maiores com 4 suítes e área de lazer completa. O Frank acessa o catálogo completo via Configurador Moní (moni-configurador.vercel.app, senha FKMONI) para simular custos por faixa e escolher o modelo mais adequado ao lote e ao perfil do comprador local.$ans$,
  (select id from public.faq_categories where slug = $c$casa-moni$c$), 'published', 40
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é o tamanho médio das casas Moní?$q$, $sl$qual-e-o-tamanho-medio-das-casas-moni$sl$, $sh$As tipologias do catálogo variam. Para saber o tamanho exato de cada modelo, acesse o Configurador Moní (moni-configurador.vercel.app).$sh$, $ans$As tipologias do catálogo variam. Para saber o tamanho exato de cada modelo, acesse o Configurador Moní (moni-configurador.vercel.app).$ans$,
  (select id from public.faq_categories where slug = $c$casa-moni$c$), 'published', 50
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$A Moní constrói apartamentos ou apenas casas?$q$, $sl$a-moni-constroi-apartamentos-ou-apenas-casas$sl$, $sh$Atualmente, o foco da Moní é exclusivamente em casas para condomínios fechados residenciais — não em apartamentos, loteamentos abertos ou edifícios.$sh$, $ans$Atualmente, o foco da Moní é exclusivamente em casas para condomínios fechados residenciais — não em apartamentos, loteamentos abertos ou edifícios.$ans$,
  (select id from public.faq_categories where slug = $c$casa-moni$c$), 'published', 60
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$A casa Moní pode ser construída em lote fora de condomínio fechado?$q$, $sl$a-casa-moni-pode-ser-construida-em-lote-fora-de-condominio-fechado$sl$, $sh$O modelo atual da Moní é voltado para condomínios fechados residenciais.$sh$, $ans$O modelo atual da Moní é voltado para condomínios fechados residenciais. Lotes fora de condomínio podem ser analisados caso a caso, mas não são o foco operacional. A análise de viabilidade (Step One) sempre considera o condomínio como critério de qualificação do lote.$ans$,
  (select id from public.faq_categories where slug = $c$casa-moni$c$), 'published', 70
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é a área mínima de lote para construir uma casa Moní?$q$, $sl$qual-e-a-area-minima-de-lote-para-construir-uma-casa-moni$sl$, $sh$Varia por tipologia. Consulte o Configurador Moní (moni-configurador.vercel.app) para ver os requisitos de lote de cada modelo (frente, fundo, área total e restrições de recuo).$sh$, $ans$Varia por tipologia. Consulte o Configurador Moní (moni-configurador.vercel.app) para ver os requisitos de lote de cada modelo (frente, fundo, área total e restrições de recuo).$ans$,
  (select id from public.faq_categories where slug = $c$casa-moni$c$), 'published', 80
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quem pode ser Franqueado Moní?$q$, $sl$quem-pode-ser-franqueado-moni$sl$, $sh$Pode ser Franqueado Moní qualquer pessoa física ou jurídica com perfil empreendedor, capital de giro para as despesas de setup (~R$85k por projeto), disponibili$sh$, $ans$Pode ser Franqueado Moní qualquer pessoa física ou jurídica com perfil empreendedor, capital de giro para as despesas de setup (~R$85k por projeto), disponibilidade para operar localmente (negociar terreno, acompanhar obra, coordenar venda) e disposição para seguir a metodologia da franqueadora. Não é necessário ter experiência prévia em incorporação — o modelo Moní é desenhado para quem quer entrar no mercado imobiliário com suporte estruturado.$ans$,
  (select id from public.faq_categories where slug = $c$expansao-e-franquia$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é o investimento inicial para ser Franqueado Moní?$q$, $sl$qual-e-o-investimento-inicial-para-ser-franqueado-moni$sl$, $sh$As despesas de setup por empreendimento são de aproximadamente R$85.000, conforme o BCA padrão.$sh$, $ans$As despesas de setup por empreendimento são de aproximadamente R$85.000, conforme o BCA padrão. Esse valor cobre: sondagem do solo, planialtimétrico, projetos (legal, executivo, estrutural), taxas de aprovação e ITBI. O crédito de terreno e de obra é fornecido pelo ecossistema Moní — o Frank não precisa aportar o valor total do projeto.$ans$,
  (select id from public.faq_categories where slug = $c$expansao-e-franquia$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Onde o Franqueado pode operar?$q$, $sl$onde-o-franqueado-pode-operar$sl$, $sh$Atualmente a Moní opera em condomínios fechados residenciais de médio e alto padrão, com foco em cidades com demanda comprovada por esse tipo de produto.$sh$, $ans$Atualmente a Moní opera em condomínios fechados residenciais de médio e alto padrão, com foco em cidades com demanda comprovada por esse tipo de produto. O Step One inclui análise de mapa de competidores e checklist de demanda para validar cada praça antes da aprovação no comitê.$ans$,
  (select id from public.faq_categories where slug = $c$expansao-e-franquia$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O Franqueado precisa morar na cidade onde vai operar?$q$, $sl$o-franqueado-precisa-morar-na-cidade-onde-vai-operar$sl$, $sh$Não é obrigatório morar na cidade, mas é necessário ter presença e capacidade de operação local — para negociar com o terrenista, acompanhar a aprovação no cond$sh$, $ans$Não é obrigatório morar na cidade, mas é necessário ter presença e capacidade de operação local — para negociar com o terrenista, acompanhar a aprovação no condomínio e prefeitura, contratar e fiscalizar a obra, e coordenar a venda com a imobiliária parceira.$ans$,
  (select id from public.faq_categories where slug = $c$expansao-e-franquia$c$), 'published', 40
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Posso ter mais de um empreendimento ao mesmo tempo?$q$, $sl$posso-ter-mais-de-um-empreendimento-ao-mesmo-tempo$sl$, $sh$Sim. O Frank pode conduzir múltiplos empreendimentos em paralelo, desde que cada um passe pelo Step One e seja aprovado no Comitê de Viabilidade.$sh$, $ans$Sim. O Frank pode conduzir múltiplos empreendimentos em paralelo, desde que cada um passe pelo Step One e seja aprovado no Comitê de Viabilidade. Cada empreendimento tem sua própria SPE. A capacidade operacional e financeira do Frank é avaliada pelo time Moní antes de aprovar novos projetos simultâneos.$ans$,
  (select id from public.faq_categories where slug = $c$expansao-e-franquia$c$), 'published', 50
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é o território exclusivo do Franqueado?$q$, $sl$qual-e-o-territorio-exclusivo-do-franqueado$sl$, $sh$O modelo Moní não tem exclusividade territorial rígida por CEP ou município — a exclusividade é por empreendimento (lote aprovado).$sh$, $ans$O modelo Moní não tem exclusividade territorial rígida por CEP ou município — a exclusividade é por empreendimento (lote aprovado). Isso significa que outro Frank pode operar na mesma cidade, mas não no mesmo projeto. A análise de sobreposição é feita pelo time de expansão durante o Step One.$ans$,
  (select id from public.faq_categories where slug = $c$expansao-e-franquia$c$), 'published', 60
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$A Moní tem taxa de royalties?$q$, $sl$a-moni-tem-taxa-de-royalties$sl$, $sh$Sim. Os detalhes sobre royalties, taxa de franquia e estrutura financeira da COF (Circular de Oferta de Franquia) são apresentados durante o processo de expansão.$sh$, $ans$Sim. Os detalhes sobre royalties, taxa de franquia e estrutura financeira da COF (Circular de Oferta de Franquia) são apresentados durante o processo de expansão. Consulte o time de expansão Moní para informações atualizadas.$ans$,
  (select id from public.faq_categories where slug = $c$expansao-e-franquia$c$), 'published', 70
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quanto tempo leva do Step One até a entrega da casa?$q$, $sl$quanto-tempo-leva-do-step-one-ate-a-entrega-da-casa$sl$, $sh$O cronograma estimado é: Step One (4–8 semanas) → Comitê → negociação e contrato do lote (4–8 semanas) → diligência e escritura (até 90 dias) → aprovação de pro$sh$, $ans$O cronograma estimado é: Step One (4–8 semanas) → Comitê → negociação e contrato do lote (4–8 semanas) → diligência e escritura (até 90 dias) → aprovação de projeto (variável por condomínio/prefeitura) → obra (4–6 meses) → venda. O prazo total médio da aprovação no comitê até a entrega da chave é de 12 a 18 meses, dependendo da praça.$ans$,
  (select id from public.faq_categories where slug = $c$expansao-e-franquia$c$), 'published', 80
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é o Hub Fly e como o Frank acessa?$q$, $sl$o-que-e-o-hub-fly-e-como-o-frank-acessa$sl$, $sh$O Hub Fly é a plataforma interna da Moní para gestão do franqueado: funis Kanban (Step One, Portfólio, Acoplamento, Operações, Crédito), Universidade Moní, Sire$sh$, $ans$O Hub Fly é a plataforma interna da Moní para gestão do franqueado: funis Kanban (Step One, Portfólio, Acoplamento, Operações, Crédito), Universidade Moní, Sirene (chamados) e canal jurídico. O Frank acessa via web (URL fornecida pela Moní) com login e senha criados pelo time. O Hub Fly é o principal canal de comunicação operacional entre o Frank e a franqueadora.$ans$,
  (select id from public.faq_categories where slug = $c$expansao-e-franquia$c$), 'published', 90
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Como funciona o modelo financeiro da Moní?$q$, $sl$como-funciona-o-modelo-financeiro-da-moni$sl$, $sh$O modelo financeiro Moní funciona com três camadas: (1) Capital do Frank (despesas de setup ~R$85k); (2) Crédito de terreno — financiado pelo ecossistema Moní v$sh$, $ans$O modelo financeiro Moní funciona com três camadas: (1) Capital do Frank (despesas de setup ~R$85k); (2) Crédito de terreno — financiado pelo ecossistema Moní via SPE, sem garantia pessoal do Frank; (3) Crédito de obra — liberado em tranches conforme o avanço da construção. O retorno do Frank vem da diferença entre o VGV da venda e todos os custos (terreno + obra + setup + corretagem + tributos).$ans$,
  (select id from public.faq_categories where slug = $c$financeiro$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é a rentabilidade esperada por projeto?$q$, $sl$qual-e-a-rentabilidade-esperada-por-projeto$sl$, $sh$O BCA (Business Case Analysis) calcula a rentabilidade em 3 cenários: Target (margem ≥ 10% do VGV, venda entre meses 6–10), Planta (venda no mês 6, margem menor$sh$, $ans$O BCA (Business Case Analysis) calcula a rentabilidade em 3 cenários: Target (margem ≥ 10% do VGV, venda entre meses 6–10), Planta (venda no mês 6, margem menor) e Liquidação (venda com desconto após mês 10, piso de 0% de margem). O cenário Target representa o objetivo da operação. Os valores exatos variam por projeto, praça e modelo de casa — consulte o BCA do seu projeto.$ans$,
  (select id from public.faq_categories where slug = $c$financeiro$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quais são as despesas de setup de um projeto Moní?$q$, $sl$quais-sao-as-despesas-de-setup-de-um-projeto-moni$sl$, $sh$As despesas de setup estimadas no BCA padrão somam ~R$85.000 por projeto, e incluem: sondagem do solo, planialtimétrico, projeto legal (arquitetônico + estrutur$sh$, $ans$As despesas de setup estimadas no BCA padrão somam ~R$85.000 por projeto, e incluem: sondagem do solo, planialtimétrico, projeto legal (arquitetônico + estrutural), taxas de aprovação em condomínio e prefeitura, ITBI (4% do valor do terreno), custas cartoriais, e outros custos pré-obra. Esse é o capital mínimo que o Frank precisa aportar para iniciar um projeto.$ans$,
  (select id from public.faq_categories where slug = $c$financeiro$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é a taxa de juros do crédito Moní (CET)?$q$, $sl$qual-e-a-taxa-de-juros-do-credito-moni-cet$sl$, $sh$O Custo Efetivo Total (CET) do crédito Moní é de 2,1% ao mês (~28,3% ao ano).$sh$, $ans$O Custo Efetivo Total (CET) do crédito Moní é de 2,1% ao mês (~28,3% ao ano). Essa taxa já está embutida no BCA como custo financeiro do projeto.$ans$,
  (select id from public.faq_categories where slug = $c$financeiro$c$), 'published', 40
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Como é calculado o lucro do Frank?$q$, $sl$como-e-calculado-o-lucro-do-frank$sl$, $sh$Lucro do Frank = VGV Líquido − Custo do Terreno − Custo de Obra − Despesas de Setup − Custos Financeiros (CET).$sh$, $ans$Lucro do Frank = VGV Líquido − Custo do Terreno − Custo de Obra − Despesas de Setup − Custos Financeiros (CET). O VGV Líquido é o VGV bruto deduzido de corretagem (6%) e tributos (Simples/Lucro Presumido/RET). O BCA do projeto calcula o resultado esperado nos 3 cenários.$ans$,
  (select id from public.faq_categories where slug = $c$financeiro$c$), 'published', 50
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O Frank precisa ter dinheiro para pagar o terreno?$q$, $sl$o-frank-precisa-ter-dinheiro-para-pagar-o-terreno$sl$, $sh$Na permuta (modelo padrão), o Frank não paga o terreno à vista — o terrenista recebe um % do VGV na venda.$sh$, $ans$Na permuta (modelo padrão), o Frank não paga o terreno à vista — o terrenista recebe um % do VGV na venda. O Frank precisa apenas do capital de setup (~R$85k). Na compra e venda com pagamento futuro, o terreno é pago na venda (sem desembolso imediato, mas com custo financeiro). Na compra parcial, há um sinal de ~30% na assinatura.$ans$,
  (select id from public.faq_categories where slug = $c$financeiro$c$), 'published', 60
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quando e como o Frank recebe seu lucro?$q$, $sl$quando-e-como-o-frank-recebe-seu-lucro$sl$, $sh$O Frank recebe o lucro após a venda da casa e liquidação de todos os custos e financiamentos da SPE.$sh$, $ans$O Frank recebe o lucro após a venda da casa e liquidação de todos os custos e financiamentos da SPE. A distribuição ocorre via SPE: VGV recebido → quitar crédito de obra + juros → quitar crédito de terreno + juros → pagar corretagem e tributos → pagar terrenista → saldo restante é lucro do Frank. O prazo típico da aprovação no comitê até o recebimento do lucro é de 12 a 18 meses.$ans$,
  (select id from public.faq_categories where slug = $c$financeiro$c$), 'published', 70
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que acontece financeiramente se a casa não vender no prazo?$q$, $sl$o-que-acontece-financeiramente-se-a-casa-nao-vender-no-prazo$sl$, $sh$Se a casa não for vendida dentro do prazo (24 meses do Contrato de Opção), a Moní pode exercer a opção de recompra das quotas da SPE (entre o 8º e 12º mês).$sh$, $ans$Se a casa não for vendida dentro do prazo (24 meses do Contrato de Opção), a Moní pode exercer a opção de recompra das quotas da SPE (entre o 8º e 12º mês). Nesse cenário, a Moní assume o controle da SPE para liquidar os ativos, pagar os credores e o terrenista. O BCA do cenário Liquidação (com desconto de 10%) deve fechar com margem ≥ 0% para que o projeto seja aprovado no comitê — garantindo que, no pior caso, não há prejuízo.$ans$,
  (select id from public.faq_categories where slug = $c$financeiro$c$), 'published', 80
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Posso usar recursos próprios no lugar do crédito Moní?$q$, $sl$posso-usar-recursos-proprios-no-lugar-do-credito-moni$sl$, $sh$A estrutura de crédito Moní (terreno + obra via SPE) é parte integrante do modelo de franquia.$sh$, $ans$A estrutura de crédito Moní (terreno + obra via SPE) é parte integrante do modelo de franquia. Financiamentos alternativos podem ser analisados caso a caso, mas devem ser compatíveis com a estrutura jurídica da SPE e aprovados pelo time financeiro da Moní antes de qualquer contratação.$ans$,
  (select id from public.faq_categories where slug = $c$financeiro$c$), 'published', 90
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Como funciona o crédito de terreno na Moní?$q$, $sl$como-funciona-o-credito-de-terreno-na-moni$sl$, $sh$O crédito de terreno é disponibilizado pelo ecossistema de funding da Moní para que a SPE adquira o terreno sem que o Frank precise de capital próprio para essa finalidade.$sh$, $ans$O crédito de terreno é disponibilizado pelo ecossistema de funding da Moní para que a SPE adquira o terreno sem que o Frank precise de capital próprio para essa finalidade. A garantia é o próprio terreno (via alienação fiduciária ou hipoteca sobre o imóvel da SPE) e a opção irrevogável de compra das quotas da SPE que o Frank outorga à Moní. O Frank não assina como fiador ou avalista pessoal.$ans$,
  (select id from public.faq_categories where slug = $c$credito-e-financiamento$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Como funciona o crédito de obra na Moní?$q$, $sl$como-funciona-o-credito-de-obra-na-moni$sl$, $sh$O crédito de obra é liberado em tranches conforme o cronograma físico da construção, verificado pelo time técnico da Moní via Hub Fly (funil Operações).$sh$, $ans$O crédito de obra é liberado em tranches conforme o cronograma físico da construção, verificado pelo time técnico da Moní via Hub Fly (funil Operações). Cada tranche exige comprovação do avanço (fotos, medições, relatório técnico) e nota fiscal dos fornecedores. O dinheiro é desembolsado via conta da SPE ou conta escrow da franqueadora, diretamente para os fornecedores homologados.$ans$,
  (select id from public.faq_categories where slug = $c$credito-e-financiamento$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O Frank precisa dar garantias pessoais para o crédito?$q$, $sl$o-frank-precisa-dar-garantias-pessoais-para-o-credito$sl$, $sh$Não. A estrutura Moní é desenhada para que o Frank não precise oferecer garantias pessoais (imóvel próprio, fiador, aval).$sh$, $ans$Não. A estrutura Moní é desenhada para que o Frank não precise oferecer garantias pessoais (imóvel próprio, fiador, aval). As garantias são estruturais: o terreno da SPE (colateral real) e a opção de compra das quotas da SPE em favor da Moní. Isso é um diferencial central do modelo.$ans$,
  (select id from public.faq_categories where slug = $c$credito-e-financiamento$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é a ordem de aprovação para liberar o crédito de terreno?$q$, $sl$qual-e-a-ordem-de-aprovacao-para-liberar-o-credito-de-terreno$sl$, $sh$A sequência é: (1) aprovação no Comitê de Viabilidade Moní; (2) assinatura do Contrato de Opção com o terrenista; (3) diligência do terreno (matrícula, certidõe$sh$, $ans$A sequência é: (1) aprovação no Comitê de Viabilidade Moní; (2) assinatura do Contrato de Opção com o terrenista; (3) diligência do terreno (matrícula, certidões, análise jurídica); (4) aprovação pelo parceiro de crédito; (5) assinatura do Contrato Definitivo de Permuta; (6) lavratura da escritura e registro no CRI; (7) liberação do crédito de terreno para a SPE. Nenhuma etapa pode ser pulada.$ans$,
  (select id from public.faq_categories where slug = $c$credito-e-financiamento$c$), 'published', 40
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é a conta escrow e como funciona?$q$, $sl$o-que-e-a-conta-escrow-e-como-funciona$sl$, $sh$A conta escrow é uma conta vinculada, bloqueada para uso exclusivo no projeto.$sh$, $ans$A conta escrow é uma conta vinculada, bloqueada para uso exclusivo no projeto. Na estrutura Moní, ela é utilizada para garantir que os recursos de crédito de obra sejam aplicados exclusivamente nos fornecedores do projeto, mediante apresentação de notas fiscais. A Moní ou o parceiro de crédito tem co-gestão da conta para autorizar desembolsos. Isso protege o credor, o terrenista e o próprio Frank de desvios.$ans$,
  (select id from public.faq_categories where slug = $c$credito-e-financiamento$c$), 'published', 50
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Posso usar financiamento bancário (CEF, BB, etc.) no lugar do crédito Moní?$q$, $sl$posso-usar-financiamento-bancario-cef-bb-etc-no-lugar-do-credito-moni$sl$, $sh$O crédito Moní é o produto padrão do modelo de franquia.$sh$, $ans$O crédito Moní é o produto padrão do modelo de franquia. Financiamentos bancários convencionais podem ter condições diferentes (prazo, garantias, aprovação) e nem sempre são compatíveis com a estrutura da SPE e os prazos do projeto. Qualquer alternativa deve ser discutida previamente com o time financeiro da Moní e aprovada antes de qualquer contratação.$ans$,
  (select id from public.faq_categories where slug = $c$credito-e-financiamento$c$), 'published', 60
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quantos modelos de casas existem no catálogo Moní?$q$, $sl$quantos-modelos-de-casas-existem-no-catalogo-moni$sl$, $sh$O catálogo Moní conta com diversas tipologias de casas.$sh$, $ans$O catálogo Moní conta com diversas tipologias de casas. Para ver todos os modelos disponíveis, acesse o Configurador Moní (moni-configurador.vercel.app, senha FKMONI). O catálogo é atualizado periodicamente com novos produtos.$ans$,
  (select id from public.faq_categories where slug = $c$produto-e-catalogo$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Como escolho o modelo de casa certo para um lote?$q$, $sl$como-escolho-o-modelo-de-casa-certo-para-um-lote$sl$, $sh$A escolha do modelo usa a Batalha de Casas: metodologia que avalia até 3 tipologias por 3 eixos — Atributos do Lote (orientação, dimensões, recuos), Preço (chec$sh$, $ans$A escolha do modelo usa a Batalha de Casas: metodologia que avalia até 3 tipologias por 3 eixos — Atributos do Lote (orientação, dimensões, recuos), Preço (checklist de reformas e adaptações) e Produto (7 critérios de adequação ao mercado local). A escala é de −3 a +2 por critério. Em empate, prevalece: Lote > Preço > Produto. O modelo com maior pontuação vai ao BCA.$ans$,
  (select id from public.faq_categories where slug = $c$produto-e-catalogo$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$É possível customizar a casa para o comprador?$q$, $sl$e-possivel-customizar-a-casa-para-o-comprador$sl$, $sh$As tipologias do catálogo têm projetos executivos padronizados para garantir prazo e custo de obra.$sh$, $ans$As tipologias do catálogo têm projetos executivos padronizados para garantir prazo e custo de obra. Customizações pontuais podem ser possíveis dependendo da etapa da obra e das opções pré-definidas pela Moní — a depender da etapa de obra e das opções de customização pré-estabelecidas pela Franqueadora.$ans$,
  (select id from public.faq_categories where slug = $c$produto-e-catalogo$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$A Moní tem projetos executivos prontos?$q$, $sl$a-moni-tem-projetos-executivos-prontos$sl$, $sh$Sim. Um dos diferenciais do modelo é que os projetos executivos (arquitetônico, estrutural, instalações) já estão desenvolvidos para cada tipologia do catálogo.$sh$, $ans$Sim. Um dos diferenciais do modelo é que os projetos executivos (arquitetônico, estrutural, instalações) já estão desenvolvidos para cada tipologia do catálogo. Isso reduz o tempo e custo de projeto para o Frank e agiliza o processo de aprovação na prefeitura.$ans$,
  (select id from public.faq_categories where slug = $c$produto-e-catalogo$c$), 'published', 40
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Como acesso o Configurador Moní?$q$, $sl$como-acesso-o-configurador-moni$sl$, $sh$Acesse moni-configurador.vercel.app — senha: FKMONI.$sh$, $ans$Acesse moni-configurador.vercel.app — senha: FKMONI. No Configurador você encontra todos os modelos do catálogo, seus requisitos de lote e o custo por faixa de cada tipologia. O PDF gerado pelo Configurador é o insumo principal para o BCA.$ans$,
  (select id from public.faq_categories where slug = $c$produto-e-catalogo$c$), 'published', 50
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é o prazo de construção de uma casa Moní?$q$, $sl$qual-e-o-prazo-de-construcao-de-uma-casa-moni$sl$, $sh$O cronograma padrão de obra é de 4 meses.$sh$, $ans$O cronograma padrão de obra é de 4 meses. Em casos excepcionais (complexidade do lote, fornecedores, aprovações), pode se estender até 6 meses.$ans$,
  (select id from public.faq_categories where slug = $c$produto-e-catalogo$c$), 'published', 60
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$A Moní faz manutenção pós-obra?$q$, $sl$a-moni-faz-manutencao-pos-obra$sl$, $sh$A estrutura de pós-obra e garantias da casa é definida pela Moní e descrita nos documentos da franquia.$sh$, $ans$A estrutura de pós-obra e garantias da casa é definida pela Moní e descrita nos documentos da franquia. Consulte o time técnico para detalhes sobre o protocolo de entrega, vistoria e assistência técnica após a conclusão da obra.$ans$,
  (select id from public.faq_categories where slug = $c$produto-e-catalogo$c$), 'published', 70
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é o One Pager e quando usar?$q$, $sl$o-que-e-o-one-pager-e-quando-usar$sl$, $sh$O One Pager é um material de apresentação resumido do produto/empreendimento, usado para prospecção inicial com terrenistas e imobiliárias.$sh$, $ans$O One Pager é um material de apresentação resumido do produto/empreendimento, usado para prospecção inicial com terrenistas e imobiliárias. Importante: o One Pager não substitui o configurador oficial como referência de preço — para negociações e BCA, sempre use os valores do Configurador Moní atualizado.$ans$,
  (select id from public.faq_categories where slug = $c$produto-e-catalogo$c$), 'published', 80
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Todos os fornecedores de produtos e serviços são Homologados Moní?$q$, $sl$todos-os-fornecedores-de-produtos-e-servicos-sao-homologados-moni$sl$, $sh$A Moní estabelece ao Franqueado Fornecedores Homologados Obrigatórios (Loja Moní) para alguns produtos e serviços.$sh$, $ans$A Moní estabelece ao Franqueado Fornecedores Homologados Obrigatórios (Loja Moní) para alguns produtos e serviços. Há também Fornecedores Homologados Não-Obrigatórios, que ficam a critério do Franqueado contratar ou não. E por fim, há Fornecedores Não-Homologados, de responsabilidade do Franqueado. Todos são descritos durante a apresentação da Franqueadora e Operação.$ans$,
  (select id from public.faq_categories where slug = $c$fornecedores$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$A Moní indica fornecedores?$q$, $sl$a-moni-indica-fornecedores$sl$, $sh$Fornecedores Não-Homologados não são indicados pela Moní.$sh$, $ans$Fornecedores Não-Homologados não são indicados pela Moní.$ans$,
  (select id from public.faq_categories where slug = $c$fornecedores$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$É obrigatório o uso de Fornecedores Homologados Moní?$q$, $sl$e-obrigatorio-o-uso-de-fornecedores-homologados-moni$sl$, $sh$Os fornecedores homologados são divididos em Obrigatórios e Não-Obrigatórios.$sh$, $ans$Os fornecedores homologados são divididos em Obrigatórios e Não-Obrigatórios. Todos são descritos durante a apresentação da Franqueadora e Operação.$ans$,
  (select id from public.faq_categories where slug = $c$fornecedores$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Como o Frank contrata Fornecedores Homologados Moní?$q$, $sl$como-o-frank-contrata-fornecedores-homologados-moni$sl$, $sh$A Moní descreve ao Frank o processo de contratação de cada Fornecedor, a depender da etapa em que o Franqueado esteja.$sh$, $ans$A Moní descreve ao Frank o processo de contratação de cada Fornecedor, a depender da etapa em que o Franqueado esteja.$ans$,
  (select id from public.faq_categories where slug = $c$fornecedores$c$), 'published', 40
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quem é o colateral na permuta?$q$, $sl$quem-e-o-colateral-na-permuta$sl$, $sh$Na permuta, o colateral para o crédito de terreno é o próprio terreno (dado em garantia ao credor).$sh$, $ans$Na permuta, o colateral para o crédito de terreno é o próprio terreno (dado em garantia ao credor). A SPE — que detém o terreno — dá o imóvel como garantia do financiamento de obra. Adicionalmente, a Moní detém uma opção irrevogável de compra das quotas da SPE como garantia de última instância ao credor. O terrenista, por sua vez, tem seu retorno garantido por um piso (Valor Base corrigido pelo IPCA).$ans$,
  (select id from public.faq_categories where slug = $c$permuta$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quem precisa ser fiador na permuta?$q$, $sl$quem-precisa-ser-fiador-na-permuta$sl$, $sh$Na estrutura Moní, não há exigência de fiador pessoal do Frank na permuta.$sh$, $ans$Na estrutura Moní, não há exigência de fiador pessoal do Frank na permuta. As garantias são estruturais: o terreno (colateral real), a SPE e a opção de compra das quotas em favor da Moní. O Frank não assina como fiador — ele é o incorporador. O risco pessoal do Frank é limitado à sua participação societária na SPE.$ans$,
  (select id from public.faq_categories where slug = $c$permuta$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O terrenista recebe em 24 meses?$q$, $sl$o-terrenista-recebe-em-24-meses$sl$, $sh$O prazo de 24 meses a partir da assinatura do Contrato de Opção é o teto da operação.$sh$, $ans$O prazo de 24 meses a partir da assinatura do Contrato de Opção é o teto da operação. O cronograma real pode variar por fatores que nenhuma das partes controla (prefeitura, condomínio, parceiros de crédito, cartórios). Por isso, a proposta ao terrenista deve apresentar um piso e um teto de tempo como cenário garantido. Caso a casa seja vendida antes dos 24 meses, o pagamento ocorre na data da venda.$ans$,
  (select id from public.faq_categories where slug = $c$permuta$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Como preencher o campo de título aquisitivo no contrato de permuta?$q$, $sl$como-preencher-o-campo-de-titulo-aquisitivo-no-contrato-de-permuta$sl$, $sh$Título aquisitivo é o documento legal que comprova a aquisição da propriedade do imóvel, registrado no Cartório de Registro de Imóveis.$sh$, $ans$Título aquisitivo é o documento legal que comprova a aquisição da propriedade do imóvel, registrado no Cartório de Registro de Imóveis. Exemplos: escritura pública de compra e venda registrada; formal de partilha (herança ou divórcio); carta de arrematação (leilão judicial); doação com escritura pública; usucapião; instrumento particular de cessão de direitos. Exemplo de preenchimento: 'O imóvel foi adquirido pelo vendedor nos termos da escritura pública de compra e venda lavrada em [data], registrada sob o nº [matrícula] no Cartório de Registro de Imóveis de [cidade/UF].'$ans$,
  (select id from public.faq_categories where slug = $c$permuta$c$), 'published', 40
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quais documentos o Frank deve pedir ao terrenista para o contrato de opção e permuta padrão Moní?$q$, $sl$quais-documentos-o-frank-deve-pedir-ao-terrenista-para-o-contrato-de-o$sl$, $sh$Documentos obrigatórios a solicitar ao terrenista: - Cópia dos documentos dos proprietários: RG, CPF, comprovante de endereço, certidão de casamento ou nascimen$sh$, $ans$Documentos obrigatórios a solicitar ao terrenista:
- Cópia dos documentos dos proprietários: RG, CPF, comprovante de endereço, certidão de casamento ou nascimento
- CNPJ do proprietário, se houver
- Cópia da matrícula do imóvel + carta de cessão de posse
- Número de inscrição de IPTU
- Declaração negativa de débitos condominiais
- Profissão do proprietário$ans$,
  (select id from public.faq_categories where slug = $c$permuta$c$), 'published', 50
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Como explicar de forma simples a segurança do terrenista em transferir a posse do terreno para a SPE?$q$, $sl$como-explicar-de-forma-simples-a-seguranca-do-terrenista-em-transferir$sl$, $sh$O terrenista está protegido por um Instrumento Garantidor (Carta Fiança ou seguro garantia imobiliária) que assegura o pagamento do valor mínimo garantido.$sh$, $ans$O terrenista está protegido por um Instrumento Garantidor (Carta Fiança ou seguro garantia imobiliária) que assegura o pagamento do valor mínimo garantido. Esse instrumento é apresentado em até 90 dias após a expedição do Alvará de Obra. Além disso, a Moní figura como Interveniente-Anuente no contrato, fiscalizando e garantindo o cumprimento das obrigações. Em caso de não venda dentro do prazo, a Moní possui opção de recompra das quotas da SPE para liquidar os ativos e pagar o terrenista.$ans$,
  (select id from public.faq_categories where slug = $c$permuta$c$), 'published', 60
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Como é pago o planialtimétrico e para que serve na permuta?$q$, $sl$como-e-pago-o-planialtimetrico-e-para-que-serve-na-permuta$sl$, $sh$O planialtimétrico é pago pelo Frank e entra nas despesas de setup do BCA (~R$85k globais).$sh$, $ans$O planialtimétrico é pago pelo Frank e entra nas despesas de setup do BCA (~R$85k globais). Na permuta, ele é necessário antes da assinatura do Contrato Definitivo para confirmar a viabilidade de implantação da casa escolhida no lote. Sem o planialtimétrico aprovado, o projeto legal não pode ser elaborado e a aprovação na prefeitura não avança.$ans$,
  (select id from public.faq_categories where slug = $c$permuta$c$), 'published', 70
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Como funciona o pagamento da corretagem no processo de permuta?$q$, $sl$como-funciona-o-pagamento-da-corretagem-no-processo-de-permuta$sl$, $sh$A comissão de corretagem é paga em duas etapas: 50% na assinatura do Contrato Definitivo de Permuta; 50% no registro da escritura pública no CRI (Cartório de Re$sh$, $ans$A comissão de corretagem é paga em duas etapas: 50% na assinatura do Contrato Definitivo de Permuta; 50% no registro da escritura pública no CRI (Cartório de Registro de Imóveis), condicionado ao efetivo registro e averbação. O valor total da corretagem é de responsabilidade do terrenista, conforme previsto nos contratos Moní. O percentual é negociado caso a caso, mas o modelo prevê até 6% do VGV (incluso nas despesas do BCA).$ans$,
  (select id from public.faq_categories where slug = $c$permuta$c$), 'published', 80
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quem paga o ITBI e quando?$q$, $sl$quem-paga-o-itbi-e-quando$sl$, $sh$O ITBI (Imposto sobre Transmissão de Bens Imóveis) é pago pelo Frank (SPE/adquirente) antes do registro da escritura pública no CRI.$sh$, $ans$O ITBI (Imposto sobre Transmissão de Bens Imóveis) é pago pelo Frank (SPE/adquirente) antes do registro da escritura pública no CRI. No BCA, o ITBI está incluído no custo do terreno como 4% sobre o Valor Base (pode variar por município). É uma das despesas de setup — pago no mesmo momento das custas cartoriais e necessário para a lavratura da escritura.$ans$,
  (select id from public.faq_categories where slug = $c$permuta$c$), 'published', 90
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é a averbação e quando é necessária?$q$, $sl$o-que-e-a-averbacao-e-quando-e-necessaria$sl$, $sh$Averbação é o ato de atualizar a matrícula do imóvel com novas informações: demolição de construção existente, início de obra, construção nova (Habite-se), alte$sh$, $ans$Averbação é o ato de atualizar a matrícula do imóvel com novas informações: demolição de construção existente, início de obra, construção nova (Habite-se), alterações de área, mudanças de proprietário etc. Na jornada Moní, as principais averbações são: (1) após escritura de transferência para a SPE (novo proprietário); (2) início de obra; (3) após Habite-se (averbação da construção nova). É feita no CRI e é necessária para regularizar o imóvel para venda.$ans$,
  (select id from public.faq_categories where slug = $c$permuta$c$), 'published', 100
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é a diferença entre Contrato de Opção e Contrato Definitivo de Permuta?$q$, $sl$qual-e-a-diferenca-entre-contrato-de-opcao-e-contrato-definitivo-de-pe$sl$, $sh$O Contrato de Opção dá ao Frank o direito (não obrigação) de adquirir o terreno, após aprovação no comitê.$sh$, $ans$O Contrato de Opção dá ao Frank o direito (não obrigação) de adquirir o terreno, após aprovação no comitê. O Contrato Definitivo formaliza a permuta ou compra e venda efetiva, com todas as cláusulas de pagamento, garantias e obrigações das partes. O prazo de 24 meses para pagamento ao terrenista é contado a partir do Contrato de Opção.$ans$,
  (select id from public.faq_categories where slug = $c$contratos-e-garantias$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é o Instrumento Garantidor e quando é apresentado?$q$, $sl$o-que-e-o-instrumento-garantidor-e-quando-e-apresentado$sl$, $sh$O Instrumento Garantidor é a garantia entregue ao terrenista de que ele receberá o valor mínimo acordado.$sh$, $ans$O Instrumento Garantidor é a garantia entregue ao terrenista de que ele receberá o valor mínimo acordado. Atualmente, a solução adotada é a Carta Fiança (via Seven, LS Garantidora ou equivalente). Ele deve ser apresentado em até 90 dias após a expedição do Alvará de Obra. Sem ele, a transferência de propriedade do terreno para a SPE não ocorre.$ans$,
  (select id from public.faq_categories where slug = $c$contratos-e-garantias$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é a multa por atraso no pagamento ao terrenista?$q$, $sl$qual-e-a-multa-por-atraso-no-pagamento-ao-terrenista$sl$, $sh$Sobre qualquer valor vencido e não pago incide: multa de 2% + juros moratórios de 1% ao mês, desde a data original do vencimento até a data do efetivo pagamento.$sh$, $ans$Sobre qualquer valor vencido e não pago incide: multa de 2% + juros moratórios de 1% ao mês, desde a data original do vencimento até a data do efetivo pagamento.$ans$,
  (select id from public.faq_categories where slug = $c$contratos-e-garantias$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é a multa se o terrenista desistir do negócio?$q$, $sl$qual-e-a-multa-se-o-terrenista-desistir-do-negocio$sl$, $sh$Na hipótese de rescisão unilateral imotivada pelo terrenista, ele fica obrigado a pagar ao Frank multa compensatória equivalente a 3% do Valor Base do Lote.$sh$, $ans$Na hipótese de rescisão unilateral imotivada pelo terrenista, ele fica obrigado a pagar ao Frank multa compensatória equivalente a 3% do Valor Base do Lote. Além disso, deve ressarcir todos os custos incorridos pelo Frank, acrescidos de multa de 10%.$ans$,
  (select id from public.faq_categories where slug = $c$contratos-e-garantias$c$), 'published', 40
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é a multa se o Frank desistir do negócio?$q$, $sl$qual-e-a-multa-se-o-frank-desistir-do-negocio$sl$, $sh$Na hipótese de desistência injustificada pelo Frank (Adquirente/Segundo Permutante), será devida multa ao terrenista equivalente a 3% do Valor Base do Lote.$sh$, $ans$Na hipótese de desistência injustificada pelo Frank (Adquirente/Segundo Permutante), será devida multa ao terrenista equivalente a 3% do Valor Base do Lote. O Frank também deve ressarcir o terrenista por eventuais custos incorridos, acrescidos de multa de 10%.$ans$,
  (select id from public.faq_categories where slug = $c$contratos-e-garantias$c$), 'published', 50
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quando as despesas do imóvel (IPTU, taxas condominiais) passam a ser responsabilidade da SPE?$q$, $sl$quando-as-despesas-do-imovel-iptu-taxas-condominiais-passam-a-ser-resp$sl$, $sh$A partir da lavratura da escritura pública que transfere a propriedade do Imóvel para a SPE, todas as despesas ordinárias e extraordinárias relativas ao imóvel $sh$, $ans$A partir da lavratura da escritura pública que transfere a propriedade do Imóvel para a SPE, todas as despesas ordinárias e extraordinárias relativas ao imóvel (IPTU, taxas condominiais etc.) passam a ser responsabilidade da SPE.$ans$,
  (select id from public.faq_categories where slug = $c$contratos-e-garantias$c$), 'published', 60
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Em quanto tempo deve ser lavrada a escritura pública após o Contrato Definitivo?$q$, $sl$em-quanto-tempo-deve-ser-lavrada-a-escritura-publica-apos-o-contrato-d$sl$, $sh$A transferência de propriedade do terreno para a SPE deve ser efetivada mediante lavratura de escritura pública em até 90 dias corridos após a assinatura do Con$sh$, $ans$A transferência de propriedade do terreno para a SPE deve ser efetivada mediante lavratura de escritura pública em até 90 dias corridos após a assinatura do Contrato Definitivo, condicionada à apresentação e formalização do instrumento garantidor.$ans$,
  (select id from public.faq_categories where slug = $c$contratos-e-garantias$c$), 'published', 70
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quem paga a comissão de corretagem na venda da casa?$q$, $sl$quem-paga-a-comissao-de-corretagem-na-venda-da-casa$sl$, $sh$A comissão de corretagem devida aos intermediadores é suportada integralmente pelo terrenista (nos contratos de permuta/compra), que reconhece sua responsabilid$sh$, $ans$A comissão de corretagem devida aos intermediadores é suportada integralmente pelo terrenista (nos contratos de permuta/compra), que reconhece sua responsabilidade pelo respectivo pagamento.$ans$,
  (select id from public.faq_categories where slug = $c$contratos-e-garantias$c$), 'published', 80
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Posso parcelar o pagamento ao terrenista mensalmente?$q$, $sl$posso-parcelar-o-pagamento-ao-terrenista-mensalmente$sl$, $sh$Não. O modelo padrão da Moní é: pagamento integral na venda da casa (dentro de 24 meses do Contrato de Opção).$sh$, $ans$Não. O modelo padrão da Moní é: pagamento integral na venda da casa (dentro de 24 meses do Contrato de Opção). Parcelamento mensal ao terrenista não é uma estrutura operacional do modelo. Caso tenha sido comunicado o contrário, a informação estava errada — o pagamento do saldo do terreno ocorre na venda da unidade, não em parcelas mensais.$ans$,
  (select id from public.faq_categories where slug = $c$contratos-e-garantias$c$), 'published', 90
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é a diferença entre Permuta Total (100% VGV), Compra e Venda com Pagamento Futuro e Compra Parcial?$q$, $sl$qual-e-a-diferenca-entre-permuta-total-100-vgv-compra-e-venda-com-paga$sl$, $sh$Os 3 modelos contratuais da Moní: 1. Permuta Total (100% VGV): o terrenista recebe um % do VGV Líquido na venda.$sh$, $ans$Os 3 modelos contratuais da Moní:
1. Permuta Total (100% VGV): o terrenista recebe um % do VGV Líquido na venda. Piso garantido = Valor Base do Lote corrigido pelo IPCA. Desembolso inicial zero.
2. Compra e Venda 100% com Pagamento Futuro: o terrenista recebe o Valor Base do Lote + remuneração equivalente a 15% a.a. sobre o saldo, pago na venda (máximo 24 meses).
3. Compra Parcial (30% à vista + 70% futuro): 30% do Valor Base pago na assinatura; 70% remanescente + 15% a.a. pago na venda (máximo 24 meses).$ans$,
  (select id from public.faq_categories where slug = $c$contratos-e-garantias$c$), 'published', 100
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Como funciona o Seguro Garantia Moní e quem contrato?$q$, $sl$como-funciona-o-seguro-garantia-moni-e-quem-contrato$sl$, $sh$O Seguro Garantia utilizado pela Moní é a Modalidade 20 — Financeira, registrada na SUSEP.$sh$, $ans$O Seguro Garantia utilizado pela Moní é a Modalidade 20 — Financeira, registrada na SUSEP. É contratado com corretor/seguradora SUSEP-habilitada. O contato indicado pela Moní é o corretor Sidinei, telefone (071) 8646-2164. O seguro é emitido para cobrir obrigações financeiras do projeto (garantia ao credor/terrenista) e deve ser formalizado em até 90 dias após a emissão do alvará de obra, conforme previsto no Contrato Definitivo.$ans$,
  (select id from public.faq_categories where slug = $c$contratos-e-garantias$c$), 'published', 110
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Na Compra e Venda com sinal, qual é a estrutura de pagamento?$q$, $sl$na-compra-e-venda-com-sinal-qual-e-a-estrutura-de-pagamento$sl$, $sh$Na Compra e Venda com sinal (modelo alternativo ao prazo): R$50.000 de sinal na assinatura do instrumento particular; o saldo restante do Valor Base é condicion$sh$, $ans$Na Compra e Venda com sinal (modelo alternativo ao prazo): R$50.000 de sinal na assinatura do instrumento particular; o saldo restante do Valor Base é condicionado à emissão do alvará de obra (janela de 90 a 120 dias). Após o pagamento do saldo, o processo segue para lavratura da escritura no cartório e registro no CRI. O prazo máximo total é de 24 meses a partir do Contrato de Opção.$ans$,
  (select id from public.faq_categories where slug = $c$contratos-e-garantias$c$), 'published', 120
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual deve ser a estrutura jurídica do Frank?$q$, $sl$qual-deve-ser-a-estrutura-juridica-do-frank$sl$, $sh$2 CNPJs (1 Empresa Incorporadora + 1 Empresa Gestora) + 1 SPE por empreendimento aprovado.$sh$, $ans$2 CNPJs (1 Empresa Incorporadora + 1 Empresa Gestora) + 1 SPE por empreendimento aprovado.$ans$,
  (select id from public.faq_categories where slug = $c$estrutura-juridica$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Por que são necessários 2 CNPJs? Um Incorporador e um Gestor?$q$, $sl$por-que-sao-necessarios-2-cnpjs-um-incorporador-e-um-gestor$sl$, $sh$Não é obrigatório abrir uma empresa Gestora, caso o Franqueado já tenha uma aberta ou caso contrate uma empresa para fazer a Gestão da Obra.$sh$, $ans$Não é obrigatório abrir uma empresa Gestora, caso o Franqueado já tenha uma aberta ou caso contrate uma empresa para fazer a Gestão da Obra.
- Se já tiver: a taxa de administração da obra será direcionada da SPE para a empresa gestora do Frank.
- Se contratar: a taxa de administração da obra será direcionada da SPE para o fornecedor contratado, de acordo com NF-e emitida por ele.$ans$,
  (select id from public.faq_categories where slug = $c$estrutura-juridica$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é SPE?$q$, $sl$o-que-e-spe$sl$, $sh$SPE, ou Sociedade de Propósito Específico, é uma empresa criada para um objetivo único e limitado, como uma incorporação.$sh$, $ans$SPE, ou Sociedade de Propósito Específico, é uma empresa criada para um objetivo único e limitado, como uma incorporação. Serve para concentrar recursos, compartilhar riscos e oferecer segurança jurídica — pois o patrimônio dos sócios fica protegido. A SPE é dissolvida após a conclusão do projeto, sendo comum no setor imobiliário.$ans$,
  (select id from public.faq_categories where slug = $c$estrutura-juridica$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é SCP (Sociedade em Conta de Participação)?$q$, $sl$o-que-e-scp-sociedade-em-conta-de-participacao$sl$, $sh$SCP (Sociedade em Conta de Participação) é uma estrutura societária onde existe um sócio ostensivo (que aparece publicamente no negócio) e um sócio participante (oculto).$sh$, $ans$SCP (Sociedade em Conta de Participação) é uma estrutura societária onde existe um sócio ostensivo (que aparece publicamente no negócio) e um sócio participante (oculto). Na construção imobiliária, é uma alternativa à SPE para estruturar o empreendimento com menor custo de abertura. No modelo atual da Moní, a estrutura padrão é a SPE — mas a SCP pode ser discutida como alternativa dependendo do projeto e do parceiro contábil.$ans$,
  (select id from public.faq_categories where slug = $c$estrutura-juridica$c$), 'published', 40
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é o Contrato de Outorga de Opção de Compra de Quotas da SPE?$q$, $sl$o-que-e-o-contrato-de-outorga-de-opcao-de-compra-de-quotas-da-spe$sl$, $sh$É um contrato pelo qual o Frank (via sua incorporadora) outorga à Moní o direito irrevogável e irretratável de adquirir 100% das quotas da SPE.$sh$, $ans$É um contrato pelo qual o Frank (via sua incorporadora) outorga à Moní o direito irrevogável e irretratável de adquirir 100% das quotas da SPE. Este direito existe como garantia ao ecossistema de crédito: caso o Frank não consiga vender a casa no prazo, a Moní pode assumir o controle da SPE para proteger os credores. O exercício da opção é possível entre o 8º e o 12º mês após a assinatura do contrato.$ans$,
  (select id from public.faq_categories where slug = $c$estrutura-juridica$c$), 'published', 50
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quando a Moní pode exercer a opção de compra das quotas da SPE?$q$, $sl$quando-a-moni-pode-exercer-a-opcao-de-compra-das-quotas-da-spe$sl$, $sh$A Moní pode exercer a Opção de Compra entre o 1º dia útil do 8º mês e o último dia útil do 12º mês, contados da data de assinatura do Contrato de Opção.$sh$, $ans$A Moní pode exercer a Opção de Compra entre o 1º dia útil do 8º mês e o último dia útil do 12º mês, contados da data de assinatura do Contrato de Opção. A notificação de exercício deve ser enviada por escrito à incorporadora, que tem 15 dias para transferir as quotas após o recebimento. O exercício pode ser total ou parcial.$ans$,
  (select id from public.faq_categories where slug = $c$estrutura-juridica$c$), 'published', 60
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Posso vender ou transferir minhas quotas da SPE durante o período da opção?$q$, $sl$posso-vender-ou-transferir-minhas-quotas-da-spe-durante-o-periodo-da-o$sl$, $sh$Não. Durante todo o Prazo de Exercício da Opção (até o 12º mês), é expressamente vedado ao Frank alienar, transferir, onerar ou prometer vender as quotas da SPE$sh$, $ans$Não. Durante todo o Prazo de Exercício da Opção (até o 12º mês), é expressamente vedado ao Frank alienar, transferir, onerar ou prometer vender as quotas da SPE sem prévia autorização escrita da Moní. Qualquer violação desta cláusula sujeita o Frank ao pagamento de perdas e danos. A única exceção é a cessão de quotas decorrente da execução de garantia de contrato de financiamento da obra.$ans$,
  (select id from public.faq_categories where slug = $c$estrutura-juridica$c$), 'published', 70
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Por que a Moní exige uma opção de compra das quotas da SPE como garantia?$q$, $sl$por-que-a-moni-exige-uma-opcao-de-compra-das-quotas-da-spe-como-garant$sl$, $sh$A opção de compra das quotas é a garantia de última instância para os credores do projeto (funding terreno + obra).$sh$, $ans$A opção de compra das quotas é a garantia de última instância para os credores do projeto (funding terreno + obra). Se o Frank não conseguir vender a casa no prazo e honrar as dívidas, a Moní pode assumir o controle da SPE para liquidar os ativos e pagar os credores. Do ponto de vista do Frank, a opção não é uma ameaça — é o que viabiliza o acesso ao crédito sem precisar de garantias pessoais (imóvel próprio, fiador). O objetivo é que a opção nunca precise ser exercida.$ans$,
  (select id from public.faq_categories where slug = $c$estrutura-juridica$c$), 'published', 80
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é o Step One e por que é obrigatório?$q$, $sl$o-que-e-o-step-one-e-por-que-e-obrigatorio$sl$, $sh$O Step One é o processo de viabilidade do franqueado.$sh$, $ans$O Step One é o processo de viabilidade do franqueado. Ele é obrigatório porque garante que cada hipótese de negócio seja bem estudada antes de ir ao comitê. O processo tem 6 eixos principais: Mapa de Competidores, Resultado, Lotes, Check de Demanda, Valor × Giro e Hipótese. Somente hipóteses que passam pelo Step One avançam para o Funil Portfólio.$ans$,
  (select id from public.faq_categories where slug = $c$step-one$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é o BCA (Business Case Analysis)?$q$, $sl$o-que-e-o-bca-business-case-analysis$sl$, $sh$O BCA é a análise de viabilidade financeira de um empreendimento.$sh$, $ans$O BCA é a análise de viabilidade financeira de um empreendimento. Ele calcula 3 cenários: Planta (venda no mês 6), Target (%VGV ≥ 10%) e Liquidação (mês 10+ com desconto). A ordem de montagem é: começar pelo VGV Target → definir o terreno → escolher a casa no configurador → inserir inputs negativos → verificar se a TIR do terrenista é ≥ 3× CDI.$ans$,
  (select id from public.faq_categories where slug = $c$step-one$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é a Batalha de Casas?$q$, $sl$o-que-e-a-batalha-de-casas$sl$, $sh$A Batalha de Casas é uma metodologia de ranqueamento que avalia até 3 modelos Moní por 3 eixos: Atributos do Lote, Preço (checklist de reforma) e Produto (7 critérios).$sh$, $ans$A Batalha de Casas é uma metodologia de ranqueamento que avalia até 3 modelos Moní por 3 eixos: Atributos do Lote, Preço (checklist de reforma) e Produto (7 critérios). A escala vai de −3 a +2. Em caso de empate, prevalece: Lote > Preço > Produto. O resultado indica qual casa tem mais chance de venda naquele lote específico.$ans$,
  (select id from public.faq_categories where slug = $c$step-one$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é o Configurador Moní e como acesso?$q$, $sl$o-que-e-o-configurador-moni-e-como-acesso$sl$, $sh$O Configurador Moní é a ferramenta online para escolher e precificar as casas do catálogo.$sh$, $ans$O Configurador Moní é a ferramenta online para escolher e precificar as casas do catálogo. Acesso: moni-configurador.vercel.app — senha: FKMONI. A partir dele o Frank gera o PDF com o custo por faixa de cada modelo, insumo indispensável para o BCA.$ans$,
  (select id from public.faq_categories where slug = $c$step-one$c$), 'published', 40
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é VGV e como é calculado?$q$, $sl$o-que-e-vgv-e-como-e-calculado$sl$, $sh$VGV (Valor Geral de Vendas) é o valor total pela venda da unidade construída.$sh$, $ans$VGV (Valor Geral de Vendas) é o valor total pela venda da unidade construída. Existem 3 referências de VGV: Target (valor ideal com margem mínima de 10%), Planta (valor esperado na venda ainda em construção, mês 6) e Liquidação (valor em cenário de venda forçada com desconto, após mês 10). O VGV Líquido é o valor efetivamente recebido, deduzidos corretagem e tributos.$ans$,
  (select id from public.faq_categories where slug = $c$step-one$c$), 'published', 50
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quais são os 3 modelos de negócio para aquisição do terreno?$q$, $sl$quais-sao-os-3-modelos-de-negocio-para-aquisicao-do-terreno$sl$, $sh$1. Permuta Total: desembolso inicial zero; o terrenista recebe % do VGV na venda.$sh$, $ans$1. Permuta Total: desembolso inicial zero; o terrenista recebe % do VGV na venda. Atenção: 30% do lote ≠ 30% do VGV. A TIR do terrenista deve ser ≥ 3× CDI.
2. Permuta Parcial: sinal em dinheiro (~30% do lote) + percentual menor do VGV na venda.
3. Compra e Venda: a SPE compra o lote integralmente; recomendado apenas com lote abaixo do mercado e liquidez comprovada.$ans$,
  (select id from public.faq_categories where slug = $c$step-one$c$), 'published', 60
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que precisa estar pronto antes do Comitê de Viabilidade?$q$, $sl$o-que-precisa-estar-pronto-antes-do-comite-de-viabilidade$sl$, $sh$Antes de levar um projeto ao Comitê, o Frank e o time Moní devem ter: (1) Mapa de Competidores concluído; (2) BCA preliminar preenchido (Moní + Frank); (3) Chec$sh$, $ans$Antes de levar um projeto ao Comitê, o Frank e o time Moní devem ter: (1) Mapa de Competidores concluído; (2) BCA preliminar preenchido (Moní + Frank); (3) Checklist de demanda residencial unifamiliar; (4) Seleção de uma ou mais tipologias do catálogo simuladas no lote; (5) Template do Comitê preenchido (Franqueado_NomeCondomínio.pptx). O Comitê acontece às quartas e sextas. Após o Comitê, e somente após, o Frank pode finalizar a negociação do terreno, fazer a sondagem, contratar projetos, abrir a SPE e solicitar crédito.$ans$,
  (select id from public.faq_categories where slug = $c$step-one$c$), 'published', 70
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é o template do Comitê e como preencho?$q$, $sl$o-que-e-o-template-do-comite-e-como-preencho$sl$, $sh$O template do Comitê é uma apresentação (Google Slides / PPTX) com o nome padrão: NomeFranqueado_NomeCondomínio.pptx.$sh$, $ans$O template do Comitê é uma apresentação (Google Slides / PPTX) com o nome padrão: NomeFranqueado_NomeCondomínio.pptx. Ele deve conter a análise de viabilidade do empreendimento: dados do lote, modelo de casa selecionado, BCA resumido (custos, preços, margem nos 3 cenários), mapa de competidores e checklist de demanda. O objetivo é que a alta liderança da Moní (Diretores de Expansão, Comercial, Financeiro/Estratégia) possa aprovar ou reprovar o projeto com base em dados concretos.$ans$,
  (select id from public.faq_categories where slug = $c$step-one$c$), 'published', 80
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é o passo a passo completo do processo de permuta após o Comitê?$q$, $sl$qual-e-o-passo-a-passo-completo-do-processo-de-permuta-apos-o-comite$sl$, $sh$Após aprovação no Comitê, o processo de permuta segue 12 etapas (A–L): A.$sh$, $ans$Após aprovação no Comitê, o processo de permuta segue 12 etapas (A–L):
A. Acordo inicial com terrenista + envio de minuta de Opção de Compra
B. Assinatura do Contrato de Opção de Compra (garante exclusividade, sem transferência de posse)
C. Diligência do terreno (matrícula, certidões, análise jurídica e técnica)
D. Assinatura do Contrato Definitivo de Permuta + 1ª parcela de corretagem (50%)
E. Envio dos documentos ao cartório para lavratura da escritura
F. Pagamento do ITBI, custas de cartório e despesas
G. Recebimento e conferência da minuta da escritura
H. Agendamento da assinatura da escritura no cartório de notas
I. Assinatura da escritura pública
J. Protocolo e registro da escritura no CRI + 2ª parcela de corretagem (50%) + início do pagamento de IPTU e taxas
K. (Seguro garantia emitido em até 90 dias após alvará)
L. Casa concluída → venda → distribuição do resultado ao terrenista$ans$,
  (select id from public.faq_categories where slug = $c$step-one$c$), 'published', 90
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$A Franqueadora disponibiliza domínio de e-mail 'moní' ao Franqueado?$q$, $sl$a-franqueadora-disponibiliza-dominio-de-e-mail-moni-ao-franqueado$sl$, $sh$Hoje a Moní não disponibiliza e-mails @moni para franqueados.$sh$, $ans$Hoje a Moní não disponibiliza e-mails @moni para franqueados. Como as unidades são operações independentes, cada franqueado utiliza seu próprio e-mail para comunicação, enquanto os canais institucionais da Moní ficam centralizados na franqueadora.$ans$,
  (select id from public.faq_categories where slug = $c$operacoes$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é o papel do Frank na construção?$q$, $sl$qual-e-o-papel-do-frank-na-construcao$sl$, $sh$O Frank é o gestor do empreendimento: negocia o terreno, constitui a SPE, contrata os fornecedores (planialtimétrico, projetos, obra), acompanha o andamento da $sh$, $ans$O Frank é o gestor do empreendimento: negocia o terreno, constitui a SPE, contrata os fornecedores (planialtimétrico, projetos, obra), acompanha o andamento da construção, responde ao time Moní pelo progresso nas fases do Kanban, participa das aprovações em condomínio e prefeitura, e coordena a venda com a imobiliária. A Moní fornece o produto, o crédito e o suporte técnico/jurídico.$ans$,
  (select id from public.faq_categories where slug = $c$operacoes$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é a duração da Obra?$q$, $sl$qual-e-a-duracao-da-obra$sl$, $sh$Cronograma de 4 meses para todas as obras, podendo se estender até 6 meses (pior caso).$sh$, $ans$Cronograma de 4 meses para todas as obras, podendo se estender até 6 meses (pior caso).$ans$,
  (select id from public.faq_categories where slug = $c$operacoes$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quanto tempo demora para aprovar o projeto no Condomínio e na Prefeitura?$q$, $sl$quanto-tempo-demora-para-aprovar-o-projeto-no-condominio-e-na-prefeitu$sl$, $sh$Varia. Essas informações devem ser consultadas por empreendimento em cada respectivo condomínio e prefeitura, assim como o prazo para atendimento de Comunique-ses.$sh$, $ans$Varia. Essas informações devem ser consultadas por empreendimento em cada respectivo condomínio e prefeitura, assim como o prazo para atendimento de Comunique-ses.$ans$,
  (select id from public.faq_categories where slug = $c$operacoes$c$), 'published', 40
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é o planialtimétrico e quando preciso contratar?$q$, $sl$o-que-e-o-planialtimetrico-e-quando-preciso-contratar$sl$, $sh$O planialtimétrico (ou levantamento topográfico) é o mapeamento do terreno com curvas de nível, dimensões, orientação solar, restrições e vegetação.$sh$, $ans$O planialtimétrico (ou levantamento topográfico) é o mapeamento do terreno com curvas de nível, dimensões, orientação solar, restrições e vegetação. É necessário em três momentos: (1) viabilidade técnica do produto — para confirmar se a casa cabem no lote; (2) projeto legal — para elaborar o projeto arquitetônico completo; (3) execução da obra — para orientar a implantação. Deve ser contratado com topógrafo credenciado, com ART/RRT assinada. O custo entra nas despesas de setup do BCA.$ans$,
  (select id from public.faq_categories where slug = $c$operacoes$c$), 'published', 50
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quais documentos são necessários para a diligência do terreno?$q$, $sl$quais-documentos-sao-necessarios-para-a-diligencia-do-terreno$sl$, $sh$Para a diligência jurídica do terreno, o Frank deve coletar: matrícula atualizada do imóvel (últimos 30 dias), certidões pessoais do terrenista (CND federal, es$sh$, $ans$Para a diligência jurídica do terreno, o Frank deve coletar: matrícula atualizada do imóvel (últimos 30 dias), certidões pessoais do terrenista (CND federal, estadual, municipal, trabalhista, FGTS, protestos, ações cíveis e criminais), certidões do imóvel (débitos de IPTU, taxas condominiais), planta do condomínio, memorial descritivo, e regulamento interno do condomínio (normas de obra, recuos). O custo das certidões é responsabilidade do Frank, podendo ser negociada a absorção pelo terrenista.$ans$,
  (select id from public.faq_categories where slug = $c$operacoes$c$), 'published', 60
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Posso usar um contrato de permuta diferente do modelo Moní?$q$, $sl$posso-usar-um-contrato-de-permuta-diferente-do-modelo-moni$sl$, $sh$É possível analisar o modelo apresentado pelo terrenista, mas ele deve ser cuidadosamente comparado com o modelo Moní antes de qualquer assinatura.$sh$, $ans$É possível analisar o modelo apresentado pelo terrenista, mas ele deve ser cuidadosamente comparado com o modelo Moní antes de qualquer assinatura. O modelo Moní é desenvolvido pelo jurídico da franqueadora para proteger o Frank, a SPE e o ecossistema. Qualquer desvio relevante (prazo, piso de valor, garantias, corretagem, rescisão) deve ser validado com o time jurídico da Moní antes de ser aceito.$ans$,
  (select id from public.faq_categories where slug = $c$operacoes$c$), 'published', 70
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é o fluxo de anúncio do empreendimento?$q$, $sl$qual-e-o-fluxo-de-anuncio-do-empreendimento$sl$, $sh$O fluxo de anúncio da casa começa após a aprovação do projeto na prefeitura (alvará de obra).$sh$, $ans$O fluxo de anúncio da casa começa após a aprovação do projeto na prefeitura (alvará de obra). A imobiliária parceira é acionada para lançamento. A venda pode ocorrer na planta (antes da obra), durante a obra ou após a conclusão. O preço de referência é o configurador oficial da Moní — não o One Pager ou materiais desatualizados. A comissão de corretagem (6%) é deduzida do VGV na distribuição do resultado.$ans$,
  (select id from public.faq_categories where slug = $c$venda-e-imobiliaria$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Em que momento a casa pode ser vendida?$q$, $sl$em-que-momento-a-casa-pode-ser-vendida$sl$, $sh$A casa pode ser anunciada como 'Breve Lançamento' após a assinatura do Contrato do Lote até a Liberação do Alvará de Obra.$sh$, $ans$A casa pode ser anunciada como 'Breve Lançamento' após a assinatura do Contrato do Lote até a Liberação do Alvará de Obra. Ela passa a ser anunciada como 'Lançamento' e pode ser vendida após a emissão do Alvará de Obra.$ans$,
  (select id from public.faq_categories where slug = $c$venda-e-imobiliaria$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Se o comprador quiser alterar coisas, a Moní refaz?$q$, $sl$se-o-comprador-quiser-alterar-coisas-a-moni-refaz$sl$, $sh$A depender da etapa de obra e das opções de customização pré-estabelecidas pela Franqueadora.$sh$, $ans$A depender da etapa de obra e das opções de customização pré-estabelecidas pela Franqueadora.$ans$,
  (select id from public.faq_categories where slug = $c$venda-e-imobiliaria$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Como funciona a recompra programada? Há algum porém que o Frank deve avaliar?$q$, $sl$como-funciona-a-recompra-programada-ha-algum-porem-que-o-frank-deve-av$sl$, $sh$A opção de recompra programada é um mecanismo pelo qual a Moní tem o direito (não obrigação) de comprar as quotas da SPE caso a casa não seja vendida dentro do $sh$, $ans$A opção de recompra programada é um mecanismo pelo qual a Moní tem o direito (não obrigação) de comprar as quotas da SPE caso a casa não seja vendida dentro do prazo (24 meses do Contrato de Opção). O objetivo é preservar a operação e manter a relação com os parceiros do ecossistema de funding. Importante: exercer ou não é decisão exclusiva da Moní. Por isso, a recompra não entra nos estudos de viabilidade nem é argumento com o terrenista — a operação precisa se sustentar pelos próprios estudos de BCA.$ans$,
  (select id from public.faq_categories where slug = $c$portfolio-e-comite$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Qual é o regime de tributação da SPE?$q$, $sl$qual-e-o-regime-de-tributacao-da-spe$sl$, $sh$A SPE é tributada preferencialmente no regime do Lucro Presumido ou RET (Regime Especial de Tributação), com alíquota de 4% sobre a receita bruta de vendas — es$sh$, $ans$A SPE é tributada preferencialmente no regime do Lucro Presumido ou RET (Regime Especial de Tributação), com alíquota de 4% sobre a receita bruta de vendas — este é o regime mais favorável para incorporações imobiliárias no Brasil. A opção pelo RET exige averbação do regime no Cartório de Registro de Imóveis. Consulte o contador parceiro Moní para confirmar o regime mais adequado ao projeto.$ans$,
  (select id from public.faq_categories where slug = $c$contabilidade-e-fiscal$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O franqueado deve abrir 2 contas (uma para o CNPJ Incorporador e outra para a SPE)? Abre ao mesmo tempo ou em tempos diferentes?$q$, $sl$o-franqueado-deve-abrir-2-contas-uma-para-o-cnpj-incorporador-e-outra$sl$, $sh$O banco exige que haja uma pessoa física responsável pela conta, mesmo que a SPE seja propriedade de outra empresa.$sh$, $ans$O banco exige que haja uma pessoa física responsável pela conta, mesmo que a SPE seja propriedade de outra empresa. Isso ocorre porque instituições financeiras só podem se relacionar diretamente com pessoas físicas para autorizar movimentações e assinar contratos bancários. Por isso, é necessário nomear um administrador, conforme contrato social, com procuração para representar a SPE na abertura e gestão da conta.$ans$,
  (select id from public.faq_categories where slug = $c$contabilidade-e-fiscal$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Por que o banco não permite abrir a conta da SPE quando a incorporadora é dona, e solicita uma pessoa física responsável?$q$, $sl$por-que-o-banco-nao-permite-abrir-a-conta-da-spe-quando-a-incorporador$sl$, $sh$A SPE é uma empresa constituída como pessoa jurídica e não possui sócios pessoas físicas diretamente — sua única sócia é a incorporadora, também pessoa jurídica.$sh$, $ans$A SPE é uma empresa constituída como pessoa jurídica e não possui sócios pessoas físicas diretamente — sua única sócia é a incorporadora, também pessoa jurídica. Por isso, o banco precisa identificar a pessoa física que exerce controle ('beneficiário final') e registrar quem será responsável por operar a conta. Essa exigência está de acordo com a regulamentação do Banco Central (Circular Bacen nº 3.978/2020). A incorporadora, por meio de seu administrador (pessoa física) indicado no contrato social, deve emitir uma procuração autorizando-o a representar a SPE no banco. Recomenda-se consultar o gerente para seguir as exigências específicas de cada instituição.$ans$,
  (select id from public.faq_categories where slug = $c$contabilidade-e-fiscal$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Por que a emissão de Nota Fiscal é obrigatória para todos os serviços e fornecedores?$q$, $sl$por-que-a-emissao-de-nota-fiscal-e-obrigatoria-para-todos-os-servicos$sl$, $sh$A NF é obrigatória por quatro razões principais: 1.$sh$, $ans$A NF é obrigatória por quatro razões principais:
1. Obrigação legal: toda prestação de serviço deve ser documentada por NF; sem ela, pode configurar sonegação ou fraude tributária.
2. Segurança para a SPE: a obra será auditada pelos parceiros de crédito — sem NF, não é possível comprovar o uso dos recursos e o crédito não é liberado.
3. Proteção do franqueado: sem NF, a despesa não entra na contabilidade da SPE, não deduz imposto e não há documento para cobrar direitos em caso de problema.
4. Proteção da rede: como o dinheiro é liberado pelo parceiro de crédito via conta escrow da franqueadora, permitir pagamento sem NF pode caracterizar conivência com fraude. A NF deve ser emitida contra a SPE.$ans$,
  (select id from public.faq_categories where slug = $c$contabilidade-e-fiscal$c$), 'published', 40
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que é a Universidade Moní e como funciona?$q$, $sl$o-que-e-a-universidade-moni-e-como-funciona$sl$, $sh$A Universidade Moní é a plataforma de capacitação do Frank, disponível no Hub Fly em /universidade.$sh$, $ans$A Universidade Moní é a plataforma de capacitação do Frank, disponível no Hub Fly em /universidade. Ela funciona como um tabuleiro com fases (casas 0 a 11), cada uma cobrindo um tema da jornada de incorporação. As fases incluem vídeos, leituras, checklists, quizzes e templates. O progresso só é registrado após clicar em 'Iniciar fase'. Os quizzes exigem 70% de acerto para aprovação.$ans$,
  (select id from public.faq_categories where slug = $c$universidade-moni$c$), 'published', 10
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Preciso completar a Universidade Moní para enviar uma hipótese ao Portfólio?$q$, $sl$preciso-completar-a-universidade-moni-para-enviar-uma-hipotese-ao-port$sl$, $sh$Sim. O Frank precisa ter concluído as Casas 0, 1 e 2 da Universidade Moní para poder enviar a hipótese ao Funil Portfólio.$sh$, $ans$Sim. O Frank precisa ter concluído as Casas 0, 1 e 2 da Universidade Moní para poder enviar a hipótese ao Funil Portfólio. Caso contrário, o sistema bloqueia o avanço com o erro ERRO_UNIVERSIDADE_HIPOTESE.$ans$,
  (select id from public.faq_categories where slug = $c$universidade-moni$c$), 'published', 20
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$Quantas fases tem a Universidade Moní atualmente e o que cada uma cobre?$q$, $sl$quantas-fases-tem-a-universidade-moni-atualmente-e-o-que-cada-uma-cobr$sl$, $sh$A Universidade Moní tem 12 casas (fases 0 a 11) no tabuleiro.$sh$, $ans$A Universidade Moní tem 12 casas (fases 0 a 11) no tabuleiro. Além das casas originais, foram adicionados 16 novos módulos de conteúdo. As fases cobrem progressivamente toda a jornada do Frank: do onboarding e modelo de negócio (casas 0–2) até a gestão de obra, venda e pós-obra (casas 8–11). As casas 0, 1 e 2 são pré-requisito para enviar a primeira hipótese ao Portfólio.$ans$,
  (select id from public.faq_categories where slug = $c$universidade-moni$c$), 'published', 30
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que acontece se eu não completar as fases da Universidade antes de avançar no funil?$q$, $sl$o-que-acontece-se-eu-nao-completar-as-fases-da-universidade-antes-de-a$sl$, $sh$O sistema Hub Fly bloqueia automaticamente o avanço da hipótese para o Portfólio se as casas 0, 1 e 2 da Universidade não estiverem concluídas.$sh$, $ans$O sistema Hub Fly bloqueia automaticamente o avanço da hipótese para o Portfólio se as casas 0, 1 e 2 da Universidade não estiverem concluídas. O erro exibido é ERRO_UNIVERSIDADE_HIPOTESE. Não há exceção a esta regra — é um gate técnico no funil. Conclua as fases da Universidade para desbloquear o avanço.$ans$,
  (select id from public.faq_categories where slug = $c$universidade-moni$c$), 'published', 40
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

insert into public.faq_articles (question, slug, short_answer, answer, category_id, status, display_order)
select $q$O que acontece na Casa 9 da Universidade Moní?$q$, $sl$o-que-acontece-na-casa-9-da-universidade-moni$sl$, $sh$A Casa 9 do tabuleiro aborda a fase de 'Aprovação e Início de Obras' — o Frank aprende como funciona o processo de aprovação na prefeitura (projeto legal, alvar$sh$, $ans$A Casa 9 do tabuleiro aborda a fase de 'Aprovação e Início de Obras' — o Frank aprende como funciona o processo de aprovação na prefeitura (projeto legal, alvará de obra), as etapas de contratação da obra com fornecedores Moní, as obrigações de acompanhamento semanal via Hub Fly, e os marcos de liberação de tranches de crédito de obra. É a transição da fase de preparação para a execução física do empreendimento.$ans$,
  (select id from public.faq_categories where slug = $c$universidade-moni$c$), 'published', 50
on conflict (slug) do update set
  question = excluded.question, short_answer = excluded.short_answer, answer = excluded.answer,
  category_id = excluded.category_id, display_order = excluded.display_order;

-- 3) Perguntas em destaque
update public.faq_articles set is_featured = true where slug like $f$o-que-e-a-moni%$f$;
update public.faq_articles set is_featured = true where slug like $f$quem-pode-ser-franqueado%$f$;
update public.faq_articles set is_featured = true where slug like $f$qual-e-o-investimento-inicial%$f$;
update public.faq_articles set is_featured = true where slug like $f$o-que-e-o-bca%$f$;
update public.faq_articles set is_featured = true where slug like $f$o-que-e-o-step-one%$f$;
update public.faq_articles set is_featured = true where slug like $f$como-funciona-o-credito-de-terreno%$f$;
update public.faq_articles set is_featured = true where slug like $f$quem-paga-o-itbi%$f$;
update public.faq_articles set is_featured = true where slug like $f$o-que-e-spe%$f$;

notify pgrst, 'reload schema';
