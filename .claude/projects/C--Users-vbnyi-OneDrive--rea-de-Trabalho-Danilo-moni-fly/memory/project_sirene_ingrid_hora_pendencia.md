---
name: sirene-ingrid-hora-pendencia
description: Sirene da Ingrid Hora mostra 3 no Backlog mas ela tem 13 tópicos abertos — investigar divergência de filtro
metadata:
  type: project
---

Ingrid Hora (profile_id 61f38c03-9e86-47c8-95fa-5cb64e371674) aparece com 3 itens Sirene no Backlog, mas tem 13 tópicos em sirene_topicos com status em aberto.

**Por:** divergência entre a query SQL manual e a query real do useBacklog.ts.

**Hipóteses a investigar:**
1. Sirene usa `responsavel_id` direto (não depende de nome/area_pessoas) — confirmar se os 13 tópicos têm `responsavel_id = Ingrid's profile_id` ou se estão vinculados via `responsaveis_ids` (array) que pode estar com `.cs.{X}` — verificar se `responsaveis_ids` existe em `sirene_topicos`
2. Filtro `arquivado = false` + `status IN ('nao_iniciado', 'em_andamento')` pode estar excluindo tópicos que a query manual não filtrava
3. `responsaveis_ids` em `sirene_topicos` existe e está preenchido para ela, mas o filtro `.or('responsavel_id.eq.X,responsaveis_ids.cs.{X}')` pode estar falhando (similar ao bug de kanban_cards.responsaveis_ids ausente)

**Onde investigar:**
- `useBacklog.ts` linha ~100: query em `sirene_topicos` com `.or('responsavel_id.eq.X,responsaveis_ids.cs.{X}')`
- Verificar se `sirene_topicos.responsaveis_ids` existe em PROD
- Comparar os 13 IDs da query manual com os 3 retornados

**How to apply:** Retomar após validar os fixes de tag Especial e cor em PROD. Não urgente — é a mesma classe de problema que area_pessoas/Ingrid Hora já identificada.
