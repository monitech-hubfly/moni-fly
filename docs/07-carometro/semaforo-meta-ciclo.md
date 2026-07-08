# Semáforo e Meta por Ciclo

> Última atualização: 2026-07-07 | Domínio: 07-carometro

## Funcionalidade

Cálculo de status verde/amarelo/vermelho por indicador e prazo de meta no ciclo S{n}.

## Objetivo

Padronizar leitura visual de atingimento de metas em dashboards e grades.

## Componentes

- `src/utils/semaforoFaixas.js` — cores, escalas, semáforo
- `src/utils/metaCiclo.js` — prazo S{n}, recorrente vs atingível

## Regras de negócio

- Priorizar `semaforo_faixas` jsonb na tabela do indicador
- Fallback: colunas `regra_verde_*` / `regra_amarelo_*`

## Próximas melhorias

- [ ] TODO: exemplos de `semaforo_faixas` por tipo de indicador
