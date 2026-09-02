# Viabilidade Moní — Step One

Sistema online para o **Processo Step One** de viabilidade: análise de praça, condomínios, listagens ZAP, catálogo Moní, batalhas e geração de BCA/PDF para franqueados.

## Como rodar

1. **Instalar dependências**

   ```bash
   npm install
   ```

2. **Configurar Supabase**
   - Crie um projeto em [Supabase](https://supabase.com).
   - Copie `.env.local.example` para `.env.local` e preencha:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Rode as migrações em `supabase/migrations/` no SQL Editor do Supabase (ou via CLI `supabase db push`).

3. **Subir o app**
   ```bash
   npm run dev
   ```
   Acesse [http://localhost:3000](http://localhost:3000).

## Fluxo principal

- **Home (**`/`**):** link para _Iniciar Step One_ e resumo das etapas 1–3, 4–7 e 8–11.
- **Iniciar processo (**`/step-one`**):** formulário **Cidade** + **Estado** → ao submeter redireciona para `/step-one/[id]?cidade=...&estado=...`.
- **Processo (**`/step-one/[id]`**):** lista das 11 etapas com links para cada uma.
- **Cada etapa (**`/step-one/[id]/etapa/[1-11]`**):** placeholder; conteúdo e integrações (IBGE, ZAP/Apify, catálogo, BCA, PDF) nas próximas sprints.

## Perfis e RLS

- **Frank (franqueado):** vê apenas seus processos e dados.
- **Consultor:** vê os Franks da sua carteira (`consultor_id` no perfil).
- **Admin:** vê tudo.

RLS nas tabelas `processo_step_one`, `etapa_progresso`, `pdf_exports`, `apify_usage`, `rede_contatos` e `audit_log` garante o isolamento.

## Logs e auditoria

- **audit_log:** ação, recurso, IP, snapshot antes/depois.
- **etapa_progresso:** status por etapa (iniciada, concluída, tentativas).
- **pdf_exports:** histórico de PDFs (Frank, hipótese, modelo, hash).
- **apify_usage:** uso por Frank (condomínio, resultados, custo).
- **alertas:** triggers (inatividade 7d/15d, PDF não enviado, limite Apify).

## Documentação

- **Especificação completa:** `docs/STEP_ONE_ESPEC.md` (fontes Etapa 1, checklist Etapa 2, 21 campos Etapas 4–5, batalhas, BCA, PDF, rede).

## Sessão Marketing (Hub de Funis)

Três funis nativos no mesmo Kanban do Portfólio (card fechado, modal, DnD e exportação):

- `/marketing` — hub da sessão (pré-selecionada)
- `/marketing/gravacao-videos-externos`
- `/marketing/programacao-conteudo-semanal`
- `/marketing/serie-inc-to-fly`

A migration `528_funis_marketing.sql` cria kanbans, fases e checklists no banco **DEV**. Não aplicar em PROD sem confirmação.

## Sessão Manutenções (Hub de Funis)

Funil nativo no mesmo Kanban do Portfólio (card fechado, modal, DnD e exportação):

- `/manutencoes` — hub da sessão (pré-selecionada)
- `/manutencoes/moni-care` — Funil Moní Care (pós-entrega, Rev. 00–07, garantia e serviços pagos)

A migration `530_funil_moni_care.sql` cria kanban, 10 fases e checklists no banco **DEV**. Não aplicar em PROD sem confirmação.

## Stack

- **Next.js 14** (App Router), **TypeScript**, **Tailwind CSS**
- **Supabase** (Auth, DB, RLS)
- Planejado: Apify (ZAP), Resend (e-mail), geração de PDF, pg_cron (atualização quinzenal)
