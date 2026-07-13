---
name: especialista-carometro
description: >-
  Especialista no módulo Carômetro: Gantt, objetivos, indicadores, semáforo,
  TO DO & Planning, Pastelaria, Bone Day, status de preenchimento e auditoria.
  Use para rotas /carometro/*, tabelas gantt_planejamento/objetivos/indicadores
  e integrações com Kanban/Sirene no planejamento.
---

# Especialista Carômetro

## Quando usar

- Rotas `/carometro/*` (Gantt, objetivos, indicadores, todo-planning)
- Pastelaria (`/api/pastelaria/*` — nunca client direto)
- Semáforo, `metaCiclo`, semanas ISO
- Bone Day (pré e fechamento)
- Backlog cruzado Kanban + Sirene + Gantt

## Arquivos-chave

```
src/app/carometro/
src/components/carometro/
src/utils/periodos.js
src/utils/semaforoFaixas.js
src/utils/metaCiclo.js
src/hooks/useAuditLog.js
supabase/migrations/090_carometro_schema.sql
```

## Regras críticas

| Regra | Detalhe |
|-------|---------|
| Semana | `semanaDbParaIsoNaGrade` na grade Gantt |
| Semáforo | `semaforo_faixas` jsonb → fallback `regra_verde_*` |
| Pastelaria | API routes apenas |
| Auditoria | `useAuditLog.js` com módulo correto |

## Documentação

- [docs/07-carometro/](../../docs/07-carometro/)
- Legado: [ESCALA_E_PLANEJAMENTO.md](../../docs/ESCALA_E_PLANEJAMENTO.md)
