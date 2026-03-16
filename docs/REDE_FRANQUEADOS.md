# Rede de Franqueados — Passo a passo

Guia para: gerar tipos do banco, aplicar a tabela e inserir/editar registros. No final, opção de ter formulário ou importação na própria ferramenta.

---

## O que você precisa fazer manualmente (resumo)

São **duas etapas**: (1) criar a tabela no Supabase e gerar tipos no projeto; (2) cadastrar os franqueados.

### Etapa 1 — Criar a tabela e gerar tipos (uma vez)

**Se o seu banco está na nuvem (Supabase hospedado):**

| # | O que fazer | Onde |
|---|--------------|------|
| 1 | Abrir o site do Supabase, entrar no seu projeto, ir em **Settings** → **General** e **copiar** o **Reference ID**. | Navegador |
| 2 | Abrir o **terminal** na pasta do projeto (VIABILIDADE) e rodar: `npx supabase link --project-ref COLE_AQUI_O_ID`. Se pedir senha, use a senha do banco do projeto. | Terminal |
| 3 | **Ou** ir no Supabase em **SQL Editor** → **New query** → abrir o arquivo `supabase/migrations/026_rede_franqueados.sql`, copiar **todo** o conteúdo, colar no editor e clicar **Run**. **Ou** no terminal rodar: `npx supabase db push`. | Navegador ou Terminal |
| 4 | No **terminal** (pasta VIABILIDADE) rodar: `npx supabase gen types typescript --project-id COLE_AQUI_O_ID > src/types/database.gen.ts` (usar o mesmo Reference ID do passo 1). | Terminal |

Depois disso a tabela `rede_franqueados` existe no banco e o projeto tem os tipos atualizados.

### Etapa 2 — Subir a lista de franqueados que você já tem (recomendado)

| # | O que fazer | Onde |
|---|--------------|------|
| 1 | Exportar sua planilha em **CSV** (Excel ou Google Sheets: Arquivo → Download/Salvar como → CSV). | Planilha |
| 2 | No Supabase, copiar a chave **service_role** (Settings → API) e colar no `.env.local` como `SUPABASE_SERVICE_ROLE_KEY=...`. | Navegador + arquivo .env.local |
| 3 | No terminal (pasta do projeto): `npm run rede-franqueados:import -- franqueados.csv` (trocar pelo caminho do seu CSV). | Terminal |

Detalhes na seção **2. Subir automaticamente a tabela de franqueados que você já tem**, mais abaixo.

### Etapa 3 — Inserir/editar franqueados manualmente (opcional)

| # | O que fazer | Onde |
|---|--------------|------|
| 1 | Abrir o Supabase → **Table Editor** → clicar na tabela **rede_franqueados**. | Navegador |
| 2 | **Inserir:** clicar em **Insert row**, preencher os campos e salvar. **Editar:** clicar na célula e alterar. **Excluir:** usar a opção de deletar a linha. | Navegador |

Ou usar o **SQL Editor** com os exemplos de INSERT/UPDATE/DELETE que estão na seção 3.

---

## 1. Gerar tipos do banco (`npm run db:types`)

Os tipos TypeScript do Supabase são gerados a partir do schema do seu projeto (local ou remoto).

### 1.1 Se você usa **Supabase local**

1. No terminal, na pasta do projeto (`VIABILIDADE`), suba o Supabase (se ainda não estiver rodando):
   ```bash
   npx supabase start
   ```
2. Aplique as migrations (incluindo a `026_rede_franqueados.sql`):
   ```bash
   npx supabase db reset
   ```
   Ou, se preferir só aplicar migrations pendentes:
   ```bash
   npx supabase migration up
   ```
3. Gere os tipos:
   ```bash
   npm run db:types
   ```
   Isso roda `supabase gen types typescript --local > src/types/database.gen.ts` e atualiza o arquivo `src/types/database.gen.ts`.

### 1.2 Se você usa **Supabase na nuvem** (projeto hospedado) — passo a passo detalhado

#### Passo 1 — Vincular o projeto (fazer uma vez)

1. Abra o [Dashboard do Supabase](https://supabase.com/dashboard) e entre no seu projeto.
2. No menu lateral esquerdo, clique em **Project Settings** (ícone de engrenagem) ou acesse **Settings**.
3. Na aba **General**, localize o campo **Reference ID** (ou **Project ID**). É um texto curto, algo como `abcdefghijklmnop`.
4. Copie esse **Reference ID** (você vai usar como `SEU_PROJECT_REF`).
5. Abra o terminal (PowerShell ou CMD) na pasta do projeto **VIABILIDADE** (onde está o `package.json`).
6. Rode o comando abaixo **trocando `SEU_PROJECT_REF`** pelo ID que você copiou:
   ```bash
   npx supabase link --project-ref SEU_PROJECT_REF
   ```
   Exemplo: se o Reference ID for `xyzabc123`, use:
   ```bash
   npx supabase link --project-ref xyzabc123
   ```
7. Se pedir, informe a **database password** do projeto (a mesma que você definiu ao criar o projeto no Supabase). O link fica salvo no projeto; não é preciso repetir esse passo.

---

#### Passo 2 — Aplicar a migration da tabela `rede_franqueados`

Você pode fazer de duas formas: **pelo Dashboard (SQL)** ou **pelo terminal (CLI)**.

**Opção A — Pelo Dashboard (SQL Editor)**

1. No Dashboard do Supabase, no menu lateral, clique em **SQL Editor**.
2. Clique em **New query** (nova consulta).
3. Abra no seu computador o arquivo da migration:  
   `VIABILIDADE\supabase\migrations\026_rede_franqueados.sql`
4. Selecione todo o conteúdo desse arquivo (Ctrl+A), copie (Ctrl+C) e cole no editor SQL do Supabase (Ctrl+V).
5. Clique no botão **Run** (ou use Ctrl+Enter) para executar o SQL.
6. Deve aparecer uma mensagem de sucesso (ex.: “Success. No rows returned”). A tabela `rede_franqueados` e as políticas RLS passam a existir no banco.

**Opção B — Pelo terminal (CLI)**

1. No terminal, na pasta **VIABILIDADE**, rode:
   ```bash
   npx supabase db push
   ```
2. Se pedir, informe a **database password** do projeto.
3. O comando envia e aplica todas as migrations pendentes (incluindo a `026_rede_franqueados.sql`) no projeto na nuvem. Ao terminar, a tabela já estará criada.

---

#### Passo 3 — Gerar os tipos TypeScript

1. Ainda no terminal, na pasta **VIABILIDADE**, rode o comando abaixo **trocando `SEU_PROJECT_REF`** pelo mesmo Reference ID do Passo 1:
   ```bash
   npx supabase gen types typescript --project-id SEU_PROJECT_REF > src/types/database.gen.ts
   ```
   Exemplo:
   ```bash
   npx supabase gen types typescript --project-id xyzabc123 > src/types/database.gen.ts
   ```
2. Se pedir, informe de novo a **database password** do projeto.
3. O comando gera os tipos a partir do schema do banco na nuvem e grava no arquivo `src/types/database.gen.ts`. Você pode abrir esse arquivo e procurar por `rede_franqueados` para conferir os tipos da tabela.

**No Windows (PowerShell):** se o comando com `>` der erro, use:
   ```powershell
   npx supabase gen types typescript --project-id SEU_PROJECT_REF | Out-File -FilePath src/types/database.gen.ts -Encoding utf8
   ```
   (trocando `SEU_PROJECT_REF` pelo seu Reference ID).

---

**Resumo:** Depois disso você terá: (1) projeto linkado, (2) tabela `rede_franqueados` criada no Supabase na nuvem, (3) tipos em `src/types/database.gen.ts`. Sempre que criar ou alterar migrations no futuro, aplique-as (Passo 2) e rode de novo o comando do Passo 3 para atualizar os tipos.

---

## 2. Subir automaticamente a tabela de franqueados que você já tem (importar CSV)

**Importante:** use o **script de importação** do projeto (comando abaixo), **não** o botão "Import CSV" do Supabase Dashboard. O Dashboard exige que os cabeçalhos do CSV sejam iguais aos nomes das colunas no banco (ex.: `n_franquia`, `nome_completo`). O script do projeto aceita os nomes da planilha (ex.: "N de Franquia", "Nome Completo do Franqueado") e faz o mapeamento automaticamente.

Se você já tem a lista de franqueados em planilha (Excel, Google Sheets, etc.), exporte em **CSV** e use o script de importação.

### Passo a passo

1. **Exportar para CSV**
   - **Excel:** Arquivo → Salvar como → escolha **CSV (delimitado por vírgulas)**.
   - **Google Sheets:** Arquivo → Fazer download → **Valores separados por vírgula (.csv)**.
   Salve o arquivo (ex.: `franqueados.csv`) na pasta do projeto ou em qualquer pasta e anote o caminho.

2. **Configurar a chave do Supabase (uma vez)**
   - No Supabase: **Project Settings** → **API** → em **Project API keys** copie a chave **service_role** (secret).
   - No projeto, abra o arquivo `.env.local` e adicione (ou edite):
     ```
     SUPABASE_SERVICE_ROLE_KEY=eyJ...sua_chave_service_role_aqui
     ```
   Não commite essa chave no Git; o `.env.local` já costuma estar no `.gitignore`.

3. **Rodar o script de importação**
   - Abra o terminal na pasta do projeto (**VIABILIDADE**, onde está o `package.json`).
   - Rode (trocando `franqueados.csv` pelo caminho do seu arquivo):
     ```bash
     npm run rede-franqueados:import -- franqueados.csv
     ```
     Se o CSV estiver em outra pasta, use o caminho completo ou relativo, ex.:
     ```bash
     npm run rede-franqueados:import -- "C:\Downloads\minha-lista-franqueados.csv"
     ```
   - O script lê o CSV, reconhece as colunas (Nome, Unidade, Cidade, Estado, E-mail, Telefone, Observações, Ordem — ou nomes parecidos) e insere todos os registros na tabela `rede_franqueados`.

4. **Se der erro de variável de ambiente**
   - No Windows, se o Node não carregar o `.env.local`, rode diretamente:
     ```bash
     node --env-file=.env.local scripts/import-rede-franqueados.mjs franqueados.csv
     ```
   - Ou defina as variáveis no terminal antes (PowerShell):
     ```powershell
     $env:NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
     $env:SUPABASE_SERVICE_ROLE_KEY="sua_service_role_key"
     node scripts/import-rede-franqueados.mjs franqueados.csv
     ```

**Formato do CSV:** primeira linha = cabeçalho. Colunas aceitas (o script reconhece variações): N de Franquia, Nome Completo do Franqueado, Status da Franquia, Classificação do Franqueado, Data de Ass. COF, Data de Ass. Contrato, Data de Expiração da Franquia, Regional, Área de Atuação da Franquia (ou Unidade), E-mail do Frank, Telefone do Frank, CPF do Frank, Data de Nasc. Frank, Endereço Casa do Frank, CEP Casa Frank, Estado Casa Frank, Cidade Casa Frank, Tamanho da Camiseta do Frank, Sócios, Ordem. Datas podem ser em dd/mm/aaaa ou aaaa-mm-dd. A coluna Ordem é numérica e define a ordem de exibição.

**Se a tabela mostrar muitas linhas mas todas vazias:** isso pode acontecer depois da migration 027 (novos campos). As linhas antigas tinham colunas que foram removidas; é preciso **reimportar** o CSV com os novos cabeçalhos. No Supabase (Table Editor ou SQL), apague as linhas da tabela `rede_franqueados` se quiser começar do zero e rode de novo `npm run rede-franqueados:import -- seu-arquivo.csv`.

---

## 3. Inserir e editar registros manualmente em `rede_franqueados`

A tabela tem as colunas: `ordem`, `nome`, `unidade`, `cidade`, `estado`, `email`, `telefone`, `observacoes`.  
`id`, `created_at` e `updated_at` são preenchidos automaticamente.

### 3.1 Pelo **Dashboard do Supabase**

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard) e abra seu projeto.
2. No menu lateral, vá em **Table Editor**.
3. Clique na tabela **rede_franqueados**.
4. **Inserir linha**: clique em **Insert row** (ou **Insert** → **Insert row**). Preencha os campos e salve.
5. **Editar**: clique na célula que deseja alterar, edite e confirme (geralmente Enter ou clique fora).
6. **Excluir**: selecione a linha e use a opção de deletar (ícone de lixeira ou menu da linha).

A ordem de exibição na ferramenta segue a coluna `ordem` (menor valor primeiro). Ajuste `ordem` para ordenar como quiser (ex.: 10, 20, 30 para facilitar inserções no meio).

### 3.2 Por **SQL** (SQL Editor no Dashboard)

1. No Dashboard, abra **SQL Editor**.
2. **Inserir um registro:**
   ```sql
   INSERT INTO public.rede_franqueados (ordem, nome, unidade, cidade, estado, email, telefone, observacoes)
   VALUES (10, 'Nome do Franqueado', 'Unidade XYZ', 'São Paulo', 'SP', 'email@exemplo.com', '(11) 99999-9999', '');
   ```
3. **Inserir vários:**
   ```sql
   INSERT INTO public.rede_franqueados (ordem, nome, unidade, cidade, estado, email, telefone, observacoes)
   VALUES
     (10, 'Franqueado A', 'Unidade 1', 'São Paulo', 'SP', 'a@exemplo.com', '(11) 11111-1111', ''),
     (20, 'Franqueado B', 'Unidade 2', 'Rio de Janeiro', 'RJ', 'b@exemplo.com', '(21) 22222-2222', '');
   ```
4. **Editar:**
   ```sql
   UPDATE public.rede_franqueados
   SET nome = 'Novo Nome', cidade = 'Curitiba', estado = 'PR', updated_at = now()
   WHERE id = 'uuid-da-linha-aqui';
   ```
5. **Excluir:**
   ```sql
   DELETE FROM public.rede_franqueados WHERE id = 'uuid-da-linha-aqui';
   ```
6. Clique em **Run** (ou Ctrl+Enter) para executar.

---

## 4. Formulário ou importação na ferramenta (opcional)

Hoje os dados são gerenciados só pelo Dashboard ou SQL. Se quiser que o **admin** cadastre e edite franqueados direto na aplicação:

- **Formulário**: na página `/rede-franqueados`, adicionar um formulário (modal ou seção) para criar e editar linhas da tabela (campos: nome, unidade, cidade, estado, email, telefone, observações e ordem), usando as políticas RLS já existentes (apenas admin pode inserir/atualizar/deletar).
- **Importação**: botão “Importar” que aceita um CSV com as mesmas colunas e faz vários `INSERT` na `rede_franqueados` (apenas para usuário admin).

Se quiser seguir por aí, diga se prefere primeiro o formulário ou a importação CSV (ou os dois) e em qual página (sugestão: `/rede-franqueados`).
