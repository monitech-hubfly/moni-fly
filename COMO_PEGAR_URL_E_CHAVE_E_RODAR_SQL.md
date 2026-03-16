# Como pegar a URL e a chave do Supabase e rodar o SQL

Guia passo a passo, com o que você vai ver em cada tela.

---

## Parte A — Achar a Project URL e a chave anon (public)

### 1. Entrar no seu projeto no Supabase

1. Abra o navegador e vá em **https://supabase.com**
2. Faça **login** (se ainda não estiver logada).
3. Na **lista de projetos**, clique no nome do projeto que você criou para o Viabilidade (ex.: **viabilidade-moni**).  
   → A tela que abre é o **Dashboard** do projeto (você pode ver gráficos, tabelas, etc.).

---

### 2. Abrir as configurações do projeto (Project Settings)

1. No **canto inferior esquerdo** da tela do Supabase há um menu em barras verticais (ícones).
2. Procure o ícone de **engrenagem** (⚙️) — ao passar o mouse, aparece o texto **“Project Settings”**.
3. **Clique** nesse ícone de engrenagem.  
   → Abre a página de **Project Settings** (configurações do projeto).

---

### 3. Ir na seção API

1. Na página **Project Settings**, no **menu da esquerda**, você verá várias opções em texto, por exemplo:
   - General
   - **API**  ← esta aqui
   - Database
   - Auth
   - Storage
   - etc.
2. **Clique** na opção **API**.  
   → A área principal da tela mostra as informações da **API** do projeto.

---

### 4. Copiar a Project URL

1. Na seção **API**, no topo, procure o bloco chamado **“Project URL”** (ou “URL do projeto”).
2. Abaixo do título há uma caixa com um endereço que começa com **https://** e termina com **.supabase.co**, por exemplo:  
   `https://abcdefghijklmn.supabase.co`
3. À **direita** dessa caixa há um **ícone de copiar** (geralmente dois quadradinhos ou um ícone de “copiar”).
4. **Clique** nesse ícone de copiar.  
   → O endereço foi copiado para a área de transferência.
5. **Cole** em um Bloco de notas e salve como “URL do Supabase” para não perder. Você vai colar esse valor no arquivo `.env.local` depois.

---

### 5. Copiar a chave anon (public)

1. Na **mesma página API**, role a tela para baixo até a parte **“Project API keys”** (ou “Chaves da API do projeto”).
2. Você verá **duas chaves**:
   - **anon** ou **anon public** (pode estar escrito “public” ao lado) — **é esta que você vai usar**.
   - **service_role** ou **service_role secret** — **não use** esta no projeto (é só para uso em servidor seguro).
3. Na linha da chave **anon** / **anon public**:
   - Há uma caixa longa com um texto que parece uma sequência grande de letras, números e pontos (ex.: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`).
   - À direita dessa caixa há o **ícone de copiar**.
4. **Clique** no ícone de copiar da chave **anon**.  
   → A chave foi copiada.
5. **Cole** no Bloco de notas e salve como “Chave anon Supabase”. Você vai colar no `.env.local` depois.

**Resumo:** Você precisa só destes dois valores:
- **Project URL** (ex.: `https://xxxxx.supabase.co`)
- **Chave anon (public)** (aquele texto longo que começa muitas vezes com `eyJ...`)

---

## Parte B — Abrir o arquivo 001_initial_schema.sql, copiar e rodar no Supabase

### 1. Abrir a pasta do projeto no computador

1. Abra o **Explorador de Arquivos** (ícone de pasta na barra de tarefas ou tecla **Windows + E**).
2. Vá até a pasta do projeto:
   - **OneDrive** → **Área de Trabalho** → **VIABILIDADE**
3. Dentro de **VIABILIDADE**, entre na pasta **supabase** (duplo clique).
4. Dentro de **supabase**, entre na pasta **migrations** (duplo clique).  
   → Você deve ver o arquivo **001_initial_schema.sql**.

---

### 2. Abrir o arquivo SQL

1. Na pasta **migrations**, você verá dois arquivos:
   - **001_initial_schema.sql** — use só na primeira vez, em um projeto Supabase ainda vazio.
   - **002_idempotent_schema.sql** — use **este** se ao rodar o 001 aparecer o erro *"relation profiles already exists"* (ele cria só o que falta e não dá erro se algo já existir).
2. Para este guia, abra o **002_idempotent_schema.sql** (ou o 001 se for a primeira vez em projeto novo).
2. **Clique com o botão direito** no arquivo.
3. No menu que abrir, escolha **“Abrir com”** e depois **“Bloco de notas”** (ou “Notepad”).  
   - Se não aparecer “Bloco de notas”, escolha “Outro aplicativo” / “Escolher outro app” e selecione **Bloco de notas**.  
   → O arquivo abre no Bloco de notas com muito texto (comandos em inglês e nomes de tabelas como `profiles`, `processo_step_one`, etc.). Se escolheu o **002**, no topo do arquivo há um comentário explicando que ele serve quando o 001 deu erro de "profiles already exists".

---

### 3. Selecionar e copiar todo o conteúdo

1. No Bloco de notas, no menu **Editar**, clique em **“Selecionar tudo”**  
   **ou** use o atalho: **Ctrl + A** (segure Ctrl e aperte A).  
   → Todo o texto do arquivo fica selecionado (azul).
2. Copie: menu **Editar** → **Copiar**  
   **ou** atalho: **Ctrl + C**.  
   → Todo o conteúdo do arquivo foi copiado para a área de transferência.  
3. Você pode **deixar o Bloco de notas aberto** ou fechar; o importante é que já copiou tudo.

---

### 4. Abrir o SQL Editor no Supabase

1. Volte ao navegador, na página do **Supabase** (seu projeto).
2. No **menu da esquerda** (aquela barra com ícones), procure o ícone que parece uma **janela com linhas de código** ou um “play” com código — ao passar o mouse aparece **“SQL Editor”**.
3. **Clique** em **SQL Editor**.  
   → Abre a tela do editor SQL. Você verá uma área grande em branco (ou com um texto de exemplo) onde se escreve ou cola comandos SQL.

---

### 5. Colar o conteúdo e rodar

1. **Clique** uma vez **dentro** da caixa de texto grande do SQL Editor (onde está o cursor piscando).
2. **Cole** o que você copiou do arquivo:  
   - Menu **Editar** → **Colar** no navegador  
   **ou** atalho: **Ctrl + V**.  
   → O editor fica preenchido com todo o texto do arquivo SQL (várias linhas começando com `--`, `CREATE TABLE`, `CREATE POLICY`, etc.).
3. Role até o **final** da tela do SQL Editor. Você verá um botão:
   - **“Run”** (Executar)  
   **ou** **“Run”** com um ícone de play (▶).  
   Em alguns layouts o botão pode estar no canto inferior direito.
4. **Clique** em **Run**.  
   → O Supabase executa todo aquele SQL.
5. **Resultado esperado:**
   - Aparece uma mensagem em **verde** tipo **“Success. No rows returned”** ou **“Success”**.  
     → Significa que deu certo: as tabelas e as regras de acesso foram criadas.
   - Se aparecer algo em **vermelho** (erro), **não apague nada**. Tire um **print** da tela ou **copie a mensagem de erro** e guarde para mostrar a um desenvolvedor ou para corrigir depois.

---

## Resumo rápido

| O que fazer | Onde |
|------------|------|
| **Project URL** | Supabase → ícone engrenagem (Project Settings) → menu esquerda **API** → bloco **Project URL** → ícone copiar. |
| **Chave anon** | Mesma página **API** → role até **Project API keys** → na chave **anon** / **anon public** → ícone copiar. |
| **Abrir o SQL** | No PC: **VIABILIDADE** → **supabase** → **migrations** → botão direito em **002_idempotent_schema.sql** (ou 001 se for projeto novo) → Abrir com → Bloco de notas. |
| **Copiar tudo** | No Bloco de notas: **Ctrl+A** (selecionar tudo) → **Ctrl+C** (copiar). |
| **Colar e rodar** | Supabase → **SQL Editor** → colar (**Ctrl+V**) na caixa grande → clicar **Run**. |

Depois disso, você usa a **URL** e a **chave anon** no arquivo **.env.local** do projeto (conforme o guia principal **GUIA_PASSOS_NAO_DEV.md**).
