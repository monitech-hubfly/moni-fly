# Hierarquia Frank / Consultor / Supervisor

> Última atualização: 2026-07-07 | Domínio: 08-rede-frank

## Funcionalidade

Modelo de papéis para ~150 usuários: franqueado, consultor, supervisor e admin.

## Objetivo

Garantir que cada login veja apenas o escopo permitido pela hierarquia.

## Banco

- `profiles.role`: `frank`, `consultor`, `supervisor`, `admin`, `team`
- RLS em tabelas sensíveis (processos, rede, alertas)

## Documentação relacionada

- [permissoes-acesso.md](../01-hub-fly/permissoes-acesso.md)
- [MATRIZ_ACESSO_USUARIOS.md](../MATRIZ_ACESSO_USUARIOS.md)
- [ESCALA_E_PLANEJAMENTO.md](../ESCALA_E_PLANEJAMENTO.md)

## Regras de negócio

- `isAdmin` vem de `profiles.role` — nunca localStorage
- Consultor vê processos dos franqueados vinculados; admin vê tudo

## Próximas melhorias

- [ ] TODO: matriz consultor → franqueados vinculados
- [ ] TODO: diferenças de UI por papel na home
