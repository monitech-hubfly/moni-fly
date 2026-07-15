# Funil Divify (Moní Capital)

> Domínio: 02-operacoes

## Funcionalidade

Captação privada via plataforma Divify — funil interno com 9 colunas no board:

1. **Recebimento** (entrada do bastão Portfólio) — SLA 1 DU
2. **Abertura da SPE e Imagens** — SLA 3 DU
3. **Abertura de Conta Bancária da SPE (digital)** — SLA 3 DU
4. **Cadastro na plataforma** — SLA 2 DU
5. **Materiais do projeto** — SLA 2 DU
6. **Informações obrigatórias para subir a oferta** — SLA 2 DU
7. **Formalização / Contrato** — SLA 2 DU
8. **Oferta publicada** (conclusão) — sem SLA
9. **Não elegível** (desfecho paralelo → `capital_ok`) — sem SLA

Total estimado do fluxo operacional (fases 2–7): 14 dias úteis sequenciais.

## Onde funciona

`/funil-moni-capital` (sidebar: Funil Divify)

**Kanban UUID:** `724aef36-37de-4454-bf6f-ec481693aeeb` (`KANBAN_IDS.MONI_CAPITAL`)

## Migrations

| Migration | Conteúdo |
|-----------|----------|
| `264_funil_moni_capital_fases_instrucoes.sql` | Fases e instruções iniciais |
| `420_rename_funis_divify_cash_me.sql` | Renomeação Moní Capital → Divify |
| `464_funil_divify_fases_checklist.sql` | Conta bancária, SLAs úteis, checklist por fase |

## Bastões

- **Entrada:** Portfólio `captacao_moni_capital` → `capital_recebimento`
- **Saída:** `capital_concluido` ou `capital_nao_elegivel` → flag `capital_ok` no card pai
- **Internos (checklist):** CNPJ SPE → conta ativa → perfil emissor → materiais+dados → contrato+pagamento (R$ 2.500) → oferta (mín. 1h)

## Plataforma

- URL: https://monicapital.divify.com.br/
- Cadastro inicial como investidor; Moní converte para emissor
- Máx. 50 investidores; valores múltiplos de R$ 10

## Componentes / actions

- Board: `renderKanbanDatabasePage` (shared)
- Cadastros Funding vinculados: `src/lib/actions/kanban-moni-capital-cadastro.ts`
- Slugs: `FASE_SLUGS.CAPITAL_*` em `src/lib/constants/kanban-ids.ts`
