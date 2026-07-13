# Pastelaria

> Última atualização: 2026-07-07 | Domínio: 07-carometro

## Funcionalidade

Módulo de mapeamento e operação Pastelaria — integração com dados operacionais via API routes dedicadas.

## Objetivo

Expor dados Pastelaria de forma segura, sem acesso direto ao Supabase no client.

## Onde funciona

- UI: `/carometro/pastelaria`
- Admin: `/admin/pastelaria/mapeamento`
- API: `/api/pastelaria/*`

## Regras de negócio

- **Sempre** usar API routes (`/api/pastelaria/*`) — não Supabase client direto no front

## Próximas melhorias

- [ ] TODO: listar endpoints `/api/pastelaria/*` com payloads
- [ ] TODO: fluxo de mapeamento admin
