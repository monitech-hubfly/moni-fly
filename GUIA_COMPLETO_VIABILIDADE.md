# Guia Completo — Sistema Viabilidade Moní

Este é o guia consolidado para colocar o sistema Viabilidade Moní no ar, desde a instalação inicial até as funcionalidades avançadas de todas as sprints.

**Para quem é este guia:** pessoas que não são desenvolvedoras, mas que vão configurar e usar o sistema.

**Tempo estimado:** 30-60 minutos na primeira configuração completa.

---

## Índice

1. [O que você vai precisar](#o-que-você-vai-precisar)
2. [PARTE 1 — Instalar o Node.js](#parte-1--instalar-o-nodejs)
3. [PARTE 2 — Criar o projeto no Supabase](#parte-2--criar-o-projeto-no-supabase)
4. [PARTE 3 — Configurar o projeto na sua máquina](#parte-3--configurar-o-projeto-na-sua-máquina)
5. [PARTE 4 — Rodar o sistema no seu computador](#parte-4--rodar-o-sistema-no-seu-computador)
6. [PARTE 5 — Funcionalidades por Sprint](#parte-5--funcionalidades-por-sprint)
7. [PARTE 6 — Publicar na internet (opcional)](#parte-6--publicar-na-internet-opcional)
8. [Solução de problemas](#solução-de-problemas)
9. [Próximos passos](#próximos-passos)

---

## O que você vai precisar

- Computador com **Windows**
- Navegador (**Chrome** ou **Edge**)
- Conta de **e-mail** (para Supabase e Vercel)
- Pasta do projeto **VIABILIDADE** na **Área de Trabalho**
- Cerca de 30 a 60 minutos na primeira vez

---

## PARTE 1 — Instalar o Node.js

O projeto foi feito em **Next.js**, que precisa do **Node.js** instalado.

### Passo 1.1 — Baixar o Node.js

1. Abra o navegador e vá em: **https://nodejs.org**
2. Na página inicial você verá dois botões grandes (versão "LTS" e outra).
3. Clique no botão da **versão LTS** (recomendada). Exemplo: "22.x.x LTS".
4. Será baixado um arquivo tipo `node-v22.x.x-x64.msi`.

### Passo 1.2 — Instalar o Node.js

1. Abra a pasta **Downloads** do seu computador.
2. Dê dois cliques no arquivo que acabou de baixar (`.msi`).
3. Se aparecer "Você deseja permitir que este app faça alterações?", clique em **Sim**.
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

## PARTE 2 — Criar o projeto no Supabase

O sistema usa o **Supabase** para guardar dados e para login (Frank, Consultor, Admin).

### Passo 2.1 — Criar conta e projeto no Supabase

1. Acesse **https://supabase.com** no navegador.
2. Clique em **Start your project** (ou "Sign in" se já tiver conta).
3. Faça login com **GitHub** ou com **e-mail** (crie conta se precisar).
4. Depois de logado, clique em **New Project** (Novo Projeto).
5. Preencha:
   - **Name:** por exemplo `viabilidade-moni`.
   - **Database Password:** crie uma senha **forte** e **guarde num lugar seguro** (bloco de notas, 1Password, etc.). Você vai usar essa senha só em caso de acesso avançado ao banco.
   - **Region:** escolha a mais próxima (ex.: South America (São Paulo)).
6. Clique em **Create new project** e espere alguns minutos (o Supabase cria o banco).

### Passo 2.2 — Pegar a URL e a chave do projeto

#### Onde encontrar a URL e a chave

1. No menu da esquerda do Supabase, procure o ícone de **engrenagem** (⚙️) — ao passar o mouse, aparece o texto **"Project Settings"**.
2. **Clique** nesse ícone de engrenagem.
3. No menu interno, clique em **API**.
4. Na tela você verá:
   - **Project URL** — algo como `https://xxxxxxxx.supabase.co`
   - **Project API keys** — uma chave chamada **anon** (public) e outra **service_role** (secret).

#### Copiar a Project URL

1. Na seção **API**, no topo, procure o bloco chamado **"Project URL"**.
2. Abaixo do título há uma caixa com um endereço que começa com **https://** e termina com **.supabase.co**.
3. À **direita** dessa caixa há um **ícone de copiar** (geralmente dois quadradinhos).
4. **Clique** nesse ícone de copiar.
5. **Cole** em um Bloco de notas e salve como "URL do Supabase" para não perder.

#### Copiar a chave anon (public)

1. Na **mesma página API**, role a tela para baixo até a parte **"Project API keys"**.
2. Você verá **duas chaves**:
   - **anon** ou **anon public** — **é esta que você vai usar**.
   - **service_role** ou **service_role secret** — **não use** esta no projeto.
3. Na linha da chave **anon** / **anon public**:
   - Há uma caixa longa com um texto que parece uma sequência grande de letras, números e pontos (ex.: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`).
   - À direita dessa caixa há o **ícone de copiar**.
4. **Clique** no ícone de copiar da chave **anon**.
5. **Cole** no Bloco de notas e salve como "Chave anon Supabase".

**Resumo:** Você precisa só destes dois valores:
- **Project URL** (ex.: `https://xxxxx.supabase.co`)
- **Chave anon (public)** (aquele texto longo que começa muitas vezes com `eyJ...`)

### Passo 2.3 — Rodar as migrações SQL no Supabase

O projeto tem vários arquivos SQL (migrações) que criam as tabelas e regras de segurança. É importante rodá-los **na ordem correta**.

#### Ordem das migrações

Rode **nesta ordem** no SQL Editor do Supabase (uma de cada vez):

| #   | Arquivo                                    | O que faz                                                                                             |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1   | **001_initial_schema.sql**                 | Cria tabelas iniciais (profiles, processo_step_one, etapa_progresso, etc.).                           |
| 2   | **002_idempotent_schema.sql**              | Ajustes idempotentes do schema + função get_my_role() (evita recursão em RLS).                        |
| 3   | **003_fix_rls_recursion_profiles.sql**     | Correção adicional de RLS em profiles (se necessário).                                                |
| 4   | **004_sprint4_listings_catalogo_lote.sql** | Cria listings_casas, listings_lotes, catalogo_casas, lote_escolhido + seed de 2 modelos.              |
| 5   | **005_batalhas_etapa8.sql**                | Cria tabela batalhas (notas preço, produto, localização para Etapa 8).                                |
| 6   | **007_catalogo_escolhidos.sql**            | Remove casas_escolhidas (se existir) e cria catalogo_escolhidos (3 modelos do catálogo por processo). |

**IMPORTANTE:** **NÃO** rode o arquivo **006_casas_escolhidas.sql**. A lógica foi substituída pela **007** (escolha de 3 **modelos do catálogo**, não 3 casas ZAP).

**Se você já rodou migrações antes:**
- Se já rodou 001 a 005: rode **só a 007** (ela remove a tabela antiga e cria a nova).
- Se já rodou a 007 e aparecer erro "relation already exists": pode **ignorar** e seguir em frente.

#### Abrir o SQL Editor no Supabase

1. Volte ao navegador, na página do **Supabase** (seu projeto).
2. No **menu da esquerda**, procure o ícone que parece uma **janela com linhas de código** — ao passar o mouse aparece **"SQL Editor"**.
3. **Clique** em **SQL Editor**.
4. Abre a tela do editor SQL com uma área grande em branco onde se escreve ou cola comandos SQL.

#### Rodar cada migração SQL

Para **cada** arquivo da lista acima (rode um de cada vez, na ordem):

1. No seu PC, abra a pasta: **Explorador de Arquivos** → **OneDrive** → **Área de Trabalho** → **VIABILIDADE** → **supabase** → **migrations**
2. Abra o arquivo (ex.: **001_initial_schema.sql**) com **botão direito** → **Abrir com** → **Bloco de notas**.
3. Selecione **todo** o conteúdo (**Ctrl+A**) e copie (**Ctrl+C**).
4. Volte ao **SQL Editor** do Supabase.
5. **Cole** o conteúdo na caixa de texto (**Ctrl+V**).
6. Clique em **Run** (Executar).
7. **Resultado esperado:**
   - Aparece uma mensagem em **verde** tipo **"Success. No rows returned"** ou **"Success"**.
   - Se aparecer algo em **vermelho** (erro), **não apague nada**. Anote a mensagem de erro (veja seção Solução de problemas).
8. **Antes de passar para o próximo arquivo**, apague o conteúdo do Editor e repita para a próxima migração.

**Dica:** Se você está configurando pela primeira vez, rode todas as 6 migrações (001, 002, 003, 004, 005, 007) na ordem. Não leva mais que 10 minutos.

---

## PARTE 3 — Configurar o projeto na sua máquina

Agora você vai "instalar" as dependências do projeto e dizer ao projeto qual é a URL e a chave do Supabase.

### Passo 3.1 — Abrir a pasta do projeto no PowerShell

**Opção A — Pelo Explorador de Arquivos (mais fácil)**

1. Abra o **Explorador de Arquivos** (Windows + E).
2. Vá em **OneDrive** → **Área de Trabalho** → **VIABILIDADE**.
3. Confira que você está **dentro** da pasta VIABILIDADE (o nome aparece na barra de endereço no topo).
4. **Clique uma vez** na **barra de endereço** (onde aparece o caminho da pasta). O texto fica selecionado.
5. Digite **powershell** (tudo junto, minúsculo) e aperte **Enter**.
6. Vai abrir uma janela do PowerShell **já dentro** da pasta VIABILIDADE. Não feche essa janela.

**Opção B — Pelo menu Executar**

1. Pressione **Windows + R**.
2. Digite **powershell** e aperte **Enter**.
3. Digite o comando abaixo (troque `apsou` pelo seu usuário do Windows se for diferente):
   ```text
   cd "C:\Users\apsou\OneDrive\Área de Trabalho\VIABILIDADE"
   ```
4. Aperte **Enter**.

### Passo 3.2 — Instalar as dependências do projeto

1. No PowerShell, ainda na pasta VIABILIDADE, digite:
   ```text
   npm install
   ```
2. Aperte **Enter** e **aguarde** (pode levar 1 a 5 minutos). Vão aparecer várias linhas; é normal.
3. Quando terminar, o cursor volta a piscar e não aparece "erro" em vermelho. Se aparecer "added XXX packages", está certo.

### Passo 3.3 — Criar o arquivo de configuração (.env.local)

#### Copiar o arquivo de exemplo

1. Na pasta **VIABILIDADE**, procure o arquivo **.env.local.example**.
2. Se **não aparecer** nenhum arquivo começando com **.env**:
   - No topo do Explorador, clique na aba **Exibir** (ou **View**).
   - Marque a opção **"Extensões de nomes de arquivos"**.
3. **Clique uma vez** no arquivo **.env.local.example** para selecioná-lo.
4. Aperte **Ctrl + C** (copiar).
5. **Clique com o botão direito** em um espaço vazio **dentro da mesma pasta** e escolha **Colar**.
6. Deve aparecer um **novo arquivo** chamado **.env.local.example - Cópia** (ou similar).

#### Renomear para .env.local

1. **Clique com o botão direito** nesse novo arquivo.
2. Escolha **Renomear**.
3. Apague o nome todo e digite **exatamente**: **.env.local**
4. Aperte **Enter**.
5. Se o Windows avisar "Se você alterar a extensão…", clique em **Sim**.
6. No final, você deve ter **dois** arquivos:
   - **.env.local.example** (o original; não mexa)
   - **.env.local** (a cópia que você vai editar)

#### Editar o .env.local

1. **Clique com o botão direito** em **.env.local**.
2. No menu, escolha **"Abrir com"** → **Bloco de notas**.
3. O Bloco de notas abre com linhas parecidas com:
   ```text
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
   ```

#### Trocar a URL do Supabase

1. Na **primeira linha**:
   - **Apague** só a parte depois do **=** (ou seja, apague `https://seu-projeto.supabase.co`).
   - **Não apague** `NEXT_PUBLIC_SUPABASE_URL=`.
2. Depois do **=**, **cole** a **Project URL** que você copiou do Supabase (Ctrl + V). Não coloque espaço antes nem depois.
3. A linha deve ficar assim (com a sua URL):
   ```text
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   ```

#### Trocar a chave anon

1. Na **segunda linha**:
   - **Apague** só a parte depois do **=** (ou seja, apague `sua-anon-key`).
   - **Não apague** `NEXT_PUBLIC_SUPABASE_ANON_KEY=`.
2. Depois do **=**, **cole** a **chave anon** que você copiou (Ctrl + V).
3. A linha deve ficar assim (com a sua chave):
   ```text
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
   ```

#### Salvar o arquivo

1. No Bloco de notas, aperte **Ctrl + S** (ou menu **Arquivo** → **Salvar**).
2. Feche o Bloco de notas.

---

## PARTE 4 — Rodar o sistema no seu computador

### Passo 4.1 — Subir o servidor do projeto

1. No **PowerShell**, ainda na pasta **VIABILIDADE** (da Parte 3), digite:
   ```text
   npm run dev
   ```
2. Aperte **Enter**.
3. Espere até aparecer algo como:
   ```text
   ✓ Ready in ...
   - Local: http://localhost:3000
   ```
   (Se aparecer "Port 3000 is in use, trying 3001", anote: você usará **3001** no navegador.)
4. **Deixe essa janela do PowerShell aberta.** Enquanto ela estiver aberta, o sistema está no ar. Se fechar, o site para.

### Passo 4.2 — Abrir o sistema no navegador

1. Abra o **Chrome** ou **Edge**.
2. Na barra de endereço digite:
   - **http://localhost:3000**
   - ou, se o PowerShell mostrou porta 3001: **http://localhost:3001**
3. Aperte **Enter**.
4. Deve abrir a **página inicial** do Viabilidade Moní.

### Passo 4.3 — Testar o fluxo básico

1. Na página que abriu, você verá os botões **Entrar** e **Cadastrar** no topo (se não estiver logado).
2. Vamos primeiro **cadastrar** uma conta para testar o sistema completo (ver Parte 5 - Sprint 2).

**Para parar o servidor:** quando não quiser mais usar, volte na janela do PowerShell e aperte **Ctrl + C**. O servidor para e você pode fechar a janela.

---

## PARTE 5 — Funcionalidades por Sprint

O sistema foi desenvolvido em várias sprints. Cada sprint adicionou novas funcionalidades.

### Sprint 2 — Login, Cadastro e Criação de Processo

#### O que a Sprint 2 entrega

- Tela de **Cadastrar** (nome, e-mail, senha)
- Tela de **Entrar** (login)
- Criar processo salva no banco de dados
- Proteção de rotas (só quem está logado acessa)
- Botão **Sair** (logout)

#### Cadastrar uma nova conta

1. Na página inicial, clique no botão **Cadastrar** (no canto superior direito).
2. A URL deve mudar para **/signup**.
3. Preencha:
   - **Nome completo**: seu nome (ex.: Maria Silva)
   - **E-mail**: um e-mail válido (ex.: maria@email.com)
   - **Senha**: pelo menos 6 caracteres (ex.: teste123)
4. Anote o e-mail e a senha para usar depois.
5. Clique no botão **Cadastrar**.
6. **Resultado esperado:** a página redireciona para **/step-one** (tela "Iniciar Processo Step One"). Isso significa que a conta foi criada e você já está logado.

#### Criar um processo

1. Se você acabou de cadastrar, já está em **/step-one**.
2. Se não, clique em **Iniciar Step One** no menu.
3. Preencha:
   - **Cidade**: por exemplo **Campinas**
   - **Estado (UF)**: **selecione na lista** o estado (ex.: **SP — São Paulo**)
     - Todas as 27 UFs estão disponíveis: AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO.
4. Clique no botão **Iniciar processo**.
5. **Resultado esperado:**
   - A tela muda e mostra a **lista das 11 etapas** (Etapa 1 — Análise da praça, Etapa 2 — Condomínios e checklist, etc.).
   - No topo da página deve aparecer **Processo — Campinas, SP** (ou a cidade e estado que você digitou).
   - A **URL** deve ser algo como **http://localhost:3000/step-one/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx**, onde a parte longa é o **ID do processo** no banco.

#### Testar proteção de rotas

1. Clique no link **Sair** no canto superior direito.
2. A página recarrega e agora mostra **Entrar** e **Cadastrar** no lugar de "Iniciar Step One" e "Sair".
3. Na barra de endereço, tente acessar diretamente: **http://localhost:3000/step-one**
4. **Resultado esperado:** o sistema **redireciona** você para a tela de **Login**. Quem não está logado **não** consegue abrir a tela de Iniciar processo.
5. Faça **Entrar** com o e-mail e senha que você cadastrou.
6. Você volta a ter acesso ao sistema.

#### Conferir no Supabase (opcional)

1. Abra outra aba do navegador e vá em **https://supabase.com**. Faça login no seu projeto.
2. No menu da esquerda, clique em **Table Editor**.
3. Clique na tabela **processo_step_one**.
4. Deve aparecer **uma linha** com:
   - **cidade** = Campinas (ou o que você digitou)
   - **estado** = SP
   - **status** = em_andamento
   - **etapa_atual** = 1
   - **user_id** = um UUID (id do usuário que criou)
5. Clique na tabela **etapa_progresso**.
6. Deve haver **11 linhas** com o mesmo **processo_id**, **etapa_id** de 1 a 11 e **status** = nao_iniciada.

---

### Sprint 3 — Meus Processos e Etapa 1 com Formulário

#### O que a Sprint 3 entrega

- Página **Meus processos** (lista de todos os processos do usuário logado)
- **Etapa 1** com formulário funcional (análise da praça, campo de narrativa, checkbox para marcar como concluída)

#### Pré-requisitos

- Sprint 2 concluída (login, cadastro, criação de processo)
- Migração SQL **003_fix_rls_recursion_profiles.sql** rodada no Supabase (se houver)

#### Acessar Meus processos

1. Faça login no sistema.
2. No **canto superior direito** da tela, você deve ver:
   - **Meus processos**
   - **Iniciar Step One**
   - **Sair**
3. **Clique** em **Meus processos**.
4. A URL deve mudar para **/meus-processos**.
5. A página mostra:
   - Título **Meus processos**
   - Se você **não tem** nenhum processo: mensagem "Você ainda não tem nenhum processo." e o link **Iniciar novo processo**.
   - Se você **já tem** processos: uma **lista** com cada processo (cidade, estado, status, etapa X/11, data de atualização).
6. **Clique** em **uma linha** (um processo). Deve abrir a tela daquele processo com as **11 etapas**.

#### Usar a Etapa 1 com formulário

1. Na lista das **11 etapas**, clique na **primeira**: **Etapa 1 — Análise da praça**.
2. A página mostra:
   - Título **Etapa 1 — Análise da praça**
   - Texto explicando a etapa
   - **Praça:** nome da cidade e estado (ex.: Campinas, SP)
   - Um **campo grande de texto** (área de texto) com o rótulo **Análise da praça (narrativa)** e uma dica sobre o que escrever
   - Um **checkbox**: "Marcar etapa 1 como concluída"
   - Botão **Salvar**
   - Botão **Próxima etapa**

#### Salvar a análise da praça

1. No campo **Análise da praça (narrativa)**, digite qualquer texto, por exemplo: **"Campinas, região metropolitana de SP. Eixo de expansão sul. Parques Taquaral e Portugal."**
2. **Não** marque ainda o checkbox "Marcar etapa 1 como concluída".
3. Clique no botão **Salvar**.
4. Deve aparecer a mensagem **Salvo com sucesso.** (em verde) por alguns segundos.
5. Depois, **marque** o checkbox **Marcar etapa 1 como concluída** e clique em **Salvar** de novo.
6. Deve aparecer **Salvo com sucesso.** de novo. A etapa 1 fica registrada como concluída no banco.

---

### Sprint 4 — Etapas 4, 5, 6 e 7

#### O que a Sprint 4 entrega

- **Etapa 4**: Listagem de casas à venda (cadastro manual; integração ZAP/Apify em breve)
- **Etapa 5**: Listagem de lotes à venda (cadastro manual)
- **Etapa 6**: Catálogo de casas Moní (tabela com modelos, área, quartos, preço)
- **Etapa 7**: Lote escolhido pelo franqueado (formulário completo)

#### Pré-requisito: Rodar a migração SQL 004

**IMPORTANTE:** Sem este passo, as telas das etapas 4 a 7 vão dar erro ou não vão salvar.

1. Abra o navegador e vá em **https://supabase.com**. Faça login e abra o **projeto** do Viabilidade.
2. No menu da esquerda, clique em **SQL Editor**.
3. Clique no **+** (nova consulta).
4. No seu computador, vá em **VIABILIDADE** → **supabase** → **migrations**
5. Abra o arquivo **004_sprint4_listings_catalogo_lote.sql** (botão direito → **Abrir com** → **Bloco de notas**).
6. Selecione **todo** o conteúdo (**Ctrl+A**) e copie (**Ctrl+C**).
7. Volte ao **SQL Editor** do Supabase, apague qualquer texto na caixa e **cole** (**Ctrl+V**).
8. Clique em **Run**.
9. Deve aparecer mensagem em **verde** (ex.: **"Success"**).

**Pronto:** as tabelas **listings_casas**, **listings_lotes**, **catalogo_casas** e **lote_escolhido** foram criadas. Dois modelos de exemplo (Modelo A e Modelo B) foram inseridos no catálogo Moní.

#### Usar a Etapa 4 (casas à venda)

1. Abra um processo e clique em **Etapa 4 — Listagem casas à venda (ZAP)**.
2. Você deve ver:
   - Texto: _"Adicione casas à venda manualmente. A integração com Apify (varredura ZAP) será conectada em breve."_
   - Lista **"Casas cadastradas"** (vazia no início).
   - Formulário **"Adicionar casa"** com: Condomínio, Área casa (m²), Quartos, Preço (R$), Link anúncio, checkbox Piscina.
3. Preencha pelo menos **Condomínio** e **Preço** (ex.: Condomínio **Residencial X**, Preço **1500000**) e clique em **Adicionar casa**.
4. A casa deve aparecer na lista acima e os campos do formulário devem limpar.

#### Usar a Etapa 5 (lotes à venda)

1. Clique em **Etapa 5 — Listagem lotes à venda**.
2. Você deve ver:
   - Texto: _"Adicione lotes à venda manualmente. A integração com Apify (varredura ZAP) será conectada em breve."_
   - Lista **"Lotes cadastrados"** (vazia no início).
   - Formulário **"Adicionar lote"** com: Condomínio, Área (m²), Preço (R$), Link.
3. Preencha e clique em **Adicionar lote**. O lote deve aparecer na lista.

#### Usar a Etapa 6 (catálogo Moní)

1. Vá para **Etapa 6 — Catálogo casas Moní**.
2. Você deve ver uma **tabela** com os modelos do catálogo (pelo menos **Modelo A** e **Modelo B**), com colunas: Nome, Área (m²), Quartos, Preço venda (R$), R$/m².
3. Se a tabela aparecer com dados, a Etapa 6 está funcionando.

#### Usar a Etapa 7 (lote escolhido)

1. Vá para **Etapa 7 — Lote escolhido pelo franqueado**.
2. Você deve ver um **formulário** com: Condomínio, Recuos permitidos, Localização no condomínio, Área do lote (m²), Topografia, Frente (m), Fundo (m), Preço oferta (R$), Preço/m² (R$).
3. Preencha alguns campos e clique em **Salvar lote escolhido**.
4. Deve aparecer **"Salvo com sucesso."** e, ao reabrir a Etapa 7, os dados devem continuar lá.

---

### Refatoração — IBGE, Apify e 3 Casas do Catálogo

#### O que esta refatoração entrega

- **Etapa 1**: Busca automática de dados do IBGE (município, região, microrregião, etc.)
- **Etapas 4 e 5**: Texto explicando que a integração com Apify (varredura ZAP) será conectada em breve
- **Etapa 8**: Escolha de **3 modelos do catálogo Moní** para batalhar com **todas as casas da ZAP**

#### Pré-requisitos

- Sprint 4 já aplicada
- Migração SQL **005** (batalhas) já aplicada (se você for usar a Etapa 8)

#### Pré-requisito: Rodar a migração SQL 007

1. Abra o navegador e vá em **https://supabase.com**. Faça login e abra o **projeto** do Viabilidade.
2. No menu da esquerda, clique em **SQL Editor**.
3. Clique no **+** (nova consulta).
4. No seu computador, vá em **VIABILIDADE** → **supabase** → **migrations**
5. Abra o arquivo **007_catalogo_escolhidos.sql** (botão direito → **Abrir com** → **Bloco de notas**).
6. Selecione **todo** o conteúdo (**Ctrl+A**) e copie (**Ctrl+C**).
7. Volte ao **SQL Editor** do Supabase e **cole** (**Ctrl+V**).
8. Clique em **Run**.
9. Deve aparecer mensagem em **verde**.

**Pronto:** a tabela **catalogo_escolhidos** foi criada (guarda os 3 modelos escolhidos para batalhas e BCA).

#### Estado (UF) no processo

Para o **IBGE** funcionar na Etapa 1, o **Estado** do processo deve ser a **sigla da UF**.

- Ao **criar um novo processo**:
  - Em **Cidade**, use o nome oficial do município (ex.: **Campinas**, **São Paulo**).
  - Em **Estado (UF)**, **selecione na lista** o estado (ex.: **SP — São Paulo**).
- Se você já criou processos com estado em texto livre, edite no Supabase (Table Editor → **processo_step_one** → coluna **estado** = **SP**) ou crie um novo processo.

#### Etapa 1: Buscar dados do IBGE

1. Abra um processo e vá para **Etapa 1 — Análise da praça**.
2. Você deve ver:
   - O bloco **"Dados automáticos (IBGE)"** com o botão **"Buscar dados do IBGE"**.
   - O bloco **"Outras fontes (em breve)"** (Atlas Brasil e Google Maps).
   - O **formulário de análise (narrativa)**.
3. Clique em **"Buscar dados do IBGE"**.
4. Se a cidade e o estado (UF) estiverem corretos, deve aparecer uma caixa com: **Município**, **UF**, **Região**, **Microrregião**, **Mesorregião**, **Região imediata**, **Região intermediária**.
5. Se aparecer erro "Município não encontrado":
   - Confira o **nome exato da cidade** (como no IBGE).
   - Confira se o **Estado** está em **UF** (2 letras: SP, RJ, etc.).
6. (Opcional) Preencha a **narrativa** usando os dados do IBGE.
7. Clique em **Salvar**.

#### Etapas 4 e 5: Texto sobre Apify

- Na **Etapa 4**, no topo deve aparecer: _"Adicione casas à venda manualmente. A integração com Apify (varredura ZAP) será conectada em breve."_
- Na **Etapa 5**, no topo deve aparecer: _"Adicione lotes à venda manualmente. A integração com Apify (varredura ZAP) será conectada em breve."_

Nada mais é necessário; o cadastro continua **manual** até a integração com o Apify.

#### Etapa 8: Escolher 3 modelos e preencher batalhas

**Pré-requisitos:**
- Tenha **casas** cadastradas na **Etapa 4** (pelo menos uma; todas entram nas batalhas).
- Na **Etapa 6**, confira se há **pelo menos 3 modelos** no catálogo Moní (Modelo A, B, C). Se tiver menos, cadastre mais no Supabase (tabela **catalogo_casas**).

**Primeira vez (ainda não escolheu 3 modelos):**

1. Vá para **Etapa 8 — Batalhas (preço, produto, localização)**.
2. Deve aparecer: _"Escolha 3 modelos do catálogo Moní que vão batalhar com todas as casas listadas na ZAP."_
3. Três dropdowns: **Modelo 1**, **Modelo 2**, **Modelo 3**. Em cada um, escolha um modelo do catálogo (cada modelo só pode ser escolhido uma vez).
4. Clique em **"Salvar 3 modelos escolhidos"**.
5. A página recarrega e passa a mostrar as **batalhas**.

**Depois de salvar os 3 modelos:**

1. Aparecem **todas as casas da ZAP** (Etapa 4).
2. Para **cada** casa ZAP, há 3 blocos (um por modelo do catálogo escolhido) com os selects Preço, Produto e Localização (notas de -2 a +2).
3. Preencha as notas; elas são **salvas automaticamente** ao mudar cada select.

**Resumo:** as batalhas são feitas com **todas as casas listadas na ZAP** × **os 3 modelos do catálogo** escolhidos.

**Detalhes importantes sobre a Etapa 8:**

- **Pré-requisito:** Migração **005_batalhas_etapa8.sql** aplicada no Supabase.
- A tabela **batalhas** guarda as três notas (preço, produto, localização) de cada par: uma casa da Etapa 4 × um modelo do catálogo.
- As notas são **salvas automaticamente** ao mudar cada select (não tem botão "Salvar").
- Todas as casas cadastradas na Etapa 4 entram nas batalhas (não há seleção de quais casas usar).
- Os 3 modelos escolhidos aqui serão os mesmos usados no BCA (Etapa 10) quando implementado.
- Se você mudar os 3 modelos escolhidos, todas as batalhas antigas são perdidas e você precisa preencher de novo.

---

## PARTE 6 — Publicar na internet (opcional)

Só faça esta parte se quiser que o sistema fique acessível por um link na internet (para você ou outras pessoas usarem sem estar no seu PC).

### O que você vai fazer

1. Criar uma conta no **GitHub**.
2. Instalar o **Git** no Windows.
3. Enviar o projeto para o GitHub.
4. Criar conta na **Vercel** e conectar o repositório do GitHub.
5. Colocar no projeto da Vercel a **URL** e a **chave anon** do Supabase.
6. Fazer o "deploy"; a Vercel vai te dar uma URL (ex.: https://viabilidade-moni-xxx.vercel.app).

### Passo 6.1 — Conta no GitHub

1. Abra o navegador e vá em **https://github.com**.
2. Se já tiver conta, clique em **Sign in** e faça login. Se não tiver:
   - Clique em **Sign up**.
   - Preencha e-mail, senha e um nome de usuário.
   - Siga os passos (verificar e-mail, etc.) até conseguir entrar no GitHub.

### Passo 6.2 — Instalar o Git no Windows

1. Abra o navegador e vá em **https://git-scm.com/download/win**.
2. O download do Git para Windows deve começar. Quando terminar, abra o arquivo baixado (algo como **Git-2.x.x-64-bit.exe**).
3. Nas telas de instalação, clique em **Next** em todas, **sem mudar as opções** (deixe o padrão).
4. No final, clique em **Install** e depois **Finish**.

### Passo 6.3 — Criar um repositório no GitHub

1. No GitHub, logado, clique no **+** no canto superior direito e escolha **New repository**.
2. Em **Repository name**, digite por exemplo **viabilidade-moni**.
3. Escolha **Private** se não quiser que o código fique público; ou **Public** se não se importar.
4. **Não** marque "Add a README file".
5. Clique em **Create repository**.
6. Anote a URL que aparece, algo como:
   `https://github.com/SEU_USUARIO/viabilidade-moni.git`
   (troque SEU_USUARIO pelo seu usuário do GitHub.)

### Passo 6.4 — Enviar o projeto para o GitHub

1. Abra o PowerShell **na pasta VIABILIDADE** (Explorador → VIABILIDADE → barra de endereço → digitar **powershell** → Enter).
2. Digite os comandos abaixo **um por vez**, apertando **Enter** após cada um. Troque **SEU_USUARIO** pelo seu usuário do GitHub e **viabilidade-moni** pelo nome do repositório:

   **Comando 1:**
   ```text
   git init
   ```

   **Comando 2:**
   ```text
   git add .
   ```

   **Comando 3:**
   ```text
   git commit -m "Projeto inicial Step One"
   ```

   **Comando 4:**
   ```text
   git branch -M main
   ```

   **Comando 5** (troque SEU_USUARIO e viabilidade-moni):
   ```text
   git remote add origin https://github.com/SEU_USUARIO/viabilidade-moni.git
   ```

   **Comando 6:**
   ```text
   git push -u origin main
   ```

3. No **Comando 6**, o GitHub pode pedir **login**:
   - Hoje o GitHub não aceita mais senha comum para push. Você precisa criar um **Personal Access Token**:
     - No GitHub: clique na sua foto → **Settings** → no menu da esquerda, no final, **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**.
     - Dê um nome (ex.: "Vercel"), marque a permissão **repo** e gere.
     - **Copie o token** (ele só aparece uma vez) e use-o **no lugar da senha** quando o PowerShell pedir.
4. Quando o **git push** terminar sem erro, o projeto estará no GitHub.

### Passo 6.5 — Conta na Vercel e conectar o repositório

1. Abra o navegador e vá em **https://vercel.com**.
2. Clique em **Sign Up** ou **Log in**. Escolha **Continue with GitHub** e autorize.
3. Depois de logado, clique em **Add New…** (ou **New Project**).
4. Na lista de repositórios, procure **viabilidade-moni** e clique em **Import**.
5. Na tela de configuração:
   - **Project Name** pode ficar viabilidade-moni.
   - **Framework Preset** a Vercel costuma detectar Next.js; deixe como está.
   - **Root Directory** deixe em branco.

### Passo 6.6 — Colocar a URL e a chave do Supabase na Vercel

1. Na **mesma** tela do projeto (antes de dar Deploy), procure a seção **Environment Variables**.
2. Em **Name**, digite: **NEXT_PUBLIC_SUPABASE_URL**
   Em **Value**, **cole a mesma URL** que está no seu arquivo .env.local.
   Clique em **Add**.
3. Em **Name**, digite: **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   Em **Value**, **cole a mesma chave anon** do .env.local.
   Clique em **Add**.
4. Confira que as duas variáveis aparecem na lista.

### Passo 6.7 — Fazer o deploy

1. Clique no botão **Deploy**.
2. A Vercel vai "construir" e publicar o projeto. Espere alguns minutos.
3. Quando terminar, aparece uma tela de **sucesso** com uma **URL**, algo como:
   **https://viabilidade-moni-xxxxx.vercel.app**
4. **Copie** essa URL. Essa é o endereço do seu sistema na internet.

---

## Solução de problemas

### Problemas com migrações SQL

#### Erro "infinite recursion detected in policy for relation 'profiles'"

Este erro aparece ao tentar criar um processo quando as policies de RLS da tabela **profiles** fazem referência à própria tabela.

**O que foi ajustado:**
- **Antes:** As policies faziam `EXISTS (SELECT 1 FROM public.profiles ...)` → recursão infinita.
- **Depois:** Foi criada a função **`get_my_role()`** (SECURITY DEFINER) que lê o role do usuário sem passar pelo RLS.

**Como corrigir:**

**Situação A — Você ainda vai rodar as migrações do zero:**
- A migração **002_idempotent_schema.sql** já inclui a função `get_my_role()` e as policies corretas.
- Rode as migrações na ordem (001, 002, 003, 004, 005, 007) e o problema não vai aparecer.

**Situação B — Você já rodou a 002 antiga e está com erro de recursão:**
1. No Supabase, abra **SQL Editor** → **+** (Nova consulta).
2. Na pasta do projeto, abra **supabase** → **CORRIGIR_RECURSAO_PROFILES.sql** (se existir).
3. Copie todo o conteúdo e cole no SQL Editor.
4. Clique em **Run**.
5. Volte ao sistema, recarregue (F5) e teste criar um processo.

Se o arquivo **CORRIGIR_RECURSAO_PROFILES.sql** não existir, rode novamente a migração **003_fix_rls_recursion_profiles.sql**.

#### Erro "relation already exists" ao rodar migrações

- **Para tabelas comuns** (processo_step_one, etc.): Use o arquivo **002_idempotent_schema.sql** que cria apenas o que não existe.
- **Para catalogo_escolhidos**: É normal se você já rodou a 007. Ignore e continue.
- **Para casas_escolhidas**: A migração 007 remove essa tabela. Se ainda existir, rode a 007 que faz o DROP automático.

#### Erro "relation does not exist" em alguma tabela

Você pulou uma migração. Confira a ordem na seção "Passo 2.3 — Rodar as migrações SQL" e rode as que faltam.

### Instalação e configuração

#### "node não é reconhecido" ou "npm não é reconhecido"

- Node.js não está instalado ou o terminal foi aberto antes da instalação.
- Reinstale o Node e **feche e abra de novo** o PowerShell.
- Confira com `node -v` e `npm -v`.

#### PowerShell não abre na pasta certa

- Depois de abrir o PowerShell, digite:
  ```text
  cd "C:\Users\apsou\OneDrive\Área de Trabalho\VIABILIDADE"
  ```
  (troque **apsou** pelo seu usuário do Windows)

#### Página em branco ou "This site can't be reached" em localhost

- Confira se você rodou **npm run dev** e se a janela do PowerShell ainda está aberta.
- Digite **http://localhost:3000** (com "http" e sem "s" em "https").
- Se o PowerShell mostrou porta 3001, use **http://localhost:3001**.

#### Sistema abre mas não salva nada

- Verifique se o arquivo **.env.local** está na pasta **VIABILIDADE**.
- Confira se o nome é exatamente **.env.local** (não .env.local.example).
- Confira se a URL e a chave anon do Supabase estão corretas (sem espaços extras).

### Login e cadastro

#### "Invalid login credentials" ao entrar

- E-mail ou senha incorretos.
- Confira se o cadastro foi feito com esse e-mail.
- Tente **Cadastrar** com outro e-mail se precisar.

#### Redireciona para login mesmo depois de entrar

- Pode ser cache ou cookie.
- Tente fechar a aba, abrir de novo e fazer **Entrar** outra vez.
- Ou use uma aba anônima para testar.

#### "Faça login para iniciar um processo"

- Você não está logado.
- Faça **Entrar** (ou Cadastrar) e tente de novo.

### Supabase

#### Erro ao rodar o SQL no Supabase

- Copie a mensagem de erro completa.
- Se aparecer "relation already exists", use o arquivo **002_idempotent_schema.sql** em vez do 001.

#### Processo não aparece no Table Editor do Supabase

- Confira se você está na tabela **processo_step_one**.
- Confira se o **user_id** da linha corresponde ao usuário que você criou.
- Em **Authentication** → **Users** no Supabase você vê o id do usuário.

### Etapas específicas

#### Etapa 1 — "Buscar dados do IBGE" dá erro ou "Município não encontrado"

- Confira se o **Estado** do processo está em **UF** (2 letras: SP, RJ, MG, etc.).
- Confira se o nome da **Cidade** está como no IBGE (ex.: "Campinas", "São Paulo").
- Se o processo foi criado com estado em nome completo, edite no Supabase ou crie um novo.

#### Etapa 1 — Dados do IBGE não aparecem após buscar

- Recarregue a página (F5).
- Os dados ficam gravados em **etapa_progresso** (etapa_id = 1, campo **dados_json.analise_ibge**).

#### Etapa 4 ou 5: "Adicionar" não faz nada ou dá erro

- Confirme que você rodou o **004_sprint4_listings_catalogo_lote.sql** no Supabase.
- Veja no **Table Editor** se existem as tabelas **listings_casas** e **listings_lotes**.

#### Etapa 6: tabela vazia ou "Nenhum modelo no catálogo"

- O SQL da Sprint 4 insere dois modelos (Modelo A e B).
- Se a tabela **catalogo_casas** existir mas estiver vazia, rode de novo só a parte do script que faz **INSERT** nos modelos.

#### Etapa 7: "Salvar" dá erro

- Verifique se a tabela **lote_escolhido** existe no Supabase.
- Confirme que você está logado no sistema.

#### Etapa 8 — "Nenhuma casa listada na Etapa 4"

- Cadastre pelo menos uma casa na **Etapa 4** do mesmo processo e volte à Etapa 8.

#### Etapa 8 — "O catálogo Moní precisa ter pelo menos 3 modelos"

- Cadastre pelo menos 3 modelos na tabela **catalogo_casas** no Supabase.

#### Etapa 8 — Não consigo salvar os 3 modelos / erro ao salvar

- Verifique se a migração **007** foi aplicada (tabela **catalogo_escolhidos** existe).
- Confirme que está logado e que o processo é seu.

### Como excluir ou substituir dados/tabelas

Use estas instruções apenas quando necessário (após erro ou para reconfigurar algo do zero).

#### Excluir a tabela catalogo_escolhidos para rodar a 007 de novo

Use se a 007 já foi aplicada e você quer **recriar** a tabela (por exemplo, após alterar o arquivo 007).

1. No Supabase, abra **SQL Editor** → Nova consulta.
2. Cole e execute:
   ```sql
   DROP TABLE IF EXISTS public.catalogo_escolhidos;
   ```
3. Depois rode de novo **todo** o conteúdo do arquivo **007_catalogo_escolhidos.sql**.

**Atenção:** isso **apaga** todas as escolhas de "3 modelos" já salvas. Os usuários terão de escolher de novo na Etapa 8.

#### Substituir o Estado (UF) de processos já criados

Se o processo foi criado com estado em texto (ex.: "São Paulo") e o IBGE não encontra o município:

1. No Supabase, vá em **Table Editor** → **processo_step_one**.
2. Localize a linha do processo (pela cidade ou pelo id).
3. Na coluna **estado**, **substitua** o valor pela **sigla** (ex.: **SP**, **RJ**, **MG**).
4. Clique para salvar a alteração.

Ou use SQL Editor:
```sql
UPDATE public.processo_step_one
SET estado = 'SP'
WHERE id = 'uuid-do-processo';
```
(troque 'uuid-do-processo' pelo ID real)

#### Incluir mais modelos no catálogo (para escolher 3 na Etapa 8)

Se aparecer "O catálogo Moní precisa ter pelo menos 3 modelos":

1. No Supabase, **Table Editor** → **catalogo_casas**.
2. Clique em **Insert row**.
3. Preencha pelo menos: **nome**, **ativo = true**. Opcional: area_m2, quartos, preco_venda.
4. Salve.

Ou use SQL:
```sql
INSERT INTO public.catalogo_casas (nome, area_m2, quartos, preco_venda, ativo)
VALUES ('Modelo C', 200, 4, 1800000, true);
```

#### Limpar as escolhas dos 3 modelos de um processo específico

Para um processo "esquecer" os 3 modelos escolhidos (e voltar à tela de seleção na Etapa 8):

1. **SQL Editor**:
   ```sql
   DELETE FROM public.catalogo_escolhidos
   WHERE processo_id = 'uuid-do-processo';
   ```
   (troque 'uuid-do-processo' pelo ID real)

A tabela continua existindo; só os registros daquele processo são excluídos.

#### Excluir a tabela antiga casas_escolhidas (se necessário)

Se por algum motivo a 007 não rodar e der erro em cima de `casas_escolhidas`:

1. **SQL Editor** → Nova consulta.
2. Execute:
   ```sql
   DROP TABLE IF EXISTS public.casas_escolhidas;
   ```
3. Depois rode de novo **todo** o **007_catalogo_escolhidos.sql**.

#### Refazer a tabela batalhas (Etapa 8)

Se a tabela **batalhas** estiver com problemas:

1. **SQL Editor**:
   ```sql
   DROP TABLE IF EXISTS public.batalhas;
   ```
2. Rode novamente todo o conteúdo de **005_batalhas_etapa8.sql**.

**Atenção:** isso apaga todas as notas de batalhas já preenchidas.

### Vercel e publicação

#### Erro ao rodar "git push"

- O GitHub não aceita mais senha comum.
- Crie um **Personal Access Token** no GitHub (Settings → Developer settings → Personal access tokens).
- Use o token **no lugar da senha** quando o PowerShell pedir.

#### Deploy na Vercel falha

- Confira se as variáveis de ambiente (**NEXT_PUBLIC_SUPABASE_URL** e **NEXT_PUBLIC_SUPABASE_ANON_KEY**) foram adicionadas na Vercel.
- Confira se os valores são os mesmos do seu **.env.local**.

---

## Próximos passos

Quando o sistema já estiver abrindo (no seu PC ou na URL da Vercel), as melhorias seguintes são:

### 1. Etapas restantes (2, 3, 9, 10, 11)

- **Etapa 2**: Condomínios e checklist (16 itens)
- **Etapa 3**: Atividades de campo
- **Etapa 9**: Ranking do catálogo
- **Etapa 10**: Preenchimento das 3 BCAs
- **Etapa 11**: Gerar e fazer download do PDF de hipóteses

### 2. Integração com Apify

- Varredura automática da ZAP para casas e lotes
- Preenchimento automático nas Etapas 4 e 5

### 3. Outras integrações

- **Atlas Brasil** e **Google Maps** na Etapa 1
- Catálogo Moní completo na Etapa 6
- Geração de PDF na Etapa 11

### 4. Melhorias de interface

- Tela de perfil do usuário
- Filtros e ordenação em Meus processos
- Gráficos e dashboards

---

## Resumo dos comandos mais usados

| O que fazer                             | Comando/Ação                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| Abrir PowerShell na pasta VIABILIDADE   | Explorador → VIABILIDADE → barra de endereço → digitar **powershell** → Enter        |
| Instalar dependências                   | `npm install`                                                                        |
| Subir o servidor                        | `npm run dev`                                                                        |
| Abrir o sistema no navegador            | **http://localhost:3000** (ou 3001)                                                  |
| Parar o servidor                        | **Ctrl + C** no PowerShell                                                           |
| Conferir versão do Node                 | `node -v`                                                                            |
| Conferir versão do npm                  | `npm -v`                                                                             |

---

## Resumo dos arquivos SQL (migrações)

| #   | Arquivo                                    | O que faz                                                                                             | Quando usar                                    |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | **001_initial_schema.sql**                 | Cria tabelas iniciais (profiles, processo_step_one, etapa_progresso, etc.).                           | Primeira vez, projeto Supabase vazio            |
| 2   | **002_idempotent_schema.sql**              | Ajustes idempotentes + função get_my_role() (evita recursão).                                         | Sempre (cria só o que não existe)               |
| 3   | **003_fix_rls_recursion_profiles.sql**     | Correção adicional de RLS em profiles.                                                                | Após 002, ou se tiver erro de recursão          |
| 4   | **004_sprint4_listings_catalogo_lote.sql** | Cria listings_casas, listings_lotes, catalogo_casas, lote_escolhido + seed de 2 modelos.              | Sprint 4 (Etapas 4, 5, 6, 7)                    |
| 5   | **005_batalhas_etapa8.sql**                | Cria tabela batalhas (notas preço, produto, localização).                                             | Etapa 8 (batalhas)                              |
| 7   | **007_catalogo_escolhidos.sql**            | Remove casas_escolhidas (se existir) e cria catalogo_escolhidos (3 modelos do catálogo por processo). | Refatoração (substitui a lógica da 006)         |
| -   | **006_casas_escolhidas.sql**               | ❌ **NÃO USAR** - Lógica substituída pela 007                                                          | Nunca (foi substituída)                         |

**Ordem de execução recomendada:** 001 → 002 → 003 → 004 → 005 → 007

---

## Contatos e suporte

Se você seguiu todos os passos e algo ainda não funciona, anote:
- O que você estava tentando fazer
- A mensagem de erro exata (tire um print ou copie o texto)
- Qual parte do guia você estava seguindo

Com essas informações, será mais fácil para quem for te ajudar identificar o problema.

---

**Fim do guia completo.**
