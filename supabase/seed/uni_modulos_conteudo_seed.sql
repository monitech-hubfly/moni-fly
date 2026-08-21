-- ============================================================
-- uni_modulos_conteudo_seed.sql
-- Substitui os módulos placeholder por conteúdo real Moní
-- Casas 0–11 com títulos, descrições e conteúdo jsonb corretos
-- Idempotente: usa UPDATE onde já existe, INSERT onde não existe
-- Rodar no SQL Editor DEV → validar → rodar em PROD
-- ============================================================

do $modconteudo$
declare
  _casa_id uuid;
  _mod_id  uuid;
begin

-- ================================================================
-- CASA 0 — Boas-vindas
-- ================================================================
select id into _casa_id from public.uni_casas where slug = 'boas-vindas';
if _casa_id is null then raise exception 'Casa boas-vindas não encontrada'; end if;

-- Módulo 0-1: Vídeo — O que é a Moní
select id into _mod_id from public.uni_modulos where casa_id = _casa_id and ordem = 1;
if _mod_id is null then
  insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio) values (
    _casa_id, 'video', 'O que é a Moní e como funciona o ecossistema',
    '{"url":"https://drive.google.com/placeholder-video-ecossistema","duracao_min":8,"thumbnail":null}'::jsonb,
    1, true);
else
  update public.uni_modulos set
    tipo = 'video',
    titulo = 'O que é a Moní e como funciona o ecossistema',
    conteudo = '{"url":"https://drive.google.com/placeholder-video-ecossistema","duracao_min":8,"thumbnail":null}'::jsonb,
    obrigatorio = true
  where id = _mod_id;
end if;

-- Módulo 0-2: Checklist — Setup inicial
select id into _mod_id from public.uni_modulos where casa_id = _casa_id and ordem = 2;
if _mod_id is null then
  insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio) values (
    _casa_id, 'checklist', 'Checklist de setup inicial — acessos e ferramentas',
    '{
      "itens": [
        {"id":"s1","texto":"Acesso ao Hub Fly configurado e funcionando","dica":"Peça ao time Moní se ainda não tiver acesso"},
        {"id":"s2","texto":"Login no Configurador de Casas (moni-configurador.vercel.app / senha: FKMONI)","dica":"Guarde o link nos favoritos do navegador"},
        {"id":"s3","texto":"Acesso à planilha Step One (R0_Análises de Viabilidade)","dica":"Link disponível na biblioteca — Step One"},
        {"id":"s4","texto":"Acesso ao BCA Geral Moní 2026","dica":"Link disponível na biblioteca — BCA"},
        {"id":"s5","texto":"Pasta do Google Drive criada e organizada por condomínio","dica":"Estrutura: 01_STEP_ONE / 02_BCA / 03_BATALHAS / 04_COMITE"},
        {"id":"s6","texto":"Contatos de pelo menos 3 corretores ativos no perímetro mapeados","dica":"Buscar no Instagram, Google e nos anúncios do Viva Real"}
      ]
    }'::jsonb,
    2, true);
else
  update public.uni_modulos set
    tipo = 'checklist',
    titulo = 'Checklist de setup inicial — acessos e ferramentas',
    conteudo = '{
      "itens": [
        {"id":"s1","texto":"Acesso ao Hub Fly configurado e funcionando","dica":"Peça ao time Moní se ainda não tiver acesso"},
        {"id":"s2","texto":"Login no Configurador de Casas (moni-configurador.vercel.app / senha: FKMONI)","dica":"Guarde o link nos favoritos do navegador"},
        {"id":"s3","texto":"Acesso à planilha Step One (R0_Análises de Viabilidade)","dica":"Link disponível na biblioteca — Step One"},
        {"id":"s4","texto":"Acesso ao BCA Geral Moní 2026","dica":"Link disponível na biblioteca — BCA"},
        {"id":"s5","texto":"Pasta do Google Drive criada e organizada por condomínio","dica":"Estrutura: 01_STEP_ONE / 02_BCA / 03_BATALHAS / 04_COMITE"},
        {"id":"s6","texto":"Contatos de pelo menos 3 corretores ativos no perímetro mapeados","dica":"Buscar no Instagram, Google e nos anúncios do Viva Real"}
      ]
    }'::jsonb,
    obrigatorio = true
  where id = _mod_id;
end if;

-- Módulo 0-3: Leitura — Organização do Drive
select id into _mod_id from public.uni_modulos where casa_id = _casa_id and ordem = 3;
if _mod_id is null then
  insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio) values (
    _casa_id, 'leitura', 'Como organizar o Drive e nomear arquivos',
    '{
      "tempo_leitura_min": 5,
      "markdown": "## Estrutura de pastas recomendada\n\nCrie uma pasta mestra com o nome da sua cidade/região. Dentro, organize assim:\n\n```\n01_STEP_ONE/\n  Cidade_A/\n  Cidade_B/\n02_BCA/\n  Condominio_X/\n  Condominio_Y/\n03_BATALHAS/\n04_COMITE/\n05_JURIDICO/\n06_PRE_OBRA/\n```\n\n## Nomenclatura de arquivos\n\nUse sempre: `DATA_TIPO_CONDOMINIO_VERSAO`\n\nExemplos:\n- `2026-05_BCA_Artesano_v1.xlsx`\n- `2026-05_Batalha_Artesano_v2.pdf`\n- `2026-06_Comite_Artesano_final.pptx`\n\n## Regra de ouro\n\nNunca envie para o comitê um arquivo sem data e versão no nome. Facilita o histórico e evita confusão entre versões."
    }'::jsonb,
    3, true);
else
  update public.uni_modulos set
    tipo = 'leitura',
    titulo = 'Como organizar o Drive e nomear arquivos',
    conteudo = '{
      "tempo_leitura_min": 5,
      "markdown": "## Estrutura de pastas recomendada\n\nCrie uma pasta mestra com o nome da sua cidade/região. Dentro, organize assim:\n\n```\n01_STEP_ONE/\n  Cidade_A/\n  Cidade_B/\n02_BCA/\n  Condominio_X/\n  Condominio_Y/\n03_BATALHAS/\n04_COMITE/\n05_JURIDICO/\n06_PRE_OBRA/\n```\n\n## Nomenclatura de arquivos\n\nUse sempre: `DATA_TIPO_CONDOMINIO_VERSAO`\n\nExemplos:\n- `2026-05_BCA_Artesano_v1.xlsx`\n- `2026-05_Batalha_Artesano_v2.pdf`\n- `2026-06_Comite_Artesano_final.pptx`\n\n## Regra de ouro\n\nNunca envie para o comitê um arquivo sem data e versão no nome. Facilita o histórico e evita confusão entre versões."
    }'::jsonb,
    obrigatorio = true
  where id = _mod_id;
end if;

-- Módulo 0-4: Vídeo — Introdução ao Hub Fly
select id into _mod_id from public.uni_modulos where casa_id = _casa_id and ordem = 4;
if _mod_id is null then
  insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio) values (
    _casa_id, 'video', 'Introdução ao Hub Fly — navegação e Kanban',
    '{"url":"https://drive.google.com/placeholder-video-hubfly","duracao_min":10,"thumbnail":null}'::jsonb,
    4, true);
else
  update public.uni_modulos set
    tipo = 'video',
    titulo = 'Introdução ao Hub Fly — navegação e Kanban',
    conteudo = '{"url":"https://drive.google.com/placeholder-video-hubfly","duracao_min":10,"thumbnail":null}'::jsonb,
    obrigatorio = true
  where id = _mod_id;
end if;

-- ================================================================
-- CASA 1 — Ecossistema Moní
-- ================================================================
select id into _casa_id from public.uni_casas where slug = 'ecossistema';
if _casa_id is null then raise exception 'Casa ecossistema não encontrada'; end if;

-- Módulo 1-1: Vídeo — O que é incorporação residencial
select id into _mod_id from public.uni_modulos where casa_id = _casa_id and ordem = 1;
if _mod_id is null then
  insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio) values (
    _casa_id, 'video', 'O que é incorporação residencial e por que casas são diferentes',
    '{"url":"https://drive.google.com/placeholder-video-incorporacao","duracao_min":12,"thumbnail":null}'::jsonb,
    1, true);
else
  update public.uni_modulos set tipo='video', titulo='O que é incorporação residencial e por que casas são diferentes',
    conteudo='{"url":"https://drive.google.com/placeholder-video-incorporacao","duracao_min":12,"thumbnail":null}'::jsonb
  where id=_mod_id;
end if;

-- Módulo 1-2: Leitura — Glossário operacional
select id into _mod_id from public.uni_modulos where casa_id = _casa_id and ordem = 2;
if _mod_id is null then
  insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio) values (
    _casa_id, 'leitura', 'Glossário operacional Moní',
    '{
      "tempo_leitura_min": 10,
      "markdown": "## Glossário operacional Moní\n\n**VGV (Valor Geral de Vendas):** Receita bruta total da operação. VGV Target = preço ideal de venda. VGV Planta = venda no mês 6. VGV Liquidação = venda com desconto no mês 10+.\n\n**BCA (Análise de Viabilidade):** Simulador financeiro da operação em 3 cenários. Meta: %VGV Target ≥ 10%.\n\n**Permuta total:** Terrenista cede o lote e recebe % do VGV líquido. Zero desembolso de caixa pelo franqueado.\n\n**Permuta parcial:** Sinal em dinheiro no ato + % menor do VGV na venda.\n\n**Compra e venda:** SPE compra o lote integralmente. Terrenista sai da operação.\n\n**SPE (Sociedade de Propósito Específico):** Empresa criada só para aquela operação. Isola o risco.\n\n**Funding:** Capital necessário para financiar a operação (terreno + obra).\n\n**Giro:** Velocidade de absorção do produto pelo mercado. Alto giro = vende rápido.\n\n**Liquidez:** Probabilidade e velocidade de venda. Produto líquido = produto que o mercado quer no preço que aceita pagar.\n\n**Due diligence:** Processo de investigação jurídica e documental do terreno e do terrenista.\n\n**Acoplamento:** Processo de adaptação do projeto ao terreno específico.\n\n**Gadgets:** Equipamentos e automação incluídos na casa (ar condicionado, segurança, automação).\n\n**Absorção:** Quantidade de unidades vendidas pelo mercado em um período.\n\n**Ticket médio:** Valor médio de venda das casas em um condomínio ou região.\n\n**TIR (Taxa Interna de Retorno):** Retorno percentual ao ano da operação. TIR do terrenista = retorno dele sobre o valor do lote."
    }'::jsonb,
    2, true);
else
  update public.uni_modulos set tipo='leitura', titulo='Glossário operacional Moní',
    conteudo='{
      "tempo_leitura_min": 10,
      "markdown": "## Glossário operacional Moní\n\n**VGV (Valor Geral de Vendas):** Receita bruta total da operação. VGV Target = preço ideal de venda. VGV Planta = venda no mês 6. VGV Liquidação = venda com desconto no mês 10+.\n\n**BCA (Análise de Viabilidade):** Simulador financeiro da operação em 3 cenários. Meta: %VGV Target ≥ 10%.\n\n**Permuta total:** Terrenista cede o lote e recebe % do VGV líquido. Zero desembolso de caixa pelo franqueado.\n\n**Permuta parcial:** Sinal em dinheiro no ato + % menor do VGV na venda.\n\n**Compra e venda:** SPE compra o lote integralmente. Terrenista sai da operação.\n\n**SPE (Sociedade de Propósito Específico):** Empresa criada só para aquela operação. Isola o risco.\n\n**Funding:** Capital necessário para financiar a operação (terreno + obra).\n\n**Giro:** Velocidade de absorção do produto pelo mercado. Alto giro = vende rápido.\n\n**Liquidez:** Probabilidade e velocidade de venda. Produto líquido = produto que o mercado quer no preço que aceita pagar.\n\n**Due diligence:** Processo de investigação jurídica e documental do terreno e do terrenista.\n\n**Acoplamento:** Processo de adaptação do projeto ao terreno específico.\n\n**Gadgets:** Equipamentos e automação incluídos na casa (ar condicionado, segurança, automação).\n\n**Absorção:** Quantidade de unidades vendidas pelo mercado em um período.\n\n**Ticket médio:** Valor médio de venda das casas em um condomínio ou região.\n\n**TIR (Taxa Interna de Retorno):** Retorno percentual ao ano da operação. TIR do terrenista = retorno dele sobre o valor do lote."
    }'::jsonb
  where id=_mod_id;
end if;

-- Módulo 1-3: Leitura — Modelos de negócio
select id into _mod_id from public.uni_modulos where casa_id = _casa_id and ordem = 3;
if _mod_id is null then
  insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio) values (
    _casa_id, 'leitura', 'Os 3 modelos de negócio — Permuta total, parcial e compra e venda',
    '{
      "tempo_leitura_min": 8,
      "markdown": "## Os 3 modelos de negócio Moní\n\n### Permuta total\nO terrenista cede o lote e recebe uma % do VGV líquido. **Desembolso inicial: zero.** A % de permuta incide sobre a Venda Líquida (VGV bruto menos comissão e impostos) — não sobre o valor do lote. São grandezas diferentes.\n\n> **Atenção crítica:** 30% do valor do lote ≠ 30% do VGV. Uma permuta de 30% do lote pode equivaler a 15–20% do VGV líquido dependendo do múltiplo do empreendimento.\n\nA TIR do terrenista precisa ser ≥ 3× o CDI para o negócio fazer sentido.\n\n### Permuta parcial\nSinal em dinheiro no ato + % menor do VGV na venda. Sinal sugerido: ≈30% do valor do lote (não registrado em cartório). Reduz a principal objeção do terrenista conservador.\n\n### Compra e venda\nSPE compra o lote integralmente. Terrenista sai da operação. Margem bruta maior, mas exposição total de caixa. Usar apenas quando o lote está muito abaixo do mercado com liquidez alta comprovada. **Sempre validar em comitê antes de avançar.**"
    }'::jsonb,
    3, true);
else
  update public.uni_modulos set tipo='leitura', titulo='Os 3 modelos de negócio — Permuta total, parcial e compra e venda',
    conteudo='{
      "tempo_leitura_min": 8,
      "markdown": "## Os 3 modelos de negócio Moní\n\n### Permuta total\nO terrenista cede o lote e recebe uma % do VGV líquido. **Desembolso inicial: zero.** A % de permuta incide sobre a Venda Líquida (VGV bruto menos comissão e impostos) — não sobre o valor do lote. São grandezas diferentes.\n\n> **Atenção crítica:** 30% do valor do lote ≠ 30% do VGV. Uma permuta de 30% do lote pode equivaler a 15–20% do VGV líquido dependendo do múltiplo do empreendimento.\n\nA TIR do terrenista precisa ser ≥ 3× o CDI para o negócio fazer sentido.\n\n### Permuta parcial\nSinal em dinheiro no ato + % menor do VGV na venda. Sinal sugerido: ≈30% do valor do lote (não registrado em cartório). Reduz a principal objeção do terrenista conservador.\n\n### Compra e venda\nSPE compra o lote integralmente. Terrenista sai da operação. Margem bruta maior, mas exposição total de caixa. Usar apenas quando o lote está muito abaixo do mercado com liquidez alta comprovada. **Sempre validar em comitê antes de avançar.**"
    }'::jsonb
  where id=_mod_id;
end if;

-- Módulo 1-4: Vídeo — Jornada macro do franqueado
select id into _mod_id from public.uni_modulos where casa_id = _casa_id and ordem = 4;
if _mod_id is null then
  insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio) values (
    _casa_id, 'video', 'A jornada completa do franqueado — dos Steps ao contrato',
    '{"url":"https://drive.google.com/placeholder-video-jornada","duracao_min":15,"thumbnail":null}'::jsonb,
    4, true);
else
  update public.uni_modulos set tipo='video', titulo='A jornada completa do franqueado — dos Steps ao contrato',
    conteudo='{"url":"https://drive.google.com/placeholder-video-jornada","duracao_min":15,"thumbnail":null}'::jsonb
  where id=_mod_id;
end if;

-- Módulo 1-5: Quiz — Fundamentos
select id into _mod_id from public.uni_modulos where casa_id = _casa_id and ordem = 5;
if _mod_id is null then
  insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio) values (
    _casa_id, 'quiz', 'Quiz — Fundamentos e glossário',
    '{
      "perguntas": [
        {
          "id":"q1",
          "texto":"O que é VGV Target no BCA?",
          "opcoes":["O preço máximo que o franqueado quer vender","O preço de venda ideal que o mercado absorve com velocidade, com meta de %VGV ≥ 10%","O valor do terreno mais o custo de obra","O valor presente da operação no mês 6"],
          "correta":"O preço de venda ideal que o mercado absorve com velocidade, com meta de %VGV ≥ 10%"
        },
        {
          "id":"q2",
          "texto":"Na permuta total, sobre qual base incide a % de permuta?",
          "opcoes":["Sobre o valor do lote","Sobre o VGV bruto","Sobre a Venda Líquida (VGV bruto menos comissão e impostos)","Sobre o resultado alavancado"],
          "correta":"Sobre a Venda Líquida (VGV bruto menos comissão e impostos)"
        },
        {
          "id":"q3",
          "texto":"O que significa ''liquidez'' em uma operação imobiliária?",
          "opcoes":["O lucro líquido após impostos","A probabilidade e velocidade de venda do produto","O saldo de caixa disponível","O valor presente líquido da operação"],
          "correta":"A probabilidade e velocidade de venda do produto"
        },
        {
          "id":"q4",
          "texto":"Qual a principal vantagem da permuta parcial vs. permuta total para fechar negócio?",
          "opcoes":["Maior margem para o franqueado","Menor risco financeiro","O sinal elimina a principal objeção do terrenista conservador","Menor % do VGV comprometido"],
          "correta":"O sinal elimina a principal objeção do terrenista conservador"
        },
        {
          "id":"q5",
          "texto":"Qual o %VGV mínimo ideal para o cenário Target no BCA?",
          "opcoes":["5%","8%","10%","15%"],
          "correta":"10%"
        }
      ]
    }'::jsonb,
    5, true);
else
  update public.uni_modulos set tipo='quiz', titulo='Quiz — Fundamentos e glossário',
    conteudo='{
      "perguntas": [
        {
          "id":"q1",
          "texto":"O que é VGV Target no BCA?",
          "opcoes":["O preço máximo que o franqueado quer vender","O preço de venda ideal que o mercado absorve com velocidade, com meta de %VGV ≥ 10%","O valor do terreno mais o custo de obra","O valor presente da operação no mês 6"],
          "correta":"O preço de venda ideal que o mercado absorve com velocidade, com meta de %VGV ≥ 10%"
        },
        {
          "id":"q2",
          "texto":"Na permuta total, sobre qual base incide a % de permuta?",
          "opcoes":["Sobre o valor do lote","Sobre o VGV bruto","Sobre a Venda Líquida (VGV bruto menos comissão e impostos)","Sobre o resultado alavancado"],
          "correta":"Sobre a Venda Líquida (VGV bruto menos comissão e impostos)"
        },
        {
          "id":"q3",
          "texto":"O que significa ''liquidez'' em uma operação imobiliária?",
          "opcoes":["O lucro líquido após impostos","A probabilidade e velocidade de venda do produto","O saldo de caixa disponível","O valor presente líquido da operação"],
          "correta":"A probabilidade e velocidade de venda do produto"
        },
        {
          "id":"q4",
          "texto":"Qual a principal vantagem da permuta parcial vs. permuta total para fechar negócio?",
          "opcoes":["Maior margem para o franqueado","Menor risco financeiro","O sinal elimina a principal objeção do terrenista conservador","Menor % do VGV comprometido"],
          "correta":"O sinal elimina a principal objeção do terrenista conservador"
        },
        {
          "id":"q5",
          "texto":"Qual o %VGV mínimo ideal para o cenário Target no BCA?",
          "opcoes":["5%","8%","10%","15%"],
          "correta":"10%"
        }
      ]
    }'::jsonb
  where id=_mod_id;
end if;


-- ================================================================
-- CASA 2 — Step One
-- ================================================================
select id into _casa_id from public.uni_casas where slug = 'step-one';
if _casa_id is null then raise exception 'Casa step-one não encontrada'; end if;

update public.uni_modulos set
  titulo = 'O que é o Step One e por que é obrigatório',
  conteudo = '{
    "tempo_leitura_min": 8,
    "markdown": "## O Step One é um sistema de inteligência imobiliária\n\nNão é um checklist. É o processo que transforma dados de mercado em hipóteses de viabilidade.\n\n### O que o Step One faz\n- Coleta dados reais de oferta e demanda\n- Estrutura e compara condomínios\n- Hierarquiza oportunidades\n- Transforma mercado em hipótese\n\n### As 6 abas da planilha\n1. **Aba 1 — Mapa de Competidores: Base** — dados brutos de casas à venda acima de R$12k/m². Atualizar mensalmente.\n2. **Aba 2 — Resultado** — médias por condomínio e compatibilidade Moní\n3. **Aba 3 — Lotes** — portfólio disponível com topografia, recuos e sol\n4. **Aba 4 — Check de Demanda** — respostas dos corretores. Duplicar para cada condomínio.\n5. **Aba 5 — Valor × Giro** — faixa com melhor equilíbrio margem × velocidade\n6. **Aba 6 — Hipótese** — síntese obrigatória mensal\n\n### Por que é obrigatório\nSem o Step One, qualquer hipótese de preço é chute. O comitê não aprova operações sem base de dados real."
  }'::jsonb
where casa_id = _casa_id and ordem = 1;

update public.uni_modulos set
  titulo = 'Como preencher e interpretar as 6 abas do Step One',
  conteudo = '{"url":"https://drive.google.com/placeholder-video-stepone","duracao_min":18,"thumbnail":null}'::jsonb,
  tipo = 'video'
where casa_id = _casa_id and ordem = 2;

-- ================================================================
-- CASA 3 — Hipótese de liquidez
-- ================================================================
select id into _casa_id from public.uni_casas where slug = 'hipotese';
if _casa_id is null then raise exception 'Casa hipotese não encontrada'; end if;

update public.uni_modulos set
  titulo = 'Como funciona o BCA — os 3 cenários e como pensar viabilidade',
  conteudo = '{
    "tempo_leitura_min": 10,
    "markdown": "## O BCA é o motor da operação\n\nNão é uma planilha de preenchimento. É um simulador de tomada de decisão.\n\n### Os 3 cenários\n- **Planta:** venda no mês 6, casa pronta. Preço de mercado sem desconto.\n- **Target:** o preço ideal que o mercado absorve com velocidade. %VGV deve ser ≥ 10%.\n- **Liquidação:** venda no mês 10+ com desconto. %VGV = 0% (ponto de equilíbrio). A margem entre Target e Liquidação deve ser ≥ 10% — essa é a gordura da operação.\n\n### Como preencher — ordem correta\n1. Comece pelo VGV Target (não pelo que quer ganhar — pelo que o mercado paga)\n2. Preencha o terreno (base + variável ou % permuta)\n3. Selecione a casa no configurador e informe o custo\n4. Não esqueça os inputs negativos: taxa de plataforma, gestão, projetos, setup\n5. Calcule a TIR do terrenista — precisa ser ≥ 3× o CDI\n\n### Erros que invalidam o BCA\n- Começar pelo VGV que quer vender em vez do que o mercado absorve\n- Esquecer inputs negativos\n- Não calcular o cenário de liquidação\n- Confundir % do valor do lote com % do VGV"
  }'::jsonb,
  tipo = 'leitura'
where casa_id = _casa_id and ordem = 1;

update public.uni_modulos set
  titulo = 'Como usar o Configurador Moní para escolher e precificar a casa',
  conteudo = '{"url":"https://drive.google.com/placeholder-video-configurador","duracao_min":12,"thumbnail":null}'::jsonb,
  tipo = 'video'
where casa_id = _casa_id and ordem = 2;

-- ================================================================
-- CASA 4 — Comitê
-- ================================================================
select id into _casa_id from public.uni_casas where slug = 'comite';
if _casa_id is null then raise exception 'Casa comite não encontrada'; end if;

update public.uni_modulos set
  titulo = 'O comitê não é burocracia — é o filtro de risco da operação',
  conteudo = '{
    "tempo_leitura_min": 7,
    "markdown": "## O que o comitê avalia\n\nO comitê analisa toda operação por 5 dimensões:\n\n1. **Liquidez** — velocidade de venda, absorção, ticket compatível, temperatura da praça\n2. **Produto** — compatibilidade produto × lote × condomínio × ticket\n3. **Estrutura financeira** — margem, gordura, custo de obra, prazo, risco\n4. **Estrutura jurídica** — matrícula, documentação, riscos, compliance\n5. **Estrutura operacional** — capacidade do franqueado, fornecedores\n\n## O template tem 12 seções\n\n1. Localização — condomínio e contexto\n2. Características do condomínio\n3. Oferta atual (estoque)\n4. Demanda (histórico de vendas)\n5. Testes operacionais (BCAs)\n6. Lote prospectado\n7. Produto proposto (lote + casa)\n8. A operação (BCA)\n9. Análise de mercado (batalha de casas)\n10. Score e posicionamento competitivo\n11. Viabilidade e liquidez\n12. Conclusão e recomendação\n\n## Como defender a tese\n\nO franqueado não apresenta um preenchimento. Ele defende uma tese de incorporação com dados reais, exemplos comparativos e racional de liquidez."
  }'::jsonb,
  tipo = 'leitura'
where casa_id = _casa_id and ordem = 1;

update public.uni_modulos set
  titulo = 'Preenchendo o template de comitê — seção por seção',
  conteudo = '{"url":"https://drive.google.com/placeholder-video-comite","duracao_min":20,"thumbnail":null}'::jsonb,
  tipo = 'video'
where casa_id = _casa_id and ordem = 2;

-- ================================================================
-- CASA 5 — Negociação
-- ================================================================
select id into _casa_id from public.uni_casas where slug = 'negociacao';
if _casa_id is null then raise exception 'Casa negociacao não encontrada'; end if;

update public.uni_modulos set
  titulo = 'Como estruturar o pitch para o terrenista',
  conteudo = '{
    "tempo_leitura_min": 8,
    "markdown": "## O pitch ao terrenista\n\nVocê não está vendendo uma casa. Está vendendo uma oportunidade de investimento com retorno superior ao CDI e sem trabalho operacional.\n\n## O que o terrenista precisa entender\n\n1. **Quanto vai receber** — TIR projetada vs CDI. Mostrar que é 3× ou mais.\n2. **Quando vai receber** — prazo realista. Não prometer o que não pode cumprir.\n3. **Qual o risco** — a SPE isola o risco. O contrato de opção protege ambos.\n4. **Quem garante** — a Moní como franqueadora, o histórico de operações.\n\n## Objeções mais comuns\n\n**\"Prefiro vender o lote em dinheiro\"**\nMostrar a TIR da permuta vs. o rendimento da poupança/CDI com o valor do lote. A permuta geralmente é melhor.\n\n**\"Não confio em receber depois\"**\nExplicar o contrato de opção e a estrutura da SPE. Oferecer permuta parcial com sinal para reduzir a objeção.\n\n**\"O lote vale mais do que você está calculando\"**\nMostrar o mapa de competidores e o BCA. O preço é função do que o mercado absorve, não do que o terrenista quer.\n\n## Mensagem de primeiro contato ao corretor\n\n\"Olá, sou [nome], da Casa Moní, estou mapeando oportunidades para incorporação residencial de alto padrão. Em quais condomínios você tem vendido mais casas com valor acima de R$12.000/m²?\""
  }'::jsonb,
  tipo = 'leitura'
where casa_id = _casa_id and ordem = 1;

update public.uni_modulos set
  titulo = 'Simulação de reunião com terrenista — objeções e respostas',
  conteudo = '{"url":"https://drive.google.com/placeholder-video-negociacao","duracao_min":15,"thumbnail":null}'::jsonb,
  tipo = 'video'
where casa_id = _casa_id and ordem = 2;

-- ================================================================
-- CASA 6 — Check legal
-- ================================================================
select id into _casa_id from public.uni_casas where slug = 'check-legal';
if _casa_id is null then raise exception 'Casa check-legal não encontrada'; end if;

update public.uni_modulos set
  titulo = 'O que verificar antes de assinar — due diligence do lote',
  conteudo = '{
    "tempo_leitura_min": 8,
    "markdown": "## Due diligence do terreno\n\n### Documentos obrigatórios do lote\n- Matrícula atualizada (máximo 30 dias)\n- Certidão negativa de ônus e ações\n- Habite-se do condomínio (se construído)\n- Convenção e regimento interno do condomínio\n- Plantas aprovadas do lote\n\n### Documentos obrigatórios do terrenista\n- RG e CPF\n- Comprovante de estado civil (certidão de casamento se aplicável)\n- Comprovante de residência\n- Certidões negativas (federal, estadual, trabalhista)\n- Se PJ: contrato social atualizado, CNPJ, certidões da empresa\n\n### Principais riscos a verificar\n- Hipoteca ou alienação fiduciária sobre o lote\n- Ações judiciais contra o terrenista\n- Dívidas de IPTU em aberto\n- Restrições de uso no condomínio\n- Confrontação da área com o registro\n\n### Checklist de análise preliminar de crédito\nDisponível na biblioteca — Jurídico."
  }'::jsonb,
  tipo = 'leitura'
where casa_id = _casa_id and ordem = 1;

update public.uni_modulos set
  titulo = 'Checklist legal — preenchimento e validação',
  conteudo = '{"url":"https://drive.google.com/placeholder-video-juridico","duracao_min":12,"thumbnail":null}'::jsonb,
  tipo = 'video'
where casa_id = _casa_id and ordem = 2;

-- ================================================================
-- CASA 7 — Crédito
-- ================================================================
select id into _casa_id from public.uni_casas where slug = 'credito';
if _casa_id is null then raise exception 'Casa credito não encontrada'; end if;

update public.uni_modulos set
  titulo = 'Como funciona o funding — crédito de obra e Moní Capital',
  conteudo = '{
    "tempo_leitura_min": 9,
    "markdown": "## Estrutura de funding da operação\n\n### Crédito de obra\nFinanciamento específico para a construção, liberado por medições mensais conforme o avanço. O imóvel em construção serve como garantia.\n\n### Moní Capital\nEstrutura de captação privada da Moní para financiar operações dos franqueados. Envolve investidores qualificados, estrutura CVM e recompra programada.\n\n### Carta fiança\nGarantia bancária ou institucional emitida em favor do credor. Substitui a caução em determinadas estruturas de funding.\n\n### Recompra programada\nMecanismo em que o franqueado se compromete a recomprar o lote do investidor caso a venda não ocorra no prazo. Reduz o risco percebido pelo investidor.\n\n### Liquidação forçada\nCláusula ativada quando o prazo de venda é ultrapassado. Define condições de desconto e prioridade de pagamento.\n\n## Sequência correta\n1. BCA aprovado em comitê\n2. Contrato de opção assinado\n3. Due diligence concluída\n4. Análise preliminar de crédito enviada\n5. Definição da estrutura de funding\n6. Carta fiança ou garantia estruturada\n7. SPE aberta e conta bancária criada"
  }'::jsonb,
  tipo = 'leitura'
where casa_id = _casa_id and ordem = 1;

update public.uni_modulos set
  titulo = 'Moní Capital e estruturação financeira da operação',
  conteudo = '{"url":"https://drive.google.com/placeholder-video-credito","duracao_min":14,"thumbnail":null}'::jsonb,
  tipo = 'video'
where casa_id = _casa_id and ordem = 2;


-- ================================================================
-- CASA 8 — Contrato final
-- ================================================================
select id into _casa_id from public.uni_casas where slug = 'contrato-final';
if _casa_id is null then raise exception 'Casa contrato-final não encontrada'; end if;

update public.uni_modulos set
  titulo = 'Da opção ao contrato de permuta — o que muda e o que se formaliza',
  conteudo = '{
    "tempo_leitura_min": 7,
    "markdown": "## Documentos da fase de contrato final\n\n### Contrato de opção\nDá ao franqueado o direito (não a obrigação) de adquirir o lote. Protege a operação durante o período de due diligence e aprovação em comitê.\n\n### Contrato de permuta\nDocumento definitivo. Formaliza a estrutura de aquisição (total, parcial ou C&V). Inclui: valor do lote, % de permuta, prazo, condições de pagamento e cláusulas de proteção.\n\n### SPE (Sociedade de Propósito Específico)\nEmpresa criada exclusivamente para aquela operação. Isola o risco do franqueado e do terrenista. CNPJ próprio, conta bancária própria, contabilidade separada.\n\n### Conta bancária da SPE\nToda movimentação financeira da operação passa por essa conta. Transparência total para todas as partes.\n\n## Sequência de assinaturas\n1. Contrato de permuta assinado por todas as partes\n2. SPE aberta (CNPJ + conta)\n3. Documentação enviada ao jurídico Moní\n4. Início dos projetos (legal, executivo)\n5. Protocolo de aprovação no condomínio e prefeitura"
  }'::jsonb,
  tipo = 'leitura'
where casa_id = _casa_id and ordem = 1;

update public.uni_modulos set
  titulo = 'Abrindo a SPE e estruturando o contrato final',
  conteudo = '{"url":"https://drive.google.com/placeholder-video-contrato","duracao_min":11,"thumbnail":null}'::jsonb,
  tipo = 'video'
where casa_id = _casa_id and ordem = 2;

-- ================================================================
-- CASA 9 — Pré-obra
-- ================================================================
select id into _casa_id from public.uni_casas where slug = 'pre-obra';
if _casa_id is null then raise exception 'Casa pre-obra não encontrada'; end if;

update public.uni_modulos set
  titulo = 'Checklist pré-obra — da topografia ao protocolo de aprovação',
  conteudo = '{
    "tempo_leitura_min": 8,
    "markdown": "## Sequência obrigatória pré-obra\n\n1. **Topografia** — levantamento planialtimétrico do lote. Base para o projeto de implantação.\n2. **Sondagem** — análise do solo. Define o tipo de fundação necessária.\n3. **Projeto legal** — elaborado pelo time de arquitetura Moní. Inclui implantação, fachadas e cortes.\n4. **Aprovação no condomínio** — protocolo com a administração. Prazo variável (15–60 dias).\n5. **Aprovação na prefeitura** — alvará de construção. Prazo variável por município.\n6. **Compatibilização** — cruzamento entre projetos arquitetônico, estrutural, hidráulico e elétrico.\n7. **Acoplamento** — adaptação do modelo Moní ao terreno específico. Ajustes de implantação.\n8. **Contratações** — mestre de obras, engenheiro responsável, fornecedores principais.\n\n## O que o franqueado faz\nProtocola o projeto no condomínio com orientação da Moní. Acompanha o prazo de aprovação. Reporta no Hub Fly."
  }'::jsonb,
  tipo = 'leitura'
where casa_id = _casa_id and ordem = 1;

update public.uni_modulos set
  titulo = 'Orientações externas pré-obra — do protocolo ao início da construção',
  conteudo = '{"url":"https://drive.google.com/placeholder-video-preobra","duracao_min":13,"thumbnail":null}'::jsonb,
  tipo = 'video'
where casa_id = _casa_id and ordem = 2;

-- ================================================================
-- CASA 10 — Operação
-- ================================================================
select id into _casa_id from public.uni_casas where slug = 'operacao';
if _casa_id is null then raise exception 'Casa operacao não encontrada'; end if;

update public.uni_modulos set
  titulo = 'Gestão financeira e operacional da obra',
  conteudo = '{
    "tempo_leitura_min": 7,
    "markdown": "## O que o franqueado gerencia na operação\n\n### Financeiro\n- Fluxo de pagamentos pela conta da SPE\n- Medições mensais para liberação do crédito de obra\n- Controle de estoque de materiais\n- Prestação de contas para investidores (se aplicável)\n\n### Qualidade\n- Acompanhamento do cronograma físico-financeiro\n- Visitas de vistoria com o engenheiro responsável\n- Reporte de desvios no Hub Fly\n\n### Gestão no Hub Fly\n- Atualizar o card da operação no Kanban a cada visita\n- Registrar chamados via Sirene para dúvidas técnicas\n- Manter fotos do avanço de obra nos anexos do card\n\n## Ritmo esperado\nVisita ao canteiro pelo menos 1× por semana. Relatório mensal de avanço para a Moní. Atualização do Hub Fly a cada movimentação relevante."
  }'::jsonb,
  tipo = 'leitura'
where casa_id = _casa_id and ordem = 1;

update public.uni_modulos set
  titulo = 'Gestão de obra no Hub Fly — Kanban e Sirene',
  conteudo = '{"url":"https://drive.google.com/placeholder-video-operacao","duracao_min":10,"thumbnail":null}'::jsonb,
  tipo = 'video'
where casa_id = _casa_id and ordem = 2;

-- ================================================================
-- CASA 11 — Venda e liquidação
-- ================================================================
select id into _casa_id from public.uni_casas where slug = 'venda-liquidacao';
if _casa_id is null then raise exception 'Casa venda-liquidacao não encontrada'; end if;

update public.uni_modulos set
  titulo = 'Como comercializar e qual estratégia de preço usar',
  conteudo = '{
    "tempo_leitura_min": 7,
    "markdown": "## Estratégia de comercialização\n\n### Quando começar a vender\nIdealmente antes do fim da obra — venda na planta (mês 6) maximiza o resultado. A batalha de casas já foi feita no Step 2: o posicionamento competitivo está validado.\n\n### Estratégia de preço\nDuas estratégias válidas, nunca as duas ao mesmo tempo:\n- **Produto nitidamente melhor, preço levemente superior (até 10%)** — o comprador percebe o valor\n- **Casa compacta que combate em preço** — menor em m², igual em programa, mais barata que a concorrência\n\n### Recompra programada\nSe o prazo de venda ultrapassar o previsto, a cláusula de recompra pode ser ativada. Isso recompra o lote do investidor pelo valor original + correção. Evitar chegando a esse ponto com uma boa batalha de casas desde o início.\n\n### Encerramento da operação\n1. Venda da casa escriturada\n2. Pagamento ao terrenista (% VGV ou saldo restante)\n3. Pagamento ao investidor (se houver)\n4. Pagamento das taxas Moní\n5. Distribuição do resultado ao franqueado\n6. Encerramento da SPE\n7. Registro do caso na biblioteca de estudos reais"
  }'::jsonb,
  tipo = 'leitura'
where casa_id = _casa_id and ordem = 1;

update public.uni_modulos set
  titulo = 'Liquidação da operação — da venda ao encerramento da SPE',
  conteudo = '{"url":"https://drive.google.com/placeholder-video-liquidacao","duracao_min":11,"thumbnail":null}'::jsonb,
  tipo = 'video'
where casa_id = _casa_id and ordem = 2;

end $modconteudo$;

-- ============================================================
-- Verificação final — esperado:
-- casa 0: 4 módulos | casa 1: 5 módulos | casas 2–11: 2 módulos cada
-- total: 29 módulos
-- ============================================================
select c.numero, c.slug, count(m.id) as modulos
from public.uni_casas c
left join public.uni_modulos m on m.casa_id = c.id
group by c.id, c.numero, c.slug
order by c.numero;

select count(*) as total_modulos from public.uni_modulos;
