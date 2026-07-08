# Objetivos e Indicadores

> Última atualização: 2026-07-07 | Domínio: 07-carometro

## Funcionalidade

Cadastro de objetivos por área e indicadores (KPIs) com metas por ciclo, semáforo e flag de indicador-chave.

## Objetivo

Estruturar metas mensuráveis e acompanhar atingimento por semana/ciclo.

## Onde funciona

- `/carometro/objetivos`
- `/carometro/indicadores`
- `/carometro/status-preenchimento`

## Banco

| Tabela | Campos-chave |
|--------|--------------|
| `objetivos` | `area_id`, `descricao`, `tipo`, `status`, `objetivo_pai_id`, `publicado` |
| `indicadores` | `objetivo_id`, `is_chave`, `semaforo_faixas` |
| `status_preenchimento_registros` | entrega de preenchimento |

## Componentes

- `src/utils/semaforoFaixas.js`
- `src/utils/metaCiclo.js` — prazo S{n}, recorrente vs atingível

## Próximas melhorias

- [ ] TODO: regras de publicação de objetivos
- [ ] TODO: hierarquia `objetivo_pai_id` com exemplos
