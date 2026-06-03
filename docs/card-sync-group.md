# Sincronização de dados entre cards vinculados

MVP server-side: quando um campo compartilhado é alterado em um card, o valor é propagado para todos os cards do **grupo de sync**.

Implementação: `src/lib/kanban/card-sync-group.ts`

## O que define "vinculado" (grupo de sync)

União transitiva de três relações:

1. **`kanban_card_vinculos`** — arestas bidirecionais (qualquer `tipo_vinculo`, inclusive manual no modal Relacionamentos).
2. **Cadeia `origem_card_id`** — sobe até a raiz e inclui todos os filhos (bastões automáticos / esteiras filhas).
3. **Mesmo `processo_step_one`** — card shadow (`kanban_cards.id = processo.id`) + cards nativos com `projeto_id = processo.id`.

**Não entram automaticamente:** cards que só compartilham `projeto_id` (esteiras paralelas) sem vínculo ou origem; tags; chamados/atividades.

## Campos sincronizados

### `kanban_cards` (replicados em todo o grupo)

| Campo | Descrição |
|-------|-----------|
| `titulo` | Recalculado a partir de franquia + condomínio + quadra/lote |
| `rede_franqueado_id` | Franqueado do negócio |
| `nome_condominio` | Nome do condomínio |
| `condominio_id` | FK condomínio |
| `quadra`, `lote` | Identificação do lote |
| `data_reuniao`, `data_followup` | Datas de reunião |

### `processo_step_one` (fonte canônica negócio/pré-obra)

Todos os campos de negócio, links, anexos e datas pré-obra listados em `PROCESSO_CAMPOS_SYNC` no módulo. Ao salvar processo, condomínio/franqueado espelham nos cards do grupo.

### Permanecem por funil/card (não sync)

`fase_id`, `kanban_id`, `status`, `concluido`, `arquivado`, `ordem_coluna`, `origem_card_id`, `projeto_id`, flags de bastão (`credito_*_ok`, `acoplamento_concluido`), SLA/docs Crédito Obra, **tags**, checklist por fase, chamados.

## Pontos de save integrados

- `kanban-card-condominio.ts` — vincular/cadastrar condomínio, quadra/lote
- `card-actions.ts` — pré-obra, anexo negócio, franqueado vinculado, info do grupo
- `kanban-card-modal-detalhes.ts` — `updateProcessoNegocioCampos` (negócio)
- `links-bca-acoplamento-sync.ts` — Gbox/Acoplamento (já existia)

## Leitura canônica

No modal, após carregar o card, campos compartilhados de `kanban_cards` são sobrescritos pelos valores do **card primário** (raiz da cadeia `origem_card_id` no grupo). Dados de negócio/pré-obra continuam resolvidos via `processo_step_one` + rede.

## Anti-loop

A propagação faz `UPDATE` direto no banco via admin client; **não** reinvoca server actions de save. Uma única escrita na origem dispara N updates nos peers.

## Limitações (MVP)

- Tags não sincronizam.
- Cards só ligados por `projeto_id` (esteiras paralelas sem vínculo) não entram no grupo.
- Cards legados (`v_processo_como_kanban_cards`) sincronizam via `processo_step_one`; shadow pode precisar existir em `kanban_cards` para vínculos FK.
- Resolução de processo segue heurística existente (`projeto_id` → `processo_step_one.id` → rede).

## Exemplo FK0016

Processo principal + filhos em funis paralelos (Portfolio → Acoplamento/Jurídico): conectados por `origem_card_id` e/ou `kanban_card_vinculos`. Alterar condomínio ou negócio em qualquer card do grupo reflete nos demais.
