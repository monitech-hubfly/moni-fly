# Tópicos e Subinterações

> Domínio: 05-sirene

## Funcionalidade

Tópicos por chamado; unificação com `kanban_atividades` como subinterações.

## Banco

`sirene_topicos` — `interacao_id`, `times_ids`, `responsaveis_ids`, `aprovado_bombeiro`

**Migrations:** `118_subinteracoes.sql`, `120_migrar_sirene_chamados_kanban_atividades.sql`, `225_sirene_unificar_topicos.sql`

## Integração Kanban

`kanban_atividades.origem = 'sirene'`, `sirene_chamado_id` único


