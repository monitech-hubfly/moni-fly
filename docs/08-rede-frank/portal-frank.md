# Portal Frank

> Última atualização: 2026-07-07 | Domínio: 08-rede-frank

## Funcionalidade

Interface do franqueado: acesso restrito aos próprios processos, alertas e documentos.

## Objetivo

Dar ao franqueado (`profiles.role = frank`) visão segura e simplificada do Hub Fly.

## Onde funciona

- Rota: `/portal-frank`
- Auth: `profiles.role` = `frank`

## Regras de negócio

- RLS garante que frank vê apenas dados próprios ou vinculados
- Permissões: ver `docs/01-hub-fly/permissoes-acesso.md` e `MATRIZ_ACESSO_USUARIOS.md`

## Próximas melhorias

- [ ] TODO: mapa de telas disponíveis para frank vs consultor
- [ ] TODO: fluxo de onboarding do franqueado
