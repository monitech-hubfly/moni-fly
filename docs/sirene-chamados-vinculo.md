# Vínculo Sirene ↔ Cards ↔ Kanban Pastéis (To Do)

Documento de contrato para integração futura (Danilo).

## Número global do chamado

- Coluna **`kanban_atividades.numero`** — sequência `sirene_numero_seq`, gerada na abertura (DEFAULT)
- Formato de exibição: **`#0001`** (`formatChamadoNumero` em `src/lib/kanban/chamado-numero.ts`)
- Chamados Sirene: `sirene_chamados.numero` e `kanban_atividades.numero` ficam sincronizados na criação
- Kanban Pastéis (fase Danilo): cards de execução devem exibir `kanban_atividades.numero` do chamado pai da atividade

## Modelo unificado

- **Cabeçalho:** `kanban_atividades` (título, descrição, categoria, status, `origem`, `card_id` opcional, `sirene_chamado_id` opcional)
- **Atividades:** `sirene_topicos` sempre via `interacao_id`
- **Metadados Sirene:** `sirene_chamados` (#numero, aberto_por, card vinculado)

## Três fontes

| Fonte | `origem` | `card_id` | Edição na Sirene |
|-------|----------|-----------|------------------|
| Card funil | nativo/legado | sim | Não (somente leitura) |
| Sirene livre | sirene | não | Sim |
| Sirene + card | sirene | sim | Não (editar no card) |

## Kanban Pastéis (fase Danilo)

Cada **atividade** (`sirene_topicos.id`) gera um card por **responsável** no Kanban de Chamados/Pastéis do usuário (página To Do).

Tabela sugerida:

```sql
-- futura
sirene_pastel_atividade_cards (
  atividade_id bigint REFERENCES sirene_topicos(id),
  user_id uuid REFERENCES profiles(id),
  prazo_estipulado date,
  coluna text,
  PRIMARY KEY (atividade_id, user_id)
)
```

### Sincronização bidirecional

- Status, redirecionamento (`historico` tipo `Redirecionado`), comentários e prazo estipulado no Pastéis → refletem na Sirene e no card/modal kanban
- Redirecionar responsável move o card do Kanban do usuário A para o B
- Tags visuais: **Trava** (vermelha), **Pastel** (amarela) conforme checkboxes na criação/edição da atividade
- Usuário só vê atividades onde é responsável
- **Não** é permitido abrir chamado direto pelo Kanban Pastéis — apenas via card funil ou Sirene

### Pontos de extensão já no schema (223+)

- `sirene_topicos.nome`, `descricao_detalhe`, `pastel`, `historico`, `data_fim` (prazo limite)
- Notificações centralizadas em `alertas` via `chamados-notificacoes.ts`
