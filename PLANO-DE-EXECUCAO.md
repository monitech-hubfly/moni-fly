# Carômetro — Plano de execução passo a passo

Guia detalhado para construir o sistema de monitoramento de resultados e comportamentos das áreas, com **ferramentas 100% gratuitas** (React + Vite, Supabase, Vercel). Cada etapa explica **como executar** o passo.

---

## 1. O que vamos construir (visão geral)

| Módulo | O que é | Equivalente hoje |
|--------|---------|-------------------|
| **Objetivos por trimestre** | Cadastro dos objetivos da presidência por área e trimestre (editável) | Planilha de objetivos |
| **Áreas** | Lista de áreas da empresa | Abas/Sheets por área |
| **Workload** | Por área: tarefas, ações, tempo estimado | Planilha de workload (um Sheet por área) |
| **Gantt / Cronograma** | Acompanhamento no prazo ou atrasado | Gantt que você monta hoje |
| **Carômetro (Personal Goat)** | Comportamentos-chave por área com emoji para reuniões | Planilha "Personal Goat Carômetro" |
| **Dashboards** | Performance e metas para você e alta gestão | Dashboards em planilhas |

---

## 2. Stack (ferramentas gratuitas)

- **Frontend:** React + Vite  
- **Banco de dados:** Supabase (PostgreSQL)  
- **Hospedagem:** Vercel  
- **PDF (se precisar):** jsPDF  
- **Desenvolvimento:** Cursor  

---

## 3. FASE 0 — Preparar contas e ferramentas

*(Você já concluiu esta fase; está aqui como referência.)*

### Item 0.1 — Conta no GitHub

1. Acesse **https://github.com** no navegador.
2. Clique em **Sign up** e crie a conta (e-mail, senha, nome de usuário).
3. Confirme o e-mail se o GitHub pedir.
4. Você usará o GitHub para guardar o código e conectar com a Vercel.

### Item 0.2 — Conta no Supabase

1. Acesse **https://supabase.com** no navegador.
2. Clique em **Start your project** e faça login (pode usar conta Google/GitHub).
3. Clique em **New project**.
4. Preencha:
   - **Name:** por exemplo `carometro`
   - **Database password:** crie uma senha forte e **guarde** (para acessar o banco depois, se precisar)
   - **Region:** escolha a mais próxima (ex.: South America)
5. Clique em **Create new project** e espere alguns minutos.
6. No menu lateral, vá em **Project Settings** (ícone de engrenagem) → **API**.
7. Anote:
   - **Project URL** (ex.: `https://xxxxx.supabase.co`)
   - **anon public** (chave longa em “Project API keys”).
8. Você vai colar esses dois valores no arquivo `.env` na Fase 1.

### Item 0.3 — Conta na Vercel

1. Acesse **https://vercel.com** no navegador.
2. Clique em **Sign Up** e escolha **Continue with GitHub** (recomendado).
3. Autorize a Vercel a acessar seu GitHub se pedir.
4. Depois vamos usar a Vercel para fazer o deploy do projeto (Fase 4).

### Item 0.4 — Git no computador

1. Se o comando `git` não funcionava no terminal:
   - Baixe o Git em **https://git-scm.com/download/win**.
   - Instale e na tela “Adjusting your PATH” escolha **“Git from the command line and also from 3rd-party software”**.
2. Se o Git estiver em pasta custom (ex.: `C:\...\Danilo\Git\bin`):
   - Tecla Windows → digite **variáveis de ambiente** → **Editar as variáveis de ambiente do sistema**.
   - **Variáveis de ambiente** → em “Variáveis do usuário” selecione **Path** → **Editar** → **Novo** → cole o caminho da pasta **bin** do Git (ex.: `C:\Users\...\Danilo\Git\bin`) → OK em todas as janelas.
3. Feche e abra o Cursor (ou o terminal) e teste: `git --version`. Deve aparecer a versão.

### Item 0.5 — Node.js e npm

1. Acesse **https://nodejs.org** e baixe a versão **LTS**.
2. Execute o instalador e avance com Next até concluir.
3. Feche e abra o Cursor. No terminal (Ctrl+`), teste: `node --version` e `npm --version`. Devem aparecer versões.

### Item 0.6 — Política de execução do PowerShell (se npm der erro de script)

1. No terminal do Cursor (PowerShell), rode **uma vez**:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
2. Se perguntar se deseja alterar, digite **S** e Enter.
3. Teste de novo: `npm --version`.

---

## 4. FASE 1 — Projeto no Cursor

### Item 1.1 — Abrir a pasta do projeto no Cursor

1. No Cursor: **File** → **Open Folder** (ou **Abrir Pasta**).
2. Navegue até a pasta **Carômetro** (ex.: `C:\Users\...\OneDrive\Área de Trabalho\Danilo\Carômetro`).
3. Clique em **Selecionar Pasta**. A barra lateral deve mostrar os arquivos do projeto.

### Item 1.2 — Projeto React + Vite (se ainda não existir)

1. Abra o terminal no Cursor: **Ctrl+`** (acento grave).
2. Confirme que está na pasta do projeto (o prompt deve mostrar `...\Carômetro>`).
3. Rode:
   ```bash
   npm create vite@latest . -- --template react
   ```
4. Se perguntar “Current directory is not empty…”:
   - Use as setas e selecione **Ignore files and continue** → Enter.
5. Em **Package name:** digite só minúsculas (ex.: `carometro`) → Enter.
6. Em **Use Vite 8 beta?** escolha **No** → Enter.
7. Se aparecer **Install with npm and start now?** pode escolher **Yes** para instalar e subir o servidor, ou **No** e depois rodar manualmente `npm install` e `npm run dev`.

### Item 1.3 — Instalar dependências (Supabase e React Router)

1. Se o servidor estiver rodando em um terminal, abra **outra aba** do terminal (ícone **+** no painel do Terminal) para não parar o servidor.
2. Na nova aba, na pasta do projeto, rode:
   ```bash
   npm install @supabase/supabase-js react-router-dom
   ```
3. Aguarde terminar. Não deve aparecer erro em vermelho.

### Item 1.4 — Criar o arquivo `.env` com as chaves do Supabase

1. A, clique com o **botão direito** na raiz do projeto (onde está `package.json`).
2. Escolha **New File** (Novo arquivo).
3. Digite o nome: `.env` (com o ponto na frente) e Enter.
4. Abra o arquivo `.env` e cole exatamente (trocando pelos seus dados do Supabase):
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
   ```
5. Substitua:
   - `https://SEU-PROJETO.supabase.co` pela **Project URL** que você anotou no Supabase (Item 0.2).
   - `sua-chave-anon-aqui` pela chave **anon public** que você anotou.
6. Salve o arquivo (**Ctrl+S**).
7. **Importante:** o arquivo `.env` não deve ser enviado para o GitHub (já deve estar no `.gitignore`). Nunca compartilhe a chave anon em redes ou prints.

---

## 5. FASE 2 — Banco de dados no Supabase

### Item 2.1 — Abrir o SQL Editor no Supabase

1. Acesse **https://supabase.com** e faça login.
2. Clique no seu projeto (ex.: **carometro**).
3. No menu lateral esquerdo, clique em **SQL Editor**.

### Item 2.2 — Criar as tabelas (uma por vez)

1. Abra o arquivo **ESTRUTURA-DO-BANCO.md** no Cursor (Ctrl+P → digite ESTRUTURA → Enter).
2. No Supabase, no SQL Editor, clique em **New query** (Nova consulta).
3. Copie do **ESTRUTURA-DO-BANCO.md** o primeiro bloco SQL (tabela **areas**). Cole na caixa de texto do SQL Editor.
4. Clique em **Run** (ou Ctrl+Enter). Deve aparecer “Success” ou mensagem de sucesso.
5. Repita para cada tabela, **na ordem**: áreas → trimestres → objetivos → tarefas → acoes → cronograma → carometro → registros_resultado.
6. Se der erro em alguma, leia a mensagem (geralmente é tabela referenciada ainda não criada ou nome duplicado). Confira se rodou na ordem correta.

### Item 2.3 — RLS (Row Level Security) — opcional no início

1. No Supabase, em **Authentication** → **Policies**, você pode configurar depois quem pode ler/escrever em cada tabela.
2. Para desenvolvimento, muitas vezes se usa a chave **anon** com políticas permissivas; quando for colocar em produção, podemos restringir. Se quiser fazer isso na Fase 3, peça no chat: “configurar RLS para as tabelas do Carômetro”.

---

## 6. FASE 3 — Telas no React (com o Cursor)

### Item 3.1 — Estrutura de pastas

1. Dentro da pasta **src**, crie as pastas: **pages**, **components**, **services**.
   - No Explorer: botão direito em **src** → **New Folder** → digite `pages` → Enter. Repita para `components` e `services`.

### Item 3.2 — Cliente Supabase no código

1. No chat do Cursor, peça:
   “Criar o arquivo `src/services/supabase.js` que exporta o cliente do Supabase usando as variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.”
2. Verifique se o arquivo foi criado em `src/services/supabase.js` e se usa `import.meta.env.VITE_SUPABASE_URL` e `import.meta.env.VITE_SUPABASE_ANON_KEY`.

### Item 3.3 — Telas (páginas)

Para cada tela, use o Cursor descrevendo o que quer, por exemplo:

- **Áreas:** “Criar página em `src/pages/Areas.jsx` que lista todas as áreas da tabela `areas` do Supabase, com botão para nova área e formulário para nome e ativo.”
- **Trimestres:** “Criar página em `src/pages/Trimestres.jsx` para listar e cadastrar trimestres (ano, trimestre 1–4, data início, data fim).”
- **Objetivos:** “Criar página Objetivos que filtra por área e trimestre e permite editar os objetivos da tabela `objetivos`.”
- **Workload:** “Criar página Workload que, por área, mostra tarefas e ações com tempo estimado (tabelas `tarefas` e `acoes`).”
- **Carômetro:** “Criar página Carômetro que lista os comportamentos-chave por área/trimestre com campo para emoji/chave (tabela `carometro`).”
- **Dashboard:** “Criar página Dashboard que mostra resumo de metas e status (pode usar dados de objetivos e registros_resultado).”

Crie uma tela de cada vez e teste no navegador (`npm run dev` e abrir **http://localhost:5173**).

### Item 3.4 — Navegação (menu entre páginas)

1. No chat do Cursor, peça:
   “Configurar react-router-dom no App: rotas para / (home), /areas, /trimestres, /objetivos, /workload, /carometro, /dashboard, e um menu ou barra de navegação com links para cada uma.”
2. Siga as alterações que o Cursor sugerir (editar `main.jsx` ou `App.jsx`, criar um componente de layout com os links, etc.).

---

## 7. FASE 4 — Deploy e uso no dia a dia

### Item 4.1 — Subir o código no GitHub

1. No terminal do Cursor, na pasta do projeto, rode:
   ```bash
   git init
   ```
2. Depois:
   ```bash
   git add .
   git commit -m "Projeto inicial Carômetro"
   ```
3. No navegador, no GitHub, clique em **+** → **New repository**.
4. Nome do repositório: por exemplo `carometro`. Não marque “Add a README”. Clique em **Create repository**.
5. O GitHub vai mostrar comandos. No terminal do Cursor, rode (troque SEU-USUARIO e carometro pelo seu usuário e nome do repositório):
   ```bash
   git remote add origin https://github.com/SEU-USUARIO/carometro.git
   git branch -M main
   git push -u origin main
   ```
6. Se pedir usuário e senha, use seu usuário do GitHub e um **Personal Access Token** como senha (em GitHub → Settings → Developer settings → Personal access tokens, crie um com permissão **repo**).

### Item 4.2 — Deploy na Vercel

1. Acesse **https://vercel.com** e faça login.
2. Clique em **Add New** → **Project**.
3. Em **Import Git Repository**, selecione o repositório **carometro** (ou o nome que você deu) e clique em **Import**.
4. Em **Configure Project**, em **Environment Variables** adicione:
   - **Name:** `VITE_SUPABASE_URL` → **Value:** a mesma URL do seu `.env`.
   - **Name:** `VITE_SUPABASE_ANON_KEY` → **Value:** a mesma chave anon do seu `.env`.
5. Clique em **Deploy**. Aguarde alguns minutos.
6. Quando terminar, a Vercel mostra a URL do projeto (ex.: `carometro.vercel.app`). Clique para abrir.

### Item 4.3 — Uso no dia a dia

1. Sempre que você fizer alterações no código e quiser atualizar o site:
   - No terminal: `git add .` → `git commit -m "Descrição da alteração"` → `git push`.
2. A Vercel faz o deploy automático a cada `git push`. Em alguns minutos o site estará atualizado.

---

## 8. Resumo — Checklist geral

- [ ] **Fase 0:** GitHub, Supabase (projeto + URL e chave anotadas), Vercel, Git no PATH, Node.js, política PowerShell (se precisou).
- [ ] **Fase 1:** Pasta aberta no Cursor, projeto Vite criado, `npm install` + Supabase e react-router, arquivo `.env` com URL e chave.
- [ ] **Fase 2:** SQL Editor no Supabase, todas as tabelas criadas na ordem do ESTRUTURA-DO-BANCO.md.
- [ ] **Fase 3:** Pastas `pages`, `components`, `services`, cliente Supabase, telas (Áreas, Trimestres, Objetivos, Workload, Carômetro, Dashboard), rotas e menu.
- [ ] **Fase 4:** Repositório no GitHub, código enviado com `git push`, projeto importado na Vercel, variáveis de ambiente configuradas, primeiro deploy concluído.

---

## 9. Onde você está agora

Você já concluiu a **Fase 0** e a **Fase 1** até o item 1.3. Próximo passo: **Item 1.4** (criar o `.env` com a URL e a chave do Supabase). Em seguida: **Fase 2** (criar as tabelas no Supabase usando o **ESTRUTURA-DO-BANCO.md**). Para qualquer etapa, você pode pedir no chat: “estou no Item X da Fase Y” e pedir o próximo comando ou trecho de código.
