# Sprint 2 — Autenticação e processo no banco

## Entregues

### 1. Login e cadastro (Supabase Auth)
- **`/login`** — Formulário e-mail + senha; entra com `signInWithPassword`. Redireciona para `?next=` ou `/step-one`.
- **`/signup`** — Formulário nome, e-mail e senha; cria conta com `signUp` (trigger no banco cria perfil com `role = 'frank'`).

### 2. Proteção das rotas Step One
- **Middleware:** Qualquer acesso a `/step-one` ou `/step-one/*` sem usuário logado redireciona para `/login?next=/step-one/...`.
- Se o usuário já está logado e acessa `/login` ou `/signup`, redireciona para `/step-one`.

### 3. Criar processo no Supabase
- **Server Action** `createProcesso(cidade, estado)` em `src/app/step-one/actions.ts`:
  - Obtém o usuário logado (cookie).
  - Insere em **processo_step_one** (`user_id`, `cidade`, `estado`, `status`, `etapa_atual`).
  - Insere 11 linhas em **etapa_progresso** (uma por etapa, `status: nao_iniciada`).
  - Retorna o `id` do processo.
- Na tela **Iniciar Step One**, o formulário chama essa action e redireciona para `/step-one/[id]` com o ID real do banco.

### 4. Página do processo a partir do banco
- **`/step-one/[id]`** — Carrega o processo em **processo_step_one** pelo `id` (RLS garante que só o dono ou consultor/admin veem). Exibe cidade, estado e lista das 11 etapas com links. Se não encontrar ou não autorizado, retorna 404.

### 5. Home e header
- **Home** — Se logado: botão “Iniciar Step One” e “Sair”; se não: “Entrar” e “Cadastrar”.
- **Sair** — Componente cliente `AuthHeader` chama `supabase.auth.signOut()` e redireciona para `/`.

## Como testar

1. Rodar o app (`npm run dev`) e abrir `http://localhost:3000` (ou 3001).
2. Clicar em **Cadastrar**, preencher nome, e-mail e senha, enviar. Deve ir para `/step-one`.
3. Clicar em **Iniciar processo**, preencher cidade e estado, enviar. Deve criar o processo no Supabase e abrir `/step-one/[id]` com a lista das 11 etapas.
4. Abrir o Supabase → Table Editor e conferir linhas em **processo_step_one** e **etapa_progresso**.
5. Clicar em **Sair** na home; acessar de novo `/step-one` — deve redirecionar para `/login`.
6. Entrar com o mesmo e-mail/senha e voltar a ver o processo em `/step-one/[id]` (pelo link direto ou criando outro processo).

## Próxima sprint (sugestão)

- **Sprint 3:** Conteúdo da Etapa 1 (análise da praça): formulário ou integração com fontes (IBGE, etc.) e exibição de dados/narrativa.
- Ou: listagem “Meus processos” na home para o Frank ver todos os processos que criou e voltar a qualquer um.
