# Carômetro — Arquitetura

> Última atualização: 2026-07-07 | Domínio: 07-carometro

## Funcionalidade

Módulo transversal de gestão de performance: áreas, objetivos, indicadores, planejamento semanal (Gantt), backlog operacional e integrações com Kanban/Sirene.

## Objetivo

Centralizar metas, preenchimento de indicadores e planejamento de atividades para todos os times (~150 usuários).

## Onde funciona

| Rota | Página |
|------|--------|
| `/carometro` | Hub do módulo |
| `/carometro/gantt` | Grade Gantt |
| `/carometro/todo-planning` | TO DO & Planning |
| `/carometro/objetivos` | Objetivos e metas |
| `/carometro/indicadores` | Indicadores |
| `/carometro/pastelaria` | Pastelaria (UI) |
| `/carometro/pre-bone-day` | Pré Bone Day |
| `/carometro/fechamento-bone-day` | Fechamento Bone Day |
| `/carometro/status-preenchimento` | Entrega de preenchimento |
| `/carometro/dashboard-geral` | Dashboard geral |
| `/carometro/dashboard-produtos` | Dashboard produtos |
| `/carometro/areas` | Áreas |
| `/carometro/cadastros` | Cadastros auxiliares |
| `/carometro/workload` | Carga de trabalho |
| `/carometro/conquistas` | Conquistas |
| `/carometro/comportamentos-e-atividades` | Comportamentos |
| `/carometro/log` | Log de auditoria do módulo |

## Banco

| Tabela | Uso |
|--------|-----|
| `gantt_planejamento` | Atividades na grade |
| `objetivos` | Metas por área |
| `indicadores` | KPIs vinculados a objetivos |
| `status_preenchimento_registros` | Botão entregar preenchimento |
| `audit_log` | Rastreabilidade (módulo `carometro`) |

Migration marco: `090_carometro_schema.sql`

## Componentes

```
src/components/carometro/
src/app/carometro/
src/utils/periodos.js
src/utils/semaforoFaixas.js
src/utils/metaCiclo.js
src/hooks/useAuditLog.js
```

## Regras de negócio

- Semana: normalizar via `semanaDbParaIsoNaGrade` (`gantt/page.tsx`)
- Semáforo: priorizar `semaforo_faixas` jsonb; fallback `regra_verde_*` / `amarelo_*`
- Pastelaria: usar API routes — não Supabase client direto no front
- Responsável: `profiles.id` (uuid)

## Próximas melhorias

- [ ] Documentar cada sub-rota com screenshots
- [ ] Extrair checklists de `gantt_planejamento` por tipo de atividade
- [ ] Consolidar backlog Sirene + cards Kanban no doc `todo-planning.md`
