# Passo a passo detalhado — Refatoração (IBGE, Apify, 3 casas)

Este guia reúne tudo o que você precisa **executar** para a refatoração rodar: dados automáticos do IBGE na Etapa 1, mensagem sobre Apify nas Etapas 4 e 5, e escolha dos 3 modelos do catálogo na Etapa 8 (batalhas = todas as casas ZAP × esses 3).

---

## O que você vai fazer (resumo)

| # | O que fazer |
|---|-------------|
| 1 | Rodar a migração **007** no Supabase (tabela `catalogo_escolhidos`) |
| 2 | Subir o sistema (`npm run dev`) e abrir no navegador |
| 3 | Fazer login e garantir que processos usam **Estado = UF** (ex.: SP) |
| 4 | Na **Etapa 1**, clicar em **"Buscar dados do IBGE"** e salvar a narrativa |
| 5 | Nas **Etapas 4 e 5**, conferir o texto sobre listagem manual / Apify em breve |
| 6 | Na **Etapa 8**, escolher **3 modelos do catálogo Moní** e preencher batalhas (todas as casas ZAP × esses 3) |

---

## Pré-requisitos

- **Sprint 4** já aplicada: tabelas `listings_casas`, `listings_lotes`, `catalogo_casas`, `lote_escolhido` existem no Supabase (arquivo **O_QUE_FAZER_PARA_SPRINT_4_FUNCIONAR.md**).
- **Migração 005** (batalhas) já aplicada, se você for usar a Etapa 8 (arquivo **PASSO_A_PASSO_ETAPA8_BATALHAS.md**).
- Projeto com **variáveis de ambiente** do Supabase: arquivo **`.env.local`** na raiz do VIABILIDADE com:
  - `NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`

---

## Passo 1 — Rodar a migração 007 no Supabase (catalogo_escolhidos)

Sem este passo, a **Etapa 8** não consegue salvar as “3 casas escolhidas” e pode dar erro.

1. Abra o navegador e vá em **https://supabase.com**. Faça login e abra o **projeto** do Viabilidade.
2. No menu da esquerda, clique em **SQL Editor**.
3. Clique no **+** (Nova consulta) para abrir uma nova aba.
4. No seu computador, abra a pasta do projeto:
   - **Explorador de Arquivos** → **OneDrive** → **Área de Trabalho** → **VIABILIDADE** → **supabase** → **migrations**
5. Abra o arquivo **007_catalogo_escolhidos.sql** (botão direito → **Abrir com** → **Bloco de notas**).
6. Selecione **todo** o conteúdo (**Ctrl+A**) e copie (**Ctrl+C**).
7. Volte ao **SQL Editor** do Supabase, apague qualquer texto na caixa e **cole** o que você copiou (**Ctrl+V**).
8. Clique em **Run**.
9. Deve aparecer mensagem em **verde** (ex.: **"Success"**).

**Pronto:** a tabela **catalogo_escolhidos** foi criada (e **casas_escolhidas** foi removida, se existia). Ela guarda os **3 modelos do catálogo Moní** que o Frank escolhe para batalhar com todas as casas da ZAP e para o BCA.

---

## Passo 2 — Subir o sistema no seu computador

1. Abra o **PowerShell** na pasta **VIABILIDADE**:
   - **Explorador de Arquivos** → OneDrive → Área de Trabalho → **VIABILIDADE**
   - Clique na **barra de endereço**, digite **powershell** e aperte **Enter**
2. Se o servidor **não** estiver rodando, digite:
   ```text
   npm run dev
   ```
   e aperte **Enter**.
3. Espere aparecer **"✓ Ready"** e algo como **"Local: http://localhost:3000"** (ou 3001).
4. **Deixe a janela do PowerShell aberta** enquanto usar o sistema.

---

## Passo 3 — Abrir o sistema e fazer login

1. No navegador, acesse **http://localhost:3000** (ou **http://localhost:3001** se for o seu caso).
2. Se não estiver logada, clique em **Entrar** e informe **e-mail** e **senha**.

---

## Passo 4 — Estado (UF) no início do processo

Para o **IBGE** encontrar o município na Etapa 1, o **Estado** do processo deve ser a **sigla da UF**.

1. Na home, clique em **Iniciar Step One** (ou **Meus processos** se for abrir um processo já criado).
2. Ao **criar um novo processo**:
   - Em **Cidade**, use o nome oficial do município (ex.: **Campinas**, **São Paulo**).
   - Em **Estado (UF)**, **selecione na lista** o estado (todas as 27 UFs estão disponíveis: AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO). Cada opção aparece como **Sigla — Nome** (ex.: **SP — São Paulo**).
3. Se você já criou processos com estado em texto livre antes dessa alteração, edite no Supabase (Table Editor → **processo_step_one** → coluna **estado** = **SP**) ou crie um novo processo escolhendo a UF na lista.

**Resumo:** escolha o estado na **lista de UFs** ao iniciar o processo para o IBGE funcionar na Etapa 1.

---

## Passo 5 — Etapa 1: buscar dados do IBGE e salvar narrativa

1. Clique em **Meus processos** e abra **um processo** (ou crie um novo em **Iniciar Step One**).
2. Na lista das 11 etapas, clique em **Etapa 1 — Análise da praça**.
3. Você deve ver:
   - A **praça** no topo (Cidade, Estado).
   - O bloco **"Dados automáticos (IBGE)"** com o botão **"Buscar dados do IBGE"**.
   - O bloco **"Outras fontes (em breve)"** (Atlas Brasil e Google Maps).
   - O **formulário de análise (narrativa)** e o checkbox **"Marcar etapa 1 como concluída"**.
4. Clique em **"Buscar dados do IBGE"**.
   - Se a cidade e o estado (UF) estiverem corretos, deve aparecer uma caixa com: **Município**, **UF**, **Região**, **Microrregião**, **Mesorregião**, **Região imediata**, **Região intermediária**.
   - Se aparecer erro (ex.: "Município não encontrado"), confira o **nome exato da cidade** (como no IBGE) e se o **Estado** está em **UF** (2 letras).
5. (Opcional) Preencha a **narrativa** usando os dados do IBGE e complemente com sua análise.
6. Se quiser, marque **"Marcar etapa 1 como concluída"** e clique em **Salvar**.

**Pronto:** a Etapa 1 está usando dados automáticos do IBGE e o texto sobre Atlas Brasil e Google Maps em breve.

---

## Passo 6 — Etapas 4 e 5: texto sobre listagem manual e Apify

1. Vá para **Etapa 4 — Listagem casas à venda (ZAP)**.
   - No topo deve aparecer: *"Adicione casas à venda manualmente. A integração com Apify (varredura ZAP) será conectada em breve."*
2. Vá para **Etapa 5 — Listagem lotes à venda**.
   - No topo deve aparecer: *"Adicione lotes à venda manualmente. A integração com Apify (varredura ZAP) será conectada em breve."*

Nada mais é necessário aqui; é só conferir que a mensagem aparece. O cadastro continua **manual** até a integração com o Apify.

---

## Passo 7 — Etapa 8: escolher 3 modelos do catálogo e preencher batalhas

1. Tenha **casas** cadastradas na **Etapa 4** (pelo menos uma; todas entram nas batalhas).
2. Vá para **Etapa 6** e confira se há **pelo menos 3 modelos** no catálogo Moní (ex.: Modelo A, B, C). Se tiver menos de 3, cadastre mais no Supabase (tabela **catalogo_casas**).
3. Na lista das 11 etapas, clique em **Etapa 8 — Batalhas (preço, produto, localização)**.
4. **Primeira vez (ainda não escolheu 3 modelos do catálogo):**
   - Deve aparecer o texto: *"Escolha 3 modelos do catálogo Moní que vão batalhar com todas as casas listadas na ZAP."*
   - Três dropdowns: **Modelo 1**, **Modelo 2**, **Modelo 3**. Em cada um, escolha um modelo do catálogo (cada modelo só pode ser escolhido uma vez).
   - Clique em **"Salvar 3 modelos escolhidos"**.
   - A página recarrega e passa a mostrar as **batalhas**.
5. **Depois de salvar os 3 modelos:**
   - Aparecem **todas as casas da ZAP** (Etapa 4). Para **cada** casa ZAP, há 3 blocos (um por modelo do catálogo escolhido) com os selects Preço, Produto e Localização (-2 a +2).
   - Preencha as notas; elas são **salvas automaticamente** ao mudar cada select.

**Pronto:** as batalhas são feitas com **todas as casas listadas na ZAP** × **os 3 modelos do catálogo** escolhidos. A Etapa 10 (BCA) usará esses mesmos 3 modelos quando for implementada.

---

## Resumo em tabela — Ordem de execução

| Ordem | O que fazer |
|-------|-------------|
| 1 | **Supabase** → SQL Editor → abrir **007_catalogo_escolhidos.sql** → copiar todo o conteúdo → colar no Editor → **Run**. (Se ainda existir 006, pode rodar 007 direto: ela remove casas_escolhidas e cria catalogo_escolhidos.) |
| 2 | **PowerShell** na pasta VIABILIDADE → **npm run dev** → deixar a janela aberta. |
| 3 | **Navegador** → http://localhost:3000 (ou 3001) → **Entrar** (login). |
| 4 | Ao **criar processo**: Cidade = nome do município; **Estado (UF)** = selecionar na lista (ex.: SP — São Paulo). |
| 5 | **Etapa 1** → **Buscar dados do IBGE** → conferir dados na tela → preencher narrativa (opcional) → **Salvar**. |
| 6 | **Etapa 4** e **Etapa 5** → conferir o texto sobre listagem manual e Apify em breve. |
| 7 | **Etapa 4** → ter pelo menos **3 casas** cadastradas. |
| 8 | **Etapa 8** → escolher **Modelo 1**, **Modelo 2**, **Modelo 3** do catálogo nos dropdowns → **Salvar 3 modelos escolhidos** → preencher batalhas (todas as casas ZAP × 3 modelos; notas -2 a +2). |

---

## Se algo der errado

- **"relation catalogo_escolhidos does not exist"**  
  A migração **007** não foi aplicada. Rode o **007_catalogo_escolhidos.sql** no SQL Editor do Supabase (Passo 1).

- **Etapa 1 — "Buscar dados do IBGE" dá erro ou "Município não encontrado"**  
  - Confira se o **Estado** do processo está em **UF** (2 letras: SP, RJ, MG, etc.).  
  - Confira se o nome da **Cidade** está como no IBGE (ex.: "Campinas", "São Paulo").  
  - Se o processo foi criado com estado em nome completo, edite no Supabase (Table Editor → **processo_step_one** → coluna **estado** = **SP**) ou crie um novo processo com UF.

- **Etapa 1 — Dados do IBGE não aparecem após buscar**  
  Recarregue a página (F5). Os dados ficam gravados em **etapa_progresso** (etapa_id = 1, campo **dados_json.analise_ibge**).

- **Etapa 8 — "Nenhuma casa listada na Etapa 4"**  
  Cadastre pelo menos uma casa na **Etapa 4** do mesmo processo e volte à Etapa 8.

- **Etapa 8 — "O catálogo Moní precisa ter pelo menos 3 modelos"**  
  Cadastre pelo menos 3 modelos na tabela **catalogo_casas** no Supabase (ou use o seed da Sprint 4 e adicione mais um).

- **Etapa 8 — Não consigo salvar os 3 modelos / erro ao salvar**  
  Verifique se a migração **007** foi aplicada (tabela **catalogo_escolhidos** existe no Supabase). Confirme também que está logada e que o processo é seu.

Quando todos os passos acima derem certo, a **refatoração** (IBGE na Etapa 1, texto Apify nas 4 e 5, e 3 casas na Etapa 8) está rodando no seu ambiente.
