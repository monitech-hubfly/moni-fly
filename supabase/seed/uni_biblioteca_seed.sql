-- ============================================================
-- uni_biblioteca_seed.sql
-- Seed da biblioteca operacional Moní — itens reais por categoria
-- Idempotente: só insere se não existir título igual na categoria
-- Rodar no SQL Editor DEV → validar → rodar em PROD
-- ============================================================

do $seed$
begin

-- ─── CATEGORIA: bca ─────────────────────────────────────────

if not exists (select 1 from public.uni_biblioteca where categoria = 'bca' and titulo = 'BCA Geral Moní 2025 — Permuta % VGV') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'bca',
    'BCA Geral Moní 2025 — Permuta % VGV',
    'Planilha oficial de análise de viabilidade 2025. Três cenários: Planta (mês 6), Target e Liquidação. Campos: VGV, comissão, impostos, terreno base, terreno variável, % permuta, casa, taxas, juros. Meta: %VGV Target ≥ 10%.',
    'link',
    'https://docs.google.com/spreadsheets/d/R2_BCA_Geral_Moni_2025',
    array['bca','viabilidade','permuta','vgv','2025'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'bca' and titulo = 'BCA Geral Moní 2026 — Permuta % VGV') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'bca',
    'BCA Geral Moní 2026 — Permuta % VGV',
    'Versão atualizada 2026 do BCA. Mesma estrutura de 3 cenários com ajustes de taxas e premissas do exercício corrente. Usar esta versão para todas as operações abertas em 2026.',
    'link',
    'https://docs.google.com/spreadsheets/d/R2_BCA_Geral_Moni_2026',
    array['bca','viabilidade','permuta','vgv','2026'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'bca' and titulo = 'Racional Temporário — Permuta Parcial') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'bca',
    'Racional Temporário — Permuta Parcial',
    'Planilha auxiliar para estruturar operações com sinal + % VGV. Mostra como o sinal (≈30% do valor do lote) se traduz em % do VGV líquido. Usar junto com o BCA principal.',
    'arquivo',
    'IMPE_K1_17-Racional_Temporario_Permuta_Parcial.xlsx',
    array['bca','permuta-parcial','sinal','racional'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'bca' and titulo = 'Como preencher o BCA — passo a passo') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'bca',
    'Como preencher o BCA — passo a passo',
    'Guia operacional: (1) definir VGV Target, (2) preencher terreno, (3) selecionar casa no configurador, (4) calcular Planta e Liquidação, (5) analisar TIR do terrenista. Inclui erros comuns e critério de aprovação.',
    'link',
    'https://hub.moni/universidade/jornada/hipotese',
    array['bca','tutorial','preenchimento','viabilidade'],
    array['frank','team','admin']::text[]
  );
end if;

-- ─── CATEGORIA: batalhas ────────────────────────────────────

if not exists (select 1 from public.uni_biblioteca where categoria = 'batalhas' and titulo = 'Template Batalha de Casas — Score e Ranking') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'batalhas',
    'Template Batalha de Casas — Score e Ranking',
    'Planilha com a tabela de pontuação oficial: Localização (–2 a +2), Preço value for money (–2 a +2), Produto (–2 a +2). Colunas: competidor, preço, m², R$/m², produto, preço, localização, resultado (G/E/P). Inclui resumo de vitórias/empates/derrotas.',
    'link',
    'https://docs.google.com/spreadsheets/d/batalha_casas_template',
    array['batalha','score','ranking','competidores','liquidez'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'batalhas' and titulo = 'Exemplo real — Batalha Artesano Campinas (aprovado)') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'batalhas',
    'Exemplo real — Batalha Artesano Campinas (aprovado)',
    'Caso real aprovado em comitê. Casa GAL no Artesano Galleria, Campinas/SP. 43 casas analisadas, 35 competidores alinhados. Resultado: 34 vitórias, 1 empate, 0 derrotas. VGV Target R$7,5MM. Ranking TOP 2. Alta probabilidade de venda.',
    'arquivo',
    'Comite_Template_GAL_2_pptx.pdf',
    array['batalha','exemplo','aprovado','campinas','artesano','gal'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'batalhas' and titulo = 'Regras da batalha — critérios de avaliação') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'batalhas',
    'Regras da batalha — critérios de avaliação',
    'Documento oficial com a tabela de referência de pontuação. Inclui exemplos práticos para cada nota em Localização, Preço e Produto. Regra de desempate: 1) Localização 2) Preço 3) Produto. Como interpretar o ranking e cruzar com velocidade de vendas.',
    'link',
    'https://hub.moni/universidade/jornada/hipotese#batalha',
    array['batalha','regras','pontuacao','criterios'],
    array['frank','team','admin']::text[]
  );
end if;

-- ─── CATEGORIA: step-one ────────────────────────────────────

if not exists (select 1 from public.uni_biblioteca where categoria = 'step-one' and titulo = 'Planilha Step One — Análises de Viabilidade') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'step-one',
    'Planilha Step One — Análises de Viabilidade',
    'Repositório central de inteligência de mercado. 6 abas: (1) Mapa de Competidores Base, (2) Resultado, (3) Lotes, (4) Check de Demanda, (5) Valor × Giro, (6) Hipótese. Atualizar Aba 1 mensalmente. Duplicar Aba 4 para cada condomínio.',
    'link',
    'https://docs.google.com/spreadsheets/d/R0_Analises_Viabilidade',
    array['step-one','planilha','competidores','lotes','demanda','giro','hipotese'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'step-one' and titulo = 'FAQ Step One — Perguntas frequentes') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'step-one',
    'FAQ Step One — Perguntas frequentes',
    'Planilha com as dúvidas mais comuns do Step One respondidas. Como filtrar outliers, como calcular o R$/m², como interpretar a Aba de Hipótese, quando duplicar abas, como abordar corretores.',
    'arquivo',
    'FAQ__STEP_ONE.xlsx',
    array['step-one','faq','duvidas','corretor','competidores'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'step-one' and titulo = 'Orientações Step 2 — Esteira de viabilidade 2026') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'step-one',
    'Orientações Step 2 — Esteira de viabilidade 2026',
    'Apresentação completa da esteira de viabilidade 2026. Jornada do franqueado macro (Steps 1–8), o que são Step 1/2/3/4, por que o Step One é obrigatório, papel do franqueado vs Moní, ritmo esperado (recorrência mensal / aprovação trimestral). Inclui roteiro das abas da planilha.',
    'arquivo',
    'STEP_ONE_v3.pdf',
    array['step-one','step-two','jornada','esteira','viabilidade','2026'],
    array['frank','team','admin']::text[]
  );
end if;

-- ─── CATEGORIA: produto ─────────────────────────────────────

if not exists (select 1 from public.uni_biblioteca where categoria = 'produto' and titulo = 'Manual do Configurador de Casas Moní') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'produto',
    'Manual do Configurador de Casas Moní',
    'Manual completo do configurador (moni-configurador.vercel.app / senha: FKMONI). Inclui: acesso ao catálogo, comparação de modelos, seleção de opcionais, pacotes prontos, opcionais com quantidade variável, geração de PDF e link de compartilhamento.',
    'arquivo',
    'Manual_Configurador_de_Casas_Moni_docx.pdf',
    array['configurador','produto','catalogo','opcionais','pdf'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'produto' and titulo = 'Configurador de Casas Moní — acesso direto') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'produto',
    'Configurador de Casas Moní — acesso direto',
    'Link direto para o configurador web. Mostra todos os modelos com área, quartos, banheiros, dimensões de projeção e preço base. Permite comparar 2 modelos lado a lado. Senha: FKMONI.',
    'link',
    'https://moni-configurador.vercel.app/',
    array['configurador','catalogo','casas','produto','acesso'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'produto' and titulo = 'Tabela de modelos — m², VGV Target e R$/m²') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'produto',
    'Tabela de modelos — m², VGV Target e R$/m²',
    'Referência rápida dos modelos disponíveis com área construída, VGV Target, VGV presente e R$/m². Modelos: Eva Sub Solo (432m²), Eva Nível (391m²), Liz Sub Solo (310m²), Liz Nível (271m²), Ivy Sub Solo (408m²), Ivy Nível (354m²), Mia Nível (357m²), Cissa Nível (475m²), Sol Nível (324m²), Gal Nível (351m²).',
    'arquivo',
    'STEP_2_TEMPLATE_pptx.pdf',
    array['modelos','catalogo','area','vgv','rsm2','eva','liz','ivy','mia','cissa','sol','gal'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'produto' and titulo = 'Boas práticas de produto e implantação') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'produto',
    'Boas práticas de produto e implantação',
    'Orientações sobre como escolher o modelo certo para cada lote. Critérios de implantação em aclive, declive e plano. Quando rooftop agrega vs atrapalha. Quando garagem subterrânea vale. Erros comuns de produto que reduzem liquidez.',
    'arquivo',
    'STEP_2_ORIENTACOES_BOAS_PRATICAS_pptx.pdf',
    array['produto','implantacao','rooftop','garagem','aclive','boas-praticas','liquidez'],
    array['frank','team','admin']::text[]
  );
end if;

-- ─── CATEGORIA: juridico ────────────────────────────────────

if not exists (select 1 from public.uni_biblioteca where categoria = 'juridico' and titulo = 'Carta fiança — modelo Moní v2') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'juridico',
    'Carta fiança — modelo Moní v2',
    'Minuta da carta fiança padrão Moní. Documento de garantia utilizado na estruturação financeira das operações. Revisar com jurídico antes de usar em operação real.',
    'arquivo',
    'moni_carta_fianca_v2.docx',
    array['juridico','carta-fianca','garantia','funding','minuta'],
    array['team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'juridico' and titulo = 'Termo de autorização para consulta de informações') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'juridico',
    'Termo de autorização para consulta de informações',
    'Documento padrão utilizado na análise preliminar de crédito. Autoriza a Moní a consultar informações do proponente em bureaus e bases de dados. Obrigatório antes de iniciar checklist de crédito.',
    'arquivo',
    'Moni_-_TERMO_DE_AUTORIZACAO_PARA_CONSULTA_DE_INFORMACOES.docx',
    array['juridico','credito','autorizacao','consulta','diligencia'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'juridico' and titulo = 'Checklist análise preliminar de crédito') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'juridico',
    'Checklist análise preliminar de crédito',
    'Lista completa de documentos e verificações necessários para a análise de crédito. Inclui: documentos pessoais, comprovantes, matrícula do imóvel, certidões e pendências jurídicas. Preencher antes de submeter ao comitê de crédito.',
    'arquivo',
    'Checklist_Analise_Preliminar_de_Credito.docx',
    array['credito','checklist','documentos','analise','comite'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'juridico' and titulo = 'Captação de franqueados — modelo contratual') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'juridico',
    'Captação de franqueados — modelo contratual',
    'Documento de referência sobre a estrutura contratual da captação de franqueados Moní. Inclui obrigações, direitos, estrutura de remuneração e fluxo de aprovação.',
    'arquivo',
    'moni_captacao_franqueados_v3.docx',
    array['juridico','franqueado','contrato','captacao','estrutura'],
    array['team','admin']::text[]
  );
end if;

-- ─── CATEGORIA: pre-obra ────────────────────────────────────

if not exists (select 1 from public.uni_biblioteca where categoria = 'pre-obra' and titulo = 'Orientações externas pré-obra') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'pre-obra',
    'Orientações externas pré-obra',
    'Guia completo para a fase de pré-obra. Cobre: topografia, sondagem, projeto legal, aprovação no condomínio, aprovação na prefeitura, compatibilização, acoplamento, abertura de SPE, conta bancária e seguros. Sequência obrigatória antes do início da construção.',
    'arquivo',
    'Orientacoes_Externas_Pre_Obra.docx',
    array['pre-obra','topografia','sondagem','aprovacao','spe','seguros','condominio'],
    array['frank','team','admin']::text[]
  );
end if;

-- ─── CATEGORIA: comite ──────────────────────────────────────

if not exists (select 1 from public.uni_biblioteca where categoria = 'comite' and titulo = 'Template de Comitê — estrutura completa') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'comite',
    'Template de Comitê — estrutura completa',
    'Template oficial para submissão ao comitê. 12 seções: (1) Localização cidade, (2) Localização condomínio, (3) Oferta/Estoque, (4) Demanda, (5) Testes operacionais/BCAs, (6) Lote prospectado, (7) Produto proposto, (8) A operação/BCA, (9) Análise de mercado, (10) Score e batalha, (11) Viabilidade, (12) Conclusão e recomendação.',
    'arquivo',
    'STEP_2_TEMPLATE_pptx.pdf',
    array['comite','template','dossiê','aprovacao','step-two','12-secoes'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'comite' and titulo = 'Exemplo aprovado — Comitê GAL Artesano Campinas') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'comite',
    'Exemplo aprovado — Comitê GAL Artesano Campinas',
    'Dossiê completo aprovado em comitê. Condomínio Artesano Galleria, Campinas/SP. Casa GAL, lote 490m², VGV Target R$7,5MM. Inclui: localização detalhada, oferta (43 casas), BCA duplo (R$7,5MM e R$7MM), batalha completa (34G/1E/0P), conclusão. Usar como referência de qualidade e profundidade.',
    'arquivo',
    'Comite_Template_GAL_2_pptx.pdf',
    array['comite','aprovado','exemplo','campinas','artesano','gal','bca','batalha'],
    array['frank','team','admin']::text[]
  );
end if;

-- ─── CATEGORIA: negociacao ──────────────────────────────────

if not exists (select 1 from public.uni_biblioteca where categoria = 'negociacao' and titulo = 'Modelos de negócio — Permuta total, parcial e C&V') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'negociacao',
    'Modelos de negócio — Permuta total, parcial e C&V',
    'Guia completo dos 3 modelos. Permuta total: zero desembolso, 25–40% VGV, risco baixo, alinhamento total. Permuta parcial: sinal ≈30% lote + % VGV menor, mais fácil de fechar. Compra e venda: 100% do lote, margem maior, risco alto. Tabela comparativa com impacto no BCA.',
    'link',
    'https://hub.moni/universidade/jornada/ecossistema#modelos',
    array['negociacao','permuta','permuta-total','permuta-parcial','compra-venda','modelos'],
    array['frank','team','admin']::text[]
  );
end if;

if not exists (select 1 from public.uni_biblioteca where categoria = 'negociacao' and titulo = 'Script de abordagem ao corretor — mensagem padrão') then
  insert into public.uni_biblioteca (categoria, titulo, descricao, tipo, url, tags, visivel_para)
  values (
    'negociacao',
    'Script de abordagem ao corretor — mensagem padrão',
    'Mensagem padrão para primeiro contato: "Olá, sou [nome], da Casa Moní, estou mapeando oportunidades para incorporação residencial de alto padrão. Em quais condomínios você tem vendido mais casas com valor acima de R$12.000/m²?" Inclui perguntas obrigatórias sobre lotes, casas à venda, velocidade e ticket.',
    'link',
    'https://hub.moni/universidade/jornada/step-one#corretor',
    array['negociacao','corretor','script','abordagem','step-one','demanda'],
    array['frank','team','admin']::text[]
  );
end if;

end $seed$;

-- Verificação final
select categoria, count(*) as itens
from public.uni_biblioteca
group by categoria
order by categoria;

select count(*) as total_itens_biblioteca from public.uni_biblioteca;
-- Esperado após 1.º run completo: 23 linhas (4+3+3+4+4+1+2+2)
