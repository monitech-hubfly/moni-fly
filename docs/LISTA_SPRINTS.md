# Lista de sprints — Viabilidade Moní Step One

Visão do que foi planejado, o que já está pronto e o que falta.

---

## Sprint 1 — Base e tela para iniciar o processo  
**Status: finalizada**

| Entrega | Situação |
|--------|----------|
| Estrutura do projeto (Next.js 14, TypeScript, Tailwind) | Feito |
| Supabase: schema (profiles, processo_step_one, etapa_progresso, audit_log, pdf_exports, apify_usage, alertas, rede_contatos) | Feito |
| Migrações SQL (001 e 002 idempotente) | Feito |
| RLS por perfil (Frank, Consultor, Admin) | Feito |
| Tela **Iniciar Processo Step One** (formulário Cidade + Estado) | Feito |
| Lista das 11 etapas em `/step-one/[id]` (com ID na URL) | Feito |
| Páginas placeholder de cada etapa `/step-one/[id]/etapa/[1-11]` | Feito |
| Documentação (STEP_ONE_ESPEC, fontes Etapa 1, checklist Etapa 2) | Feito |

---

## Sprint 2 — Autenticação e processo no banco  
**Status: finalizada**

| Entrega | Situação |
|--------|----------|
| Login (`/login`) com e-mail e senha (Supabase) | Feito |
| Cadastro (`/signup`) — trigger cria perfil com role `frank` | Feito |
| Proteção de rotas: `/step-one` e `/step-one/*` só com login | Feito |
| Redirecionamento: logado em `/login` ou `/signup` → `/step-one` | Feito |
| Criar processo no Supabase ao clicar em **Iniciar processo** (processo_step_one + 11 linhas em etapa_progresso) | Feito |
| Redirecionar para `/step-one/[id]` com ID real do banco | Feito |
| Página `/step-one/[id]` carregando processo do banco (cidade, estado) | Feito |
| Home: se logado → "Iniciar Step One" e "Sair"; se não → "Entrar" e "Cadastrar" | Feito |
| Botão **Sair** (logout e voltar à home) | Feito |
| Correção RLS: função `get_my_role()` para evitar recursão em `profiles` (003_fix_rls_recursion_profiles.sql) | Feito |
| Redefinir senha: **Esqueci minha senha** → e-mail → link → **Nova senha** (`/esqueci-senha`, `/redefinir-senha`) | Feito |

---

## Sprint 3 — Meus processos e Etapa 1 (Análise da praça)  
**Status: finalizada**

| Entrega | Situação |
|--------|----------|
| Página **Meus processos** (`/meus-processos`) listando todos os processos do Frank | Feito |
| Link **Meus processos** no menu (quando logado) | Feito |
| Proteção da rota: só logado acessa `/meus-processos` | Feito |
| Na home: seção "Meus processos" com até 10 processos + link "Ver todos" | Feito |
| **Etapa 1** com formulário: narrativa, dados IBGE (botão buscar), blocos Atlas/Google e referência de imagens (em breve) | Feito |
| Salvar Etapa 1 no banco (etapa_progresso.dados_json, status, iniciada_em, concluida_em) | Feito |
| Ao marcar etapa 1 como concluída, processo_step_one.etapa_atual passa para 2 | Feito |
| Reabrir Etapa 1 carrega texto e status do banco | Feito |
| Passo a passo detalhado de execução (docs/PASSO_A_PASSO_SPRINT_3.md) | Feito |

---

## Sprint 4 — Etapas 4 a 7 (listagens, catálogo, lote escolhido)  
**Status: finalizada**

| Entrega | Situação |
|--------|----------|
| Migração **004**: tabelas listings_casas, listings_lotes, catalogo_casas, lote_escolhido + RLS | Feito |
| **Etapa 4**: listagem de casas à venda + formulário para adicionar casa (manual) | Feito |
| **Etapa 5**: listagem de lotes à venda + formulário para adicionar lote (manual) | Feito |
| **Etapa 6**: tela do catálogo Moní (tabela com modelos; seed Modelo A e B) | Feito |
| **Etapa 7**: formulário do lote escolhido pelo franqueado (salvar em lote_escolhido) | Feito |
| Passo a passo para funcionar (O_QUE_FAZER_PARA_SPRINT_4_FUNCIONAR.md) | Feito |

---

## Sprint 5 — Etapas 8 a 11 (batalhas, ranking, BCA, PDF)  
**Status: finalizada**

| Entrega | Situação |
|--------|----------|
| Migrações **005** (batalhas) e **007** (catalogo_escolhidos) | Feito |
| **Etapa 8**: escolher 3 modelos do catálogo; batalhas (todas as casas ZAP × 3 modelos) com notas preço, produto, localização (-2 a +2) | Feito |
| **Etapa 9**: ranking dos 3 modelos com base nas batalhas; justificativas "por quê?" opcionais; marcar como concluída | Feito |
| **Etapa 10**: 3 opções de BCA (título e descrição por modelo); salvamento automático; marcar como concluída | Feito |
| **Etapa 11**: resumo consolidado do processo; botão Imprimir/Salvar como PDF; registrar em `pdf_exports`; marcar etapa como concluída | Feito |

---

## Sprint 6 — Rede, Painel Moní, alertas e fechamento  
**Status: finalizada**

| Entrega | Situação |
|--------|----------|
| **Rede de contatos**: lista (condomínios, corretores, imobiliárias); atualização quinzenal | Feito — página `/rede`, CRUD, menção quinzenal na tela |
| **Painel Moní** (consultor/admin): funil por Frank, PDFs gerados | Feito — página `/painel` (consultor vê carteira, admin vê todos); seção PDFs gerados (últimos 30); uso Apify em expansão |
| **Minhas alertas** (Frank): lista de alertas, marcar como lido | Feito — página `/alertas` |
| Ajustes finais: exportação de PDF com hash | Feito — registro de PDF com `file_hash` (SHA-256); audit_log no schema para logs futuros |

---

## Etapas 2 e 3

| Etapa | Nome | Situação |
|-------|------|----------|
| **2** | Condomínios e checklist | Feito — formulário, 16 itens, persistência em `processo_condominios` |
| **3** | Tabela resumo e conclusão | Feito — tabela por condomínio + conclusão em `etapa_progresso.dados_json` |

---

## Por que algumas entregas ainda não foram implementadas

Resumo do motivo de cada bloco ter ficado para depois e se vamos implementar.

| Entregas | Por que não foram implementadas | Vamos implementar? |
|----------|----------------------------------|--------------------|
| **Etapa 2 — Condomínios e checklist** | Priorizamos o fluxo completo até o PDF (etapas 1, 4–11). A Etapa 2 exige modelo de dados (condomínios por processo, 16 itens do checklist) e telas mais densas. | **Sim** — próximo passo natural para fechar o funil antes da listagem ZAP. |
| **Etapa 3 — Tabela resumo e conclusão** | Depende da Etapa 2 (dados por condomínio). Foi deixada para depois do checklist. | **Sim** — assim que a Etapa 2 estiver persistindo condomínios e respostas. |
| **Rede de contatos** (condomínios, corretores, imobiliárias; quinzenal) | Tabela `rede_contatos` já existe no schema; a tela e o fluxo de atualização quinzenal não foram priorizados. | **Sim** — faz parte da Sprint 6. |
| **Painel Moní** (consultor/admin) | Requer rotas e visões por role (consultor vê carteira, admin vê tudo), dashboards e uso de Apify. Focado primeiro no fluxo do Frank. | **Sim** — Sprint 6. |
| **Ajustes finais** (logs por franqueado, PDF com hash) | Logs parciais já existem (audit_log, pdf_exports); hash no PDF e relatórios de uso ficaram para fase de fechamento. | **Sim** — junto da Sprint 6. |
| **Etapa 1 — Atlas Brasil, Google Maps, referência de imagens** | IBGE já integrado. Atlas e Google exigem API key / fontes não-REST; referência de imagens (escolas, hospitais, eixos, etc.) depende dessas integrações. Deixamos a **estrutura e placeholders** na tela. | **Sim** — quando houver definição de fonte (API Keys, CSV Atlas, etc.). |
| **Etapas 4 e 5 — API Apify** | Você informou que ainda não conectou a API do Apify; mantivemos listagem manual e mensagem explícita na tela. | **Sim** — assim que a API do Apify for conectada e o fluxo de varredura ZAP estiver definido. |

---

## Integrações e pendências resumidas

- **Etapa 1:** IBGE ✅ | Atlas Brasil, Google Maps, referência de imagens → **em breve** (estrutura/placeholders prontos).
- **Etapas 2 e 3:** Implementadas (condomínios + checklist, tabela resumo e conclusão).
- **Etapas 4 e 5:** Listagem manual ✅ | Apify → **a conectar** quando a API estiver disponível.
- **Etapas 6–11:** Implementadas.
- **Sprint 6:** Finalizada (Rede, Painel com PDFs gerados, Minhas alertas, PDF com hash).

**Próximas prioridades (quando disponíveis):** integrações Etapa 1 (Atlas/Google/imagens), Apify nas Etapas 4 e 5, uso Apify e relatórios no Painel.

---

## Resumo

| Sprint | Foco | Status |
|--------|------|--------|
| **1** | Base + tela iniciar processo + schema + RLS | Finalizada |
| **2** | Login, cadastro, proteção, processo no banco, home/sair, redefinir senha, fix RLS | Finalizada |
| **3** | Meus processos + Etapa 1 (análise da praça) | Finalizada |
| **4** | Etapas 4–7 (listagens, catálogo, lote escolhido) | Finalizada |
| **5** | Etapas 8–11 (batalhas, ranking, BCA, PDF) | Finalizada |
| **6** | Rede, painel Moní, alertas, PDF com hash | Finalizada |

**Finalizadas:** 6 de 6 sprints.
