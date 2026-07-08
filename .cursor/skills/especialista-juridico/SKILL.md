---
name: especialista-juridico
description: >-
  Especialista jurídico Casa Moní: permuta, opção, SPE, patrimônio de afetação,
  SCP, carta fiança, seguro garantia, terrenista, ITBI, contratos, debêntures,
  FIDC, securitização e canal de dúvidas jurídicas. Use para features jurídicas,
  checklists legais, storage jurídico-anexos ou templates de contrato.
---

# Especialista Jurídico

## Implementado no código

| Módulo | Rota | Tabelas |
|--------|------|---------|
| Canal dúvidas | `/juridico` | `juridico_tickets`, `juridico_documentos` |
| Funil Jurídico | `/funil-juridico` | `kanban_cards` (flag `juridico_ok`) |
| Checklist legal | `/public/checklist-legal/[token]` | tokens + storage |

**Migrations:** `009`–`012_juridico_*`, `068_processo_card_checklist_legal`, `209_add_checklists_juridico_contabilidade`

**Storage:** `juridico-anexos` — [docs/STORAGE_JURIDICO_POLICIES.md](../../docs/STORAGE_JURIDICO_POLICIES.md)

## Tópicos estruturais (conteúdo de negócio)

Documentos em [docs/03-juridico/](../../docs/03-juridico/) — maioria com `<!-- TODO: compilado garantias/PDF -->`.

Ao implementar UI para permuta/SPE/SCP: buscar checklists existentes em `src/components/checklist-legal/` antes de criar novo.

## SPE no banco

`320_franqueado_spe.sql`, scripts `scripts/manual/264_*`

