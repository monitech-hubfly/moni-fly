# Comentários e Timeline

> Domínio: 04-kanban

## Funcionalidade

Comentários no card e histórico auditável de movimentações.

## Banco

| Tabela | Uso |
|--------|-----|
| `kanban_card_comentarios` | Comentários |
| `kanban_historico` | Triggers: criado, fase_avancada, etc. |
| `kanban_card_cronologia` | Migration 125 |

**Migration:** `321_kanban_card_comentarios_card_id_nullable.sql`


