# MAPEAMENTO COMPLETO DO PROJETO MONI-FLY
**Data**: 15/04/2026
**Gerado para**: Análise de estrutura antes de novas implementações

---

## ÍNDICE

1. [Estrutura de Pastas](#estrutura-de-pastas)
2. [Sistema de Kanbans](#sistema-de-kanbans)
3. [Sistema de Atividades/Tarefas](#sistema-de-atividadestarefas)
4. [Componentes Criados Nesta Sessão](#componentes-criados-nesta-sessão)
5. [Componentes Pré-Existentes](#componentes-pré-existentes)
6. [Conflitos Identificados](#conflitos-identificados)
7. [Banco de Dados](#banco-de-dados)
8. [Sistema de Autenticação](#sistema-de-autenticação)

---

## 1. ESTRUTURA DE PASTAS

```
c:\Dev\moni-fly\
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── funil-stepone/           # ✅ CRIADO NESTA SESSÃO - Kanban Step One
│   │   ├── steps-viabilidade/       # ⚠️ PRÉ-EXISTENTE - Kanban antigo (Portfolio)
│   │   ├── painel-novos-negocios/   # ⚠️ PRÉ-EXISTENTE - Painel principal
│   │   ├── painel/                  # ⚠️ PRÉ-EXISTENTE - Painel Moní (Admin)
│   │   ├── painel-contabilidade/    # ⚠️ PRÉ-EXISTENTE - Kanban Contabilidade
│   │   ├── painel-credito/          # ⚠️ PRÉ-EXISTENTE - Kanban Crédito
│   │   ├── step-one/                # ⚠️ PRÉ-EXISTENTE - Formulário Step One (antigo)
│   │   ├── sirene/                  # ⚠️ PRÉ-EXISTENTE - Sistema de Chamados
│   │   ├── juridico/                # ⚠️ PRÉ-EXISTENTE - Canal Jurídico
│   │   └── ...outros módulos
│   ├── components/                   # Componentes globais
│   │   ├── AppShell.tsx             # Shell principal da aplicação
│   │   ├── PortalSidebar.tsx        # Menu lateral de navegação
│   │   ├── AuthHeader.tsx           # Header com autenticação
│   │   └── TabelaRedeFranqueados.tsx
│   ├── lib/                          # Utilitários e bibliotecas
│   │   ├── supabase/                # Cliente Supabase
│   │   │   ├── client.ts            # Cliente para client components
│   │   │   ├── server.ts            # Cliente para server components
│   │   │   ├── admin.ts             # Cliente admin (bypass RLS)
│   │   │   └── middleware.ts        # Middleware de autenticação
│   │   ├── dias-uteis.ts            # ✅ CRIADO NESTA SESSÃO - Cálculo de dias úteis
│   │   ├── painel-tarefas-filtros.ts # ⚠️ PRÉ-EXISTENTE - Filtros do painel
│   │   ├── atividade-times-responsaveis.ts # ⚠️ PRÉ-EXISTENTE - Lógica de checklists
│   │   ├── atividade-times.ts       # ⚠️ PRÉ-EXISTENTE - Times e responsáveis
│   │   ├── auth-guard.ts            # Proteção de rotas
│   │   ├── authz.ts                 # Autorização (roles)
│   │   └── access-matrix.ts         # Matriz de acesso
│   ├── styles/
│   │   └── moni-tokens.css          # ✅ MODIFICADO - Tokens de design
│   └── middleware.ts                 # Middleware global do Next.js
├── supabase/
│   └── migrations/                   # Migrações SQL do banco
│       ├── 091_step_one_kanban.sql  # ✅ CRIADO - Estrutura do Funil Step One
│       ├── 102_feriados_dias_uteis.sql # ✅ CRIADO - Feriados e funções PL/pgSQL
│       ├── 103_atividades_kanban.sql # ✅ CRIADO - Tabela de atividades
│       ├── 104_atividades_add_time.sql # ✅ CRIADO - Campo 'time' em atividades
│       ├── 001_initial_schema.sql   # ⚠️ PRÉ-EXISTENTE - Schema inicial
│       ├── 045_painel_card_comentarios_checklist_topicos.sql # ⚠️ Checklists antigos
│       ├── 090_processo_card_checklist_multi_times_responsaveis.sql # ⚠️ Sistema antigo
│       └── ...outras 115 migrações
├── docs/                             # Documentação
└── [arquivos raiz]
    ├── FUNIL_STEPONE_KANBAN.md      # ✅ CRIADO - Doc do Funil
    ├── ABAS_KANBAN_PAINEL.md        # ✅ CRIADO - Doc das abas
    ├── ATIVIDADES_KANBAN.md         # ✅ CRIADO - Doc de atividades
    ├── GUIA_COMPLETO_VIABILIDADE.md # ⚠️ PRÉ-EXISTENTE
    └── ...outros docs
```

---

## 2. SISTEMA DE KANBANS

### 2.1. FUNIL STEP ONE (✅ CRIADO NESTA SESSÃO)

**Localização**: `src/app/funil-stepone/`

**Arquivos**:
- `page.tsx` - Página principal do Kanban com tabs (Kanban/Painel)
- `KanbanColumn.tsx` - Componente de coluna do Kanban
- `KanbanWrapper.tsx` - Wrapper para controlar modais via URL query params
- `KanbanTabs.tsx` - Abas "Kanban" e "Painel"
- `CardModal.tsx` - Modal de detalhes do card (duas colunas, histórico + ação atual)
- `NovoCardModal.tsx` - Modal para criar novo card
- `[id]/page.tsx` - Página de detalhes (rota antiga, mas renderiza o modal)
- `[id]/CardDetailClient.tsx` - Cliente de detalhes antigo (menos usado agora)
- `novo/page.tsx` - Página de criação (rota antiga)
- `novo/NovoCardForm.tsx` - Formulário de criação antigo

**Fases** (7 fases):
1. Dados da Cidade (SLA: 7 dias)
2. Lista de Condomínios (SLA: 7 dias)
3. Dados dos Condomínios (SLA: 10 dias)
4. Lotes disponíveis (SLA: 7 dias)
5. Mapa de Competidores (SLA: 7 dias)
6. BCA + Batalha de Casas (SLA: 14 dias)
7. Hipóteses (SLA: 7 dias)

**Tabelas do Banco**:
- `kanbans` - Definição dos boards
- `kanban_fases` - Fases de cada Kanban
- `kanban_cards` - Cards do Kanban (com FK para `franqueado_id`)
- `kanban_atividades` - Atividades vinculadas aos cards (✅ CRIADO)
- `feriados_nacionais` - Feriados para cálculo de dias úteis (✅ CRIADO)

**Funcionalidades Implementadas**:
- ✅ SLA calculado em **dias úteis** (exclui fins de semana e feriados)
- ✅ Cards abrem como **modal sobre o Kanban** (não navegação)
- ✅ Layout **duas colunas**: histórico (esquerda 40%) + ação atual (direita 60%)
- ✅ Abas minimizáveis de fases concluídas
- ✅ Tabs "Kanban" e "Painel" (Painel ainda não implementado)
- ✅ Sistema de atividades vinculadas com filtros (Status, Time, Responsável, Ordenação)
- ✅ Formulário inline para adicionar novas atividades
- ✅ Campo `time` nas atividades (manhã/tarde/dia todo)
- ✅ RLS configurado por franqueado e role

**Cores/Design**:
- Primária: `--moni-kanban-stepone` (#0C2633 - verde naval escuro)
- Light: `--moni-kanban-stepone-light` (#e8eef1)
- Accent: `--moni-kanban-stepone-accent` (#3e7490)
- SEM LARANJA (regra de design)

---

### 2.2. PORTFÓLIO + OPERAÇÕES (⚠️ PRÉ-EXISTENTE)

**Localização**: `src/app/steps-viabilidade/` e `src/app/painel-novos-negocios/`

**Arquivos Principais**:
- `steps-viabilidade/page.tsx` - Redireciona para `/painel-novos-negocios`
- `painel-novos-negocios/page.tsx` - Página principal do Kanban (Server Component)
- `PainelNovosNegociosClient.tsx` - Cliente com busca e filtros
- `StepsKanbanColumn.tsx` - Componente de coluna do Kanban (drag & drop)
- `PainelCard.tsx` - Card individual no Kanban
- `CardDetalheModal.tsx` - **MODAL ANTIGO DE DETALHES** (⚠️ ~6000 linhas!)
- `PainelFlowBoard.tsx` - Layout do board Kanban
- `tarefas/TarefasPainelConteudo.tsx` - **PAINEL DE TAREFAS ANTIGO**
- `tarefas/page.tsx` - Página do Painel de Tarefas

**Colunas do Painel** (definidas em `painelColumns.ts`):
- Step 1 - Estudos de Viabilidade
- Step 2 - Em Casa
- Step 3 - Documentação
- Prefeitura
- Aprovação Prefeitura
- Comitê
- Aprovação Comitê
- Step 7 - Contratos
- Contabilidade
- Crédito Abertura
- Crédito Terreno
- Crédito Obra
- Acoplamento
- Homologações
- Pré-Obra

**Tabelas do Banco**:
- `processo_step_one` - Processos de viabilidade (tabela principal antiga)
- `processo_card_checklist` - Checklists por etapa (**SISTEMA ANTIGO COMPLEXO**)
- `processo_card_comentarios` - Comentários nos cards
- `processo_card_documentos` - Documentos anexados
- `processo_card_comite` - Dados de comitê
- `step1_areas_checklist` - Checklist das áreas no Step 1

**⚠️ IMPORTANTE**: Este é o sistema antigo e **MUITO COMPLEXO** que já estava funcionando. Tem:
- Sistema de checklist por fase com múltiplos times e responsáveis
- Filtros avançados (busca, status, tags, etapa)
- Drag & drop entre colunas
- Cancelamento com motivos
- Histórico de ações
- Integração com Autentique para documentos
- Formulários públicos

---

### 2.3. OUTROS KANBANS (⚠️ PRÉ-EXISTENTES)

**Contabilidade**: `src/app/painel-contabilidade/`
- Usa a mesma estrutura de `processo_step_one`
- Fases específicas de contabilidade

**Crédito**: `src/app/painel-credito/`
- Usa a mesma estrutura de `processo_step_one`
- Fases de aprovação de crédito

**Sirene (Chamados)**: `src/app/sirene/`
- Sistema de chamados/tickets
- Kanban próprio com fases diferentes
- Tabelas: `sirene_chamados`, `sirene_mensagens`, etc.

**Jurídico**: `src/app/juridico/`
- Canal de dúvidas jurídicas
- Kanban de tickets jurídicos
- Tabelas: `juridico_ticket`, etc.

---

## 3. SISTEMA DE ATIVIDADES/TAREFAS

### 3.1. NOVO SISTEMA (✅ CRIADO NESTA SESSÃO)

**Tabela**: `kanban_atividades`

**Localização**: Usado no `CardModal.tsx` do Funil Step One

**Campos**:
- `id` (UUID)
- `card_id` (FK para `kanban_cards`)
- `titulo` (TEXT)
- `descricao` (TEXT, nullable)
- `status` ('pendente' | 'em_andamento' | 'concluido')
- `prioridade` ('baixa' | 'media' | 'alta')
- `responsavel_id` (FK para `profiles`, nullable)
- `data_vencimento` (DATE, nullable)
- `time` (TEXT, nullable) - 'manha' | 'tarde' | 'dia_todo'
- `criado_por` (FK para `auth.users`)
- `concluida_em` (TIMESTAMPTZ, nullable)
- `ordem` (INT) - para ordenação
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Funcionalidades**:
- ✅ Filtros por Status, Time, Responsável
- ✅ Ordenação por Responsável ou Prazo
- ✅ Formulário inline para adicionar atividades
- ✅ Campo `time` para especificar período do dia
- ✅ Cores por status e prioridade
- ✅ RLS configurado (franqueado vê só suas atividades, admin/consultor vê todas)

**RLS**:
```sql
-- SELECT: Usuário vê atividades dos seus cards OU é admin/consultor
-- INSERT: Apenas o dono do card ou admin/consultor
-- UPDATE: Apenas o criador da atividade ou admin/consultor
-- DELETE: Apenas o criador da atividade ou admin/consultor
```

---

### 3.2. SISTEMA ANTIGO (⚠️ PRÉ-EXISTENTE)

**Tabela**: `processo_card_checklist`

**Localização**: Usado em `CardDetalheModal.tsx` (sistema antigo)

**Campos**:
- `id` (UUID)
- `processo_id` (FK para `processo_step_one`)
- `etapa_painel` (TEXT) - qual coluna do Kanban
- `titulo` (TEXT)
- `times_nomes` (TEXT[]) - array de times
- `responsaveis_nomes` (TEXT[]) - array de responsáveis
- `time_nome` (TEXT, legacy) - campo legado
- `responsavel_nome` (TEXT, legacy) - campo legado
- `prazo` (TEXT) - formato DD/MM/YYYY
- `status` ('nao_iniciada' | 'em_andamento' | 'concluido')
- `concluido` (BOOLEAN)
- `link` (TEXT, nullable)
- `anexo` (TEXT, nullable)
- `created_at`, `updated_at`

**⚠️ DIFERENÇAS DO SISTEMA NOVO**:
- Usa arrays para múltiplos times/responsáveis (mais complexo)
- Vinculado a `processo_step_one` (não a `kanban_cards`)
- Prazo em formato brasileiro (DD/MM/YYYY), não DATE
- Tem campos legados (`time_nome`, `responsavel_nome`)
- RLS diferente (baseado em `processo_step_one`)

**Painel de Tarefas Antigo**:
- **Arquivo**: `src/app/steps-viabilidade/tarefas/TarefasPainelConteudo.tsx`
- **Rota**: `/painel-novos-negocios/tarefas`
- Exibe todas as atividades do sistema antigo (`processo_card_checklist`)
- Filtros complexos: Busca, Time, Franqueado, Etapa, Status, Tag, Ordenação
- Agrupamento por Responsável ou Prazo
- Ação inline para mudar status

---

## 4. COMPONENTES CRIADOS NESTA SESSÃO

### ✅ Arquivos TypeScript/React

1. **`src/app/funil-stepone/page.tsx`**
   - Página principal do Kanban
   - Busca fases e cards do Supabase
   - Renderiza `KanbanWrapper` e `KanbanTabs`
   - Tabs: Kanban (ativo) e Painel (placeholder)

2. **`src/app/funil-stepone/KanbanColumn.tsx`**
   - Componente de coluna do Kanban
   - Exibe fase, contador, SLA
   - Lista cards com status SLA em dias úteis
   - Botão no card abre modal via `router.push(?card=ID)`

3. **`src/app/funil-stepone/KanbanWrapper.tsx`**
   - Wrapper client-side
   - Monitora `searchParams` (?card=ID ou ?novo=true)
   - Renderiza `CardModal` ou `NovoCardModal`
   - Função `closeModal` para voltar ao Kanban

4. **`src/app/funil-stepone/KanbanTabs.tsx`**
   - Componente de tabs "Kanban" e "Painel"
   - Controla tab ativa via URL (?tab=painel)
   - Fundo branco, linha verde na tab ativa
   - ⚠️ Visual foi ajustado: removido fundo azul pesado

5. **`src/app/funil-stepone/CardModal.tsx`**
   - Modal de detalhes do card (duas colunas)
   - **Coluna esquerda** (40%): Histórico de fases concluídas (abas minimizáveis) + Comentários gerais
   - **Coluna direita** (60%): Fase atual, checklist, campos, comentários, **atividades vinculadas**
   - Sistema de atividades com filtros (Status, Time, Responsável, Ordenação)
   - Formulário inline para adicionar atividades
   - Botões: "Avançar para próxima fase" e "Arquivar"
   - ⚠️ Visual ajustado: header branco, botões sem fundo azul pesado

6. **`src/app/funil-stepone/NovoCardModal.tsx`**
   - Modal para criar novo card
   - Campos: Franqueado (dropdown para admin), Fase inicial
   - Preview do título automático
   - ⚠️ Visual ajustado: header branco

7. **`src/app/funil-stepone/[id]/page.tsx`**
   - Rota antiga de detalhes (mantida para compatibilidade)
   - Redireciona para modal via query params

8. **`src/app/funil-stepone/[id]/CardDetailClient.tsx`**
   - Cliente de detalhes antigo (menos usado agora que temos modal)

9. **`src/app/funil-stepone/novo/page.tsx`**
   - Rota antiga de criação (mantida para compatibilidade)

10. **`src/app/funil-stepone/novo/NovoCardForm.tsx`**
    - Formulário de criação antigo

11. **`src/lib/dias-uteis.ts`**
    - Funções para cálculo de dias úteis
    - `isDiaUtil()`, `calcularDiasUteis()`, `adicionarDiasUteis()`
    - `calcularStatusSLA()` - retorna status, label e classe CSS
    - Lista hardcoded de feriados nacionais 2025-2027

### ✅ Arquivos SQL

1. **`supabase/migrations/091_step_one_kanban.sql`**
   - Cria tabelas: `kanbans`, `kanban_fases`, `kanban_cards`
   - Seed do Kanban "Funil Step One" com 7 fases
   - RLS configurado para todas as tabelas

2. **`supabase/migrations/102_feriados_dias_uteis.sql`**
   - Cria tabela `feriados_nacionais`
   - Seed de feriados 2025-2027
   - Funções PL/pgSQL: `calcular_dias_uteis()` e `adicionar_dias_uteis()`

3. **`supabase/migrations/103_atividades_kanban.sql`**
   - Cria tabela `kanban_atividades`
   - Índices e trigger `updated_at`
   - RLS configurado (franqueado vê só suas, admin/consultor vê todas)

4. **`supabase/migrations/104_atividades_add_time.sql`**
   - Adiciona coluna `time` em `kanban_atividades`
   - Atualiza atividades exemplo com valores de `time`

### ✅ Scripts SQL Auxiliares (raiz do projeto)

1. **`CARDS_EXEMPLO_COMPLETO.sql`** - Cria 8 cards exemplo com datas variadas (SLA realista)
2. **`CARDS_EXEMPLO_SIMPLES.sql`** - Versão simplificada para DEV
3. **`ATUALIZAR_CARDS_EXEMPLO.sql`** - Script para atualizar cards existentes
4. **`ATIVIDADES_EXEMPLO.sql`** - Cria 4-5 atividades exemplo por card
5. **`QUERIES_RAPIDAS_CARDS.sql`** - 15 queries úteis para operações diárias
6. **`MIGRAR_DIAS_UTEIS.sql`** - Script consolidado de feriados e funções
7. **`VERIFICAR_TUDO.sql`** - Script de diagnóstico completo
8. **`DEBUG_CARDS.sql`** - Script de debug de RLS e permissões
9. **`VER_E_CONSERTAR_CARDS.sql`** - Script para corrigir dados de cards

### ✅ Documentação (Markdown)

1. **`FUNIL_STEPONE_KANBAN.md`** - Documentação completa do Funil Step One
2. **`ABAS_KANBAN_PAINEL.md`** - Documentação das tabs Kanban/Painel
3. **`ATIVIDADES_KANBAN.md`** - Documentação do sistema de atividades
4. **`GUIA_CARDS_EXEMPLO.md`** - Guia dos scripts de cards exemplo
5. **`README_CARDS_EXEMPLO.md`** - Índice visual dos scripts
6. **`COMO_USAR_ATIVIDADES.md`** - Guia rápido de atividades
7. **`ATIVIDADES_COMPLETAS_FILTROS.md`** - Doc da integração de filtros antigos
8. **`APLICAR_ATIVIDADES_ATUALIZADAS.md`** - Guia de aplicação do campo `time`
9. **`MODAL_CARD_COMPLETO.md`** - Spec do modal duas colunas
10. **`AJUSTES_FUNIL_STEPONE.md`** - Lista de ajustes implementados

### ✅ Modificações em Arquivos Existentes

1. **`src/styles/moni-tokens.css`**
   - Adicionadas variáveis CSS para o modal duas colunas
   - Classes `.moni-card-modal-split`, `--moni-modal-left-width`, etc.

2. **`src/components/PortalSidebar.tsx`**
   - Adicionado link "Funil Step One" no menu (ANTES de "Portfolio + Operações")

3. **`src/app/globals.css`**
   - (Modificações menores, se houver)

---

## 5. COMPONENTES PRÉ-EXISTENTES

### ⚠️ Sistema de Kanban Antigo (Portfolio)

**Localização**: `src/app/steps-viabilidade/` e `src/app/painel-novos-negocios/`

**Arquivos Principais** (não modificados por nós):
1. **`CardDetalheModal.tsx`** (~6000 linhas) - Modal gigante com:
   - Abas: Dados, Comentários, Checklist, Checklist Step 1, Histórico, Documentos
   - Sistema de checklist complexo com múltiplos times/responsáveis
   - Integração com Autentique
   - Cancelamento/Remoção com motivos
   - Drag & drop de documentos
   - Formulários públicos
   - Checklist Legal, Crédito, Contabilidade

2. **`TarefasPainelConteudo.tsx`** - Painel de tarefas global
   - Lista todas as atividades de `processo_card_checklist`
   - Filtros: Busca, Time, Franqueado, Etapa, Status, Tag, Ordenação
   - Agrupamento por Responsável ou Prazo
   - Ação inline para mudar status

3. **`StepsKanbanColumn.tsx`** - Coluna do Kanban com drag & drop

4. **`PainelCard.tsx`** - Card individual do Kanban

5. **`PainelFlowBoard.tsx`** - Layout do board Kanban

6. **`PainelNovosNegociosClient.tsx`** - Cliente com busca e filtros

7. **`painelColumns.ts`** - Definição das 15 colunas do Kanban

8. **`card-actions.ts`** - Server actions para CRUD de cards antigos

### ⚠️ Bibliotecas Utilitárias (não modificadas)

1. **`lib/painel-tarefas-filtros.ts`**
   - Lógica de filtros do painel de tarefas antigo
   - Funções: `aplicarFiltrosTarefasPainel()`, `getPrazoTagAtividade()`, etc.

2. **`lib/atividade-times-responsaveis.ts`**
   - Normalização de listas de times/responsáveis
   - Funções: `parseTextArrayColumn()`, `mergeArraysWithLegacy()`, etc.

3. **`lib/atividade-times.ts`**
   - Definição de times e seus membros
   - Usado no sistema antigo

4. **`lib/painel/cancelamento-motivos.ts`**
   - Motivos de cancelamento e reprovação

5. **`lib/painel/dashboard-etapas.ts`**
   - Lógica de etapas do dashboard

6. **`lib/supabase/client.ts`** - Cliente Supabase (client-side)

7. **`lib/supabase/server.ts`** - Cliente Supabase (server-side)

8. **`lib/supabase/admin.ts`** - Cliente admin (bypass RLS)

9. **`lib/auth-guard.ts`** - Proteção de rotas

10. **`lib/authz.ts`** - Sistema de autorização (roles)

11. **`lib/access-matrix.ts`** - Matriz de acesso por role

### ⚠️ Componentes Globais (não modificados)

1. **`components/AppShell.tsx`** - Shell principal da aplicação

2. **`components/PortalSidebar.tsx`** - Menu lateral (✅ modificado para adicionar link)

3. **`components/AuthHeader.tsx`** - Header com autenticação

### ⚠️ Outros Módulos (não relacionados)

- `src/app/sirene/` - Sistema de chamados
- `src/app/juridico/` - Canal jurídico
- `src/app/step-one/` - Formulário Step One antigo
- `src/app/step-2/` - Step 2
- `src/app/step-3/` - Step 3 (Documentação)
- `src/app/step-5/` - Step 5 (Comitê)
- `src/app/step-7/` - Step 7 (Contratos)
- `src/app/rede-franqueados/` - Gestão de franqueados
- `src/app/comunidade/` - Timeline social
- `src/app/admin/` - Painel admin
- etc.

---

## 6. CONFLITOS IDENTIFICADOS

### ⚠️ CONFLITO 1: DOIS SISTEMAS DE ATIVIDADES

**Problema**: Temos dois sistemas paralelos de atividades/tarefas que NÃO estão integrados:

1. **Sistema NOVO** (criado por nós):
   - Tabela: `kanban_atividades`
   - Usado em: `funil-stepone/CardModal.tsx`
   - Vinculado a: `kanban_cards`
   - Campo `time`: 'manha' | 'tarde' | 'dia_todo'
   - Filtros: Status, Time, Responsável, Ordenação
   - RLS: Por franqueado e role

2. **Sistema ANTIGO** (pré-existente):
   - Tabela: `processo_card_checklist`
   - Usado em: `steps-viabilidade/CardDetalheModal.tsx` e `TarefasPainelConteudo.tsx`
   - Vinculado a: `processo_step_one`
   - Arrays: `times_nomes[]`, `responsaveis_nomes[]`
   - Campos legados: `time_nome`, `responsavel_nome`
   - Painel global de tarefas: `/painel-novos-negocios/tarefas`

**Impacto**:
- ❌ Atividades do Funil Step One NÃO aparecem no Painel de Tarefas global
- ❌ Não há forma unificada de ver todas as atividades do sistema
- ❌ Lógica duplicada de filtros e exibição

**Soluções Possíveis**:
1. **Criar view unificada**: `SELECT` que combina ambas as tabelas
2. **Integrar no Painel de Tarefas**: Modificar `TarefasPainelConteudo.tsx` para buscar de ambas
3. **Migrar sistema antigo**: Mover dados de `processo_card_checklist` para `kanban_atividades` (PERIGOSO)

---

### ⚠️ CONFLITO 2: DOIS MODAIS DE DETALHES

**Problema**: Temos dois componentes de modal de card:

1. **Modal NOVO** (criado por nós):
   - `funil-stepone/CardModal.tsx` (~900 linhas)
   - Layout duas colunas
   - Sistema de atividades integrado
   - Abas minimizáveis de histórico
   - Design limpo e moderno

2. **Modal ANTIGO** (pré-existente):
   - `steps-viabilidade/CardDetalheModal.tsx` (~6000 linhas!)
   - Abas: Dados, Comentários, Checklist, etc.
   - Sistema muito mais complexo
   - Integração com Autentique, formulários públicos, etc.

**Impacto**:
- ✅ Não há conflito direto (usados em Kanbans diferentes)
- ⚠️ Mas há duplicação de funcionalidades básicas (comentários, checklist, etc.)
- ⚠️ Modal antigo tem features que o novo não tem (ex: Autentique, formulários públicos)

**Solução**:
- Por enquanto, **manter ambos separados**
- No futuro: extrair componentes comuns (ex: `CommentsList`, `ChecklistSection`)

---

### ⚠️ CONFLITO 3: CÁLCULO DE SLA

**Problema**: Temos dois métodos de cálculo de SLA:

1. **Sistema NOVO** (Funil Step One):
   - Cálculo em **dias úteis** (exclui fins de semana e feriados)
   - Funções TypeScript: `src/lib/dias-uteis.ts`
   - Funções PL/pgSQL: `calcular_dias_uteis()`, `adicionar_dias_uteis()`
   - Tabela: `feriados_nacionais`
   - Display: "Atrasado 3 d.u." ou "Vence em 2 d.u."

2. **Sistema ANTIGO** (Portfolio):
   - Cálculo em **dias corridos** (via `processo_card_checklist.prazo`)
   - Lógica em `lib/painel-tarefas-filtros.ts` (`getPrazoTagAtividade()`)
   - Sem tabela de feriados
   - Display: "Atrasado", "Atenção", tags vermelhas/douradas

**Impacto**:
- ❌ Inconsistência na forma de contar prazos
- ❌ Usuários podem ficar confusos com diferentes contagens
- ⚠️ Sistema antigo usa formato DD/MM/YYYY (string), novo usa DATE

**Solução**:
- **Idealmente**: Migrar sistema antigo para usar dias úteis também
- **Pragmática**: Manter separado, documentar diferença para o usuário

---

### ⚠️ CONFLITO 4: NAVEGAÇÃO POR QUERY PARAMS vs. ROTAS

**Problema**: Temos dois padrões de navegação:

1. **Sistema NOVO** (Funil Step One):
   - Modal abre via query params: `?card=ID` ou `?novo=true`
   - Kanban permanece visível atrás
   - Melhor UX (não perde contexto)

2. **Sistema ANTIGO** (Portfolio):
   - Cards abrem como **modal overlay** também (via `PainelCard.tsx`)
   - Mas usa state React, não query params
   - `CardDetalheModal` é renderizado condicionalmente

**Impacto**:
- ✅ Não há conflito direto (sistemas separados)
- ⚠️ Mas inconsistência na forma de abrir modais
- ⚠️ Query params permitem deep linking, state React não

**Solução**:
- Manter ambos como estão por enquanto
- No futuro: migrar sistema antigo para query params também

---

### ⚠️ CONFLITO 5: RLS E PERMISSÕES

**Problema**: Temos duas formas de controle de acesso:

1. **Sistema NOVO** (Funil Step One):
   - RLS baseado em `franqueado_id` (FK direto para `auth.users`)
   - Admin/consultor vê tudo, franqueado vê só o seu
   - Simples e direto

2. **Sistema ANTIGO** (Portfolio):
   - RLS baseado em `user_id` de `processo_step_one`
   - Consultor vê processos dos seus franqueados (`profiles.consultor_id`)
   - Mais complexo, mas permite hierarquia

**Impacto**:
- ✅ Não há conflito direto (tabelas diferentes)
- ⚠️ Mas lógica de permissão duplicada
- ⚠️ Admin tem que gerir dois sistemas diferentes

**Solução**:
- Manter como está, sistemas independentes
- Documentar bem as diferenças

---

## 7. BANCO DE DADOS

### Tabelas CRIADAS nesta sessão (✅ NOVAS):

1. **`kanbans`**
   - Boards de Kanban genéricos
   - Seed: "Funil Step One"
   - Campos: `id`, `nome`, `ordem`, `cor_hex`, `ativo`

2. **`kanban_fases`**
   - Fases de cada Kanban
   - Seed: 7 fases do Funil Step One
   - Campos: `id`, `kanban_id`, `nome`, `ordem`, `sla_dias`, `ativo`

3. **`kanban_cards`**
   - Cards dos Kanbans
   - FK: `kanban_id`, `fase_id`, `franqueado_id`
   - Campos: `id`, `titulo`, `status`, `created_at`
   - RLS: Franqueado vê só o seu, admin/consultor vê tudo

4. **`kanban_atividades`**
   - Atividades vinculadas aos cards
   - FK: `card_id`, `responsavel_id`, `criado_por`
   - Campos: `id`, `titulo`, `descricao`, `status`, `prioridade`, `data_vencimento`, `time`, `ordem`, `concluida_em`
   - RLS: Franqueado vê atividades dos seus cards, admin/consultor vê tudo

5. **`feriados_nacionais`**
   - Feriados nacionais brasileiros
   - Seed: 2025-2027
   - Campos: `id`, `data`, `nome`, `fixo`

### Funções PL/pgSQL CRIADAS (✅ NOVAS):

1. **`public.calcular_dias_uteis(data_inicio DATE, data_fim DATE)`**
   - Retorna: INT (número de dias úteis entre as datas)
   - Ignora fins de semana e feriados

2. **`public.adicionar_dias_uteis(data_base DATE, dias_uteis_add INT)`**
   - Retorna: DATE (data após adicionar X dias úteis)
   - Ignora fins de semana e feriados

### Tabelas PRÉ-EXISTENTES (⚠️ ANTIGAS):

1. **`profiles`**
   - Perfis de usuários
   - Campos: `id`, `email`, `full_name`, `role`, `consultor_id`, `autentique_api_key`, etc.
   - Roles: 'admin', 'consultor', 'frank', 'supervisor'

2. **`processo_step_one`**
   - Processos de viabilidade (sistema antigo)
   - Campos: `id`, `user_id`, `cidade`, `estado`, `status`, `etapa_atual`, `step_atual`, `etapa_painel`, `trava_painel`, `cancelado_em`, `removido_em`, `numero_franquia`, `nome_franqueado`, etc.

3. **`processo_card_checklist`**
   - Checklists do sistema antigo
   - Campos: `id`, `processo_id`, `etapa_painel`, `titulo`, `times_nomes[]`, `responsaveis_nomes[]`, `time_nome`, `responsavel_nome`, `prazo`, `status`, `concluido`, `link`, `anexo`

4. **`processo_card_comentarios`**
   - Comentários nos cards do sistema antigo

5. **`processo_card_documentos`**
   - Documentos anexados aos cards do sistema antigo

6. **`processo_card_comite`**
   - Dados de comitê (aprovação/reprovação)

7. **`step1_areas_checklist`**
   - Checklist das áreas no Step 1 (sistema antigo)

8. **`rede_franqueados`**
   - Cadastro de franqueados

9. **`sirene_chamados`**, **`sirene_mensagens`**, etc.
   - Sistema de chamados Sirene

10. **`juridico_ticket`**, etc.
    - Sistema jurídico

11. **Outras ~110 tabelas** do sistema (listings, battles, BCA, storage, etc.)

### Migrações SQL:

- **Total**: 121 arquivos de migração
- **Criados por nós**: 4 arquivos (091, 102, 103, 104)
- **Pré-existentes**: 117 arquivos

---

## 8. SISTEMA DE AUTENTICAÇÃO

### Roles (definidos em `profiles.role`):

1. **`admin`**
   - Acesso total
   - Vê todos os cards, processos, franqueados
   - Pode criar/editar/deletar qualquer coisa

2. **`consultor`**
   - Vê processos dos franqueados sob sua supervisão
   - Vê todos os cards de Kanbans (no Funil Step One)
   - Pode criar/editar cards

3. **`frank`** (franqueado)
   - Vê apenas seus próprios processos e cards
   - Pode criar/editar seus cards
   - Acesso limitado

4. **`supervisor`**
   - Role específico para algumas funcionalidades
   - Acesso intermediário

### Arquivos de Autenticação:

1. **`lib/supabase/client.ts`** - Cliente para client components
2. **`lib/supabase/server.ts`** - Cliente para server components
3. **`lib/supabase/admin.ts`** - Cliente admin (bypass RLS)
4. **`lib/supabase/middleware.ts`** - Middleware de autenticação
5. **`middleware.ts`** - Middleware global do Next.js
6. **`lib/auth-guard.ts`** - Função `guardLoginRequired()`
7. **`lib/authz.ts`** - Verificações de autorização
8. **`lib/access-matrix.ts`** - Matriz de acesso por role

### RLS (Row Level Security):

**Funil Step One** (✅ criado por nós):
- `kanbans`: Leitura pública, escrita admin/consultor
- `kanban_fases`: Leitura pública, escrita admin/consultor
- `kanban_cards`: Franqueado vê/edita só o seu, admin/consultor vê/edita tudo
- `kanban_atividades`: Atividades do card (mesmo RLS do card pai)

**Sistema Antigo** (⚠️ pré-existente):
- `processo_step_one`: User vê só o seu, consultor vê dos seus franqueados, admin vê tudo
- `processo_card_checklist`: Vinculado ao processo pai
- Outras tabelas: RLS complexo com hierarquia de consultores

---

## 9. RESUMO EXECUTIVO

### O QUE CRIAMOS:

✅ **Kanban "Funil Step One"** completo e funcional
✅ **Sistema de atividades vinculadas** aos cards
✅ **Cálculo de SLA em dias úteis** (exclui fins de semana e feriados)
✅ **Modal duas colunas** (histórico + ação atual)
✅ **Tabs Kanban/Painel**
✅ **Filtros de atividades** (Status, Time, Responsável, Ordenação)
✅ **Campo `time` nas atividades** (manhã/tarde/dia todo)
✅ **RLS configurado** para todas as tabelas novas
✅ **10 componentes React/TypeScript**
✅ **4 migrações SQL**
✅ **9 scripts SQL auxiliares**
✅ **10 documentos Markdown**

### O QUE JÁ EXISTIA (e não tocamos):

⚠️ **Sistema de Kanban "Portfolio + Operações"** (~15 colunas, muito complexo)
⚠️ **CardDetalheModal.tsx** (~6000 linhas, modal gigante com muitas features)
⚠️ **TarefasPainelConteudo.tsx** (Painel de Tarefas global do sistema antigo)
⚠️ **processo_card_checklist** (tabela de atividades do sistema antigo)
⚠️ **Sistema de RLS complexo** com hierarquia de consultores
⚠️ **Integração com Autentique** para documentos
⚠️ **Formulários públicos**
⚠️ **~110 outras tabelas** do banco
⚠️ **~117 migrações SQL** antigas

### CONFLITOS IDENTIFICADOS:

1. ⚠️ **Dois sistemas de atividades** não integrados (`kanban_atividades` vs. `processo_card_checklist`)
2. ⚠️ **Dois modais de detalhes** com features diferentes
3. ⚠️ **Dois métodos de cálculo de SLA** (dias úteis vs. dias corridos)
4. ⚠️ **Dois padrões de navegação** (query params vs. state React)
5. ⚠️ **Duas formas de RLS** (simples vs. hierárquica)

### PRÓXIMOS PASSOS SUGERIDOS:

1. **Integrar sistemas de atividades**: Criar view unificada ou modificar Painel de Tarefas
2. **Extrair componentes comuns**: `CommentsList`, `ChecklistSection`, etc.
3. **Padronizar navegação**: Migrar sistema antigo para query params
4. **Unificar cálculo de SLA**: Aplicar dias úteis também ao sistema antigo (se possível)
5. **Implementar "Painel" do Funil Step One**: Dashboard/métricas específicas

### CUIDADOS AO IMPLEMENTAR NOVAS FUNCIONALIDADES:

- ⚠️ **NÃO modificar `CardDetalheModal.tsx`** sem revisar impacto (muito complexo)
- ⚠️ **NÃO modificar `processo_card_checklist`** (sistema em produção)
- ⚠️ **NÃO modificar RLS do sistema antigo** (pode quebrar permissões)
- ✅ **SEMPRE testar RLS** antes de deploy (usar diferentes roles)
- ✅ **SEMPRE usar migrations idempotentes** (IF NOT EXISTS, etc.)
- ✅ **SEMPRE documentar mudanças** em arquivos Markdown

---

## 10. ARQUIVOS LEGADOS QUE O USUÁRIO MENCIONOU

O usuário pediu especificamente para analisar estes arquivos (que são do sistema antigo):

1. **`CardDetalheModal.tsx`** ✅ Encontrado em `src/app/steps-viabilidade/CardDetalheModal.tsx`
   - Modal gigante (~6000 linhas)
   - Sistema antigo de checklist com múltiplos times/responsáveis
   - Integração com Autentique, formulários públicos, etc.

2. **`TarefasPainelConteudo.tsx`** ✅ Encontrado em `src/app/steps-viabilidade/tarefas/TarefasPainelConteudo.tsx`
   - Painel de Tarefas global
   - Lista atividades de `processo_card_checklist`
   - Filtros complexos

3. **`atividade-times-responsaveis.ts`** ✅ Encontrado em `src/lib/atividade-times-responsaveis.ts`
   - Normalização de arrays de times/responsáveis
   - Usado no sistema antigo

4. **`painel-tarefas-filtros.ts`** ✅ Encontrado em `src/lib/painel-tarefas-filtros.ts`
   - Lógica de filtros do painel de tarefas antigo
   - Funções de busca e ordenação

**⚠️ IMPORTANTE**: Estes arquivos fazem parte do sistema antigo e JÁ existiam. NÃO foram criados ou modificados por nós nesta sessão.

---

## CONCLUSÃO

O projeto Moni-Fly tem **dois sistemas de Kanban paralelos**:

1. **Sistema NOVO** (Funil Step One) - ✅ Criado por nós, simples, moderno, dias úteis
2. **Sistema ANTIGO** (Portfolio + Operações) - ⚠️ Pré-existente, complexo, muitas features

Ambos funcionam de forma **independente** e **não há conflitos diretos** entre eles. Mas há **duplicação de funcionalidades** e **falta de integração**.

Antes de implementar qualquer coisa nova, é essencial:
- ✅ Entender qual sistema será afetado (novo ou antigo)
- ✅ Verificar se há features equivalentes no outro sistema
- ✅ Avaliar se a mudança deve ser aplicada em ambos
- ✅ Testar RLS e permissões com diferentes roles
- ✅ Documentar tudo

**FIM DO RELATÓRIO**
