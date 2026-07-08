# Tags, Vínculos e Chamados

> Domínio: 04-kanban

## Funcionalidade

Tags customizadas, vínculos card↔card e ligação com Sirene.

## Banco

| Tabela | Uso |
|--------|-----|
| `kanban_tags`, `kanban_card_tags` | Tags |
| `kanban_card_vinculos` | Relacionamentos |
| `kanban_atividades.sirene_chamado_id` | Link Sirene |

**Migrations:** `170_kanban_tags.sql`, `130_vinculos_cards.sql`, `164_kanban_atividades_sirene_chamado_id.sql`

## Deep link

`src/lib/kanban/kanban-card-href.ts`


