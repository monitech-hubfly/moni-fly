# RLS e Permissões Sirene

> Domínio: 05-sirene

## Funcionalidade

Row Level Security por papel Bombeiro, time HDM, criador e admin.

## Banco

**Migrations:** `034_sirene.sql` (RLS base), `427_fix_sirene_topicos_rls_chamado_id_null.sql`, `20260611_323_rls_kanban_card_comentarios_sirene.sql`

## Storage

Bucket `sirene-attachments` (migration 034)

## Funções

`canActAsBombeiro` em `src/lib/sirene.ts`


