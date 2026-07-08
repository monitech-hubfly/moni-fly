# Funil Operações

> Domínio: 02-operacoes

## Funcionalidade

Pré-obra, tranches, abertura automática Cash Me, campos `prev_*`.

## Onde funciona

`/operacoes`

**Migration:** `398_funil_operacoes_remove_fase_sondagem.sql`, `400_operacoes_sla_tipo_habite_se.sql`

## Banco

`kanban_operacoes_tranche_vinculos` — presets Operações → Crédito Obra

## Componentes

`src/lib/actions/operacoes-tranche-vinculos.ts`


