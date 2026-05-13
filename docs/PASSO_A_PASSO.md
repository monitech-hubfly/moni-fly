# Passo a passo — Viabilidade Moní

Guia único para configurar, rodar e usar a ferramenta. Siga na ordem; se já tiver feito algum item, pule para o próximo.

---

## Sumário

1. [Pré-requisitos e instalação](#1-pré-requisitos-e-instalação)
2. [Projeto Supabase e variáveis de ambiente](#2-projeto-supabase-e-variáveis-de-ambiente)
3. [Como obter URL e chave no Supabase](#3-como-obter-url-e-chave-no-supabase)
4. [Migrações no banco](#4-migrações-no-banco)
5. [Como rodar cada migração no SQL Editor](#5-como-rodar-cada-migração-no-sql-editor)
6. [Autenticação](#6-autenticação)
7. [Rodar a aplicação](#7-rodar-a-aplicação)
8. [Primeiro acesso](#8-primeiro-acesso)
9. [Testar o fluxo (Meus processos e Etapas 1 a 7)](#9-testar-o-fluxo-meus-processos-e-etapas-1-a-7)
10. [Gerar tipos do banco](#10-gerar-tipos-do-banco)
11. [Rede de Franqueados](#11-rede-de-franqueados)
12. [R.I.P. — Central de Chamados (Jurídico)](#12-rip--central-de-chamados-jurídico)
13. [Apify — Varrer ZAP (Etapa 4)](#13-apify--varrer-zap-etapa-4)
14. [Etapa 2 — Condomínios e checklist](#14-etapa-2--condomínios-e-checklist)
15. [Problemas comuns](#15-problemas-comuns)
16. [Deploy (opcional)](#16-deploy-opcional)

---

## 1. Pré-requisitos e instalação

- **Node.js** (LTS): [nodejs.org](https://nodejs.org) — instale e confira no terminal: `node -v` e `npm -v`.
- Na pasta do projeto (**VIABILIDADE**):

```bash
npm install
```

---

## 2. Projeto Supabase e variáveis de ambiente

1. Crie um projeto em [supabase.com](https://supabase.com): **New project** → nome, senha do banco, região (ex.: South America São Paulo).
2. Em **Project Settings** → **API**, copie **Project URL** e **anon public** (chave pública).
3. Na raiz do projeto, crie ou edite **`.env.local`**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

Substitua pelos valores reais. O arquivo `.env.local.example` serve de referência.

---

## 3. Como obter URL e chave no Supabase

Se precisar localizar os valores no painel do Supabase:

1. Acesse **https://supabase.com**, faça login e abra o **projeto** do Viabilidade.
2. No canto inferior esquerdo, clique no ícone de **engrenagem** (**Project Settings**).
3. No menu da esquerda, clique em **API**.
4. **Project URL:** no bloco "Project URL", use o ícone de copiar ao lado da caixa (endereço que termina em `.supabase.co`). Cole no `.env.local` em `NEXT_PUBLIC_SUPABASE_URL`.
5. **Chave anon:** role até **Project API keys**. Use a chave **anon** / **anon public** (não a service_role). Copie e cole no `.env.local` em `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

| O que copiar | Onde no Supabase |
|--------------|-------------------|
| Project URL | Project Settings → API → bloco Project URL → ícone copiar |
| Chave anon (public) | Mesma página API → Project API keys → linha anon / anon public → ícone copiar |

---

## 4. Migrações no banco

As migrações criam tabelas, políticas (RLS), triggers e storage. **Ordem:** execute no **SQL Editor** do Supabase cada arquivo em **ordem numérica**, **um por vez** (New query → colar conteúdo do arquivo → Run).

- Pasta: `supabase/migrations/`
- **Ordem:** 001 → 002 → 003 → 004 → 005 → **não use 006** → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015 → 016 → 017 → 018 → 019 → 020 → 021 → 022 → 023 → 024 → 025 → 026 → 027 → 028 → 029.

A **006** foi substituída pela **007** (escolha de 3 modelos do catálogo em vez de 3 casas ZAP). Se já tiver rodado a 006, rode a 007 — ela remove a tabela antiga e cria a nova.

**Erros comuns:**

- **"policy already exists"**: antes de rodar a migração que falhou, execute (ajustando nome da policy e tabela):
  ```sql
  DROP POLICY IF EXISTS "nome_da_policy" ON public.nome_da_tabela;
  ```
- **"infinite recursion detected in policy for relation 'profiles'"**: garanta que **002** e **003** foram executadas (criam `get_my_role()` e ajustam RLS em `profiles`).

---

## 5. Como rodar cada migração no SQL Editor

Para cada arquivo de migração (um por vez):

1. No seu computador: pasta **VIABILIDADE** → **supabase** → **migrations**. Abra o arquivo (ex.: `001_initial_schema.sql`) no Bloco de notas ou editor.
2. Selecione **todo** o conteúdo (**Ctrl+A**) e copie (**Ctrl+C**).
3. No Supabase: menu da esquerda → **SQL Editor** → **+** (New query).
4. Cole o conteúdo na caixa do editor (**Ctrl+V**) e clique em **Run**.
5. Confira mensagem em **verde** (Success). Se der erro, não apague: tire print ou copie a mensagem para corrigir (ex.: `DROP POLICY IF EXISTS` antes do `CREATE POLICY` que falhou).

| O que fazer | Onde |
|-------------|------|
| Abrir o SQL | PC: VIABILIDADE → supabase → migrations → abrir o arquivo .sql (ex.: 002_idempotent_schema.sql) |
| Copiar tudo | Ctrl+A → Ctrl+C |
| Colar e rodar | Supabase → SQL Editor → New query → Ctrl+V → Run |

---

## 6. Autenticação

No Supabase: **Authentication** → **Providers** → **Email** deve estar habilitado. Para desenvolvimento, pode desmarcar **Confirm email**; em produção é melhor manter confirmado.

---

## 7. Rodar a aplicação

Na pasta do projeto:

```bash
npm run dev
```

Abra o navegador em **http://localhost:3000** (ou a porta indicada no terminal).

---

## 8. Primeiro acesso

1. Na tela inicial use **Cadastrar** (ou `/signup`): e-mail, senha e nome.
2. O Supabase cria o usuário e o trigger cria um perfil em `public.profiles` com `role = 'frank'`.
3. Faça **Login** (`/login`) se não tiver sido redirecionado.
4. Você pode **Iniciar Step One** (cidade + UF), acessar **Steps Viabilidade**, **Rede de contatos**, **Perfil**, **R.I.P.**, etc., conforme seu perfil (frank, consultor, admin, supervisor).

---

## 9. Testar o fluxo (Meus processos e Etapas 1 a 7)

**Meus processos e Etapa 1:** No menu devem aparecer **Meus processos**, **Iniciar Step One** e **Sair**. Em **Meus processos** você vê a lista (ou "nenhum processo"); clique em um processo para abrir as 11 etapas. Se não tiver processo, crie em **Iniciar Step One** (Cidade + Estado → Iniciar processo). Na **Etapa 1 — Análise da praça** preencha a narrativa, marque "Marcar etapa 1 como concluída" se quiser e clique em **Salvar**; deve aparecer "Salvo com sucesso.".

**Etapas 4 a 7 (listagens, catálogo, lote escolhido):** Após rodar a migração **004** (e as anteriores):

- **Etapa 4:** Adicione pelo menos uma casa (Condomínio, Preço, etc.) com **Adicionar casa**.
- **Etapa 5:** Adicione pelo menos um lote com **Adicionar lote**.
- **Etapa 6:** A tabela do catálogo Moní deve mostrar os modelos (ex.: Modelo A e B inseridos pela 004).
- **Etapa 7:** Preencha o formulário do lote escolhido e **Salvar lote escolhido**; ao reabrir, os dados devem permanecer.

**Se der errado:** Etapa 4/5 "Adicionar" não faz nada → confirme que a **004** foi rodada e que as tabelas `listings_casas` e `listings_lotes` existem. Etapa 6 vazia → a 004 insere dois modelos; se `catalogo_casas` existir vazia, rode novamente o INSERT dos modelos. Etapa 7 erro ao salvar → confira se a tabela `lote_escolhido` existe.

---

## 10. Gerar tipos do banco

Para manter os tipos TypeScript alinhados ao schema (útil após novas migrações):

**Supabase na nuvem:**

1. **Project Settings** → **General** → copie o **Reference ID**.
2. No terminal, na pasta do projeto:
   ```bash
   npx supabase link --project-ref SEU_PROJECT_REF
   ```
3. Aplique migrações pendentes (se usar CLI):
   ```bash
   npx supabase db push
   ```
4. Gere os tipos (use o mesmo Reference ID):
   ```bash
   npx supabase gen types typescript --project-id SEU_PROJECT_REF > src/types/database.gen.ts
   ```
   Ou use o script, se existir: `npm run db:types` (conforme configurado no `package.json`).

**Supabase local:** `npx supabase start` → `npx supabase db reset` (ou `migration up`) → `npm run db:types` (se o script apontar para `--local`).

---

## 11. Rede de Franqueados

- **Tabela:** migração **026** (e **027**, **028** para campos adicionais e kit boas-vindas). Admin vê em **Rede de Franqueados** (`/rede-franqueados`); franqueados veem na seção **COMUNIDADE**.
- **Importação por CSV:** use o script do projeto (não o import do Dashboard). No terminal:  
  `npm run rede-franqueados:import -- caminho/arquivo.csv`  
  Requer `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` para importar.
- **Documentação detalhada:** [docs/REDE_FRANQUEADOS.md](REDE_FRANQUEADOS.md) — estrutura da tabela, colunas, reimportar se dados vazios.

---

## 12. R.I.P. — Central de Chamados (Jurídico)

- **Migrações:** 009 (tabelas e RLS), 010 (storage e políticas — políticas de storage podem precisar ser criadas pelo Dashboard), 011, 012 (campos do ticket e e-mail do frank).
- **Acesso:** menu **R.I.P. - Central de Chamados** → `/juridico`. Frank: lista de tickets, nova dúvida, documentos templates. Consultor/Admin: **Kanban Moní** (`/juridico/kanban`), detalhe do ticket, comentários internos, responder e finalizar.
- **E-mail ao franqueado:** configurar **RESEND_API_KEY** (e opcionalmente **RESEND_FROM**) no `.env.local` ou nas variáveis de ambiente do deploy. Sem a chave, só os alertas no portal são criados.
- **Detalhes:** políticas de storage em `docs/STORAGE_JURIDICO_POLICIES.md`; configuração de e-mail em `docs/CONFIGURAR_EMAIL_RESEND.md` (se existir).

---

## 13. Apify — Varrer ZAP (Etapa 4)

Para o botão **"Varrer ZAP"** na Etapa 4 funcionar:

1. Obtenha um token em [Apify](https://apify.com) → **Settings** → **Integrations** → **API tokens** → **Create new token**.
2. No `.env.local` (raiz do projeto), adicione:
   ```env
   APIFY_API_TOKEN=seu_token_aqui
   ```
   (Ou `VITE_APIFY_TOKEN`, conforme o código da aplicação.)
3. Reinicie o servidor (`Ctrl+C` e depois `npm run dev`). Em produção, configure a mesma variável no painel do provedor (ex.: Vercel → Environment Variables).

---

## 14. Etapa 2 — Condomínios e checklist

A **Etapa 2** (Condomínios e checklist) usa a tabela `processo_condominios` (migração **008**). Garanta que a 008 foi rodada. No app: Step One → processo → Etapa 2 — adicionar condomínio, preencher checklist (16 itens), marcar etapa como concluída. Se aparecer "relation processo_condominios does not exist", rode a migração 008 no SQL Editor.

---

## 15. Problemas comuns

| Problema | O que fazer |
|----------|-------------|
| "Invalid API key" ou tela em branco | Conferir `.env.local` (URL e anon key); reiniciar `npm run dev`. |
| "relation 'profiles' does not exist" | Rodar migração **001** (e **002**). |
| "infinite recursion" em `profiles` | Garantir que **002** e **003** foram executadas. |
| "policy already exists" | Na mesma query, rodar `DROP POLICY IF EXISTS "nome" ON public.tabela;` antes do `CREATE POLICY` da migração e executar de novo. |
| Cadastro ok mas não consigo logar | Ver em **Authentication** → **Users** se o usuário existe; em **Providers** → **Email** verificar "Confirm email"; checar e-mail de confirmação ou desligar em dev. |
| Nenhum processo aparece / 404 na etapa | Confirmar que está logado e que as migrações necessárias (004, 005, 007, 008, etc.) foram rodadas. |
| Etapa 8 — "Nenhuma casa listada na Etapa 4" | Cadastrar pelo menos uma casa na Etapa 4. |
| Etapa 8 — catálogo com menos de 3 modelos | No Supabase, **Table Editor** → **catalogo_casas** → inserir modelos até ter pelo menos 3 com `ativo = true`. |

---

## 16. Deploy (opcional)

Para publicar na internet (ex.: Vercel):

1. Envie o projeto para um repositório no **GitHub** (`git init`, `git add .`, `git commit`, `git remote add origin ...`, `git push`).
2. Crie conta na **Vercel** e importe o repositório.
3. Em **Settings** → **Environment Variables**, adicione **NEXT_PUBLIC_SUPABASE_URL** e **NEXT_PUBLIC_SUPABASE_ANON_KEY** (e, se usar, **APIFY_API_TOKEN**, **RESEND_API_KEY**, **SUPABASE_SERVICE_ROLE_KEY** apenas se necessário e com cuidado).
4. Faça o deploy. A URL gerada (ex.: `https://seu-projeto.vercel.app`) será o acesso ao sistema.

---

## Escala (~150 usuários)

A ferramenta é usada por todos os times e franqueados (~150 logins, hierarquias diferentes). Não é necessário alterar a arquitetura para isso. Para recomendações de plano (Supabase/Vercel) e limites internos, veja **[docs/ESCALA_E_PLANEJAMENTO.md](ESCALA_E_PLANEJAMENTO.md)**.

---

## Checklist rápido

- [ ] Node instalado; `npm install` na pasta do projeto
- [ ] Projeto criado no Supabase; `.env.local` com URL e anon key
- [ ] Migrações rodadas em ordem (001 a 029, exceto 006)
- [ ] Email provider habilitado (Confirm email opcional em dev)
- [ ] `npm run dev` e teste de cadastro/login e criação de processo
