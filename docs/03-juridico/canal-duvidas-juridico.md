# Canal de Dúvidas Jurídicas

> Domínio: 03-juridico

## Funcionalidade

Tickets de dúvidas do franqueado com kanban interno Moní, anexos e e-mail via Resend.

## Onde funciona

| Papel | Rota |
|-------|------|
| Frank | `/juridico`, `/juridico/nova`, `/juridico/[id]` |
| Moní | `/juridico/kanban` |

## Banco

`juridico_tickets`, `juridico_ticket_comentarios`, `juridico_ticket_anexos`, `juridico_documentos`

**Migrations:** `009_juridico_canal_duvidas.sql` … `012_juridico_ticket_email_frank.sql`

**Storage:** bucket `juridico-anexos` — ver [STORAGE_JURIDICO_POLICIES.md](../STORAGE_JURIDICO_POLICIES.md)

## Referência legada

[PASSO_A_PASSO_JURIDICO.md](../PASSO_A_PASSO_JURIDICO.md)


