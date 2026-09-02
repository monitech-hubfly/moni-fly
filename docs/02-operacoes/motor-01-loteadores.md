# Funil Loteadores (esteira v1.0)

> Domínio: 02-operacoes  
> **Atenção:** no Hub, Funil Loteadores ≠ Funil Motor 01 (`/funil-motor01`, slugs `m1_*`). Doc antiga chamava Loteadores de “Motor 01” — nomenclatura legada.

## Funcionalidade

Qualificação de loteadores: primeiro contato → parceria, com NDA/opção/ficha no início, viabilidade, acoplamento, comitê, diligência, showroom e passagem Waysers.

## Onde funciona

- `/loteadores` (principal)
- `/funil-moni-inc` (alias)
- Form externo: `/loteador/[token]`
- Painel: `/loteadores?tab=painel`

**Kanban:** `Funil Loteadores` — `KANBAN_IDS.LOTEADORES` (`3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c`)

**Gate Comitê:** exige `acoplamento_concluido === true` (esteira Acoplamento + Gbox).

**Bastão Acoplamento:** ao entrar em `acoplamento_moni_inc` **ou** `acoplamento_gbox_moni_inc`.

## Fases (ordem 1–20)

| # | Nome | Slug |
|---|------|------|
| 1 | Primeiro Contato | `primeiro_contato_moni_inc` |
| 2 | R1 Conceito | `r1_conceito_moni_inc` |
| 3 | NDA | `nda_moni_inc` |
| 4 | Opção | `opcao_moni_inc` |
| 5 | Aguardando Ficha | `aguardando_ficha_moni_inc` |
| 6 | Novo Produto | `novo_produto_moni_inc` |
| 7 | Viabilidade / Premissas | `viabilidade_moni_inc` |
| 8 | Acoplamento | `acoplamento_moni_inc` |
| 9 | Executar Material | `execucao_material_moni_inc` |
| 10 | Validação | `validacao_moni_inc` |
| 11 | R2 Apresentação | `r2_plano_teorico_moni_inc` |
| 12 | Revisões + Forma Pgto | `revisoes_moni_inc` |
| 13 | Acoplamento + Gbox | `acoplamento_gbox_moni_inc` |
| 14 | Comitê | `comite_moni_inc` |
| 15 | Revisões (pós-Comitê) | `revisoes_pos_comite_moni_inc` |
| 16 | Cto c/ Precedentes | `cto_precedentes_moni_inc` |
| 17 | Diligência | `diligencia_moni_inc` |
| 18 | Cto Showroom | `cto_showroom_moni_inc` |
| 19 | Passagem para Waysers | `passagem_waysers_moni_inc` |
| 20 | Cto de Parceria | `contrato_parceria_moni_inc` |

Fases legado desativadas (cards movidos na 511): Batalha de Casas, R3, Moní Capital, Abertura SPE.

## Confirmações «Assinou?»

Ao sair de: Opção, Cto c/ Precedentes, Cto Showroom, Cto de Parceria → colunas `loteadores_*_assinad*` em `kanban_cards`.

## Banco

`rede_loteador_id`, `kanban_loteador_externo_tokens`, RLS staff em `rede_loteadores` (Frank só visualiza).

**Migrations esteira v1:** `511_funil_loteadores_esteira_v1.sql`, `512_funil_loteadores_checklists_v1.sql`

## Código

- `src/lib/kanban/funil-loteadores.ts`
- `src/lib/kanban/loteadores-*.ts`
- `src/lib/kanban/loteadores-confirmacao-fase.ts`
- `src/lib/constants/kanban-ids.ts` (`FASE_SLUGS.LOTEADORES_*`)
