# Design System Moní

> Domínio: 01-hub-fly

## Funcionalidade

Sistema visual Casa Moní: paleta editorial (Porsche/Vogue/moni.casa), tokens CSS, classes de SLA e utilitários mobile.

## Objetivo

Garantir consistência visual e proibir cores hardcoded ou laranja em qualquer componente.

## Onde funciona

| Contexto | Arquivo |
|----------|---------|
| Tokens globais | `src/styles/moni-tokens.css` |
| Regras permanentes | `.cursorrules` |

## Cores principais (variáveis)

| Uso | Variável | Hex ref |
|-----|----------|---------|
| Primário / headers | `--moni-navy-800` | #0C2633 |
| Portfólio / sucesso | `--moni-green-800` | #2F4A3A |
| Contabilidade / corpo | `--moni-earth-800` | #4A3929 |
| Crédito / SLA atenção | `--moni-gold-400` | #D4AD68 |

## Identidade por Kanban

- Step One: `--moni-kanban-stepone`, `--moni-kanban-stepone-light`
- Portfólio: `--moni-kanban-portfolio`, `--moni-kanban-portfolio-light`
- Contabilidade: `--moni-kanban-contab`, `--moni-kanban-contab-light`
- Crédito: `--moni-kanban-credito`, `--moni-kanban-credito-light`

## Tags SLA (classes prontas)

| Estado | Classe |
|--------|--------|
| Vencendo | `moni-tag-atencao` |
| Vencido | `moni-tag-atrasado` |
| Concluído | `moni-tag-concluido` |
| Arquivado | `moni-tag-arquivado` |

## Regras inegociáveis

- Bordas: `var(--moni-border-width)` (0.5px)
- Cards/modais: `border-radius: var(--moni-radius-lg)` (12px)
- Botões: `var(--moni-radius-md)` (8px)
- Display: `var(--moni-font-display)` | UI: `var(--moni-font-sans)`
- **Nunca laranja**
- Mobile breakpoint: **640px** — classes `moni-kanban-board`, `moni-card-modal-split`, etc.

## Componentes

Todos os componentes novos ou editados devem importar/usar tokens do `moni-tokens.css`.

## Próximas melhorias

- [ ] Storybook ou página de referência visual
<!-- TODO: preencher com compilado de garantias / sessões PDF de design -->


