# Guia passo a passo — Colocar o projeto Viabilidade Moní no ar

Este guia é para quem **não é desenvolvedor(a)**. Siga na ordem; cada passo explica o que fazer e onde clicar.

---

## O que você vai precisar

- Um computador com Windows (o seu).
- Navegador (Chrome ou Edge).
- Conta de e-mail (para criar conta no Supabase e no Vercel, se quiser publicar na internet).
- Cerca de 30 a 60 minutos na primeira vez.

---

## PARTE 1 — Instalar o Node.js (ferramenta que roda o projeto)

O projeto foi feito em **Next.js**, que precisa do **Node.js** instalado.

### Passo 1.1 — Baixar o Node.js

1. Abra o navegador e vá em: **https://nodejs.org**
2. Na página inicial você verá dois botões grandes (versão “LTS” e outra).
3. Clique no botão da **versão LTS** (recomendada). Exemplo: “22.x.x LTS”.
4. Será baixado um arquivo tipo `node-v22.x.x-x64.msi`.

### Passo 1.2 — Instalar o Node.js

1. Abra a pasta **Downloads** do seu computador.
2. Dê dois cliques no arquivo que acabou de baixar (`.msi`).
3. Se aparecer “Você deseja permitir que este app faça alterações?”, clique em **Sim**.
4. Na tela de instalação:
   - Clique em **Next** (Próximo) em todas as telas.
   - Se aparecer a opção **Add to PATH**, deixe marcada.
   - No final, clique em **Install** (Instalar) e depois **Finish** (Concluir).
5. **Feche e abra de novo** o terminal/PowerShell (ou reinicie o computador) para o sistema reconhecer o Node.

### Passo 1.3 — Conferir se instalou

1. Pressione **Windows + R**, digite **powershell** e aperte Enter.
2. Na janela que abrir, digite exatamente (e aperte Enter):

   ```text
   node -v
   ```

3. Deve aparecer algo como `v22.11.0` (o número pode ser outro). Se aparecer, está certo.
4. Digite também:

   ```text
   npm -v
   ```

5. Deve aparecer um número (ex.: `10.2.0`). Pronto: Node e npm estão instalados.

---

## PARTE 2 — Criar o projeto no Supabase (banco de dados e login)

O sistema usa o **Supabase** para guardar dados e para login (Frank, Consultor, Admin). Você precisa criar um projeto gratuito.

### Passo 2.1 — Criar conta e projeto no Supabase

1. Acesse **https://supabase.com** no navegador.
2. Clique em **Start your project** (ou “Sign in” se já tiver conta).
3. Faça login com **GitHub** ou com **e-mail** (crie conta se precisar).
4. Depois de logado, clique em **New Project** (Novo Projeto).
5. Preencha:
   - **Name:** por exemplo `viabilidade-moni`.
   - **Database Password:** crie uma senha **forte** e **guarde num lugar seguro** (bloco de notas, 1Password, etc.). Você vai usar essa senha só em caso de acesso avançado ao banco.
   - **Region:** escolha a mais próxima (ex.: South America (São Paulo)).
6. Clique em **Create new project** e espere alguns minutos (o Supabase cria o banco).

### Passo 2.2 — Pegar a URL e a chave do projeto (para o sistema conectar no Supabase)

1. No menu da esquerda do Supabase, clique em **Project Settings** (ícone de engrenagem).
2. No menu interno, clique em **API**.
3. Na tela você verá:
   - **Project URL** — algo como `https://xxxxxxxx.supabase.co`
   - **Project API keys** — uma chave chamada **anon** (public) e outra **service_role** (secret).

4. Você vai usar só a **URL** e a chave **anon (public)** no projeto.
   - Clique no ícone de **copiar** ao lado de **Project URL** e cole num bloco de notas; marque como “URL do Supabase”.
   - Clique no ícone de **copiar** ao lado da chave **anon public** e cole no bloco de notas; marque como “Chave anon Supabase”.

### Passo 2.3 — Rodar o SQL do projeto no Supabase (criar tabelas e regras de segurança)

O projeto tem um arquivo que “ensina” o Supabase a criar todas as tabelas (processos, etapas, logs, etc.) e as regras de quem pode ver o quê (Frank só vê os próprios dados, etc.).

1. No Supabase, no menu da esquerda, clique em **SQL Editor**.
2. Clique em **New query** (Nova consulta).
3. Abra no seu computador a pasta do projeto:
   - Caminho: **Área de Trabalho** → **VIABILIDADE** → **supabase** → **migrations**
   - Abra o arquivo **001_initial_schema.sql** com o **Bloco de notas** (botão direito → Abrir com → Bloco de notas).
4. Selecione **todo** o conteúdo do arquivo (Ctrl+A), copie (Ctrl+C).
5. Volte ao **SQL Editor** do Supabase e cole (Ctrl+V) na caixa de texto.
6. Clique no botão **Run** (ou **Execute**) embaixo.
7. Deve aparecer uma mensagem de sucesso (tipo “Success. No rows returned”). Se aparecer algum erro em vermelho, anote a mensagem — você pode enviar para um desenvolvedor ou suporte corrigir.

Depois disso, as tabelas e as regras de acesso (RLS) já estão criadas no seu projeto Supabase.

---

## PARTE 3 — Configurar o projeto na sua máquina (pasta VIABILIDADE)

Agora você vai “instalar” as dependências do projeto e dizer ao projeto qual é a URL e a chave do Supabase.

### Passo 3.1 — Abrir a pasta do projeto no terminal

1. Abra o **Explorador de Arquivos** e vá até:
   - **Este computador** → **OneDrive** → **Área de Trabalho** → **VIABILIDADE**
2. Na barra de endereço do Explorador (onde aparece o caminho da pasta), **clique uma vez** no caminho, digite **powershell** e aperte **Enter**.
   - Isso abre o PowerShell já **dentro** da pasta VIABILIDADE.

Se preferir:

- Pressione **Windows + R**, digite **powershell**, Enter.
- Depois digite (troque pelo seu usuário se for diferente):
  ```text
  cd "C:\Users\apsou\OneDrive\Área de Trabalho\VIABILIDADE"
  ```
- Aperte Enter.

### Passo 3.2 — Instalar as dependências do projeto

1. No PowerShell, ainda na pasta VIABILIDADE, digite:

   ```text
   npm install
   ```

2. Aperte Enter e **aguarde** (pode levar 1 a 3 minutos). Vão aparecer várias linhas; é normal.
3. Quando terminar, o cursor volta a piscar e não aparece “erro” em vermelho. Se aparecer “added XXX packages”, está certo.

### Passo 3.3 — Criar o arquivo de configuração com a URL e a chave do Supabase

1. Na pasta **VIABILIDADE**, procure o arquivo **.env.local.example**.
2. **Copie** esse arquivo (Ctrl+C) e **cole** na mesma pasta (Ctrl+V).
3. **Renomeie** a cópia para exatamente: **.env.local**  
   (o nome começa com ponto; no Windows às vezes o Explorador esconde “extensões”; se precisar, mostre extensões em: Visualizar → marcar “Extensões de nomes de arquivos”).
4. Abra o arquivo **.env.local** com o Bloco de notas.
5. Você verá linhas como:
   ```text
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
   ```
6. **Substitua**:
   - `https://seu-projeto.supabase.co` pela **Project URL** que você copiou do Supabase (Passo 2.2).
   - `sua-anon-key` pela **chave anon (public)** que você copiou.
7. Salve o arquivo (Ctrl+S) e feche.

Exemplo de como pode ficar (com dados fictícios):

```text
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
```

---

## PARTE 4 — Rodar o sistema no seu computador

### Passo 4.1 — Subir o servidor do projeto

1. No PowerShell, ainda na pasta **VIABILIDADE**, digite:

   ```text
   npm run dev
   ```

2. Aperte Enter.
3. Aguarde até aparecer algo como:
   ```text
   ▲ Next.js 14.x.x
   - Local:        http://localhost:3000
   ```
4. **Deixe essa janela aberta** (se fechar, o site para de rodar).

### Passo 4.2 — Abrir o sistema no navegador

1. Abra o Chrome ou o Edge.
2. Na barra de endereço digite exatamente: **http://localhost:3000**
3. Aperte Enter.
4. Deve abrir a **página inicial** do Viabilidade Moní, com o botão “Iniciar Step One”. Pronto: o sistema está no ar na sua máquina.

### Passo 4.3 — Testar o fluxo “Iniciar processo”

1. Clique em **Iniciar Step One**.
2. Preencha **Cidade** (ex.: Campinas) e **Estado** (ex.: SP).
3. Clique em **Iniciar processo**.
4. Você deve ser levada à lista das **11 etapas**; clicando em cada uma, abre a página daquela etapa (por enquanto com texto explicativo e “próxima etapa / etapa anterior”).

Se tudo isso acontecer, a Parte 4 está ok.

---

## PARTE 5 — Deixar o sistema acessível na internet (opcional)

Enquanto você usa só **npm run dev** e **http://localhost:3000**, o sistema roda **só no seu PC**. Para outras pessoas (ou você em outro lugar) acessarem pela internet, é preciso publicar em um serviço de hospedagem. A opção mais simples para este projeto é o **Vercel** (gratuito para projetos pequenos).

### Passo 5.1 — Conta no GitHub (se ainda não tiver)

1. Acesse **https://github.com** e crie uma conta (ou faça login).
2. Instale o **Git** no Windows: **https://git-scm.com/download/win** — instale com as opções padrão.

### Passo 5.2 — Subir o projeto para o GitHub

1. No GitHub, clique em **New** (novo repositório).
2. Nome do repositório: por exemplo **viabilidade-moni**.
3. Deixe **Private** se não quiser que o código fique público; depois clique **Create repository**.
4. No seu PC, na pasta **VIABILIDADE**, abra o PowerShell e rode, um por vez (troque `SEU_USUARIO` pelo seu usuário do GitHub e `viabilidade-moni` pelo nome do repositório que criou):

   ```text
   git init
   git add .
   git commit -m "Projeto inicial Step One"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/viabilidade-moni.git
   git push -u origin main
   ```

   O GitHub pode pedir usuário e senha (ou “token”); use um **Personal Access Token** se pedir senha: em GitHub → Settings → Developer settings → Personal access tokens.

### Passo 5.3 — Conectar o repositório na Vercel

1. Acesse **https://vercel.com** e faça login (pode ser com a conta do GitHub).
2. Clique em **Add New** → **Project**.
3. Importe o repositório **viabilidade-moni** (ou o nome que você deu).
4. Em **Environment Variables** (Variáveis de ambiente), adicione:
   - **Name:** `NEXT_PUBLIC_SUPABASE_URL`  
     **Value:** a mesma URL do Supabase que está no seu `.env.local`.
   - **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
     **Value:** a mesma chave anon do `.env.local`.
5. Clique em **Deploy**.
6. Quando terminar, a Vercel mostra uma URL tipo `https://viabilidade-moni-xxx.vercel.app`. Essa é a URL do sistema na internet.

**Importante:** Na Vercel, as variáveis que você colocou são usadas só no build e na execução online. O `.env.local` da sua máquina continua sendo só para quando você roda **npm run dev** no PC.

---

## Resumo rápido — O que fazer na próxima vez

- **Só usar no seu computador:**
  1. Abrir PowerShell na pasta **VIABILIDADE**.
  2. Digitar **npm run dev** e apertar Enter.
  3. Abrir o navegador em **http://localhost:3000**.

- **Se publicou na Vercel:** basta abrir a URL que a Vercel te deu (ex.: `https://viabilidade-moni-xxx.vercel.app`) no navegador.

---

## Se algo der errado

- **“node não é reconhecido”:** Node.js não está instalado ou o terminal foi aberto antes da instalação. Reinstale o Node e **feche e abra de novo** o PowerShell.
- **“npm não é reconhecido”:** Mesma ideia; confira com `node -v` e `npm -v` depois de reinstalar.
- **Erro ao rodar o SQL no Supabase:** Copie a mensagem de erro completa e envie para quem for dar suporte técnico (ou guarde para um desenvolvedor).
- **Página em branco ou “This site can’t be reached” em localhost:** Confira se você rodou **npm run dev** e se a janela do PowerShell ainda está aberta; e se digitou **http://localhost:3000** (com “http” e sem “s” em “https”).
- **Sistema abre mas não salva nada:** Verifique se o arquivo **.env.local** está na pasta **VIABILIDADE**, com o nome certo e com a URL e a chave anon do Supabase corretas (sem espaços extras).

---

## Próximos passos depois que estiver no ar

Quando o projeto estiver abrindo e você conseguir clicar em “Iniciar processo” e ver as 11 etapas:

1. **Login:** Um desenvolvedor ou você (se seguir um tutorial de Supabase Auth) pode adicionar tela de login e vincular o “processo” ao usuário logado (Frank).
2. **Salvar no banco:** O botão “Iniciar processo” pode passar a criar o registro na tabela `processo_step_one` no Supabase e redirecionar para o ID real (hoje o ID é só na URL).
3. **Conteúdo de cada etapa:** Cada etapa (1 a 11) pode ganhar formulários e integrações (APIs da praça, ZAP, catálogo Moní, BCA, PDF), conforme o arquivo **docs/STEP_ONE_ESPEC.md**.

Se quiser, na próxima conversa você pode dizer em qual parte parou (ex.: “instalei o Node e rodei npm install”) e eu te guio só naquela parte, com ainda mais detalhe.
