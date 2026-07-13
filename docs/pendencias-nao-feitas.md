# Pendências completas — moni-fly

**Gerado em:** 2026-07-06 (atualizado)  
**Branch de referência:** `main` @ `102121fe`  
**Estado:** `funcionalidade-ingrid` obsoleta (~541 commits atrás de `main`); trabalhar em `main`.  
**Status completo da sessão:** ver `docs/status-sessao-completo.md`.

---

## 1. Migrations não aplicadas (DEV vs PROD)

Não há acesso ao `schema_migrations` de PROD daqui; o status abaixo vem de `scripts/manual/README.md`, commits e arquivos do repo.

### Confirmado pendente (documentado pelo time)

| Migration | O quê | Status documentado |
|-----------|--------|-------------------|
| **263** | Nomes/SLA Funil Portfólio (`263_funil_portfolio_fases_nomes_sla.sql` + parts 01–10 em `scripts/manual/`) | ⏳ Opcional, não aplicada |
| **264** | Funil Moní Capital — fases, SLAs, instruções | ⏳ Pendente (28 parts + instruções opcionais) |
| **265b / 266b** | Reparo `rede_franqueado_id` via `origem_card_id` | ⏳ Loop até `pendentes_origem = 0` |
| **265c / 266c** | Reparo via vínculos | ✅ Concluído (`pendentes_vinculos = 0`) |
| **265d / 266d** | Reparo `processo_step_one.origem_rede_franqueados_id` | ⏳ Loop até `pendentes_processo = 0` |

Guia: `supabase/migrations/MANUAL_RUN_264_265.md` e `scripts/manual/README.md`.

### Provavelmente pendentes em PROD (código em `main`, aplicação adiada)

| Migration | O quê | Notas |
|-----------|--------|-------|
| **235** | `checklist_legal_condominio` + log + tokens | Sem `INSERT schema_migrations` no arquivo; status PROD desconhecido |
| **394** | Funil Motor 01 (`394_funil_motor01_produto.sql`) | Usuário pediu esperar Motor 01 antes de rodar PROD |
| **426** | RLS Sirene admin/team | Commit `56a70da3`: "aplicada em DEV, **PROD pendente Ingrid**" |
| **427** | Fix RLS `sirene_topicos` (`chamado_id` NULL) | Fix de efeito colateral da 426; 157 tópicos afetados em PROD |
| **428** (×2) | Backfill Step One onboarding + `v_atividades_unificadas.responsaveis_ids` | Dois arquivos com prefixo `428_`; nenhum registra `schema_migrations` |
| **429–431** | Sirene classificação, proxima_atividade genérica, reparo DEV `etapa_progresso` | **431** é reparo DEV; demais provavelmente pendentes em PROD |

**Última migration numerada no repo:** `435_moni_capital_cadastros.sql` (WIP local, aplicada no DEV).

### Status DEV `schema_migrations` (consulta 2026-07-06)

| Status | Versões |
|--------|---------|
| ✅ Aplicadas | 262, 263, 264, 265, 266, 394, **435** |
| ⏳ Pendentes | **426, 427, 428, 429, 430, 431, 432, 433, 434** |

> **434** está em `main` (`102121fe`) mas **não aplicada no DEV** — upload de anexos no checklist pode falhar.  
> **435** aplicada no DEV; código WIP ainda não commitado.

### Gap DEV ↔ PROD (geral)

- Repo tem migrations **269→431**; PROD provavelmente parou antes disso (exceto 265c).
- Script `scripts/sync-dev-paridade-prod.mjs` sincroniza DEV a partir de `--from=269`.
- **Ação operacional pendente:** rodar migrations em PROD (usuário disse aguardar Motor 01).
- Após aplicar manualmente: registrar em `schema_migrations` (SQL no README manual).

### Problema técnico: números duplicados

Há colisões de versão no repo (só uma entra em `schema_migrations` por número):

| Versão | Arquivos |
|--------|----------|
| **394** | `394_funil_motor01_produto.sql` + `394_gantt_planejamento_novos_campos.sql` |
| **398** | 3 arquivos |
| **428** | 2 arquivos |
| **425, 401, 400, 399, 324, 322, 321, 262, 260, 234, 221, 220, 199, 179, 090** | 2 arquivos cada |

Isso complica `db push` e paridade DEV/PROD.

---

## 2. Deploy / Build

| Item | Status |
|------|--------|
| **Build local (`_build-log.txt`)** | ✅ Compila, lint/types OK, rotas geradas (HEAD atual de `main`) |
| **`44fa33e` Motor 01** | Mergeado em `main`; fixes posteriores: `cf08b5f9`, `b41a6549`, `f0a81dc1` |
| **`b90c9111` bastão removal** | ✅ Em `main` — remove bastão `m1_cto_cliente` → Jurídico |
| **`102121fe` migration 434** | ✅ Em `main` — RLS upload checklist; **DEV pendente** |
| **`85726599` rename migrations** | ✅ Renomeia 425b→432, 428b→433 |
| **`262b31b5` sort próxima atividade** | ✅ Ordenação board por prioridade |
| **`5e45cc2a` menu Motor 01** | ✅ Após Funil Acoplamento |
| **`41798a8` middleware** | ✅ Em `main` — `hasSupabaseAuthCookie`, rotas públicas sem cookie não chamam Supabase |
| **`0bf10c8` / `b2d094c7`** | ❌ Não encontrados como commits git (provavelmente IDs Vercel) — status Vercel não verificável daqui |
| **Vercel PROD build** | Não verificado; local passa após fixes de ProximaAtividadeDot |

Warnings no build: `react-hooks/exhaustive-deps`, `@next/next/no-img-element` — não bloqueiam.

---

## 3. Features pedidas mas incompletas

### Funil Motor 01 (commit `44fa33e`)

**Feito:**

- Migration 394, rota `/funil-motor01`, sidebar staff, middleware, UUID fixo
- 13 fases produto (`m1_r01` … `m1_custom_final`)
- Esteira manual: Jurídico, Projeto Legal, Cash Me
- Bastão automático em `m1_pagamento_entrada` → Projeto Legal + Cash Me
- Staff-only; Frank oculto (`KANBANS_INTERNOS` + `NOVOS_NEGOCIOS_SUBITENS_FRANK` sem Motor 01)

**Não feito / futuro:**

- Funis Waysers, Crédito Terreno, Projetos Locais como esteiras do Motor 01
- Bastão `m1_cto_cliente` → Jurídico **removido** (`b90c9111`) — decisão tomada, não pendência de implementação
- Instruções das fases (`instrucoes = NULL` na 394)
- Checklists por fase (sem seed)
- Entrada no `docs/inventario-kanban-funil-completo.md`
- Migration 394 em PROD (aguardando OK operacional)

### Checklist Legal

| Item | Status |
|------|--------|
| Tabelas (migration 235) | Código pronto; PROD incerto |
| UI + gate no Portfólio | ✅ Implementado |
| Import Google Forms | ⏳ **Stub** — `scripts/import-checklist-legal-google-forms.mjs` só lê CSV; doc em `docs/import-checklist-legal-google-forms.md` |
| API Google automatizada | ⏳ Futuro (doc) |

### Frank / visibilidade Motor 01

**Intencionalmente oculto** — não é bug pendente, salvo se quiserem expor ao Frank depois.

### Outras features documentadas como faltando

De `docs/O_QUE_FALTA_FAZER.md`:

- Atlas Brasil, Google Maps/Places (Etapa 1)
- Apify ZAP (Etapas 4–5)
- Triggers de alertas automáticos
- Importação catálogo `catalogo_casas`
- Uso de `audit_log` nas ações do app

De `docs/SIRENE_PROXIMOS_PASSOS.md` (muitos itens `[ ]`):

- Resolução pontual completa, tópicos UI, fechamento, julgamento criador
- Chat, upload anexos no detalhe
- Notificações para todos os eventos

De `ATIVIDADES_KANBAN.md`:

- Dashboard atividades, filtros avançados, email, calendário

Carômetro **TO DO & Planning** (`/carometro/todo-planning`): marcado ⚠ "Em teste" na sidebar — em desenvolvimento.

---

## 4. Ações operacionais pendentes (usuário)

| Ação | Status |
|------|--------|
| Rodar migrations PROD (263–266, 394, 428+, etc.) | ⏳ Aguardando Motor 01 |
| Completar 264 Moní Capital manual | ⏳ |
| Completar reparo franqueado (origem + processo) | ⏳ |
| Registrar versões em `schema_migrations` após manual | ⏳ |
| **`DEV_DB_URL` com colchetes na senha** | ✅ Resolvido em `scripts/pg-dev-client.mjs` (`normalizePostgresPassword`) |
| Deletar **`_220_insert.txt`** (junk untracked na raiz) | ⏳ Limpeza manual |
| Deletar **`_build-log.txt`** (untracked) | ⏳ Limpeza manual |

---

## 5. Divergência de branches

```
main ────────────────────► 1d1d9a2a (541 commits à frente)
funcionalidade-ingrid ───► 2889556a (parou no merge)
```

- **Nada em `funcionalidade-ingrid` que não esteja em `main`.**
- **541 commits em `main` fora de `funcionalidade-ingrid`**, incluindo Motor 01, Sirene, backlog, relatório, funding, merge `460f5b2d`.
- Recomendação: trabalhar em `main` ou recriar branch a partir de `main`.

---

## 6. Bugs reportados — status

| Bug / fix | Status em `main` |
|-----------|------------------|
| Build pós-`44fa33e` (ProximaAtividadeDot types) | ✅ `cf08b5f9`, `b41a6549` |
| `proxima_atividade`/`prazo_atividade` em KanbanCardBrief | ✅ `b41a6549` |
| `etapa_progresso` ausente no DEV | ✅ `f0a81dc1` + migration 431 |
| Middleware timeout Edge | ✅ `41798a8` presente |
| Bastão Motor 01 cto_cliente → Jurídico indevido | ✅ Removido `b90c9111` |
| RLS Sirene 157 tópicos `chamado_id` NULL | Fix 427 no código; **PROD pode precisar migration** |
| Build fix `0bf10c8` | Commit não encontrado — possivelmente deploy Vercel, não hash git |

---

## 7. Documentação

| Doc | Status |
|-----|--------|
| `docs/inventario-kanban-funil-completo.md` | ✅ Criado (`4dd431e5`) — **falta Motor 01** na tabela de funis |
| `docs/pendencias-nao-feitas.md` | ✅ Este documento |
| `docs/status-sessao-completo.md` | ✅ Status consolidado da sessão |
| `docs/import-checklist-legal-google-forms.md` | ✅ Existe; import não implementado |
| `docs/O_QUE_FALTA_FAZER.md` | ✅ Integrações externas pendentes |
| `docs/SIRENE_PROXIMOS_PASSOS.md` | ✅ Lista extensa de pendências Sirene |
| `supabase/migrations/MANUAL_RUN_264_265.md` | ✅ Guia migrations manuais |
| `scripts/manual/README.md` | ✅ Checklist operacional com status parcial |

---

## 8. Lixo / untracked no repo

```
?? _build-log.txt      (log de build local bem-sucedido)
?? _220_insert.txt     (junk SQL — deletar)
```

---

## Resumo executivo (prioridade)

1. **DEV migrations** — aplicar fila **426→434** (código já em `main`; DEV tem 435 mas não a fila).
2. **PROD migrations** — 264 reparo franqueado (origem + processo), 263 opcional, depois 394 Motor 01 e fila 426–435 quando autorizado.
3. **Cadastros Moní Capital (435)** — WIP local; migration aplicada no DEV; commitar código + PROD pendente.
4. **Motor 01** — código em `main`; falta PROD, instruções, checklists, funis futuros, doc inventário.
5. **Checklist Legal import** — stub; migration 235 em PROD incerta.
6. **Branch** — usar `main`; `funcionalidade-ingrid` obsoleta.
7. **Build** — local OK; confirmar Vercel manualmente.
8. **Doc** — atualizar inventário com Motor 01.
