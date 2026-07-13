# Gantt — Planejamento Semanal

> Última atualização: 2026-07-07 | Domínio: 07-carometro

## Funcionalidade

Grade de planejamento por semana ISO, vinculando atividades a objetivos, franqueados e backlog operacional.

## Objetivo

Permitir planejamento e acompanhamento semanal das atividades de cada área/time.

## Onde funciona

- Rota: `/carometro/gantt`
- Componente principal: `src/app/carometro/gantt/page.tsx`

## Banco

- Tabela: `gantt_planejamento`
- Colunas relevantes: `semana`, `objetivo_id`, `portfolio_franqueado_id`, `status`, `tipo`

## Componentes

- `src/app/carometro/gantt/page.tsx`
- `src/utils/periodos.js` — semanas ISO, labels, normalização

## Regras de negócio

- Semana no banco vs. exibição: usar `semanaDbParaIsoNaGrade`
- Vínculo com franqueado: `portfolio_franqueado_id` → `rede_franqueados`

## Próximas melhorias

- [ ] TODO: documentar tipos de atividade e cores na grade
- [ ] TODO: fluxo de criação/edição de linha no Gantt
