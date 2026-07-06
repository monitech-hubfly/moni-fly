# Status completo da sessão — moni-fly

**Gerado em:** 2026-07-06 (segunda-feira)  
**Branch de referência:** `main` @ `102121fe`  
**Ambiente DEV:** `bgaadvfucnrkpimaszjv.supabase.co`  
**Ambiente PROD:** `aydryzoxqnwnbybvgiug.supabase.co` (migrations só com autorização explícita)

---

## 1. O que fizemos

Organizado por tema, com hashes de commit em `main` (ordem aproximada de entrega).

### 1.1 Kanban — UX e ações de card

| Tema | O quê | Commits |
|------|--------|---------|
| **Desarquivar** | UI no modal + botão em cards arquivados/concluídos | `9f1db588`, `a64dd79c` |
| **Próxima atividade** | `ProximaAtividadeDot` generalizado para todos os funis; campos restaurados em `KanbanCardBrief`; ordenação do board por prioridade da próxima atividade | `2889556a`, `b41a6549`, `cf08b5f9`, `262b31b5` |
| **Justificativa SLA** | Tabela `kanban_card_sla_justificativas` (migration 432) + refactor genérico em todos os kanbans | `06054b7e` + `432_kanban_card_sla_justificativas.sql` |
| **Upload checklist** | Migration 434 — reforço RLS storage `documentos-templates/respostas/*` | `102121fe` |
| **Comentários no board** | Balão opt-in no card (sem N+1) | `d2ec3d24` |
| **Tags / prazos** | Remover tag no card fechado; botão único de alteração de prazo admin | `df7b20ce`, `23c50386` |

### 1.2 Portfólio, Checklist Legal e gates

| Tema | O quê | Commits |
|------|--------|---------|
| **Gate Comitê** | Removida trava de esteiras pendentes ao avançar Portfólio → Comitê | `f0d97ea6` |
| **Checklist Legal** | Gate removido (não bloqueia avanço); resumo de faixas enriquecido no mapa | `03222382` |
| **Checklist Legal Portfólio step4** | UI e campos no Portfólio operacionais; import Google Forms continua stub (`scripts/import-checklist-legal-google-forms.mjs`) | código em `main`; migration **235** status PROD incerto |

### 1.3 Bastões e esteiras (Projeto Legal, Motor 01, Operações)

| Tema | O quê | Commits |
|------|--------|---------|
| **Projeto Legal** | Esteira manual + bastão de volta move pai Operações; slugs corretos | `530c62ca`, `adb6e3a5`, `81f8c0e2` |
| **Motor 01** | Funil novo com 13 fases, esteira manual Jurídico/Projeto Legal/Cash Me, bastão em `m1_pagamento_entrada` | `44fa33e5` |
| **Motor 01 — bastão removido** | Bastão `m1_cto_cliente` → Jurídico **removido** (decisão tomada) | `b90c9111` |
| **Motor 01 — menu** | Reordenado: Motor 01 após Funil Acoplamento | `5e45cc2a` |
| **Frank / visibilidade** | Motor 01 oculto para Frank (`KANBANS_INTERNOS`) — intencional | `44fa33e5` |
| **Wayser / checklist** | Passagem Wayser sem gate de checklist | `3a458500` |
| **Calculadora sync** | Sincronizar calculadora do pai ao criar filho Operações | `0bd8415c` |

### 1.4 Rede de franqueados e Step One onboarding

| Tema | O quê | Commits |
|------|--------|---------|
| **Auto-card onboarding** | Ao cadastrar franqueado, cria card automático no Funil Step One Onboarding | `1925d6d9` |
| **Fix FK / etapa_progresso** | Recriar `etapa_progresso` no DEV — corrige erro ao cadastrar franqueado (ex.: FK0038) | `f0a81dc1` + migration **431** |
| **Duplicidade franqueado** | Impede cadastro duplicado em retry/duplo clique | `5eabf90f` |
| **Reparo rede_franqueado_id** | Migrations **262–266** manuais; 265c concluído; origem + processo em loop | ver `scripts/manual/README.md` |
| **Title sync** | Títulos FK+nome no sync group; `montarTituloCardSync`, loteadores por condomínio | `a595d6e6`, `d2a414e8`, `99655289`, `43257927` |

### 1.5 Sirene, backlog, relatório, funding

| Tema | O quê | Commits (amostra) |
|------|--------|-------------------|
| **Sirene — Ver minhas** | Grupos Abertos/Recebidos/Concluídos; toggle Abri/Pra mim/Todos | `245b3109`, `2227cd4b` |
| **Sirene — classificação** | Pontual/Recorrente obrigatório ao concluir atividade | `1fadddd6` |
| **Sirene — anexos** | Agregados por card; upload direto do modal Kanban | `ab9bbde4`, `b5605466` |
| **Sirene — RLS 426/427** | Fix tópicos `chamado_id` NULL (157 em PROD); código em `1ba62a8d` | migration **427** pendente PROD |
| **Sirene — comentários** | Corrige mistura chamado/card | `bb6e390f` |
| **Backlog** | SLA real, expandir modal 4 blocos, filtros `responsaveis_ids[]` | `bbcbccf5`, `7d21e00a`, `8d7e609f` |
| **Relatório** | Hierarquia Card > Chamado > Atividade; filtro Meus; migration 428 view | `c932f072`, `b78f9929`, `bbe49cdf` |
| **Funding** | Bolinha próxima atividade; form dedicado novo card | `f28c8980`, `63c0bb8a`, `faac9f2e` |
| **Alertas** | Toggle Não lidas/Todas, marcar tudo lido | `1a8dcc02` |

### 1.6 Migrations manuais 262–266 (DEV)

| Migration | Status DEV (schema_migrations) |
|-----------|-------------------------------|
| **262–266** | ✅ Aplicadas |
| **394** (Motor 01) | ✅ Aplicada em DEV |
| **264** Moní Capital fases | ✅ Aplicada (via manual parts) |
| **265c** vínculos | ✅ Concluído (`pendentes_vinculos = 0`) |
| **265b/d** origem + processo | ⏳ Loop manual até zero (ver README manual) |

### 1.7 Migrations recentes 426–435

| # | Arquivo | O quê | DEV | PROD | Código `main` |
|---|---------|-------|-----|------|---------------|
| **426** | RLS Sirene admin/team | ⏳ Pendente | ⏳ Pendente | ✅ |
| **427** | Fix RLS `sirene_topicos` NULL | ⏳ Pendente | ⏳ Pendente | ✅ |
| **428** | Backfill Step One + view `responsaveis_ids` | ⏳ Pendente | ⏳ | ✅ (renomeado: `433_backfill_…`) |
| **429** | Sirene classificação | ⏳ Pendente | ⏳ | ✅ |
| **430** | `proxima_atividade` genérica | ⏳ Pendente | ⏳ | ✅ |
| **431** | Reparo `etapa_progresso` DEV | ⏳ Pendente | N/A (DEV) | ✅ |
| **432** | SLA justificativas + loteadores comentários | ⏳ Pendente | ⏳ | ✅ (2 arquivos 432 — renomeação `85726599`) |
| **433** | Backfill onboarding rede | ⏳ Pendente | ⏳ | ✅ |
| **434** | Storage upload checklist | ⏳ **Pendente DEV** | ⏳ | ✅ `102121fe` |
| **435** | `moni_capital_cadastros` | ✅ **Aplicada DEV** | ⏳ | ⏳ **WIP local (não commitado)** |

> **Nota:** Usuário confirmou "migration aplicada" — no DEV isso corresponde à **435** (cadastros Moní Capital). A **434** está no código/`main` mas **ainda não registrada** em `schema_migrations` do DEV.

### 1.8 Documentação

| Doc | Status |
|-----|--------|
| `docs/inventario-kanban-funil-completo.md` | ✅ `4dd431e5` — falta Motor 01 na tabela de funis |
| `docs/pendencias-nao-feitas.md` | ✅ Atualizado nesta sessão |
| `docs/status-sessao-completo.md` | ✅ Este documento |

### 1.9 Chore / infra

| Item | Commit |
|------|--------|
| Renomear migrations duplicadas 425b→432, 428b→433 | `85726599` |
| Middleware auth cookie (rotas públicas) | `41798a8` |
| Merge `funcionalidade-ingrid` → `main` | `460f5b2d` |
| Build local | ✅ passa (HEAD `102121fe`) |

---

## 2. Em andamento

### 2.1 Código local não commitado (WIP)

Trabalho em progresso na **Rede de Franqueados — Cadastros Moní Capital** (migration **435** já aplicada no DEV):

```
modified:   src/app/funil-funding/NovoCardFundingModal.tsx
modified:   src/app/rede-franqueados/RedeFranqueadosPageTabs.tsx
modified:   src/app/rede-franqueados/page.tsx
modified:   src/app/rede-franqueados/rede-tabelas-csv-actions.ts
modified:   src/components/kanban-shared/KanbanCardModal.tsx
modified:   src/lib/actions/card-actions.ts
modified:   src/lib/rede-tabelas-csv-export.ts

untracked:  public/templates/moni-capital-cadastros-template.csv
untracked:  src/app/rede-franqueados/CadastrosMoniCapitalTabela*.tsx
untracked:  src/app/rede-franqueados/NovoCadastroMoniCapitalModal.tsx
untracked:  src/components/kanban-shared/DadosMoniCapitalPersistentPanel.tsx
untracked:  src/lib/actions/kanban-moni-capital-cadastro.ts
untracked:  src/lib/moni-capital-cadastros*.ts
untracked:  src/lib/next-mc-cadastro.ts
untracked:  supabase/migrations/435_moni_capital_cadastros.sql
```

**Próximo passo:** commitar WIP + push quando feature estiver estável.

### 2.2 Branch e deploy

| Item | Status |
|------|--------|
| **Branch ativa** | `main` — sincronizada com `origin/main` |
| **`funcionalidade-ingrid`** | Obsoleta (~541 commits atrás de `main`); usar `main` |
| **Vercel PROD** | Código até `102121fe` deve estar deployável; build local OK — **confirmar deploy manualmente** no dashboard Vercel |
| **Migration 434 no DEV** | Código em produção no git, mas policy storage **não aplicada** no DEV — upload checklist pode falhar até rodar 434 |

### 2.3 Reparos manuais em curso (operacional)

- Loop **265b/266b** — `repair_franqueado_origem.sql` até `pendentes_origem = 0`
- Loop **265d/266d** — `repair_franqueado_processo.sql` até `pendentes_processo = 0`
- Instruções completas migration **264** (parts 21–28 são placeholder `—`)

---

## 3. Pendente

### 3.1 Migrations — prioridade operacional

1. **DEV — aplicar fila 426→434** (código já em `main`; DEV parou em 394/435 sem a fila intermediária)
2. **DEV — rodar 434** (upload checklist — commit `102121fe`)
3. **PROD — aguardando autorização** para 263–266, 394, 426–435
4. **PROD — 427** urgente se Sirene com tópicos invisíveis (157 registros `chamado_id` NULL)
5. Registrar versões em `schema_migrations` após execução manual (`scripts/manual/README.md`)

### 3.2 Motor 01 — futuro

- [ ] Migration **394** em PROD (aguardando OK operacional)
- [ ] Instruções das fases (`instrucoes = NULL` na 394)
- [ ] Checklists por fase (sem seed)
- [ ] Funis futuros: Waysers, Crédito Terreno, Projetos Locais como esteiras
- [ ] Entrada no `docs/inventario-kanban-funil-completo.md`
- [ ] Expor ao Frank? (hoje oculto — decisão de negócio)

### 3.3 Checklist Legal

- [ ] Import Google Forms automatizado (stub existe)
- [ ] Migration **235** em PROD (status incerto)
- [ ] API Google (futuro — `docs/import-checklist-legal-google-forms.md`)

### 3.4 Sirene — backlog de produto

De `docs/SIRENE_PROXIMOS_PASSOS.md`:

- Resolução pontual completa, chat, notificações para todos os eventos
- Julgamento criador, fechamento formal
- Migrations **426–429** em PROD quando autorizado

### 3.5 Integrações e outras features

De `docs/O_QUE_FALTA_FAZER.md`:

- Atlas Brasil, Google Maps/Places, Apify ZAP
- Triggers de alertas automáticos
- Importação catálogo `catalogo_casas`
- Uso de `audit_log` nas ações do app
- Carômetro TO DO & Planning (`/carometro/todo-planning`) — em teste

### 3.6 Cadastros Moní Capital (435)

- [ ] Commitar código WIP + migration 435 em `main`
- [ ] Aplicar **435** em PROD quando autorizado
- [ ] Template CSV + import/export na Rede de Franqueados
- [ ] Painel persistente no modal Funding (`DadosMoniCapitalPersistentPanel`)

### 3.7 Limpeza repo

- [ ] Deletar `_220_insert.txt` (junk untracked)
- [ ] Deletar `_build-log.txt` (log local)

### 3.8 Documentação

- [ ] Atualizar inventário com Motor 01
- [ ] Manter `pendencias-nao-feitas.md` e este doc após cada sprint

---

## 4. Referência rápida — estado DEV `schema_migrations`

Consulta em 2026-07-06:

```
Aplicadas (numéricas relevantes): 262, 263, 264, 265, 266, 394, 435
Pendentes:                         426, 427, 428, 429, 430, 431, 432, 433, 434
```

---

## 5. Commits recentes em `main` (últimos 15)

```
102121fe fix(kanban): migration 434 reforça RLS de upload de anexos no checklist
85726599 chore: renomear migrations duplicadas 425b→432 e 428b→433
262b31b5 Ordena cards do Kanban por prioridade da próxima atividade
06054b7e refactor(kanban): justificativa SLA genérica em todos os kanbans
5e45cc2a fix(nav): Motor 01 após Funil Acoplamento no menu
5eabf90f fix(rede-franqueados): impede cadastro duplicado em retry ou duplo clique
bb6e390f fix(sirene): corrige mistura de comentários entre chamado e card
fc142124 fix(sirene): corrige nome/email de Diogo Chagas no catálogo Moní Capital
013c2f06 docs: inventario de pendencias nao feitas
7c917328 fix(notificacoes): origem=legado no link de cards legado
1d1d9a2a fix(sirene): agrupa chamados por conclusão das atividades do usuário
f0a81dc1 fix: recriar etapa_progresso no DEV (cadastro franqueado Step One)
b41a6549 fix: restaurar proxima_atividade e prazo_atividade em KanbanCardBrief
b90c9111 fix(kanban): remover bastão Motor 01 cto_cliente para Jurídico
44fa33e5 feat(funil): Funil Motor 01 com 13 fases, bastões e esteira manual
```

---

*Documento gerado para consolidar o trabalho da sessão. Atualizar após commits significativos ou aplicação de migrations.*
