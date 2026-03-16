# Passo a passo detalhado — Execução da Sprint 2

Este guia descreve como **rodar e testar** tudo o que foi entregue na Sprint 2 (login, cadastro, criação de processo no banco e proteção das rotas). Siga na ordem.

---

## Pré-requisitos

Antes de começar, confira:

1. **Node.js** instalado (no PowerShell: `node -v` deve mostrar a versão).
2. **Projeto VIABILIDADE** com dependências instaladas (`npm install` já rodado).
3. **Arquivo .env.local** na pasta VIABILIDADE com:
   - `NEXT_PUBLIC_SUPABASE_URL` = URL do seu projeto no Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = chave anon (public) do Supabase
4. **SQL já executado** no Supabase (tabelas e regras criadas com o arquivo `002_idempotent_schema.sql`).

Se algo disso não estiver feito, use os guias **GUIA_PASSOS_NAO_DEV.md** e **PASSO_A_PASSO_NPM_E_ENV.md**.

---

## Parte 1 — Subir o sistema e abrir no navegador

### Passo 1.1 — Abrir o PowerShell na pasta do projeto

1. Abra o **Explorador de Arquivos** (Windows + E).
2. Vá em **OneDrive** → **Área de Trabalho** → **VIABILIDADE**.
3. Clique **uma vez** na **barra de endereço** (onde aparece o caminho da pasta).
4. Digite **powershell** e aperte **Enter**.
5. A janela do PowerShell abre **dentro** da pasta VIABILIDADE.

### Passo 1.2 — Iniciar o servidor

1. No PowerShell, digite:
   ```text
   npm run dev
   ```
2. Aperte **Enter**.
3. Espere aparecer algo como **"✓ Ready"** e a linha **"Local: http://localhost:3000"** (ou **3001** se a 3000 estiver em uso).
4. **Deixe essa janela aberta** durante todo o teste.

### Passo 1.3 — Abrir o site no navegador

1. Abra o **Chrome** ou **Edge**.
2. Na barra de endereço digite:
   - **http://localhost:3000**  
     ou, se o PowerShell mostrou porta 3001:
   - **http://localhost:3001**
3. Aperte **Enter**.
4. Deve abrir a **página inicial** do Viabilidade Moní, com os botões **Entrar** e **Cadastrar** no topo.

---

## Parte 2 — Cadastrar uma nova conta

### Passo 2.1 — Ir para a tela de cadastro

1. Na página inicial, clique no botão **Cadastrar** (no canto superior direito).
2. A URL deve mudar para algo como **http://localhost:3000/signup** (ou 3001/signup).
3. A tela mostra o título **Cadastrar** e os campos: **Nome completo**, **E-mail**, **Senha**.

### Passo 2.2 — Preencher o formulário

1. Em **Nome completo**, digite seu nome (ex.: Maria Silva).
2. Em **E-mail**, digite um e-mail que você use (ex.: maria@email.com).  
   **Importante:** use um e-mail real se o Supabase estiver configurado para enviar confirmação; caso contrário, pode usar um e-mail de teste.
3. Em **Senha**, digite uma senha com **pelo menos 6 caracteres** (ex.: teste123).
4. Anote o e-mail e a senha para usar no **login** depois.

### Passo 2.3 — Enviar o cadastro

1. Clique no botão **Cadastrar**.
2. O botão pode mudar para **Cadastrando…** por um instante.
3. **Resultado esperado:** a página redireciona para **/step-one** (tela "Iniciar Processo Step One"). Isso significa que a conta foi criada e você já está logada.
4. Se aparecer uma **mensagem de erro** em vermelho, leia o texto (ex.: "User already registered" = e-mail já cadastrado; use outro e-mail ou vá para Entrar).

---

## Parte 3 — Criar um processo (e salvar no banco)

### Passo 3.1 — Estar na tela Iniciar Step One

1. Se você acabou de cadastrar, já está em **/step-one**.
2. Se não, na página inicial clique em **Iniciar Step One** (ou em **Entrar**, faça login e depois clique em **Iniciar Step One**).

### Passo 3.2 — Preencher cidade e estado

1. No campo **Cidade**, digite por exemplo **Campinas**.
2. No campo **Estado (UF)**, digite **SP** (duas letras).
3. Clique no botão **Iniciar processo**.

### Passo 3.3 — Verificar a lista das 11 etapas

1. O botão pode mostrar **Criando…** por um momento.
2. **Resultado esperado:** a tela muda e mostra a **lista das 11 etapas** (Etapa 1 — Análise da praça, Etapa 2 — Condomínios e checklist, etc.).
3. No topo da página deve aparecer **Processo — Campinas, SP** (ou a cidade e estado que você digitou).
4. A **URL** deve ser algo como **http://localhost:3000/step-one/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx**, onde a parte longa é o **ID do processo** no banco. **Copie ou anote essa URL** para testar depois.

### Passo 3.4 — Conferir no Supabase que o processo foi salvo

1. Abra outra aba do navegador e vá em **https://supabase.com**. Faça login no seu projeto.
2. No menu da esquerda, clique em **Table Editor**.
3. Clique na tabela **processo_step_one**.
4. Deve aparecer **uma linha** com:
   - **cidade** = Campinas (ou o que você digitou)
   - **estado** = SP
   - **status** = em_andamento
   - **etapa_atual** = 1
   - **user_id** = um UUID (id do usuário que criou)
5. No menu da esquerda, clique na tabela **etapa_progresso**.
6. Deve haver **11 linhas** com o mesmo **processo_id** (o ID que aparece na URL do passo 3.3), **etapa_id** de 1 a 11 e **status** = nao_iniciada.

Se tudo isso estiver certo, o **processo está sendo criado e salvo no banco** na Sprint 2.

---

## Parte 4 — Testar a proteção das rotas (só logado acessa Step One)

### Passo 4.1 — Fazer logout

1. Volte na aba do navegador onde está o sistema (localhost:3000 ou 3001).
2. Clique no link **"← Voltar"** ou na barra de endereço digite **http://localhost:3000** (ou 3001) e aperte Enter para ir à **página inicial**.
3. No canto superior direito deve aparecer **Iniciar Step One** e **Sair** (porque você está logada).
4. Clique em **Sair**.
5. **Resultado esperado:** a página recarrega e agora mostra **Entrar** e **Cadastrar** no lugar de "Iniciar Step One" e "Sair". Você não está mais logada.

### Passo 4.2 — Tentar acessar Step One sem estar logada

1. Na barra de endereço digite **exatamente** a URL do Step One, por exemplo:
   ```text
   http://localhost:3000/step-one
   ```
   (ou 3001 se for o seu caso).
2. Aperte **Enter**.
3. **Resultado esperado:** o sistema **redireciona** você para a tela de **Login** (URL fica algo como **/login?next=/step-one**). Ou seja, quem não está logado **não** consegue abrir a tela de Iniciar processo.

### Passo 4.3 — Entrar de novo e acessar o processo

1. Na tela de **Login**, digite o **e-mail** e a **senha** que você usou no cadastro.
2. Clique em **Entrar**.
3. **Resultado esperado:** você é redirecionada para **/step-one** (Iniciar Processo Step One).
4. Cole na barra de endereço a **URL do processo** que você anotou no Passo 3.3 (ex.: http://localhost:3000/step-one/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) e aperte **Enter**.
5. **Resultado esperado:** a página do processo abre de novo, com **Campinas, SP** e a lista das 11 etapas. Ou seja, com login você **volta a ver** o processo que criou.

---

## Parte 5 — Resumo do que a Sprint 2 faz

| O que você fez                    | O que a Sprint 2 entrega                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Cadastrar (nome, e-mail, senha)   | Conta no Supabase Auth + perfil na tabela **profiles** (role = frank)                            |
| Entrar (e-mail, senha)            | Login com Supabase; sessão mantida por cookies                                                   |
| Iniciar processo (cidade, estado) | Registro em **processo_step_one** + 11 linhas em **etapa_progresso**; redireciona para o ID real |
| Abrir /step-one sem login         | Redireciona para /login (proteção de rota)                                                       |
| Sair                              | Logout; na home aparecem de novo Entrar e Cadastrar                                              |

---

## Se algo der errado

- **"Faça login para iniciar um processo"** ao clicar em Iniciar processo  
  → Você não está logada. Faça **Entrar** (ou Cadastrar) e tente de novo.

- **Página em branco ou erro 500 ao abrir a home**  
  → Confira o **.env.local** (URL e chave do Supabase) e se o SQL foi rodado no Supabase. Reinicie o servidor (Ctrl+C no PowerShell e `npm run dev` de novo).

- **"Invalid login credentials"** ao entrar  
  → E-mail ou senha incorretos. Confira se o cadastro foi feito com esse e-mail e tente **Cadastrar** com outro e-mail se precisar.

- **Processo não aparece no Table Editor do Supabase**  
  → Confira se você está na tabela **processo_step_one** e se o **user_id** da linha corresponde ao usuário que você criou (em Authentication → Users no Supabase você vê o id do usuário).

- **Redireciona para login mesmo depois de entrar**  
  → Pode ser cache ou cookie. Tente fechar a aba, abrir de novo e fazer **Entrar** outra vez; ou use uma aba anônima para testar.

---

## Checklist final da Sprint 2

- [ ] Servidor sobe com `npm run dev` e o site abre em localhost:3000 (ou 3001).
- [ ] Cadastrar cria conta e redireciona para /step-one.
- [ ] Iniciar processo (cidade + estado) cria uma linha em **processo_step_one** e 11 em **etapa_progresso** no Supabase.
- [ ] A URL após criar o processo é /step-one/[id] com ID real; a página mostra cidade, estado e 11 etapas.
- [ ] Sair faz logout; a home mostra Entrar e Cadastrar.
- [ ] Acessar /step-one sem login redireciona para /login.
- [ ] Entrar de novo permite acessar /step-one e o processo pelo link /step-one/[id].

Quando todos os itens estiverem ok, a **execução da Sprint 2** está concluída.
