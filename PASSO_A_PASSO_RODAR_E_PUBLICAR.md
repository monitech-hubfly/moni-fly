# Passo a passo detalhado: Rodar o sistema e publicar na internet

Guia para **Parte 4** (rodar no seu computador), **Parte 5** (publicar na internet) e **próximos passos**.

---

# PARTE 4 — Rodar o sistema no seu computador

## O que você vai fazer

1. Abrir o PowerShell na pasta VIABILIDADE.
2. Digitar um comando para “ligar” o servidor do projeto.
3. Deixar essa janela aberta.
4. Abrir o navegador e acessar um endereço para ver o sistema.
5. Testar o fluxo: Iniciar Step One → preencher cidade/estado → ver as 11 etapas.

---

## Passo 4.1 — Abrir o PowerShell na pasta VIABILIDADE

1. Pressione a tecla **Windows** (ou clique no ícone do Windows na barra de tarefas).
2. Digite **Explorador de Arquivos** e aperte **Enter**.
3. No Explorador: clique em **OneDrive** → **Área de Trabalho** → **VIABILIDADE** (entre na pasta VIABILIDADE).
4. Confira que você está **dentro** da pasta VIABILIDADE (o nome aparece na barra de endereço no topo).
5. **Clique uma vez** na barra de endereço (onde está o caminho da pasta). O texto fica selecionado.
6. Digite **powershell** (tudo junto, minúsculo).
7. Aperte **Enter**.
8. Vai abrir uma janela (fundo azul ou preto) com texto branco — é o **PowerShell**, já na pasta VIABILIDADE. Não feche essa janela.

**Alternativa:** Se já tiver uma janela do PowerShell aberta de quando você rodou o `npm install`, pode usar a mesma. Só confira que o final da linha mostra algo como `\VIABILIDADE>`. Se não estiver nessa pasta, digite o comando abaixo e aperte Enter:

```
cd "C:\Users\apsou\OneDrive\Área de Trabalho\VIABILIDADE"
```

---

## Passo 4.2 — Rodar o comando npm run dev

1. Na janela do **PowerShell** (com o cursor piscando no final da linha),
2. Digite **exatamente** (ou copie e cole):

   ```
   npm run dev
   ```

3. Aperte **Enter**.

---

## Passo 4.3 — Esperar e deixar a janela aberta

1. O PowerShell vai mostrar várias linhas. É normal.
2. Espere alguns segundos. Quando estiver pronto, deve aparecer algo como:

   ```
   ▲ Next.js 14.x.x
   - Local:        http://localhost:3000
   ```

   (O número da versão pode ser outro; o importante é aparecer **http://localhost:3000**.)

3. **Não feche a janela do PowerShell.** Enquanto ela estiver aberta e mostrando isso, o servidor está rodando. Se fechar, o site para de funcionar.
4. Se aparecer alguma mensagem de **erro** em vermelho, anote ou tire um print para enviar a quem for te ajudar.

---

## Passo 4.4 — Abrir o sistema no navegador

1. Abra o **Chrome**, o **Edge** ou outro navegador que você use.
2. **Clique** na barra de endereço (onde normalmente você digita google.com, etc.).
3. Digite **exatamente** (ou copie e cole):

   ```
   http://localhost:3000
   ```

   **Importante:** use **http** (não https) e **localhost** (tudo junto). O número é 3000.

4. Aperte **Enter**.
5. Deve abrir a **página inicial** do Viabilidade Moní: título “Processo Step One”, botão “Iniciar Step One”, etc. Se abrir, o sistema está rodando.

**Se não abrir:** confira se a janela do PowerShell ainda está aberta e se apareceu “Local: http://localhost:3000”. Se fechou o PowerShell, abra de novo, vá na pasta VIABILIDADE, rode `npm run dev` outra vez e tente acessar de novo.

---

## Passo 4.5 — Testar o fluxo (Iniciar Step One e as 11 etapas)

1. Na página que abriu (http://localhost:3000), clique no botão **“Iniciar Step One”** (ou no link “Iniciar Step One” no topo).
2. Deve abrir uma tela com o título **“Iniciar Processo Step One”** e dois campos: **Cidade** e **Estado (UF)**.
3. No campo **Cidade**, digite por exemplo **Campinas** (ou qualquer cidade).
4. No campo **Estado (UF)**, digite por exemplo **SP** (duas letras).
5. Clique no botão **“Iniciar processo”**.
6. A tela deve mudar e mostrar a **lista das 11 etapas** (Etapa 1 — Análise da praça, Etapa 2 — Condomínios e checklist, etc.), cada uma com um número e um link.
7. **Clique** em qualquer etapa (ex.: “Etapa 1”). Deve abrir a página daquela etapa, com texto explicativo e botões “Etapa anterior” / “Próxima etapa”.
8. Se tudo isso acontecer, a **Parte 4** está concluída: o sistema está rodando no seu computador e o fluxo principal funciona.

**Para parar o servidor:** quando não quiser mais usar, volte na janela do PowerShell e aperte **Ctrl + C** (segure Ctrl e aperte C). O servidor para e você pode fechar a janela.

---

# PARTE 5 — Publicar na internet (opcional)

Só faça esta parte se quiser que o sistema fique acessível por um link na internet (para você ou outras pessoas usarem sem estar no seu PC).

## O que você vai fazer

1. Criar uma conta no **GitHub** (se ainda não tiver).
2. Instalar o **Git** no Windows.
3. Enviar o projeto da pasta VIABILIDADE para um “repositório” no GitHub (com comandos no PowerShell).
4. Criar conta na **Vercel** e conectar o repositório do GitHub.
5. Colocar no projeto da Vercel a **URL** e a **chave anon** do Supabase (as mesmas do .env.local).
6. Fazer o “deploy”; a Vercel vai te dar uma URL (ex.: https://viabilidade-moni-xxx.vercel.app) para acessar o sistema na internet.

---

## Passo 5.1 — Conta no GitHub

1. Abra o navegador e vá em **https://github.com**.
2. Se já tiver conta, clique em **Sign in** e faça login. Se não tiver:
   - Clique em **Sign up**.
   - Preencha e-mail, senha e um nome de usuário (ex.: moni-viabilidade).
   - Siga os passos (verificar e-mail, etc.) até conseguir entrar no GitHub.

---

## Passo 5.2 — Instalar o Git no Windows

O Git é um programa que permite “enviar” o projeto para o GitHub.

1. Abra o navegador e vá em **https://git-scm.com/download/win**.
2. O download do Git para Windows deve começar. Quando terminar, abra o arquivo baixado (algo como **Git-2.x.x-64-bit.exe**).
3. Nas telas de instalação, clique em **Next** (Próximo) em todas, **sem mudar as opções** (deixe o padrão).
4. No final, clique em **Install** e depois **Finish**.

---

## Passo 5.3 — Criar um repositório novo no GitHub

1. No GitHub, logado, clique no **+** no canto superior direito e escolha **New repository**.
2. Em **Repository name**, digite por exemplo **viabilidade-moni** (pode ser outro nome, sem espaços).
3. Escolha **Private** se não quiser que o código fique público; ou **Public** se não se importar.
4. **Não** marque “Add a README file” (deixe tudo em branco).
5. Clique em **Create repository**.
6. A próxima tela mostra instruções; você vai usar a parte **“…or push an existing repository from the command line”**. Anote a URL que aparece, algo como:  
   `https://github.com/SEU_USUARIO/viabilidade-moni.git`  
   (troque SEU_USUARIO pelo seu usuário do GitHub.)

---

## Passo 5.4 — Enviar o projeto para o GitHub (comandos no PowerShell)

**Importante:** o projeto precisa estar na pasta VIABILIDADE e você precisa ter o **Git** instalado (Passo 5.2).

1. **Feche** a janela do PowerShell onde estava rodando `npm run dev` (ou abra **outra** janela do PowerShell).
2. Abra o PowerShell **na pasta VIABILIDADE** (como no Passo 4.1: Explorador → VIABILIDADE → barra de endereço → digitar **powershell** → Enter).
3. Digite os comandos abaixo **um por vez**, apertando **Enter** após cada um. Troque **SEU_USUARIO** pelo seu usuário do GitHub e **viabilidade-moni** pelo nome do repositório que você criou, se for diferente.

   **Comando 1** (inicializa o Git na pasta):
   ```
   git init
   ```

   **Comando 2** (prepara todos os arquivos):
   ```
   git add .
   ```

   **Comando 3** (cria um “commit” com uma mensagem):
   ```
   git commit -m "Projeto inicial Step One"
   ```

   **Comando 4** (nome da branch principal):
   ```
   git branch -M main
   ```

   **Comando 5** (conecta à sua pasta no GitHub — **troque SEU_USUARIO e viabilidade-moni**):
   ```
   git remote add origin https://github.com/SEU_USUARIO/viabilidade-moni.git
   ```

   **Comando 6** (envia o código para o GitHub):
   ```
   git push -u origin main
   ```

4. No **Comando 6**, o GitHub pode pedir **login**:
   - Se pedir **usuário e senha:** hoje o GitHub não aceita mais senha comum para push. Você precisa criar um **Personal Access Token**:
     - No GitHub: clique na sua foto (canto superior direito) → **Settings** → no menu da esquerda, no final, **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**. Dê um nome (ex.: “Vercel”), marque a permissão **repo** e gere. **Copie o token** (ele só aparece uma vez) e use-o **no lugar da senha** quando o PowerShell pedir.
   - Se abrir uma janela do navegador para login no GitHub, faça login lá e autorize.
5. Quando o **git push** terminar sem erro, o projeto estará no GitHub. Você pode conferir entrando no repositório no site (github.com/SEU_USUARIO/viabilidade-moni).

---

## Passo 5.5 — Conta na Vercel e conectar o repositório

1. Abra o navegador e vá em **https://vercel.com**.
2. Clique em **Sign Up** ou **Log in**. Escolha **Continue with GitHub** e autorize a Vercel a acessar sua conta do GitHub.
3. Depois de logado, clique em **Add New…** (ou **New Project**).
4. Na lista de repositórios, procure **viabilidade-moni** (ou o nome que você deu) e clique em **Import** ao lado.
5. Na tela de configuração do projeto:
   - **Project Name** pode ficar viabilidade-moni (ou o que quiser).
   - **Framework Preset** a Vercel costuma detectar Next.js; deixe como está.
   - **Root Directory** deixe em branco.
   - **Build and Output Settings** deixe o padrão.

---

## Passo 5.6 — Colocar a URL e a chave do Supabase na Vercel

1. Na **mesma** tela do projeto (antes de dar Deploy), procure a seção **Environment Variables** (Variáveis de ambiente).
2. Em **Name** (nome), digite: **NEXT_PUBLIC_SUPABASE_URL**  
   Em **Value** (valor), **cole a mesma URL** que está no seu arquivo .env.local (a Project URL do Supabase).  
   Depois clique em **Add** (ou em “Add another” para adicionar a próxima).
3. Em **Name**, digite: **NEXT_PUBLIC_SUPABASE_ANON_KEY**  
   Em **Value**, **cole a mesma chave anon (public)** que está no .env.local.  
   Clique em **Add**.
4. Confira que as duas variáveis aparecem na lista (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY).

---

## Passo 5.7 — Fazer o deploy e pegar a URL

1. Clique no botão **Deploy** (ou **Deploy Project**).
2. A Vercel vai “construir” e publicar o projeto. Espere alguns minutos. A tela mostra o progresso.
3. Quando terminar, aparece uma tela de **sucesso** com uma **URL**, algo como:  
   **https://viabilidade-moni-xxxxx.vercel.app**
4. **Copie** essa URL ou clique nela. Essa é o endereço do seu sistema na internet. Qualquer pessoa com o link pode acessar (se o repositório for público; se for privado, só quem você autorizar).

**Resumo Parte 5:** Você criou conta no GitHub, enviou o projeto com `git`, criou conta na Vercel, importou o repositório, colocou as variáveis do Supabase e fez o deploy. A URL que a Vercel mostrou é o “site no ar”.

---

# PRÓXIMOS PASSOS (depois que estiver no ar)

Quando o sistema já estiver abrindo (no seu PC com `npm run dev` ou na URL da Vercel), as melhorias seguintes são:

---

## 1. Login (entrar no sistema com usuário e senha)

- **O que é:** Tela de “Entrar” e “Cadastrar”; só quem tiver conta acessa as etapas. Cada usuário (Frank) vê só os próprios processos.
- **O que fazer:** Usar o **Supabase Auth** (já está no projeto). Um desenvolvedor pode:
  - Adicionar páginas de login e cadastro.
  - Proteger as rotas `/step-one` e `/step-one/[id]` para exigir usuário logado.
  - Garantir que, ao criar um processo, o `user_id` seja o do usuário logado (e que a tabela `profiles` seja preenchida pelo trigger que já criamos no SQL).

---

## 2. Salvar no banco (processo e etapas de verdade)

- **O que é:** Quando o Frank clica em “Iniciar processo”, em vez de só redirecionar com um ID na URL, o sistema cria um registro na tabela **processo_step_one** no Supabase e registros em **etapa_progresso** para as 11 etapas. Assim o progresso fica salvo e pode ser retomado depois.
- **O que fazer:** No front (página `/step-one`), ao submeter o formulário (cidade e estado), chamar a API do Supabase (ou uma rota API do Next.js que use o cliente Supabase) para:
  - Inserir em `processo_step_one` (user_id, cidade, estado, status, etapa_atual).
  - Inserir 11 linhas em `etapa_progresso` (uma por etapa, vinculadas ao processo).
  - Redirecionar para `/step-one/[id]` usando o **id** retornado pelo Supabase (em vez de um ID gerado no navegador).

---

## 3. Preencher o conteúdo de cada etapa

- **O que é:** Cada uma das 11 etapas ganha formulários, tabelas e integrações reais (APIs da praça, ZAP/Apify, catálogo Moní, BCA, geração de PDF), conforme o documento **docs/STEP_ONE_ESPEC.md**.
- **O que fazer:** Implementar etapa por etapa (ou por sprint), por exemplo:
  - **Etapa 1:** Chamar APIs (IBGE, Prefeitura, etc.) e/ou Claude para análise da praça; mostrar dados e narrativa na tela.
  - **Etapa 2:** Listagem de condomínios e checklist (16 itens); salvar em tabelas no Supabase.
  - **Etapas 4 e 5:** Integração com Apify (ou outra ferramenta) para varrer a ZAP; listagem de casas e lotes; recuos (manual/PDF).
  - **Etapa 6:** Tela ou importação do catálogo Moní (largura, área, preços, adicionais).
  - **Etapa 7:** Formulário do lote escolhido pelo franqueado.
  - **Etapa 8:** Tela de batalhas (preço, produto, localização) com notas -2 a +2; produto validado pelo Frank.
  - **Etapas 9 e 10:** Ranking do catálogo e preenchimento das 3 BCAs.
  - **Etapa 11:** Gerar e fazer download do PDF de hipóteses; registrar em **pdf_exports**.

Você pode priorizar com um desenvolvedor: por exemplo, primeiro login + salvar processo no banco, depois as etapas na ordem 1 → 11.

---

## Resumo do guia

| Parte | O que fazer |
|-------|-------------|
| **4** | PowerShell na VIABILIDADE → `npm run dev` → deixar janela aberta → navegador em http://localhost:3000 → testar Iniciar Step One e as 11 etapas. |
| **5** | Conta GitHub + Git instalado → criar repositório → `git init`, `add`, `commit`, `remote`, `push` → Vercel → importar repo → colocar NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY → Deploy → usar a URL que a Vercel mostrar. |
| **Depois** | Login (Supabase Auth), salvar processo e etapas no banco, preencher conteúdo das 11 etapas (ver docs/STEP_ONE_ESPEC.md). |
