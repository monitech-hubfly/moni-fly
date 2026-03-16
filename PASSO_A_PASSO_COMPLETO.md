# Passo a passo completo — Todas as alterações

Siga **na ordem**. Se algo já tiver sido feito (ex.: migrações antigas), pule o passo correspondente e vá para o próximo.

---

## Pré-requisitos

- Conta no **Supabase** e projeto do Viabilidade criado.
- Na raiz do projeto **VIABILIDADE**, arquivo **`.env.local`** com:
  - `NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon`
- **Node.js** instalado (para rodar `npm run dev`).

---

## PARTE 1 — Migrações no Supabase

Todas as etapas abaixo são no **Supabase** → **SQL Editor** (menu da esquerda) → **+ Nova consulta**.

### Passo 1 — Abrir o SQL Editor

1. Acesse **https://supabase.com** e faça login.
2. Abra o **projeto** do Viabilidade.
3. No menu da esquerda, clique em **SQL Editor**.
4. Clique em **+** (Nova consulta).

---

### Passo 2 — Rodar as migrações na ordem certa

No seu PC, abra a pasta:

**Explorador de Arquivos** → **OneDrive** → **Área de Trabalho** → **VIABILIDADE** → **supabase** → **migrations**

Para **cada** arquivo da lista abaixo (um de cada vez):

1. Abra o arquivo (botão direito → **Abrir com** → **Bloco de notas**).
2. Selecione **todo** o conteúdo (**Ctrl+A**) e copie (**Ctrl+C**).
3. No **SQL Editor** do Supabase, apague o que estiver na caixa e **cole** (**Ctrl+V**).
4. Clique em **Run**.
5. Confira a mensagem em **verde** (Success).
6. **Antes de passar para o próximo arquivo**, apague o conteúdo do Editor e repita para o próximo.

**Ordem dos arquivos (rode nesta ordem):**

| # | Arquivo | O que faz |
|---|---------|-----------|
| 1 | **001_initial_schema.sql** | Cria tabelas iniciais (profiles, processo_step_one, etapa_progresso, etc.). |
| 2 | **002_idempotent_schema.sql** | Ajustes idempotentes do schema. |
| 3 | **003_fix_rls_recursion_profiles.sql** | Corrige RLS em profiles (evita recursão). |
| 4 | **004_sprint4_listings_catalogo_lote.sql** | Cria listings_casas, listings_lotes, catalogo_casas, lote_escolhido + seed de 2 modelos. |
| 5 | **005_batalhas_etapa8.sql** | Cria tabela batalhas (notas preço, produto, localização). |
| 6 | **007_catalogo_escolhidos.sql** | Remove casas_escolhidas (se existir) e cria catalogo_escolhidos (3 modelos do catálogo por processo). |

**Importante:** **NÃO** rode o arquivo **006_casas_escolhidas.sql**. A lógica foi substituída pela **007** (escolha de 3 **modelos do catálogo**, não 3 casas ZAP).

**Se você já tiver rodado migrações antes:**

- Se já rodou 001 a 005: rode **só a 007** (ela remove a tabela da 006 e cria a nova).
- Se já rodou a 007 e aparecer "relation catalogo_escolhidos already exists": pode **ignorar** e seguir para a Parte 2.

---

## PARTE 2 — Subir o sistema no seu computador

### Passo 3 — Abrir o PowerShell na pasta do projeto

1. Abra o **Explorador de Arquivos**.
2. Vá até **OneDrive** → **Área de Trabalho** → **VIABILIDADE**.
3. Clique na **barra de endereço** da pasta, digite **powershell** e aperte **Enter**.

---

### Passo 4 — Instalar dependências (se ainda não fez)

No PowerShell, digite:

```text
npm install
```

Aperte **Enter** e espere terminar.

---

### Passo 5 — Iniciar o servidor

No mesmo PowerShell, digite:

```text
npm run dev
```

Aperte **Enter**. Espere aparecer **"✓ Ready"** e algo como **"Local: http://localhost:3000"** (ou 3001).

**Deixe essa janela aberta** enquanto usar o sistema.

---

## PARTE 3 — Usar o sistema no navegador

### Passo 6 — Abrir o sistema e fazer login

1. No navegador, acesse **http://localhost:3000** (ou a porta que apareceu no passo 5).
2. Clique em **Entrar**.
3. Informe **e-mail** e **senha** e faça login.

---

### Passo 7 — Criar um processo (com Estado = UF)

1. Na home, clique em **Iniciar Step One**.
2. Preencha:
   - **Cidade:** nome do município (ex.: **Campinas**, **São Paulo**).
   - **Estado (UF):** escolha na **lista** (ex.: **SP — São Paulo**). Não digite; use o dropdown para o IBGE funcionar na Etapa 1.
3. Clique em **Iniciar processo**.
4. Você será levado para a página do processo com as 11 etapas.

---

### Passo 8 — Etapa 1: dados do IBGE e narrativa

1. Na lista das 11 etapas, clique em **Etapa 1 — Análise da praça**.
2. Você verá a **praça** (cidade, estado), o bloco **"Dados automáticos (IBGE)"** e o bloco **"Outras fontes (em breve)"**.
3. Clique no botão **"Buscar dados do IBGE"**.
   - Deve aparecer uma caixa com: Município, UF, Região, Microrregião, Mesorregião, Região imediata, Região intermediária.
   - Se der "Município não encontrado", confira se o **Estado** do processo está em **UF** (2 letras). Se o processo foi criado antes, edite no Supabase (Table Editor → **processo_step_one** → coluna **estado** = **SP**).
4. (Opcional) Preencha a **narrativa** e marque **"Marcar etapa 1 como concluída"**.
5. Clique em **Salvar**.

---

### Passo 9 — Etapas 4 e 5: casas e lotes (listagem manual)

1. Vá para **Etapa 4 — Listagem casas à venda (ZAP)**.
   - Deve aparecer o texto: *"Adicione casas à venda manualmente. A integração com Apify (varredura ZAP) será conectada em breve."*
   - Cadastre **pelo menos uma casa** (Condomínio, Preço, etc.) para poder usar a Etapa 8.
2. Vá para **Etapa 5 — Listagem lotes à venda**.
   - Texto similar sobre listagem manual e Apify em breve.
   - Cadastre lotes se for usar a Etapa 7 (lote escolhido).

---

### Passo 10 — Etapa 6: catálogo com pelo menos 3 modelos

1. Vá para **Etapa 6 — Catálogo casas Moní**.
2. Confira se há **pelo menos 3 modelos** na tabela (a migração 004 insere 2: Modelo A e B). Para a Etapa 8 funcionar, é preciso **3 modelos**.
3. Se tiver menos de 3: no **Supabase** → **Table Editor** → **catalogo_casas** → **Insert row** e cadastre mais um (nome, ativo = true, e outros campos que quiser).

---

### Passo 11 — Etapa 8: escolher 3 modelos do catálogo e batalhas

1. Na lista das 11 etapas, clique em **Etapa 8 — Batalhas (preço, produto, localização)**.
2. **Se aparecer a tela "Escolha 3 modelos do catálogo Moní":**
   - Nos três dropdowns (**Modelo 1**, **Modelo 2**, **Modelo 3**), escolha um modelo do catálogo em cada um (cada modelo só pode ser escolhido uma vez).
   - Clique em **"Salvar 3 modelos escolhidos"**.
   - A página recarrega.
3. **Depois de salvar os 3 modelos:**
   - Aparecem **todas as casas listadas na ZAP** (Etapa 4).
   - Para **cada** casa ZAP, há **3 blocos** (um por modelo do catálogo escolhido), cada um com três notas: **Preço**, **Produto**, **Localização** (de -2 a +2).
   - Preencha as notas; elas **salvam automaticamente** ao mudar cada select.

**Resumo da lógica:** as batalhas são feitas com **todas as casas da ZAP** × **os 3 modelos do catálogo** que você escolheu. Os mesmos 3 modelos serão usados no BCA (Etapa 10) quando for implementado.

---

## PARTE 4 — Se algo der errado ou precisar excluir/substituir

| Situação | O que fazer |
|----------|-------------|
| **Erro "relation catalogo_escolhidos does not exist"** | Rode a migração **007** no SQL Editor (Passo 2). |
| **Já rodei a 006 (casas_escolhidas)** | Rode a **007**. Ela remove `casas_escolhidas` e cria `catalogo_escolhidos`. Não precisa excluir nada à mão. |
| **Etapa 1 — "Município não encontrado"** | No Supabase, **Table Editor** → **processo_step_one** → na linha do processo, coluna **estado**, coloque a **sigla** (ex.: **SP**). |
| **Etapa 8 — "Nenhuma casa listada na Etapa 4"** | Cadastre pelo menos **uma** casa na Etapa 4. |
| **Etapa 8 — "O catálogo Moní precisa ter pelo menos 3 modelos"** | No Supabase, **Table Editor** → **catalogo_casas** → **Insert row** e adicione mais um modelo (ativo = true). |
| **Quero apagar a tabela catalogo_escolhidos e rodar a 007 de novo** | No SQL Editor: `DROP TABLE IF EXISTS public.catalogo_escolhidos;` Depois rode todo o conteúdo do **007_catalogo_escolhidos.sql** de novo. |

---

## Checklist final

Marque conforme for fazendo:

- [ ] **Parte 1** — Migrações 001, 002, 003, 004, 005 e **007** rodadas no Supabase (**NÃO** rodar 006).
- [ ] **Parte 2** — `npm install` e `npm run dev` rodando; janela do PowerShell aberta.
- [ ] **Parte 3** — Login feito; processo criado com **Estado (UF)** escolhido na lista.
- [ ] **Etapa 1** — Botão "Buscar dados do IBGE" clicado; dados aparecem; narrativa salva (se quiser).
- [ ] **Etapa 4** — Pelo menos uma casa cadastrada; texto sobre Apify em breve visível.
- [ ] **Etapa 5** — Texto sobre Apify em breve visível.
- [ ] **Etapa 6** — Pelo menos 3 modelos no catálogo.
- [ ] **Etapa 8** — 3 modelos do catálogo escolhidos e salvos; batalhas aparecendo (todas as casas ZAP × 3 modelos); notas preenchidas e salvando sozinhas.

Quando todos os itens estiverem marcados, o fluxo está completo com todas as alterações aplicadas.
