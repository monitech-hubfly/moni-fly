# Rede de Franqueados

> Última atualização: 2026-07-07 | Domínio: 08-rede-frank

## Funcionalidade

Cadastro e gestão da rede de franqueados, com importação CSV e vínculo a processos Kanban (Step One).

## Objetivo

Manter base única de franqueados referenciada por funis, Carômetro e portal Frank.

## Onde funciona

- `/rede-franqueados/[id]`
- Referenciado em cards Step One (`rede_franqueado_id`, título com `n_franquia`)

## Banco

- Tabela: `rede_franqueados`
- Migration: `026_rede_franqueados.sql`
- Vínculos: `processo_step_one.origem_rede_franqueados_id`, `kanban_cards.rede_franqueado_id`

## Scripts

- `npm run rede-franqueados:import -- arquivo.csv`
- `npm run db:types` após migration

## Documentação legada

Ver [REDE_FRANQUEADOS.md](../REDE_FRANQUEADOS.md) para passo a passo completo de setup e import.

## Próximas melhorias

- [ ] TODO: campos da tabela e regras de `n_franquia`
- [ ] TODO: fluxo de criação de card Step One a partir da rede
