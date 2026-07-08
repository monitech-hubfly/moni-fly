# Manual Interno — Casa Moní Hub Fly

Manual de referência para engenharia, produto e onboarding. Organizado por **8 domínios de especialista**, alinhados aos Cursor Agent Skills em `.cursor/skills/`.

## Como usar

1. **Onboarding:** comece em [onboarding/README.md](onboarding/README.md).
2. **Por domínio:** escolha a pasta abaixo conforme a tarefa.
3. **Nova funcionalidade:** copie [_template-funcionalidade.md](_template-funcionalidade.md).
4. **Cursor:** invoque o skill do domínio (ex.: `especialista-hub-fly-kanban`) para contexto focado.

## Domínios

| # | Domínio | Pasta | Skill Cursor |
|---|---------|-------|--------------|
| 1 | Hub Fly (plataforma) | [01-hub-fly/](01-hub-fly/) | `especialista-hub-fly` |
| 2 | Operações / funis | [02-operacoes/](02-operacoes/) | `especialista-operacoes` |
| 3 | Jurídico | [03-juridico/](03-juridico/) | `especialista-juridico` |
| 4 | Kanban | [04-kanban/](04-kanban/) | `especialista-hub-fly-kanban` |
| 5 | Sirene | [05-sirene/](05-sirene/) | `especialista-sirene` |
| 6 | Produto Casa Moní | [06-produto/](06-produto/) | `especialista-produto-casa-moni` |
| 7 | Carômetro | [07-carometro/](07-carometro/) | `especialista-carometro` |
| 8 | Rede / Frank | [08-rede-frank/](08-rede-frank/) | `especialista-rede-frank` |

## Outros

- [onboarding/](onboarding/) — primeiro dia, ambientes DEV/PROD
- [referencia/](referencia/) — glossário, índices de código, docs legados

## Documentação legada (raiz `docs/`)

Arquivos anteriores a esta reorganização permanecem na raiz de `docs/` e estão indexados em [referencia/docs-legados.md](referencia/docs-legados.md).

## Convenções

- Idioma: **pt-BR**
- Cores e UI: sempre `src/styles/moni-tokens.css` — nunca hex hardcoded
- Banco DEV: `bgaadvfucnrkpimaszjv.supabase.co` | PROD: `aydryzoxqnwnbybvgiug.supabase.co` (não alterar sem confirmação)
- Migrations: numerar sequencialmente; scripts idempotentes (`IF NOT EXISTS`)

