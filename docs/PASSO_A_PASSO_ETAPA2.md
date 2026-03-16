# Passo a passo detalhado — Etapa 2 (Condomínios e checklist)

Siga na ordem. O código (actions, checklist, componente e página) já está no projeto; o que você precisa fazer é **rodar a migração 008** no Supabase e **testar** no navegador.

---

## O que já está no projeto (não precisa reescrever)

- **Actions** em `src/app/step-one/[id]/etapa/actions.ts`  
  (`addCondominio`, `updateCondominioChecklist`, `deleteCondominio`, `saveEtapa2`)
- **CHECKLIST_ETAPA2.ts** em `src/app/step-one/[id]/etapa/CHECKLIST_ETAPA2.ts`
- **Etapa2Condominios** em `src/app/step-one/[id]/etapa/Etapa2Condominios.tsx`
- **Página** em `src/app/step-one/[id]/etapa/[etapa]/page.tsx` (etapa 2 já carrega condomínios e renderiza o componente)
- **PASSO_A_PASSO.md** já cita a migração 008

Você só precisa **aplicar a migração no banco** e **usar a aplicação**.

---

## Passo 1 — Rodar a migração 008 no Supabase

A migração cria a tabela `processo_condominios` e a política RLS. Sem ela, a Etapa 2 dá erro ao adicionar condomínio.

### 1.1 Abrir o SQL Editor do Supabase

1. Acesse [supabase.com](https://supabase.com) e entre no seu projeto.
2. No menu lateral, clique em **SQL Editor**.
3. Clique em **New query** (nova consulta).

### 1.2 Copiar o conteúdo da migração 008

1. No seu computador, abra o arquivo:
   ```
   VIABILIDADE/supabase/migrations/008_condominios_etapa2.sql
   ```
2. Selecione **todo** o conteúdo (Ctrl+A).
3. Copie (Ctrl+C).

### 1.3 Colar e executar no Supabase

1. No SQL Editor do Supabase, clique na área do editor (onde aparece “New query”).
2. Cole o conteúdo (Ctrl+V).
3. Clique em **Run** (ou pressione Ctrl+Enter).
4. Confira o resultado:
   - **Sucesso:** mensagem verde, tipo “Success. No rows returned”.
   - **Erro:** leia a mensagem. Exemplos:
     - Se aparecer **“policy already exists”**, rode antes (na mesma aba ou em nova query):
       ```sql
       DROP POLICY IF EXISTS "Frank processo_condominios" ON public.processo_condominios;
       ```
       Depois rode de novo o conteúdo completo da **008**.

### 1.4 Conferir se a tabela existe (opcional)

1. No Supabase, vá em **Table Editor** (menu lateral).
2. Verifique se existe a tabela **processo_condominios**.
3. Ela pode estar vazia; isso é normal até você adicionar condomínios pela Etapa 2.

---

## Passo 2 — Garantir que as migrações anteriores foram rodadas

A Etapa 2 usa a tabela `processo_step_one` (criada na 001/002). Se você ainda não rodou as migrações do projeto, faça nesta ordem:

1. `001_initial_schema.sql`
2. `002_idempotent_schema.sql`
3. `003_fix_rls_recursion_profiles.sql`
4. `004_sprint4_listings_catalogo_lote.sql`
5. `005_batalhas_etapa8.sql`
6. **Não use** `006_casas_escolhidas.sql`
7. `007_catalogo_escolhidos.sql`
8. `008_condominios_etapa2.sql`

Para cada uma: SQL Editor → New query → colar o conteúdo do arquivo → Run.  
Detalhes gerais estão em **docs/PASSO_A_PASSO.md**.

---

## Passo 3 — Subir a aplicação e testar

### 3.1 Variáveis de ambiente

1. Na raiz do projeto, confira o arquivo **`.env.local`**.
2. Ele deve ter:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
   ```
3. Use a URL e a chave **anon public** do seu projeto (Project Settings → API).

### 3.2 Iniciar o servidor

1. Abra o terminal na pasta do projeto (`VIABILIDADE`).
2. Rode:
   ```bash
   npm install
   npm run dev
   ```
3. Abra o navegador em: **http://localhost:3000**.

### 3.3 Login e processo

1. Faça **login** (ou cadastre-se em **Cadastrar**).
2. Em **Step One**, clique em **Iniciar processo**.
3. Preencha **Cidade** e **Estado (UF)** e crie o processo.
4. Você será levado à página do processo, com as 11 etapas listadas.

### 3.4 Abrir a Etapa 2

1. Na lista de etapas, clique em **Etapa 2 — Condomínios e checklist**  
   (ou acesse diretamente: `http://localhost:3000/step-one/[ID_DO_PROCESSO]/etapa/2`).
2. A tela deve mostrar:
   - Texto explicando “Condomínios da cidade que vendem casa **acima de 5 MM**”.
   - Campo **“Nome do condomínio”** e botão **“Adicionar condomínio”**.

### 3.5 Adicionar um condomínio

1. Digite um nome (ex.: “Condomínio Solar”).
2. Clique em **Adicionar condomínio**.
3. A lista deve atualizar e exibir o condomínio (e botão **Excluir**).

### 3.6 Preencher o checklist

1. Clique no **nome do condomínio** na lista.
2. Deve abrir o bloco **“Checklist — [nome do condomínio]”** com as 16 perguntas (q1 a q16).
3. Preencha as respostas que quiser (podem ser só testes).
4. Clique em **Salvar checklist**.
5. Recarregue a página: as respostas devem continuar lá.

### 3.7 Concluir a etapa 2

1. Marque o checkbox **“Marcar etapa 2 como concluída”**.
2. Clique em **Salvar e avançar**.
3. O processo deve passar para a **Etapa 3** (você pode conferir na lista de etapas ou na URL `/etapa/3`).

---

## Resumo do que você executa (checklist)

| # | O que fazer | Onde |
|---|-------------|------|
| 1 | Rodar a migração **008** (criar tabela e RLS) | Supabase → SQL Editor → colar `008_condominios_etapa2.sql` → Run |
| 2 | Ter as migrações **001, 002, 003, 004, 005, 007** já rodadas | Supabase → SQL Editor (ver PASSO_A_PASSO.md) |
| 3 | Ter **.env.local** com URL e anon key do Supabase | Raiz do projeto |
| 4 | Rodar **npm install** e **npm run dev** | Terminal na pasta do projeto |
| 5 | Logar, criar um processo, abrir **Etapa 2**, adicionar condomínio, preencher checklist e marcar como concluída | Navegador em localhost:3000 |

O restante (actions, CHECKLIST_ETAPA2.ts, Etapa2Condominios, integração na página e menção da 008 no PASSO_A_PASSO) já está implementado no código; não é necessário “executar” esses arquivos à mão, só garantir que a migração 008 foi aplicada e que o app está rodando com o `.env.local` correto.

---

## Se algo der errado

- **“relation processo_condominios does not exist”**  
  A migração 008 não foi rodada ou falhou. Siga de novo o **Passo 1**.

- **“Invalid API key” ou tela em branco**  
  Confira `.env.local` e reinicie o servidor (`Ctrl+C` e depois `npm run dev`).

- **Botão “Adicionar condomínio” não faz nada / erro na rede**  
  Abra as Ferramentas do desenvolvedor (F12) → aba **Network** (Rede) e veja se a requisição ao Supabase retorna erro (ex.: 403 por RLS). Confirme que a política **“Frank processo_condominios”** existe na tabela `processo_condominios` (Table Editor → processo_condominios → não dá para ver RLS ali; use SQL Editor com `SELECT * FROM pg_policies WHERE tablename = 'processo_condominios';` se quiser).

- **Etapa 2 não aparece / continua placeholder**  
  Confira se está acessando a URL correta (`/step-one/[id]/etapa/2`) e se o arquivo `src/app/step-one/[id]/etapa/[etapa]/page.tsx` está com a condição `etapaNum === 2` e o componente `Etapa2Condominios` (já deve estar; se não, o código da etapa 2 não foi commitado).

Se quiser, na próxima mensagem você pode colar o erro exato (tela ou terminal) e eu te digo o próximo passo.
