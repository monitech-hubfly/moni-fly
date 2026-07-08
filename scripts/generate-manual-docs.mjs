#!/usr/bin/env node
/**
 * Gera estrutura inicial do manual interno Hub Fly.
 * Uso: node scripts/generate-manual-docs.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

function write(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.trimStart() + '\n', 'utf8');
  return rel;
}

const created = [];

// ─── Template ───────────────────────────────────────────────────────────────
created.push(write('docs/_template-funcionalidade.md', `# [Nome da Funcionalidade]

> Última atualização: YYYY-MM-DD | Domínio: [01-hub-fly | 02-operacoes | …]

## Funcionalidade

[O que é, em 2–4 frases.]

## Objetivo

[Por que existe; qual problema de negócio resolve.]

## Onde funciona

| Contexto | Rota / entrada |
|----------|----------------|
| App | \`/rota\` |
| API | \`/api/...\` |
| Público | (se houver) |

## Banco

| Tabela / view | Uso |
|---------------|-----|
| \`tabela\` | … |

**Migrations relevantes:** \`NNN_nome.sql\`

## Componentes

| Arquivo | Papel |
|---------|-------|
| \`src/...\` | … |

## Commits / histórico

<!-- TODO: commits ou PRs de referência -->

## Próximas melhorias

- [ ] …

## Referências

- [doc relacionada](../…)
`));

// ─── docs/README.md ─────────────────────────────────────────────────────────
created.push(write('docs/README.md', `# Manual Interno — Casa Moní Hub Fly

Manual de referência para engenharia, produto e onboarding. Organizado por **6 domínios de especialista**, alinhados aos Cursor Agent Skills em \`.cursor/skills/\`.

## Como usar

1. **Onboarding:** comece em [onboarding/README.md](onboarding/README.md).
2. **Por domínio:** escolha a pasta abaixo conforme a tarefa.
3. **Nova funcionalidade:** copie [_template-funcionalidade.md](_template-funcionalidade.md).
4. **Cursor:** invoque o skill do domínio (ex.: \`especialista-hub-fly-kanban\`) para contexto focado.

## Domínios

| # | Domínio | Pasta | Skill Cursor |
|---|---------|-------|--------------|
| 1 | Hub Fly (plataforma) | [01-hub-fly/](01-hub-fly/) | \`especialista-hub-fly\` |
| 2 | Operações / funis | [02-operacoes/](02-operacoes/) | \`especialista-operacoes\` |
| 3 | Jurídico | [03-juridico/](03-juridico/) | \`especialista-juridico\` |
| 4 | Kanban | [04-kanban/](04-kanban/) | \`especialista-hub-fly-kanban\` |
| 5 | Sirene | [05-sirene/](05-sirene/) | \`especialista-sirene\` |
| 6 | Produto Casa Moní | [06-produto/](06-produto/) | \`especialista-produto-casa-moni\` |

## Outros

- [onboarding/](onboarding/) — primeiro dia, ambientes DEV/PROD
- [referencia/](referencia/) — glossário, índices de código, docs legados

## Documentação legada (raiz \`docs/\`)

Arquivos anteriores a esta reorganização permanecem na raiz de \`docs/\` e estão indexados em [referencia/docs-legados.md](referencia/docs-legados.md).

## Convenções

- Idioma: **pt-BR**
- Cores e UI: sempre \`src/styles/moni-tokens.css\` — nunca hex hardcoded
- Banco DEV: \`bgaadvfucnrkpimaszjv.supabase.co\` | PROD: \`aydryzoxqnwnbybvgiug.supabase.co\` (não alterar sem confirmação)
- Migrations: numerar sequencialmente; scripts idempotentes (\`IF NOT EXISTS\`)
`));

// Helper for feature docs
function feat(title, domain, sections) {
  return `# ${title}

> Domínio: ${domain}

${sections}
`;
}

const hubFlyDocs = {
  '01-hub-fly/README.md': `# Hub Fly — Plataforma

Documentação transversal: arquitetura, design system, permissões, banco, migrations, deploy e componentes compartilhados.

## Índice

| Documento | Conteúdo |
|-----------|----------|
| [arquitetura.md](arquitetura.md) | Stack, App Router, pastas-chave |
| [design-system.md](design-system.md) | moni-tokens.css, regras visuais |
| [permissoes-acesso.md](permissoes-acesso.md) | profiles.role, matriz de rotas |
| [banco-supabase.md](banco-supabase.md) | DEV/PROD, RLS, convenções |
| [migrations.md](migrations.md) | Fluxo de migrations (~400+) |
| [deploy-git.md](deploy-git.md) | Branches, PRs, ambiente |
| [componentes-compartilhados.md](componentes-compartilhados.md) | Layout, sidebar, hooks |

**Skill:** \`especialista-hub-fly\`
`,

  '01-hub-fly/arquitetura.md': feat('Arquitetura Hub Fly', '01-hub-fly', `## Funcionalidade

Plataforma **Next.js 14** (App Router) + **TypeScript** + **Tailwind** + **Supabase** (Auth, PostgreSQL, Storage, RLS) para gestão de franquias Casa Moní: funis Kanban, Step One, Sirene, Carômetro, portal do franqueado.

## Objetivo

Centralizar operações de novos negócios, crédito, jurídico, produto e atendimento em um único hub com permissões por papel.

## Onde funciona

| Contexto | Caminho |
|----------|---------|
| App principal | \`src/app/\` |
| Server actions / lib | \`src/lib/\` |
| Componentes UI | \`src/components/\` |
| Migrations | \`supabase/migrations/\` |
| Regras Cursor | \`.cursor/rules/\`, \`.cursorrules\` |

## Estrutura de pastas (resumo)

\`\`\`
src/app/           # Rotas por módulo (funil-*, sirene, portfolio, …)
src/components/    # UI compartilhada + kanban-shared/
src/lib/           # actions, kanban/, authz, access-matrix
src/hooks/         # useAuditLog, usePermissoes, …
src/styles/        # moni-tokens.css
supabase/migrations/
docs/              # Este manual
\`\`\`

## Banco

- **DEV:** \`bgaadvfucnrkpimaszjv.supabase.co\`
- **PROD:** \`aydryzoxqnwnbybvgiug.supabase.co\` — alterações somente com confirmação explícita

Tabelas centrais: \`profiles\`, \`kanban_*\`, \`processo_step_one\`, \`rede_franqueados\`, \`sirene_*\`, \`audit_log\`.

## Componentes

| Arquivo | Papel |
|---------|-------|
| \`src/lib/authz.ts\` | Normalização de papéis |
| \`src/lib/access-matrix.ts\` | Prefixos de rota por papel |
| \`src/lib/supabase/middleware.ts\` | Guard de rotas |
| \`src/components/PortalSidebar.tsx\` | Navegação principal |

## Migrations

Ver [migrations.md](migrations.md). Schema base: \`002_idempotent_schema.sql\`, correções RLS: \`003_fix_rls_recursion_profiles.sql\`.

## Commits

<!-- TODO: preencher marcos de arquitetura (kanban nativo, sirene unificado, carômetro) -->

## Próximas melhorias

- [ ] Diagrama C4 atualizado
- [ ] Inventário de API routes (\`/api/*\`)

## Referências

- [README raiz](../../README.md)
- [inventario-kanban-funil-completo.md](../inventario-kanban-funil-completo.md) (legado detalhado)
`),

  '01-hub-fly/design-system.md': feat('Design System Moní', '01-hub-fly', `## Funcionalidade

Sistema visual Casa Moní: paleta editorial (Porsche/Vogue/moni.casa), tokens CSS, classes de SLA e utilitários mobile.

## Objetivo

Garantir consistência visual e proibir cores hardcoded ou laranja em qualquer componente.

## Onde funciona

| Contexto | Arquivo |
|----------|---------|
| Tokens globais | \`src/styles/moni-tokens.css\` |
| Regras permanentes | \`.cursorrules\` |

## Cores principais (variáveis)

| Uso | Variável | Hex ref |
|-----|----------|---------|
| Primário / headers | \`--moni-navy-800\` | #0C2633 |
| Portfólio / sucesso | \`--moni-green-800\` | #2F4A3A |
| Contabilidade / corpo | \`--moni-earth-800\` | #4A3929 |
| Crédito / SLA atenção | \`--moni-gold-400\` | #D4AD68 |

## Identidade por Kanban

- Step One: \`--moni-kanban-stepone\`, \`--moni-kanban-stepone-light\`
- Portfólio: \`--moni-kanban-portfolio\`, \`--moni-kanban-portfolio-light\`
- Contabilidade: \`--moni-kanban-contab\`, \`--moni-kanban-contab-light\`
- Crédito: \`--moni-kanban-credito\`, \`--moni-kanban-credito-light\`

## Tags SLA (classes prontas)

| Estado | Classe |
|--------|--------|
| Vencendo | \`moni-tag-atencao\` |
| Vencido | \`moni-tag-atrasado\` |
| Concluído | \`moni-tag-concluido\` |
| Arquivado | \`moni-tag-arquivado\` |

## Regras inegociáveis

- Bordas: \`var(--moni-border-width)\` (0.5px)
- Cards/modais: \`border-radius: var(--moni-radius-lg)\` (12px)
- Botões: \`var(--moni-radius-md)\` (8px)
- Display: \`var(--moni-font-display)\` | UI: \`var(--moni-font-sans)\`
- **Nunca laranja**
- Mobile breakpoint: **640px** — classes \`moni-kanban-board\`, \`moni-card-modal-split\`, etc.

## Componentes

Todos os componentes novos ou editados devem importar/usar tokens do \`moni-tokens.css\`.

## Próximas melhorias

- [ ] Storybook ou página de referência visual
<!-- TODO: preencher com compilado de garantias / sessões PDF de design -->
`),

  '01-hub-fly/permissoes-acesso.md': feat('Permissões e Acesso', '01-hub-fly', `## Funcionalidade

Controle de acesso por \`profiles.role\`, middleware Next.js e matriz de prefixos de rota.

## Objetivo

Isolar dados do franqueado (Frank), liberar funis ao time Moní e restringir rotas administrativas.

## Onde funciona

| Arquivo | Função |
|---------|--------|
| \`src/lib/authz.ts\` | \`normalizeAccessRole\`, \`isAdmin\` |
| \`src/lib/access-matrix.ts\` | \`TEAM_ALLOWED_*\`, \`FRANK_*\`, \`ADMIN_ONLY_*\` |
| \`src/lib/supabase/middleware.ts\` | Redirect por papel |
| \`src/lib/hooks/usePermissoes.ts\` | Hook client-side |

## Papéis (\`profiles.role\`)

| Valor DB | Normalizado | Resumo |
|----------|-------------|--------|
| \`admin\` | admin | Acesso amplo |
| \`team\` | team | Prefixos em \`TEAM_ALLOWED_PATH_PREFIXES\` |
| \`frank\`, \`franqueado\` | frank | Hub limitado + \`/portal-frank\` |
| \`pending\` / \`blocked\` | — | Preso no login |
| \`consultor\`, \`supervisor\` | admin | Legado → admin |

## Banco

| Tabela | Uso |
|--------|-----|
| \`profiles\` | \`role\`, \`time\`, dados do usuário |
| \`team_members\` | Membros de times (Sirene/Kanban) |

**Regra:** responsável em card/checklist → sempre \`profiles.id\` (uuid), nunca texto livre.

**Migrations:** \`003_fix_rls_recursion_profiles.sql\`, \`083_team_members.sql\`, \`368_kanban_cards_select_staff.sql\`

## Prefixos (resumo)

- **Team:** \`/rede-franqueados\`, \`/portfolio\`, \`/funil-stepone\`, \`/sirene\`, \`/operacoes\`, …
- **Frank:** portal + funis de novos negócios (RLS limita cards)
- **Admin only:** catálogo, crédito interno legado, \`/admin/*\`, etc.

Detalhe completo: [MATRIZ_ACESSO_USUARIOS.md](../MATRIZ_ACESSO_USUARIOS.md)

## Próximas melhorias

- [ ] Matriz por feature (não só por rota)
`),

  '01-hub-fly/banco-supabase.md': feat('Banco de Dados e Supabase', '01-hub-fly', `## Funcionalidade

PostgreSQL hospedado no Supabase com RLS, Storage buckets e Auth.

## Objetivo

Persistir processos, cards Kanban, chamados Sirene, rede de franqueados e auditoria com isolamento por franqueado.

## Ambientes

| Ambiente | Projeto | Uso |
|----------|---------|-----|
| DEV | \`bgaadvfucnrkpimaszjv\` | Desenvolvimento |
| PROD | \`aydryzoxqnwnbybvgiug\` | Produção — **não alterar sem confirmação** |

## Convenções

- Scripts temporários: Node.js + \`pg\` na raiz; deletar após uso
- Não usar \`psql\` (fora do PATH no Windows)
- Após migration: \`NOTIFY pgrst, 'reload schema'\`
- Tabela de controle: \`supabase_migrations.schema_migrations\`
- Pastelaria/Sirene admin: preferir API routes \`/api/pastelaria/*\`

## Domínios de tabelas (amostra)

| Domínio | Tabelas |
|---------|---------|
| Auth/perfil | \`profiles\`, \`team_members\` |
| Kanban | \`kanbans\`, \`kanban_fases\`, \`kanban_cards\`, \`kanban_atividades\`, … |
| Step One | \`processo_step_one\`, \`etapa_progresso\`, \`condominios\` |
| Rede | \`rede_franqueados\`, \`rede_contatos\` |
| Sirene | \`sirene_chamados\`, \`sirene_topicos\`, \`sirene_notificacoes\` |
| Jurídico | \`juridico_tickets\`, \`juridico_documentos\` |
| Auditoria | \`audit_log\` |

## RLS

Padrão: franqueado vê apenas registros com \`franqueado_id = auth.uid()\`; staff via políticas \`staff\` / \`admin\`.

## Referências

- [migrations.md](migrations.md)
- [inventario-kanban-funil-completo.md](../inventario-kanban-funil-completo.md) §2
`),

  '01-hub-fly/migrations.md': feat('Migrations SQL', '01-hub-fly', `## Funcionalidade

Evolução do schema em \`supabase/migrations/\` (~400+ arquivos numerados + syncs \`_SYNC_*\`).

## Objetivo

Versionar alterações de banco de forma idempotente e rastreável.

## Onde funciona

\`supabase/migrations/NNN_descricao.sql\`

## Regras

1. Numerar sequencialmente (coordenar com equipe antes de criar)
2. \`IF NOT EXISTS\`, \`ADD COLUMN IF NOT EXISTS\`
3. Idempotente — seguro reexecutar em DEV
4. Após aplicar: \`NOTIFY pgrst, 'reload schema'\`
5. **Nunca** aplicar em PROD sem confirmação explícita

## Migrations marco (referência)

| # | Tema |
|---|------|
| 002 | Schema idempotente base |
| 003 | Fix RLS profiles |
| 034–035 | Sirene inicial + HDM |
| 103–125 | Kanban atividades, histórico |
| 114 | Renomear kanbans e fases |
| 128 | Funil Acoplamento |
| 164–175 | Sirene ↔ kanban_atividades |
| 229 | Crédito Obra documentação SLA |
| 263 | Portfolio fases SLA |
| 419 | Kanban Funding |

## Padrão novo funil

Referência: \`419_kanban_funding.sql\` — inserir em \`kanbans\`, \`kanban_fases\`, checklists, RLS.

## Commits

<!-- TODO: política de branch + quem aplica em PROD -->

## Próximas melhorias

- [ ] Script de inventário automático de migrations por domínio
`),

  '01-hub-fly/deploy-git.md': feat('Deploy, Git e Workflow', '01-hub-fly', `## Funcionalidade

Fluxo de desenvolvimento com branches por feature, PRs para revisão e deploy Next.js + Supabase.

## Objetivo

Integrar mudanças com segurança (DEV primeiro, PROD sob controle).

## Onde funciona

| Contexto | Detalhe |
|----------|---------|
| Branch de trabalho | \`funcionalidade-danilo\` / \`funcionalidade-ingrid\` (ver regras ativas) |
| PRs | Revisão Ingrid antes de merge em \`main\` |
| App | \`npm run dev\` local; deploy conforme pipeline do projeto |

## Setup local

\`\`\`bash
npm install
cp .env.local.example .env.local
npm run dev
\`\`\`

Variáveis: \`NEXT_PUBLIC_SUPABASE_URL\`, \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`, \`RESEND_API_KEY\` (e-mail).

## Commits

- Mensagens em português ou inglês conforme padrão do PR
- Não commitar \`.env\` ou secrets

## Próximas melhorias

- [ ] Documentar pipeline CI/CD e URLs de preview
<!-- TODO: URLs Vercel / ambiente staging -->
`),

  '01-hub-fly/componentes-compartilhados.md': feat('Componentes Compartilhados', '01-hub-fly', `## Funcionalidade

Biblioteca de UI e helpers reutilizados entre funis, Sirene e portal.

## Objetivo

Evitar duplicação; manter padrão visual Moní.

## Componentes-chave

| Caminho | Uso |
|---------|-----|
| \`src/components/PortalSidebar.tsx\` | Menu lateral |
| \`src/components/kanban-shared/*\` | Modal, checklist, SLA dots, filtros |
| \`src/components/carometro/*\` | Carômetro / Gantt / TO DO |
| \`src/hooks/useAuditLog.js\` | Auditoria |
| \`src/utils/periodos.js\` | Semanas ISO |
| \`src/utils/semaforoFaixas.js\` | Semáforo metas |

## Kanban shared (amostra)

- \`KanbanCardModal.tsx\` — modal de detalhe do card
- \`FaseChecklistCard.tsx\` — checklist por fase
- \`ProximaAtividadeDot.tsx\`, \`FundingAtividadeDot.tsx\` — bolinhas de atividade
- \`ChamadoAtividadesPanel.tsx\` — painel Sirene no card

## Lib de ações

| Arquivo | Ações |
|---------|-------|
| \`src/lib/actions/card-actions.ts\` | Arquivar, excluir, mover fase |
| \`src/lib/actions/kanban-sla-justificativa.ts\` | Justificativa SLA |

## Próximas melhorias

- [ ] Mapa de dependências entre kanban-shared e funis
`),
};

Object.entries(hubFlyDocs).forEach(([p, c]) => created.push(write(`docs/${p}`, c)));

// Continue in part 2 - operacoes, juridico, kanban, sirene, produto, onboarding, referencia, skills
// Due to script size, remaining content appended below

const operacoesDocs = {
  '02-operacoes/README.md': `# Operações — Funis de Negócio

Funis Kanban e fluxos operacionais: Step One, Portfólio, Acoplamento, Crédito, Operações, Contabilidade, Loteadores (Motor 01), Moní Capital, Obra.

## Índice

| Doc | Módulo | Rota principal |
|-----|--------|----------------|
| [step-one.md](step-one.md) | Funil Step One | \`/funil-stepone\` |
| [portfolio.md](portfolio.md) | Portfólio | \`/portfolio\` |
| [acoplamento.md](acoplamento.md) | Acoplamento | \`/funil-acoplamento\` |
| [projeto-legal.md](projeto-legal.md) | Projeto Legal | \`/funil-projeto-legal\` |
| [credito-obra.md](credito-obra.md) | Crédito Obra (Cash Me) | \`/funil-credito-obra\` |
| [operacoes.md](operacoes.md) | Operações | \`/operacoes\` |
| [contabilidade.md](contabilidade.md) | Contabilidade | \`/painel-contabilidade\` |
| [motor-01-loteadores.md](motor-01-loteadores.md) | Loteadores / Moní INC | \`/loteadores\`, \`/funil-moni-inc\` |
| [moni-capital.md](moni-capital.md) | Moní Capital (Divify) | \`/funil-moni-capital\` |
| [obra-pos-obra.md](obra-pos-obra.md) | Obra e pós-obra | \`/pre-obra\`, flags \`prev_*\` |

**Inventário completo:** [inventario-kanban-funil-completo.md](../inventario-kanban-funil-completo.md)

**Skill:** \`especialista-operacoes\`
`,

  '02-operacoes/step-one.md': feat('Funil Step One', '02-operacoes', `## Funcionalidade

Kanban de onboarding e viabilidade do franqueado: condomínios, mapa, pré-batalha, BCA, integração com rede.

## Objetivo

Conduzir o candidato/franqueado do primeiro contato até decisão de batalha e entrada no portfólio.

## Onde funciona

| Contexto | Rota |
|----------|------|
| Kanban | \`/funil-stepone\` |
| Processo legado 11 etapas | \`/step-one/[id]\` |
| Painel legado | \`/painel-novos-negocios\` |

**UUID kanban:** ver \`KANBAN_IDS.STEP_ONE\` em \`src/lib/constants/kanban-ids.ts\`

## Banco

| Tabela | Uso |
|--------|-----|
| \`kanban_cards\` | Cards nativos |
| \`processo_step_one\` | Legado / sync |
| \`condominios\` | Dados de condomínio |
| \`rede_franqueados\` | Auto-cura cards da rede |

**Migrations:** \`248_funil_stepone_*\`, \`301_funil_stepone_batalha_vira_pre_batalha\`, \`385_stepone_responsavel_fase_franqueado_rede\`

## Componentes

| Arquivo | Papel |
|---------|-------|
| \`src/app/funil-stepone/\` | Board custom |
| \`src/app/step-one/[id]/etapa/*\` | Etapas 1–11 |
| \`src/lib/kanban/pre-batalha-compatibilidade.ts\` | Ranking pré-batalha |

## Especificação legada

[STEP_ONE_ESPEC.md](../STEP_ONE_ESPEC.md) — Etapas 1–11, checklist 16 itens, BCA, Apify/ZAP.

## Próximas melhorias

<!-- TODO: preencher com compilado de garantias / sessões PDF Step One -->
- [ ] Unificar documentação etapas vs kanban nativo
`),

  '02-operacoes/portfolio.md': feat('Funil Portfólio', '02-operacoes', `## Funcionalidade

Esteira principal de negócios aprovados: paralelas informativas (Acoplamento, Crédito, Contabilidade, Jurídico, Capital).

## Objetivo

Orquestrar bastões para funis satélite e visão consolidada do franqueado.

## Onde funciona

\`/portfolio\` — \`renderKanbanDatabasePage\` + chips paralelas

**Kanban:** \`Funil Portfólio\` | UUID em \`KANBAN_IDS.PORTFOLIO\`

## Banco

Flags em \`kanban_cards\`: \`acoplamento_concluido\`, \`credito_obra_ok\`, \`contabilidade_ok\`, \`juridico_ok\`, \`capital_ok\`, \`projetos_locais_ok\`, \`projetos_legais_ok\`

**Migration:** \`263_funil_portfolio_fases_nomes_sla.sql\`, \`195_portfolio_franqueados.sql\`

## Componentes

\`src/components/kanban-shared/KanbanParalelasChips.tsx\`

## Próximas melhorias

- [ ] Documentar cada bastão spawn (origem → destino)
`),

  '02-operacoes/acoplamento.md': feat('Funil Acoplamento', '02-operacoes', `## Funcionalidade

Modelagem financeira Gbox: aprovação, reprovação e paralisados; gate para Comitê Loteadores.

## Onde funciona

\`/funil-acoplamento\`

**Migration:** \`128_funil_acoplamento.sql\`, \`378_gbox_acoplamento_preenchimento_manual.sql\`

## Banco

\`motivo_reprovacao_acoplamento\`, \`acoplamento_filho_fase_slug/nome\` no card pai Portfólio

## Próximas melhorias

<!-- TODO: regras Gbox detalhadas -->
`),

  '02-operacoes/projeto-legal.md': feat('Funil Projeto Legal', '02-operacoes', `## Funcionalidade

Aprovação de projeto legal municipal; bastão de volta move pai em Operações.

## Onde funciona

\`/funil-projeto-legal\` — ~14 fases

**Migration:** \`416_projeto_legal_sla_10_dias_uteis.sql\`

## Próximas melhorias

<!-- TODO: checklist por fase projeto legal -->
`),

  '02-operacoes/credito-obra.md': feat('Funil Crédito Obra', '02-operacoes', `## Funcionalidade

Financiamento de obra via Cash Me: 25 fases, tranches 2ª–6ª, SLA pausado em documentação.

## Onde funciona

\`/funil-credito-obra\`

**UUID:** \`6463af1d-850d-4958-b74c-404f8d668e21\` (\`KANBAN_IDS.CREDITO_OBRA\`)

## Banco

Colunas: \`alvara_url\`, \`docs_terreno_url\`, \`sla_iniciado_em\`

**Migration:** \`229_kanban_credito_obra_documentacao_sla.sql\`

## Componentes

\`src/lib/kanban/kanban-card-sla.ts\` — tag \`Aguardando Documentação\` (\`moni-tag-atencao\`)

Fases: slugs \`co_*\` em \`FASE_SLUGS\` — ver \`.cursor/rules/funil-credito-obra-prompts.mdc\`

## Próximas melhorias

- [ ] Mapa completo tranches × Operações
`),

  '02-operacoes/operacoes.md': feat('Funil Operações', '02-operacoes', `## Funcionalidade

Pré-obra, tranches, abertura automática Cash Me, campos \`prev_*\`.

## Onde funciona

\`/operacoes\`

**Migration:** \`398_funil_operacoes_remove_fase_sondagem.sql\`, \`400_operacoes_sla_tipo_habite_se.sql\`

## Banco

\`kanban_operacoes_tranche_vinculos\` — presets Operações → Crédito Obra

## Componentes

\`src/lib/actions/operacoes-tranche-vinculos.ts\`
`),

  '02-operacoes/contabilidade.md': feat('Funil Contabilidade', '02-operacoes', `## Funcionalidade

Kanban híbrido (legado + nativo); bastão de volta \`contabilidade_ok\`.

## Onde funciona

\`/painel-contabilidade\` — query \`?kanbanCard=\`

**Migration:** \`209_add_checklists_juridico_contabilidade.sql\`
`),

  '02-operacoes/motor-01-loteadores.md': feat('Motor 01 — Funil Loteadores', '02-operacoes', `## Funcionalidade

Relação com loteadores: viabilidade, comitê, diligência, contrato parceria, link externo.

## Onde funciona

\`/loteadores\`, \`/funil-moni-inc\`

**Kanban:** \`Funil Loteadores\` — gate Comitê exige Acoplamento aprovado

## Banco

\`rede_loteador_id\`, \`kanban_loteador_externo_tokens\`

**Migrations:** \`181_rename_kanban_funil_loteadores\`, \`311_funil_loteadores_contrato_parceria\`, \`335_funil_loteadores_fase_diligencia\`, \`317_funil_loteadores_sla_justificativa\`

## Componentes

\`src/lib/kanban/funil-loteadores.ts\`
`),

  '02-operacoes/moni-capital.md': feat('Funil Moní Capital', '02-operacoes', `## Funcionalidade

Financiamento Divify (ex-Moní Capital) — funil interno 8 fases.

## Onde funciona

\`/funil-moni-capital\`

**Migration:** renomeação em \`114_renomear_kanbans_e_fases.sql\`

## Componentes

\`src/lib/actions/kanban-moni-capital-cadastro.ts\`
`),

  '02-operacoes/obra-pos-obra.md': feat('Obra e Pós-Obra', '02-operacoes', `## Funcionalidade

Campos de pré-obra (\`prev_*\`), habite-se, SLA corridos em obra.

## Onde funciona

Flags em Operações; rotas \`/pre-obra\`, \`/obra-ways\` (admin)

**Migration:** \`422_em_obra_sla_corridos.sql\`, \`400_operacoes_sla_tipo_habite_se.sql\`

## Próximas melhorias

<!-- TODO: preencher fluxo pós-obra completo -->
`),
};

Object.entries(operacoesDocs).forEach(([p, c]) => created.push(write(`docs/${p}`, c)));

// ─── Jurídico ───────────────────────────────────────────────────────────────
const juridicoDocs = {
  '03-juridico/README.md': `# Jurídico

Estruturas jurídicas de franquia e incorporação: permuta, SPE, SCP, garantias, contratos e canal de dúvidas.

## Índice

| Doc | Tema |
|-----|------|
| [canal-duvidas-juridico.md](canal-duvidas-juridico.md) | Tickets Frank ↔ Moní (implementado) |
| [permuta.md](permuta.md) | Permuta |
| [opcao-spe.md](opcao-spe.md) | Opção de compra e SPE |
| [patrimonio-afetacao-scp.md](patrimonio-afetacao-scp.md) | Patrimônio de Afetação e SCP |
| [carta-fianca-seguro.md](carta-fianca-seguro.md) | Carta Fiança e Seguro Garantia |
| [terrenista-itbi.md](terrenista-itbi.md) | Terrenista e ITBI |
| [contratos-debentures.md](contratos-debentures.md) | Contratos e debêntures |
| [fidc-securitizacao.md](fidc-securitizacao.md) | FIDC e securitização |

**Skill:** \`especialista-juridico\`

> A maior parte dos tópicos estruturais abaixo aguarda compilação das garantias e materiais PDF.
`,
  '03-juridico/canal-duvidas-juridico.md': feat('Canal de Dúvidas Jurídicas', '03-juridico', `## Funcionalidade

Tickets de dúvidas do franqueado com kanban interno Moní, anexos e e-mail via Resend.

## Onde funciona

| Papel | Rota |
|-------|------|
| Frank | \`/juridico\`, \`/juridico/nova\`, \`/juridico/[id]\` |
| Moní | \`/juridico/kanban\` |

## Banco

\`juridico_tickets\`, \`juridico_ticket_comentarios\`, \`juridico_ticket_anexos\`, \`juridico_documentos\`

**Migrations:** \`009_juridico_canal_duvidas.sql\` … \`012_juridico_ticket_email_frank.sql\`

**Storage:** bucket \`juridico-anexos\` — ver [STORAGE_JURIDICO_POLICIES.md](../STORAGE_JURIDICO_POLICIES.md)

## Referência legada

[PASSO_A_PASSO_JURIDICO.md](../PASSO_A_PASSO_JURIDICO.md)
`),
  '03-juridico/permuta.md': feat('Permuta', '03-juridico', `## Funcionalidade

Estrutura jurídica de permuta imobiliária na operação Casa Moní.

<!-- TODO: preencher com compilado de garantias / sessões PDF -->

## Onde funciona

<!-- TODO: funil/checklist associado no Hub -->

## Banco

<!-- TODO: tabelas e migrations específicas -->

## Próximas melhorias

- [ ] Vincular checklists legais existentes (\`checklist-legal\`, \`068_processo_card_checklist_legal\`)
`),
  '03-juridico/opcao-spe.md': feat('Opção de Compra e SPE', '03-juridico', `<!-- TODO: preencher com compilado de garantias / sessões PDF -->

## Funcionalidade

Contratos de opção e constituição de SPE para o negócio.

## Banco

\`320_franqueado_spe.sql\` — colunas SPE em rede/franqueado

Scripts manuais: \`scripts/manual/264_instrucoes_02_abertura_spe.sql\`
`),
  '03-juridico/patrimonio-afetacao-scp.md': feat('Patrimônio de Afetação e SCP', '03-juridico', `<!-- TODO: preencher com compilado de garantias / sessões PDF -->

## Funcionalidade

Patrimônio de Afetação (Lei 4.591) e Sociedade em Conta de Participação.

## Referências no código

- Migration \`183_uni_biblioteca_carta_fianca_interna.sql\` (biblioteca jurídica)
`),
  '03-juridico/carta-fianca-seguro.md': feat('Carta Fiança e Seguro Garantia', '03-juridico', `<!-- TODO: preencher com compilado de garantias / sessões PDF -->

## Funcionalidade

Garantias contratuais: carta fiança e seguro garantia.

## Banco

\`183_uni_biblioteca_carta_fianca_interna.sql\`
`),
  '03-juridico/terrenista-itbi.md': feat('Terrenista e ITBI', '03-juridico', `<!-- TODO: preencher com compilado de garantias / sessões PDF -->

## Funcionalidade

Relação com terrenista e tributação ITBI na aquisição do terreno.
`),
  '03-juridico/contratos-debentures.md': feat('Contratos e Debêntures', '03-juridico', `<!-- TODO: preencher com compilado de garantias / sessões PDF -->

## Funcionalidade

Modelos contratuais e instrumentos de debêntures.

## Onde funciona

Templates em \`juridico_documentos\`; upload checklist legal.
`),
  '03-juridico/fidc-securitizacao.md': feat('FIDC e Securitização', '03-juridico', `<!-- TODO: preencher com compilado de garantias / sessões PDF -->

## Funcionalidade

Estruturas de FIDC e securitização de recebíveis.
`),
};
Object.entries(juridicoDocs).forEach(([p, c]) => created.push(write(`docs/${p}`, c)));

// ─── Kanban ─────────────────────────────────────────────────────────────────
const kanbanDocs = {
  '04-kanban/README.md': `# Kanban — Motor de Cards

Documentação do sistema Kanban nativo: cards, fases, SLA, checklists, atividades, timeline, arquivamento.

## Índice

| Doc | Tema |
|-----|------|
| [cards-estrutura.md](cards-estrutura.md) | Modelo de card e colunas |
| [fases-sla.md](fases-sla.md) | SLA, bolinhas, justificativa |
| [checklists-atividades.md](checklists-atividades.md) | Checklist por fase + próxima atividade |
| [comentarios-timeline.md](comentarios-timeline.md) | Comentários e cronologia |
| [arquivar-mover-fase.md](arquivar-mover-fase.md) | Ações do card |
| [dashboard-painel.md](dashboard-painel.md) | Painel de atividades |
| [tags-chamados-vinculos.md](tags-chamados-vinculos.md) | Tags, vínculos, Sirene |

**Inventário:** [inventario-kanban-funil-completo.md](../inventario-kanban-funil-completo.md)

**Skill:** \`especialista-hub-fly-kanban\`
`,
  '04-kanban/cards-estrutura.md': feat('Estrutura de Cards', '04-kanban', `## Funcionalidade

Entidade central \`kanban_cards\` com vínculos a franqueado, rede, condomínio, processo e card pai.

## Banco — colunas principais

| Coluna | Significado |
|--------|-------------|
| \`franqueado_id\` | Dono — base RLS |
| \`rede_franqueado_id\` | Rede; sync group |
| \`fase_id\` | Coluna atual |
| \`origem_card_id\` | Bastão spawn |
| \`arquivado\`, \`concluido\` | Estados terminais |
| \`entered_fase_at\`, \`sla_iniciado_em\` | SLA |

Ver inventário §2.2 completo.

## Componentes

| Arquivo | Papel |
|---------|-------|
| \`src/components/kanban-shared/KanbanCardModal.tsx\` | Modal detalhe |
| \`src/app/steps-viabilidade/CardDetalheModal.tsx\` | Variante legado |
| \`src/lib/actions/card-actions.ts\` | Ações servidor |

## Constantes

\`src/lib/constants/kanban-ids.ts\` — \`KANBAN_IDS\`, \`FASE_SLUGS\`, \`FASE_IDS\`
`),
  '04-kanban/fases-sla.md': feat('Fases e SLA', '04-kanban', `## Funcionalidade

Cada \`kanban_fases\` define \`sla_dias\`, \`sla_tipo\` (úteis/corridos). Cards calculam status ok/atencao/atrasado.

## Componentes

\`src/lib/kanban/kanban-card-sla.ts\` — \`tagSlaKanbanParaExibicao\`, \`indicadorBolinhaSlaKanban\`

\`src/lib/dias-uteis.ts\` — \`calcularStatusSLAPorTipo\`

## Classes visuais

- Atenção: \`moni-tag-atencao\`
- Atrasado: \`moni-tag-atrasado\`

## SLA pausado

Crédito Obra fase \`co_documentacao_alvara\`: pausa até \`alvara_url\` e \`docs_terreno_url\` preenchidos.

## Justificativa

\`src/lib/actions/kanban-sla-justificativa.ts\` — \`317_funil_loteadores_sla_justificativa.sql\`
`),
  '04-kanban/checklists-atividades.md': feat('Checklists e Atividades', '04-kanban', `## Funcionalidade

Checklist por fase (\`kanban_fase_checklist_*\`) e interações (\`kanban_atividades\`) com integração Sirene.

## Banco

| Tabela | Uso |
|--------|-----|
| \`kanban_fase_checklist_itens\` | Template por fase |
| \`kanban_fase_checklist_respostas\` | Respostas por card |
| \`kanban_atividades\` | Interações, chamados, subinterações |

## Componentes

| Arquivo | Papel |
|---------|-------|
| \`src/components/kanban-shared/FaseChecklistCard.tsx\` | UI checklist |
| \`src/components/kanban-shared/ProximaAtividadeDot.tsx\` | Bolinha próxima atividade |
| \`checklist-atividade-arrays.ts\` | Arrays por fase (legado) |
| \`src/app/steps-viabilidade/tarefas/TarefasPainelConteudo.tsx\` | Painel atividades |

## Responsável por fase

\`src/lib/kanban/responsavel-fase-checklist.ts\`
`),
  '04-kanban/comentarios-timeline.md': feat('Comentários e Timeline', '04-kanban', `## Funcionalidade

Comentários no card e histórico auditável de movimentações.

## Banco

| Tabela | Uso |
|--------|-----|
| \`kanban_card_comentarios\` | Comentários |
| \`kanban_historico\` | Triggers: criado, fase_avancada, etc. |
| \`kanban_card_cronologia\` | Migration 125 |

**Migration:** \`321_kanban_card_comentarios_card_id_nullable.sql\`
`),
  '04-kanban/arquivar-mover-fase.md': feat('Arquivar e Mover Fase', '04-kanban', `## Funcionalidade

Ações de ciclo de vida: mover coluna, arquivar com motivo, excluir, concluir.

## Componentes

\`src/lib/actions/card-actions.ts\`

## Banco

\`motivo_arquivamento\`, categorias — \`388_motivo_arquivamento_categorias.sql\`

## Gates

Validações antes de avançar fase: checklist obrigatório, aprovações bombeiro (\`kanban_aprovacoes_fase\`).
`),
  '04-kanban/dashboard-painel.md': feat('Dashboard e Painel de Atividades', '04-kanban', `## Funcionalidade

Visão consolidada de tarefas, filtros por responsável/time e dashboard novos negócios.

## Onde funciona

\`/dashboard-novos-negocios\`, painéis por funil

## Componentes

\`painel-tarefas-filtros.ts\`, \`TarefasPainelConteudo.tsx\`

## View

\`105_view_atividades_unificadas.sql\`, \`428_v_atividades_unificadas_responsaveis_ids.sql\`
`),
  '04-kanban/tags-chamados-vinculos.md': feat('Tags, Vínculos e Chamados', '04-kanban', `## Funcionalidade

Tags customizadas, vínculos card↔card e ligação com Sirene.

## Banco

| Tabela | Uso |
|--------|-----|
| \`kanban_tags\`, \`kanban_card_tags\` | Tags |
| \`kanban_card_vinculos\` | Relacionamentos |
| \`kanban_atividades.sirene_chamado_id\` | Link Sirene |

**Migrations:** \`170_kanban_tags.sql\`, \`130_vinculos_cards.sql\`, \`164_kanban_atividades_sirene_chamado_id.sql\`

## Deep link

\`src/lib/kanban/kanban-card-href.ts\`
`),
};
Object.entries(kanbanDocs).forEach(([p, c]) => created.push(write(`docs/${p}`, c)));

// ─── Sirene ─────────────────────────────────────────────────────────────────
const sireneDocs = {
  '05-sirene/README.md': `# Sirene — Central de Chamados

Chamados, tópicos, HDM, times, dashboard, notificações e integração Kanban.

## Índice

| Doc | Tema |
|-----|------|
| [chamados.md](chamados.md) | Abertura, status, fechamento |
| [topicos-subinteracoes.md](topicos-subinteracoes.md) | Tópicos e kanban_atividades |
| [hdm-times.md](hdm-times.md) | HDM e times |
| [dashboard-notificacoes.md](dashboard-notificacoes.md) | KPIs e sino |
| [rls-permissoes.md](rls-permissoes.md) | RLS e papéis Sirene |

**Legado:** [SIRENE_PROXIMOS_PASSOS.md](../SIRENE_PROXIMOS_PASSOS.md)

**Skill:** \`especialista-sirene\`
`,
  '05-sirene/chamados.md': feat('Chamados Sirene', '05-sirene', `## Funcionalidade

Central de chamados com tipos Padrão e HDM, vínculo opcional a card Kanban.

## Onde funciona

\`/sirene\`, \`/sirene/chamados\`, \`/sirene/[id]\`

## Banco

\`sirene_chamados\` — campos: \`tipo\`, \`hdm_responsavel\`, \`card_id\`, \`data_vencimento\`

**Migrations:** \`034_sirene.sql\`, \`035_sirene_hdm.sql\`, \`324_sirene_chamados_hdm_executivo_local.sql\`

## Lib / types

\`src/types/sirene.ts\`, \`src/lib/sirene.ts\`, actions em \`src/lib/actions/\` (criarChamado, fecharChamado, …)

## UI

\`src/app/sirene/ModalNovoChamado.tsx\`, \`ClassificacaoConclusaoModal.tsx\`
`),
  '05-sirene/topicos-subinteracoes.md': feat('Tópicos e Subinterações', '05-sirene', `## Funcionalidade

Tópicos por chamado; unificação com \`kanban_atividades\` como subinterações.

## Banco

\`sirene_topicos\` — \`interacao_id\`, \`times_ids\`, \`responsaveis_ids\`, \`aprovado_bombeiro\`

**Migrations:** \`118_subinteracoes.sql\`, \`120_migrar_sirene_chamados_kanban_atividades.sql\`, \`225_sirene_unificar_topicos.sql\`

## Integração Kanban

\`kanban_atividades.origem = 'sirene'\`, \`sirene_chamado_id\` único
`),
  '05-sirene/hdm-times.md': feat('HDM e Times', '05-sirene', `## Funcionalidade

Chamados HDM redirecionados a times; \`profiles.time\` e \`kanban_times\`.

## Onde funciona

\`ModalRedirecionarHDM.tsx\`, filtro tipo HDM na lista

## Banco

\`sirene_papeis\` — papéis \`bombeiro\`, \`caneta_verde\`

**Migration:** \`426_sirene_rls_admin_team_acesso.sql\`
`),
  '05-sirene/dashboard-notificacoes.md': feat('Dashboard e Notificações', '05-sirene', `## Funcionalidade

KPIs, gráficos por status, sino com últimas notificações.

## Banco

\`sirene_notificacoes\` — tipos: \`novo_chamado\`, \`chamado_hdm_recebido\`, \`topico_aprovado\`, …

**Migration:** \`042_sirene_notificacoes_topico_id.sql\`

## Pastelaria

API \`/api/pastelaria/*\` — \`src/lib/pastelaria/sirene-status-sync.ts\`
`),
  '05-sirene/rls-permissoes.md': feat('RLS e Permissões Sirene', '05-sirene', `## Funcionalidade

Row Level Security por papel Bombeiro, time HDM, criador e admin.

## Banco

**Migrations:** \`034_sirene.sql\` (RLS base), \`427_fix_sirene_topicos_rls_chamado_id_null.sql\`, \`20260611_323_rls_kanban_card_comentarios_sirene.sql\`

## Storage

Bucket \`sirene-attachments\` (migration 034)

## Funções

\`canActAsBombeiro\` em \`src/lib/sirene.ts\`
`),
};
Object.entries(sireneDocs).forEach(([p, c]) => created.push(write(`docs/${p}`, c)));

// ─── Produto ────────────────────────────────────────────────────────────────
const produtoDocs = {
  '06-produto/README.md': `# Produto Casa Moní

Kit Moní, INC, Configurador, BCA, Batalha, Modelos, Universidade, Catálogo.

## Índice

| Doc | Tema |
|-----|------|
| [kit-moni-inc.md](kit-moni-inc.md) | Kit e Moní INC |
| [configurador-bca.md](configurador-bca.md) | Configurador e BCA/PDF |
| [batalha-modelos.md](batalha-modelos.md) | Batalha e modelos virtuais |
| [universidade-treinamentos.md](universidade-treinamentos.md) | Universidade Moní |
| [catalogo-casas.md](catalogo-casas.md) | Catálogo de casas |

**Skill:** \`especialista-produto-casa-moni\`
`,
  '06-produto/kit-moni-inc.md': feat('Kit Moní e Moní INC', '06-produto', `## Funcionalidade

Funil produto Moní INC — checklists por fase de incorporação do kit.

## Onde funciona

\`/funil-moni-inc\` (loteadores), checklists INC

**Migration:** \`160_checklist_fases_moni_inc.sql\`

## Próximas melhorias

<!-- TODO: preencher escopo Kit Moní comercial -->
`),
  '06-produto/configurador-bca.md': feat('Configurador e BCA', '06-produto', `## Funcionalidade

Geração de BCA (Business Case Analysis) e PDF para franqueado; treinamento BCA.

## Onde funciona

\`/treinamento-bca\`, etapas Step One, \`pdf_exports\`

## Banco

\`pdf_exports\`, \`005_batalhas_etapa8.sql\`

## Especificação

[STEP_ONE_ESPEC.md](../STEP_ONE_ESPEC.md) — etapas 8–11
`),
  '06-produto/batalha-modelos.md': feat('Batalha e Modelos', '06-produto', `## Funcionalidade

Batalha entre modelos de casa; funis Produto → Modelo Virtual → Homologações.

## Onde funciona

\`/funil-produto\`, \`/funil-modelo-virtual\`, \`/funil-homologacoes\`

\`/pre-batalha\` — ranking compatibilidade

**Migrations:** \`005_batalhas_etapa8.sql\`, \`301_funil_stepone_batalha_vira_pre_batalha\`, \`303_funil_stepone_pre_batalha_ranking_compatibilidade.sql\`

## Componentes

\`src/lib/kanban/pre-batalha-compatibilidade.ts\`
`),
  '06-produto/universidade-treinamentos.md': feat('Universidade e Treinamentos', '06-produto', `## Funcionalidade

Conteúdo de capacitação para franqueados e time.

## Onde funciona

\`/universidade\`, \`/admin/universidade\`

## Componentes

\`src/lib/universidade/actions.ts\`
`),
  '06-produto/catalogo-casas.md': feat('Catálogo de Casas', '06-produto', `## Funcionalidade

Catálogo de modelos Moní para batalha e vendas.

## Onde funciona

\`/catalogo-produtos-moni\` (admin)

## Referência

[CATALOGO_CASAS_TABELA.md](../CATALOGO_CASAS_TABELA.md)
`),
};
Object.entries(produtoDocs).forEach(([p, c]) => created.push(write(`docs/${p}`, c)));

// ─── Onboarding + Referência ────────────────────────────────────────────────
created.push(write('docs/onboarding/README.md', `# Onboarding — Hub Fly

Roteiro para novos desenvolvedores e colaboradores.

## Trilha sugerida

1. [primeiro-dia.md](primeiro-dia.md) — setup e tour
2. [ambientes-dev-prod.md](ambientes-dev-prod.md) — Supabase DEV vs PROD
3. [../01-hub-fly/arquitetura.md](../01-hub-fly/arquitetura.md)
4. Domínio da sua squad (pasta \`01\`–\`06\`)
5. [../referencia/glossario.md](../referencia/glossario.md)
`));

created.push(write('docs/onboarding/primeiro-dia.md', feat('Primeiro Dia', 'onboarding', `## Checklist

- [ ] Clonar \`moni-fly\`, branch de trabalho da squad
- [ ] \`npm install\` + \`.env.local\` (credenciais DEV)
- [ ] \`npm run dev\` → http://localhost:3000
- [ ] Ler [docs/README.md](../README.md) e skill do seu domínio em \`.cursor/skills/\`
- [ ] Conta Supabase DEV (nunca PROD para testes destrutivos)
- [ ] Ler \`.cursorrules\` e \`moni-tokens.css\`

## Contatos / acessos

<!-- TODO: preencher owners por domínio (Ingrid, Danilo, …) -->
`)));

created.push(write('docs/onboarding/ambientes-dev-prod.md', feat('Ambientes DEV e PROD', 'onboarding', `## Supabase

| | DEV | PROD |
|---|-----|------|
| Host | \`bgaadvfucnrkpimaszjv.supabase.co\` | \`aydryzoxqnwnbybvgiug.supabase.co\` |
| Uso | Desenvolvimento, migrations novas | Franqueados reais |
| Regra | Pode resetar dados de teste | **Nunca alterar sem confirmação explícita** |

## Migrations

1. Escrever SQL idempotente em \`supabase/migrations/\`
2. Aplicar em DEV
3. \`NOTIFY pgrst, 'reload schema'\`
4. PR + revisão → aplicar em PROD sob controle

## Variáveis

Ver \`.env.local.example\` — Supabase, Resend, Autentique, Apify (quando usado).
`)));

created.push(write('docs/referencia/README.md', `# Referência

Material transversal: glossário, índices de código e documentação legada.
`));

created.push(write('docs/referencia/glossario.md', `# Glossário Hub Fly

| Termo | Significado |
|-------|-------------|
| **Frank** | Franqueado (\`profiles.role\` frank/franqueado) |
| **Bombeiro** | Papel Sirene que triagem/aprova tópicos |
| **Bastão** | Spawn automático de card filho em outro funil |
| **BCA** | Business Case Analysis — PDF de viabilidade |
| **Motor 01** | Funil Loteadores / relação com loteadores |
| **Cash Me** | Parceiro crédito obra (funil Crédito Obra) |
| **HDM** | Chamado de alta demanda gerencial (Sirene) |
| **RLS** | Row Level Security (Supabase) |
| **SPE** | Sociedade de Propósito Específico |
| **SLA** | Prazo por fase do kanban (úteis ou corridos) |
| **Step One** | Processo de viabilidade inicial (11 etapas + kanban) |
| **Sync group** | Cards vinculados pela mesma \`rede_franqueado_id\` |
`));

created.push(write('docs/referencia/indices-codigo.md', `# Índices de Código

## Constantes Kanban

\`src/lib/constants/kanban-ids.ts\` — UUIDs de kanbans e slugs de fases

## Autorização

\`src/lib/authz.ts\`, \`src/lib/access-matrix.ts\`, \`src/lib/supabase/middleware.ts\`

## Ações de card

\`src/lib/actions/card-actions.ts\`

## SLA

\`src/lib/kanban/kanban-card-sla.ts\`, \`src/lib/dias-uteis.ts\`

## Sirene

\`src/types/sirene.ts\`, \`src/lib/sirene.ts\`, \`src/app/sirene/\`

## Auditoria

\`src/hooks/useAuditLog.js\`

## Inventário Kanban completo

[inventario-kanban-funil-completo.md](../inventario-kanban-funil-completo.md)
`));

created.push(write('docs/referencia/docs-legados.md', `# Documentação Legada (raiz docs/)

Arquivos existentes antes da reorganização em domínios. Mantidos para referência; preferir pastas \`01\`–\`06\` para conteúdo novo.

| Arquivo | Tema |
|---------|------|
| [MATRIZ_ACESSO_USUARIOS.md](../MATRIZ_ACESSO_USUARIOS.md) | Permissões |
| [inventario-kanban-funil-completo.md](../inventario-kanban-funil-completo.md) | Kanban completo |
| [STEP_ONE_ESPEC.md](../STEP_ONE_ESPEC.md) | Step One técnico |
| [PASSO_A_PASSO_JURIDICO.md](../PASSO_A_PASSO_JURIDICO.md) | Jurídico tickets |
| [SIRENE_PROXIMOS_PASSOS.md](../SIRENE_PROXIMOS_PASSOS.md) | Roadmap Sirene |
| [CATALOGO_CASAS_TABELA.md](../CATALOGO_CASAS_TABELA.md) | Catálogo |
| [REDE_FRANQUEADOS.md](../REDE_FRANQUEADOS.md) | Rede |
| [STORAGE_JURIDICO_POLICIES.md](../STORAGE_JURIDICO_POLICIES.md) | Storage jurídico |
| [CONFIGURAR_EMAIL_RESEND.md](../CONFIGURAR_EMAIL_RESEND.md) | E-mail |
| [COMO_DAR_ACESSO_PAINEL.md](../COMO_DAR_ACESSO_PAINEL.md) | Acesso painel |
| [ABAS_KANBAN_PAINEL.md](../../ABAS_KANBAN_PAINEL.md) | Abas painel (raiz) |
| [Hub Fly/guia_fernanda_hub_fly.docx](../../Hub%20Fly/guia_fernanda_hub_fly.docx) | Guia Word (compilar para md) |
`));

// ─── Skills ─────────────────────────────────────────────────────────────────
const skills = {
  '.cursor/skills/especialista-hub-fly/SKILL.md': `---
name: especialista-hub-fly
description: >-
  Especialista na plataforma Hub Fly: arquitetura Next.js/Supabase, design system
  moni-tokens, permissões profiles.role, migrations, deploy, componentes
  compartilhados e padrões do projeto. Use para questões transversais de
  infraestrutura, auth, banco DEV/PROD, Cursor rules ou quando não souber qual
  domínio de negócio aplicar.
---

# Especialista Hub Fly

## Quando usar

- Arquitetura, setup, env, deploy, git/PR
- \`profiles.role\`, middleware, \`access-matrix.ts\`
- Migrations SQL, RLS, scripts \`pg\`
- Design system: **sempre** \`src/styles/moni-tokens.css\` — sem hex, sem laranja
- Componentes em \`src/components/kanban-shared/\` usados por vários funis

## Regras críticas

| Regra | Detalhe |
|-------|---------|
| DEV | \`bgaadvfucnrkpimaszjv.supabase.co\` |
| PROD | \`aydryzoxqnwnbybvgiug.supabase.co\` — não alterar sem confirmação |
| Responsável | \`profiles.id\` uuid — nunca texto livre |
| Bordas | 0.5px via \`--moni-border-width\` |
| Migrations | Idempotentes; \`NOTIFY pgrst, 'reload schema'\` após aplicar |

## Arquivos-chave

\`\`\`
src/lib/authz.ts
src/lib/access-matrix.ts
src/lib/supabase/middleware.ts
src/styles/moni-tokens.css
.cursorrules
\`\`\`

## Documentação

- [docs/01-hub-fly/](../../docs/01-hub-fly/)
- [docs/onboarding/](../../docs/onboarding/)
- Permissões: [docs/MATRIZ_ACESSO_USUARIOS.md](../../docs/MATRIZ_ACESSO_USUARIOS.md)

## Workflow migration

1. Criar \`supabase/migrations/NNN_descricao.sql\` com \`IF NOT EXISTS\`
2. Aplicar só em DEV
3. Testar RLS com papéis admin/team/frank
4. PR para revisão antes de PROD
`,

  '.cursor/skills/especialista-operacoes/SKILL.md': `---
name: especialista-operacoes
description: >-
  Especialista nos funis operacionais Casa Moní: Step One, Portfólio, Acoplamento,
  Projeto Legal, Crédito Obra, Operações, Contabilidade, Loteadores (Motor 01),
  Moní Capital, Obra e pós-obra. Use ao implementar ou debugar fluxos de negócio,
  bastões entre funis, flags paralelas ou fases específicas.
---

# Especialista Operações

## Quando usar

- Rotas \`/funil-*\`, \`/portfolio\`, \`/operacoes\`, \`/loteadores\`
- Bastões spawn, flags \`*_ok\` no card pai Portfólio
- Gates (ex.: Comitê exige Acoplamento)
- Step One: kanban + processo legado 11 etapas

## Constantes

\`src/lib/constants/kanban-ids.ts\` — \`KANBAN_IDS\`, \`FASE_SLUGS\`

| Funil | Rota | ID constante |
|-------|------|--------------|
| Step One | \`/funil-stepone\` | \`STEP_ONE\` |
| Portfólio | \`/portfolio\` | \`PORTFOLIO\` |
| Acoplamento | \`/funil-acoplamento\` | \`ACOPLAMENTO\` |
| Crédito Obra | \`/funil-credito-obra\` | \`CREDITO_OBRA\` |
| Operações | \`/operacoes\` | \`OPERACOES\` |
| Loteadores | \`/loteadores\` | \`LOTEADORES\` |
| Moní Capital | \`/funil-moni-capital\` | \`MONI_CAPITAL\` |

## Inventário completo

Ler [docs/inventario-kanban-funil-completo.md](../../docs/inventario-kanban-funil-completo.md) para tabelas, fases, gates e diagramas.

## Docs por módulo

[docs/02-operacoes/](../../docs/02-operacoes/)

## Padrão novo funil

Migration modelo: \`419_kanban_funding.sql\` + registrar slugs em \`kanban-ids.ts\`
`,

  '.cursor/skills/especialista-juridico/SKILL.md': `---
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
| Canal dúvidas | \`/juridico\` | \`juridico_tickets\`, \`juridico_documentos\` |
| Funil Jurídico | \`/funil-juridico\` | \`kanban_cards\` (flag \`juridico_ok\`) |
| Checklist legal | \`/public/checklist-legal/[token]\` | tokens + storage |

**Migrations:** \`009\`–\`012_juridico_*\`, \`068_processo_card_checklist_legal\`, \`209_add_checklists_juridico_contabilidade\`

**Storage:** \`juridico-anexos\` — [docs/STORAGE_JURIDICO_POLICIES.md](../../docs/STORAGE_JURIDICO_POLICIES.md)

## Tópicos estruturais (conteúdo de negócio)

Documentos em [docs/03-juridico/](../../docs/03-juridico/) — maioria com \`<!-- TODO: compilado garantias/PDF -->\`.

Ao implementar UI para permuta/SPE/SCP: buscar checklists existentes em \`src/components/checklist-legal/\` antes de criar novo.

## SPE no banco

\`320_franqueado_spe.sql\`, scripts \`scripts/manual/264_*\`
`,

  '.cursor/skills/especialista-hub-fly-kanban/SKILL.md': `---
name: especialista-hub-fly-kanban
description: >-
  Especialista no motor Kanban Hub Fly: cards, fases, comentários, checklists,
  próxima atividade, SLA e bolinhas, dashboard de tarefas, arquivar, mover fase,
  permissões por card, tags, vínculos, chamados Sirene no card e timeline. Use
  para CardDetalheModal, card-actions, painel de atividades ou qualquer tabela
  kanban_*.
---

# Especialista Hub Fly Kanban

## Arquivos obrigatórios

| Arquivo | Uso |
|---------|-----|
| \`src/components/kanban-shared/KanbanCardModal.tsx\` | Modal detalhe |
| \`src/lib/actions/card-actions.ts\` | Arquivar, mover, excluir |
| \`src/lib/kanban/kanban-card-sla.ts\` | SLA e tags |
| \`src/lib/kanban/kanban-card-href.ts\` | Deep links |
| \`src/lib/kanban/responsavel-fase-checklist.ts\` | Responsável fase |
| \`src/app/steps-viabilidade/tarefas/TarefasPainelConteudo.tsx\` | Painel atividades |

## Tabelas

\`kanbans\`, \`kanban_fases\`, \`kanban_cards\`, \`kanban_fase_checklist_*\`, \`kanban_atividades\`, \`kanban_card_comentarios\`, \`kanban_historico\`, \`kanban_tags\`

## SLA

- Cálculo: \`calcularStatusSLAPorTipo\` (\`dias-uteis.ts\`)
- Classes: \`moni-tag-atencao\`, \`moni-tag-atrasado\`
- Pausa documentação: Crédito Obra \`co_documentacao_alvara\`

## Bolinhas

\`ProximaAtividadeDot.tsx\`, \`FundingAtividadeDot.tsx\`

## Docs

[docs/04-kanban/](../../docs/04-kanban/) + [inventario-kanban-funil-completo.md](../../docs/inventario-kanban-funil-completo.md)

## Ao editar UI

Só visual: trocar hex por tokens \`moni-tokens.css\`. Não alterar lógica de negócio sem pedido explícito.
`,

  '.cursor/skills/especialista-sirene/SKILL.md': `---
name: especialista-sirene
description: >-
  Especialista Sirene: chamados, subinterações, tópicos, HDM, times, dashboard,
  gráficos, notificações, permissões Bombeiro, vínculo com cards Kanban, RLS e
  tabelas sirene_*. Use para rotas /sirene, kanban_atividades origem sirene,
  ou API pastelaria.
---

# Especialista Sirene

## Rotas

\`/sirene\`, \`/sirene/chamados\`, \`/sirene/[id]\`, \`/sirene/monitor\`

## Tabelas

\`sirene_chamados\`, \`sirene_topicos\`, \`sirene_anexos\`, \`sirene_mensagens\`, \`sirene_notificacoes\`, \`sirene_papeis\`, \`sirene_pericias\`

## Lib

\`src/types/sirene.ts\`, \`src/lib/sirene.ts\` (\`canActAsBombeiro\`, \`calcularProgressoTopicos\`)

## Integração Kanban

- \`kanban_atividades.sirene_chamado_id\`
- \`sirene_topicos.interacao_id\` → subinteração
- Migrations: \`118\`, \`120\`, \`164\`, \`225\`

## HDM

Chamado \`tipo = 'hdm'\`; redirecionar via \`ModalRedirecionarHDM.tsx\`; \`profiles.time\`

## Pastelaria (admin)

Preferir \`/api/pastelaria/*\` — não Supabase client direto para ops admin

## RLS

\`034_sirene.sql\`, \`426_sirene_rls_admin_team_acesso.sql\`, \`427_fix_sirene_topicos_rls_chamado_id_null.sql\`

## Docs

[docs/05-sirene/](../../docs/05-sirene/) + [SIRENE_PROXIMOS_PASSOS.md](../../docs/SIRENE_PROXIMOS_PASSOS.md)
`,

  '.cursor/skills/especialista-produto-casa-moni/SKILL.md': `---
name: especialista-produto-casa-moni
description: >-
  Especialista Produto Casa Moní: Kit Moní, Moní INC, Configurador, BCA, Batalha,
  Modelos Virtuais, Homologações, Universidade, Treinamentos e Catálogo de casas.
  Use para funis produto, pré-batalha, pdf_exports, universidade ou catálogo.
---

# Especialista Produto Casa Moní

## Funis produto

| Rota | Kanban |
|------|--------|
| \`/funil-produto\` | Funil Produto |
| \`/funil-modelo-virtual\` | Modelo Virtual |
| \`/funil-homologacoes\` | Homologações |
| \`/pre-batalha\` | Ranking pré-batalha |
| \`/treinamento-bca\` | Treinamento BCA |
| \`/universidade\` | Universidade |
| \`/catalogo-produtos-moni\` | Catálogo (admin) |

## Banco / migrations

- \`005_batalhas_etapa8.sql\`
- \`160_checklist_fases_moni_inc.sql\`
- \`301_funil_stepone_batalha_vira_pre_batalha.sql\`
- \`pdf_exports\` — histórico PDF BCA

## Componentes

\`src/lib/kanban/pre-batalha-compatibilidade.ts\`
\`src/lib/universidade/actions.ts\`
\`src/app/step-one/[id]/etapa/*\` — etapas catálogo/BCA

## Especificação Step One

[docs/STEP_ONE_ESPEC.md](../../docs/STEP_ONE_ESPEC.md) — etapas 4–11 catálogo e BCA

## Docs

[docs/06-produto/](../../docs/06-produto/) + [CATALOGO_CASAS_TABELA.md](../../docs/CATALOGO_CASAS_TABELA.md)
`,
};

Object.entries(skills).forEach(([p, c]) => created.push(write(p, c)));

console.log('Created', created.length, 'files');
console.log(created.join('\n'));
