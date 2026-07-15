# Funil Divify (Moní Capital)

> Domínio: 02-operacoes  
> Versão Hub Fly: migration `464` (fases + checklist) + `465` (nomes/instruções)

## Resumo

9 fases · 33 campos de checklist · SLAs em dias úteis · PROD não alterado sem confirmação.

| # | Nome | Slug Hub Fly | SLA | Checklist |
|---|------|--------------|-----|-----------|
| 1 | Recebimento | `capital_recebimento` | 1 DU | — |
| 2 | Abertura da SPE e Imagens | `capital_abertura_spe` | 3 DU | 6 |
| 3 | Conta Bancária | `capital_abertura_conta` | 3 DU | 4 |
| 4 | Cadastro na plataforma | `capital_cadastro_plataforma` | 2 DU | 4 |
| 5 | Materiais do projeto | `capital_materiais_projeto` | 2 DU | 6 |
| 6 | Informações obrigatórias | `capital_informacoes_obrigatorias` | 2 DU | 5 |
| 7 | Formalização / Contrato | `capital_formalizacao` | 2 DU | 5 |
| 8 | Oferta publicada | `capital_concluido` | — | 3 |
| 9 | Não elegível | `capital_nao_elegivel` | — | — |

Total estimado (fases 1–7): **15 dias úteis** sequenciais.

> **Slugs:** não usar abreviações (`capital_cadastro`, `capital_ok` como fase, etc.).  
> `capital_ok` é a **flag** no card pai ao sair por `capital_concluido` ou `capital_nao_elegivel`.

## Onde funciona

`/funil-moni-capital` (sidebar: Funil Divify)  
UUID: `724aef36-37de-4454-bf6f-ec481693aeeb` (`KANBAN_IDS.MONI_CAPITAL`)

## Bastões

| Fluxo | Detalhe |
|-------|---------|
| Entrada | Portfólio `captacao_moni_capital` → `capital_recebimento` |
| Saída OK | `capital_concluido` → flag `capital_ok` |
| Saída descarte | `capital_nao_elegivel` → flag `capital_ok` |
| Internos | CNPJ SPE → conta → perfil emissor → materiais+dados → contrato+pagamento (R$ 2.500, mín. 1h) |

## Plataforma

- URL: https://monicapital.divify.com.br/
- Cadastro como investidor; Moní converte para emissor
- Máx. 50 investidores; valores múltiplos de R$ 10
- Taxa de publicação: R$ 2.500

## Responsáveis (padrão)

| Fase | Principal |
|------|-----------|
| Recebimento, Materiais, Formalização, Oferta, Não elegível | Moní |
| SPE, Conta, Informações | Emissor (franqueado) |
| Cadastro | Emissor (cria) + Moní (perfil emissor) |

## Arquivos

- Board: `renderKanbanDatabasePage` (shared)
- Slugs: `FASE_SLUGS.CAPITAL_*` em `src/lib/constants/kanban-ids.ts`
- Cadastros Funding: `src/lib/actions/kanban-moni-capital-cadastro.ts`
- Colunas sem subtítulo de instruções: `KanbanColumn.tsx` (Divify)

## Fora de escopo

App Next isolado / Zustand / prompts scaffold `divify-moni` — o funil vive no Hub Fly.
