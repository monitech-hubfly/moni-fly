# Banco de Dados e Supabase

> Domínio: 01-hub-fly

## Funcionalidade

PostgreSQL hospedado no Supabase com RLS, Storage buckets e Auth.

## Objetivo

Persistir processos, cards Kanban, chamados Sirene, rede de franqueados e auditoria com isolamento por franqueado.

## Ambientes

| Ambiente | Projeto | Uso |
|----------|---------|-----|
| DEV | `bgaadvfucnrkpimaszjv` | Desenvolvimento |
| PROD | `aydryzoxqnwnbybvgiug` | Produção — **não alterar sem confirmação** |

## Convenções

- Scripts temporários: Node.js + `pg` na raiz; deletar após uso
- Não usar `psql` (fora do PATH no Windows)
- Após migration: `NOTIFY pgrst, 'reload schema'`
- Tabela de controle: `supabase_migrations.schema_migrations`
- Pastelaria/Sirene admin: preferir API routes `/api/pastelaria/*`

## Domínios de tabelas (amostra)

| Domínio | Tabelas |
|---------|---------|
| Auth/perfil | `profiles`, `team_members` |
| Kanban | `kanbans`, `kanban_fases`, `kanban_cards`, `kanban_atividades`, … |
| Step One | `processo_step_one`, `etapa_progresso`, `condominios` |
| Rede | `rede_franqueados`, `rede_contatos` |
| Sirene | `sirene_chamados`, `sirene_topicos`, `sirene_notificacoes` |
| Jurídico | `juridico_tickets`, `juridico_documentos` |
| Auditoria | `audit_log` |

## RLS

Padrão: franqueado vê apenas registros com `franqueado_id = auth.uid()`; staff via políticas `staff` / `admin`.

## Referências

- [migrations.md](migrations.md)
- [inventario-kanban-funil-completo.md](../inventario-kanban-funil-completo.md) §2


