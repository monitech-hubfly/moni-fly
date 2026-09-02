# Contexto: TO DO & Planning — Cards/Kanban Backlog

## Página e seções

`/carometro/todo-planning` tem três seções independentes:
- Sirene / Pastelaria (hook próprio)
- Atividades Planejadas (hook próprio)
- **Cards / Kanban** ← foco deste trabalho (`src/hooks/useBacklogKanban.ts`)

---

## Como funciona o responsável de um card

- `responsavel_id` e `responsaveis_ids` em `kanban_cards`: **sempre nulos** (209/209 auditados). Não usar.
- `franqueado_id`: dono da conta / gerente de relacionamento. Não é o especialista.
- **`responsavel_fase`** = quem aparece como avatar no quadro Kanban = responsável real de execução.

### Resolução do responsavel_fase:

1. **Explícito via checklist:**
   - Tabela `kanban_fase_checklist_respostas` onde `campo_slug IN ('responsavel_fase', 'responsavel_contato', 'responsavel_revisao')`
   - `CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO` em `src/lib/kanban/responsavel-fase-checklist.ts`
   - Validar que `item.fase_id = card.fase_id` (fase ATUAL, não histórica)
   - Relacionamento: `respostas.item_id → kanban_fase_checklist_itens.id` (tem `fase_id` e `campo_slug`)

2. **Fallback por kanban** (`EMAIL_RESPONSAVEL_PADRAO_POR_KANBAN` em `responsavel-fase-checklist.ts`):
   - Portfolio → Renata
   - Loteadores → Helenna
   - Acoplamento / ProjetoLegal / HDM → Elisabete
   - Funding / Divify / Contabilidade/Crédito → Kim
   - Operações / ProjetosLocais / ProjetosLegais → Larissa

3. **Step One especial:** resolvido via `rede_franqueado_id` → perfil candidato

Kanbans SEM entrada no mapa: Step One, Motor01 (e outros não listados).

---

## Lógica desejada no backlog

### Usuário comum (Helenna, Renata, Kim, etc.)
- Ver cards onde ela é `responsavel_fase` (explícito OU default do kanban dela)
- Seção principal: cards com SLA, ordenados por prioridade P1–P6
- Seção expansível **SND — SLA Não Definido**: cards dela sem `sla_dias`

### Ingrid (ingrid.hora@moni.casa)
- Cards regulares onde ela é `responsavel_fase` explícita (atualmente 0 — ela não é especialista)
- **SND global**: TODOS os cards sem `sla_dias`, qualquer funil → para ela cadastrar SLAs
- **SRC global**: cards em kanbans sem default (`KANBANS_SEM_DEFAULT`) sem checklist explícito → para ela atribuir responsáveis

### Regras gerais
- Nunca mostrar `arquivado = true` ou `concluido = true`
- Desconsiderar entradas de fases históricas (`item.fase_id ≠ card.fase_id` atual)
- Card em kanban default com override explícito de OUTRO usuário na fase atual → não aparece para o usuário default

---

## Problema: timeout PostgreSQL código 57014

**Limite:** Supabase cancela queries que ultrapassam o timeout configurado (padrão ~30s no plano free/pro).

### Tentativa 1 (commit 99216da5) — falhou
Usou `enrichCardsComResponsavelFase` sobre todos os 209 cards.
Essa função faz N+1 queries sequenciais: uma `buscarProfileIdPorEmail` por kanban sem assignment explícito → timeout.

### Tentativa 2 (commit 0723e7c0) — ainda falhou
Reescreveu o hook em 3 rounds paralelos buscando primeiro todos os `kanban_fase_checklist_itens` com os slugs responsavel → lista grande de IDs → usava essa lista enorme no `.in('item_id', ...)` → ainda timeout.

### Estado atual do arquivo (modificado via Claude Code)
O hook foi ajustado para inverter a ordem: em vez de buscar todos os item_ids de responsavel e filtrar respostas, busca **minhas respostas diretamente por `valor = profileId`** (resultado pequeno, ~5–200 linhas) e depois valida quais são de itens responsavel.

**O timeout ainda persiste.** Causa exata não identificada na versão atual.

---

## Arquivos relevantes

| Arquivo | Papel |
|---|---|
| `src/hooks/useBacklogKanban.ts` | Hook principal — reescrito, ainda com timeout |
| `src/components/carometro/todo/BacklogKanbanColuna.tsx` | Componente que renderiza a coluna |
| `src/lib/kanban/responsavel-fase-checklist.ts` | `EMAIL_RESPONSAVEL_PADRAO_POR_KANBAN`, `CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO`, `enrichCardsComResponsavelFase` (não usada mais) |
| `src/lib/constants/kanban-ids.ts` | `KANBAN_IDS` — UUIDs de cada kanban |
| `src/components/carometro/todo/SeletorUsuarioAdmin.tsx` | Contexto de simulação — `SimulacaoUsuario` tem campo `email` |

---

## Distribuição auditada dos cards (PROD, 209 total abertos)

Explícito via checklist: ~116 cards
Via default kanban: ~49 cards (não Step One)
Step One (candidatos): ~44 cards
Sem responsável (orphan): poucos

Por usuário aproximado: Renata ~32, Elisabete ~39, Kim ~49, Helenna ~17, Larissa ~25, Rafael ~8, Nathalia ~6

---

## Próximo passo

Diagnosticar qual query específica causa o timeout na versão atual do `useBacklogKanban.ts`.
Estratégia sugerida: adicionar logs de tempo (`console.time`) em cada round, ou testar cada query isoladamente no SQL Editor do Supabase PROD para medir o tempo real de execução.

Antes de qualquer nova implementação: identificar a query culpada com evidência, não presunção.
