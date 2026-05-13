# Código de possível desuso (análise estática em `src`)

> Gerado em: **2026-04-20** (script: `scripts/scan-unused.mjs`)

## Limitações (leia antes de apagar ficheiros)

- A análise **não** executa a app, não resolve módulos como o TypeScript, e **ignora** ficheiros fora de `src/`.
- **Componentes:** só procura a substring `@/components/...` noutros ficheiros. Imports relativos (`../components/`), re-exports dinâmicos, ou usos em testes/CI em pastas fora de `src` dão **falsos positivos**.
- **Rotas (páginas “sem ligação”):** a rota derivada de `app/.../page.tsx` procura a path como string em ficheiros `src/**` (ex. `"/foo"` em `Link`, `href`, `redirect`, etc.). Não vê ligação por menus dinâmicos, middleware, sitemaps, ou atalhos noutro repositório.
- **Actions:** export com nome; ignora padrões como `"use server"` em barrel files se o identificador não for importado por nome. **Falsos negativos** se só for usado com `import *` ou re-export com outro nome.
- **Hooks / tipos:** hooks por `@/caminho` e nome; tipos com nome: se o **nome** não existir noutro ficheiro, lista como órfão. Nomes genéricos (`Data`, `Props`) têm muitos **falsos positivos**.

## 1. Componentes em `src/components/`: módulo não referido por `@/components/...`

- **Ficheiro:** `src/components/AppStickyHeader.tsx` — **não** foi encontrada a substring de import `@/components/AppStickyHeader` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).
- **Ficheiro:** `src/components/AuthHeader.tsx` — **não** foi encontrada a substring de import `@/components/AuthHeader` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).
- **Ficheiro:** `src/components/kanban-shared/AnexosChamado.tsx` — **não** foi encontrada a substring de import `@/components/kanban-shared/AnexosChamado` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).
- **Ficheiro:** `src/components/kanban-shared/AnexosSubchamado.tsx` — **não** foi encontrada a substring de import `@/components/kanban-shared/AnexosSubchamado` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).
- **Ficheiro:** `src/components/kanban-shared/chartjs-cdn.ts` — **não** foi encontrada a substring de import `@/components/kanban-shared/chartjs-cdn` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).
- **Ficheiro:** `src/components/kanban-shared/ChecklistCard.tsx` — **não** foi encontrada a substring de import `@/components/kanban-shared/ChecklistCard` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).
- **Ficheiro:** `src/components/kanban-shared/kanban-card-modal-helpers.tsx` — **não** foi encontrada a substring de import `@/components/kanban-shared/kanban-card-modal-helpers` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).
- **Ficheiro:** `src/components/kanban-shared/kanbanBoardFiltros.ts` — **não** foi encontrada a substring de import `@/components/kanban-shared/kanbanBoardFiltros` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).
- **Ficheiro:** `src/components/kanban-shared/KanbanBoardFiltrosPanel.tsx` — **não** foi encontrada a substring de import `@/components/kanban-shared/KanbanBoardFiltrosPanel` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).
- **Ficheiro:** `src/components/kanban-shared/KanbanColumn.tsx` — **não** foi encontrada a substring de import `@/components/kanban-shared/KanbanColumn` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).
- **Ficheiro:** `src/components/kanban-shared/KanbanInteracoesFiltrosPanel.tsx` — **não** foi encontrada a substring de import `@/components/kanban-shared/KanbanInteracoesFiltrosPanel` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).
- **Ficheiro:** `src/components/kanban-shared/KanbanPainelTabsShell.tsx` — **não** foi encontrada a substring de import `@/components/kanban-shared/KanbanPainelTabsShell` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).
- **Ficheiro:** `src/components/kanban-shared/PainelPerformanceDashboard.tsx` — **não** foi encontrada a substring de import `@/components/kanban-shared/PainelPerformanceDashboard` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).
- **Ficheiro:** `src/components/PortalSidebar.tsx` — **não** foi encontrada a substring de import `@/components/PortalSidebar` noutro ficheiro de `src` (apenas o próprio ficheiro é ignorado).

## 2. Páginas `page.tsx` cuja rota (URL) não aparece como string noutro ficheiro de `src`

- **Ficheiro:** `src/app/acoplamento-pl/alteracoes-acoplamento/page.tsx`  **Rota:** `/acoplamento-pl/alteracoes-acoplamento` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/acoplamento-pl/checklist-legal/page.tsx`  **Rota:** `/acoplamento-pl/checklist-legal` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/acoplamento-pl/modelagem-casa-gbox/page.tsx`  **Rota:** `/acoplamento-pl/modelagem-casa-gbox` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/acoplamento-pl/modelagem-terreno/page.tsx`  **Rota:** `/acoplamento-pl/modelagem-terreno` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/acoplamento-pl/resumo-manuais/page.tsx`  **Rota:** `/acoplamento-pl/resumo-manuais` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/acoplamento-pl/validacao-acoplamento/page.tsx`  **Rota:** `/acoplamento-pl/validacao-acoplamento` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/funil-stepone/novo/page.tsx`  **Rota:** `/funil-stepone/novo` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/funil-stepone/[id]/page.tsx`  **Rota:** `/funil-stepone/[id]` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/painel/documentos/page.tsx`  **Rota:** `/painel/documentos` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/painel-novos-negocios/tarefas/page.tsx`  **Rota:** `/painel-novos-negocios/tarefas` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/processo-seletivo-candidatos/contrato-franquia/page.tsx`  **Rota:** `/processo-seletivo-candidatos/contrato-franquia` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/processo-seletivo-candidatos/due-diligence-avaliacao-inicial/page.tsx`  **Rota:** `/processo-seletivo-candidatos/due-diligence-avaliacao-inicial` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/processo-seletivo-candidatos/forms-cof/page.tsx`  **Rota:** `/processo-seletivo-candidatos/forms-cof` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/processo-seletivo-candidatos/termo-scr/page.tsx`  **Rota:** `/processo-seletivo-candidatos/termo-scr` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/public/forms/[formType]/page.tsx`  **Rota:** `/public/forms/[formType]` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/rede-franqueados/[id]/page.tsx`  **Rota:** `/rede-franqueados/[id]` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/sirene/[id]/page.tsx`  **Rota:** `/sirene/[id]` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/step-2/[id]/page.tsx`  **Rota:** `/step-2/[id]` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/[etapa]/page.tsx`  **Rota:** `/step-one/[id]/etapa/[etapa]` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/step-one/[id]/page.tsx`  **Rota:** `/step-one/[id]` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/page.tsx`  **Rota:** `/steps-viabilidade` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/tarefas/page.tsx`  **Rota:** `/steps-viabilidade/tarefas` — **não** foi encontrada esta path como string em `src` (p.ex. `Link`, `href`, `router.push`, `redirect`); a heurística não vê ligação dinâmica nem middleware fora de `src`.

## 3. Ficheiros `actions.ts` (e `src/lib/actions/**`): `export` com nome sem `import` desse identificador a partir de outro ficheiro

- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `criarInteracao` — **não** foi encontrado `import` nomeado, default, nem `* as criarInteracao` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `editarInteracao` — **não** foi encontrado `import` nomeado, default, nem `* as editarInteracao` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `criarSubInteracao` — **não** foi encontrado `import` nomeado, default, nem `* as criarSubInteracao` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `atualizarStatusSubInteracao` — **não** foi encontrado `import` nomeado, default, nem `* as atualizarStatusSubInteracao` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `finalizarCard` — **não** foi encontrado `import` nomeado, default, nem `* as finalizarCard` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `arquivarCard` — **não** foi encontrado `import` nomeado, default, nem `* as arquivarCard` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `desarquivarCard` — **não** foi encontrado `import` nomeado, default, nem `* as desarquivarCard` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `listarArquivados` — **não** foi encontrado `import` nomeado, default, nem `* as listarArquivados` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `salvarDadosPreObra` — **não** foi encontrado `import` nomeado, default, nem `* as salvarDadosPreObra` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `uploadContratoFranquia` — **não** foi encontrado `import` nomeado, default, nem `* as uploadContratoFranquia` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `salvarInstrucoesFase` — **não** foi encontrado `import` nomeado, default, nem `* as salvarInstrucoesFase` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `listarVinculosCard` — **não** foi encontrado `import` nomeado, default, nem `* as listarVinculosCard` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `buscarCardsParaVinculo` — **não** foi encontrado `import` nomeado, default, nem `* as buscarCardsParaVinculo` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `criarVinculoCard` — **não** foi encontrado `import` nomeado, default, nem `* as criarVinculoCard` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `removerVinculoCard` — **não** foi encontrado `import` nomeado, default, nem `* as removerVinculoCard` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `listarAnexosChamado` — **não** foi encontrado `import` nomeado, default, nem `* as listarAnexosChamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `listarAnexosSubchamado` — **não** foi encontrado `import` nomeado, default, nem `* as listarAnexosSubchamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `getSignedUrlAnexo` — **não** foi encontrado `import` nomeado, default, nem `* as getSignedUrlAnexo` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `adicionarAnexoChamado` — **não** foi encontrado `import` nomeado, default, nem `* as adicionarAnexoChamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `adicionarAnexoSubchamado` — **não** foi encontrado `import` nomeado, default, nem `* as adicionarAnexoSubchamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `removerAnexoChamado` — **não** foi encontrado `import` nomeado, default, nem `* as removerAnexoChamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `removerAnexoSubchamado` — **não** foi encontrado `import` nomeado, default, nem `* as removerAnexoSubchamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `listarChecklistCard` — **não** foi encontrado `import` nomeado, default, nem `* as listarChecklistCard` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `criarChecklistItem` — **não** foi encontrado `import` nomeado, default, nem `* as criarChecklistItem` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `toggleChecklistItem` — **não** foi encontrado `import` nomeado, default, nem `* as toggleChecklistItem` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `deletarChecklistItem` — **não** foi encontrado `import` nomeado, default, nem `* as deletarChecklistItem` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `verificarChecklistParaFase` — **não** foi encontrado `import` nomeado, default, nem `* as verificarChecklistParaFase` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `solicitarAprovacaoFase` — **não** foi encontrado `import` nomeado, default, nem `* as solicitarAprovacaoFase` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `aprovarPassagemFase` — **não** foi encontrado `import` nomeado, default, nem `* as aprovarPassagemFase` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/lib/actions/card-actions.ts`  **identificador:** `rejeitarPassagemFase` — **não** foi encontrado `import` nomeado, default, nem `* as rejeitarPassagemFase` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/admin/sla/actions.ts`  **identificador:** `atualizarSlaFase` — **não** foi encontrado `import` nomeado, default, nem `* as atualizarSlaFase` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/admin/usuarios/actions.ts`  **identificador:** `updateUserRole` — **não** foi encontrado `import` nomeado, default, nem `* as updateUserRole` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/admin/usuarios/actions.ts`  **identificador:** `updateUserCargo` — **não** foi encontrado `import` nomeado, default, nem `* as updateUserCargo` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/admin/usuarios/actions.ts`  **identificador:** `inviteAllUsersNotLoggedIn` — **não** foi encontrado `import` nomeado, default, nem `* as inviteAllUsersNotLoggedIn` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/admin/usuarios/actions.ts`  **identificador:** `inviteAllPendingUsers` — **não** foi encontrado `import` nomeado, default, nem `* as inviteAllPendingUsers` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/admin/usuarios/actions.ts`  **identificador:** `resendInviteEmailsPreviouslyConfirmed` — **não** foi encontrado `import` nomeado, default, nem `* as resendInviteEmailsPreviouslyConfirmed` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/admin/usuarios/actions.ts`  **identificador:** `sendInviteEmailForActiveTokensNeverDelivered` — **não** foi encontrado `import` nomeado, default, nem `* as sendInviteEmailForActiveTokensNeverDelivered` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/juridico/actions.ts`  **identificador:** `setJuridicoRespostaPublica` — **não** foi encontrado `import` nomeado, default, nem `* as setJuridicoRespostaPublica` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/juridico/actions.ts`  **identificador:** `addJuridicoComentarioInterno` — **não** foi encontrado `import` nomeado, default, nem `* as addJuridicoComentarioInterno` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/perfil/actions.ts`  **identificador:** `atualizarPerfilBasico` — **não** foi encontrado `import` nomeado, default, nem `* as atualizarPerfilBasico` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `getTimesParaTopicos` — **não** foi encontrado `import` nomeado, default, nem `* as getTimesParaTopicos` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `getTopicosChamado` — **não** foi encontrado `import` nomeado, default, nem `* as getTopicosChamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `salvarResolucaoComTopicos` — **não** foi encontrado `import` nomeado, default, nem `* as salvarResolucaoComTopicos` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `definirPrioridade` — **não** foi encontrado `import` nomeado, default, nem `* as definirPrioridade` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `editarChamado` — **não** foi encontrado `import` nomeado, default, nem `* as editarChamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `salvarResolucaoPontual` — **não** foi encontrado `import` nomeado, default, nem `* as salvarResolucaoPontual` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `concluirTopico` — **não** foi encontrado `import` nomeado, default, nem `* as concluirTopico` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `aprovarTopico` — **não** foi encontrado `import` nomeado, default, nem `* as aprovarTopico` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `reprovarTopico` — **não** foi encontrado `import` nomeado, default, nem `* as reprovarTopico` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `fecharChamado` — **não** foi encontrado `import` nomeado, default, nem `* as fecharChamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `concluirChamadoCriador` — **não** foi encontrado `import` nomeado, default, nem `* as concluirChamadoCriador` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `listAnexosChamado` — **não** foi encontrado `import` nomeado, default, nem `* as listAnexosChamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `uploadAnexoChamado` — **não** foi encontrado `import` nomeado, default, nem `* as uploadAnexoChamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `getAnexoChamadoDownloadUrl` — **não** foi encontrado `import` nomeado, default, nem `* as getAnexoChamadoDownloadUrl` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `listPericias` — **não** foi encontrado `import` nomeado, default, nem `* as listPericias` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `vincularChamadoPericia` — **não** foi encontrado `import` nomeado, default, nem `* as vincularChamadoPericia` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `getPericiaDoChamado` — **não** foi encontrado `import` nomeado, default, nem `* as getPericiaDoChamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `listMensagensChamado` — **não** foi encontrado `import` nomeado, default, nem `* as listMensagensChamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `getParticipantesChamado` — **não** foi encontrado `import` nomeado, default, nem `* as getParticipantesChamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `enviarMensagemChamado` — **não** foi encontrado `import` nomeado, default, nem `* as enviarMensagemChamado` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `inserirMencoes` — **não** foi encontrado `import` nomeado, default, nem `* as inserirMencoes` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `getNotificacoesResumo` — **não** foi encontrado `import` nomeado, default, nem `* as getNotificacoesResumo` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/actions.ts`  **identificador:** `marcarNotificacaoLida` — **não** foi encontrado `import` nomeado, default, nem `* as marcarNotificacaoLida` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/chamados/actions.ts`  **identificador:** `atualizarStatusInteracaoSirene` — **não** foi encontrado `import` nomeado, default, nem `* as atualizarStatusInteracaoSirene` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/chamados/actions.ts`  **identificador:** `atualizarInteracaoCompletaSirene` — **não** foi encontrado `import` nomeado, default, nem `* as atualizarInteracaoCompletaSirene` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/chamados/actions.ts`  **identificador:** `listarComentariosCardSirene` — **não** foi encontrado `import` nomeado, default, nem `* as listarComentariosCardSirene` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/sirene/chamados/actions.ts`  **identificador:** `publicarComentarioCardSirene` — **não** foi encontrado `import` nomeado, default, nem `* as publicarComentarioCardSirene` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-3/actions.ts`  **identificador:** `getStep3ModalIsOwner` — **não** foi encontrado `import` nomeado, default, nem `* as getStep3ModalIsOwner` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-7/actions.ts`  **identificador:** `getStep7ModalIsOwner` — **não** foi encontrado `import` nomeado, default, nem `* as getStep7ModalIsOwner` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `buscarCondominiosViaZap` — **não** foi encontrado `import` nomeado, default, nem `* as buscarCondominiosViaZap` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `saveChecklistCondominio` — **não** foi encontrado `import` nomeado, default, nem `* as saveChecklistCondominio` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `saveEtapa2` — **não** foi encontrado `import` nomeado, default, nem `* as saveEtapa2` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `addCasaListing` — **não** foi encontrado `import` nomeado, default, nem `* as addCasaListing` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `saveZapItemsEtapa4` — **não** foi encontrado `import` nomeado, default, nem `* as saveZapItemsEtapa4` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `updateCasaCompatibilidadeMoni` — **não** foi encontrado `import` nomeado, default, nem `* as updateCasaCompatibilidadeMoni` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `updateCasaStatus` — **não** foi encontrado `import` nomeado, default, nem `* as updateCasaStatus` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `validarStatusCasasManuais` — **não** foi encontrado `import` nomeado, default, nem `* as validarStatusCasasManuais` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `saveZapItemsEtapa5` — **não** foi encontrado `import` nomeado, default, nem `* as saveZapItemsEtapa5` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `addLoteListing` — **não** foi encontrado `import` nomeado, default, nem `* as addLoteListing` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `saveCasasEscolhidasEtapa5` — **não** foi encontrado `import` nomeado, default, nem `* as saveCasasEscolhidasEtapa5` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `saveBatalhaCasasEtapa5` — **não** foi encontrado `import` nomeado, default, nem `* as saveBatalhaCasasEtapa5` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `saveScoreBatalhaPdfUrl` — **não** foi encontrado `import` nomeado, default, nem `* as saveScoreBatalhaPdfUrl` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `deleteLoteListing` — **não** foi encontrado `import` nomeado, default, nem `* as deleteLoteListing` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `saveLoteEscolhidoEtapa4` — **não** foi encontrado `import` nomeado, default, nem `* as saveLoteEscolhidoEtapa4` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/step-one/[id]/etapa/actions.ts`  **identificador:** `saveEtapa5JustificativasRanking` — **não** foi encontrado `import` nomeado, default, nem `* as saveEtapa5JustificativasRanking` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/actions.ts`  **identificador:** `getResumoProcessoStep1` — **não** foi encontrado `import` nomeado, default, nem `* as getResumoProcessoStep1` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/actions.ts`  **identificador:** `getRelacionadosProcesso` — **não** foi encontrado `import` nomeado, default, nem `* as getRelacionadosProcesso` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/actions.ts`  **identificador:** `updateDadosPreObra` — **não** foi encontrado `import` nomeado, default, nem `* as updateDadosPreObra` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/actions.ts`  **identificador:** `atualizarFaseContabilidadeDashboard` — **não** foi encontrado `import` nomeado, default, nem `* as atualizarFaseContabilidadeDashboard` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/actions.ts`  **identificador:** `atualizarFaseCreditoDashboard` — **não** foi encontrado `import` nomeado, default, nem `* as atualizarFaseCreditoDashboard` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/actions.ts`  **identificador:** `toggleTravaPainel` — **não** foi encontrado `import` nomeado, default, nem `* as toggleTravaPainel` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/actions.ts`  **identificador:** `cancelarProcessoPainel` — **não** foi encontrado `import` nomeado, default, nem `* as cancelarProcessoPainel` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/actions.ts`  **identificador:** `removerProcessoPainel` — **não** foi encontrado `import` nomeado, default, nem `* as removerProcessoPainel` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/checklist-contabilidade/actions.ts`  **identificador:** `getChecklistContabilidadeForCard` — **não** foi encontrado `import` nomeado, default, nem `* as getChecklistContabilidadeForCard` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/checklist-contabilidade/actions.ts`  **identificador:** `findChecklistContabilidadeByCnpj` — **não** foi encontrado `import` nomeado, default, nem `* as findChecklistContabilidadeByCnpj` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/checklist-contabilidade/actions.ts`  **identificador:** `saveChecklistContabilidadeDraft` — **não** foi encontrado `import` nomeado, default, nem `* as saveChecklistContabilidadeDraft` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/checklist-contabilidade/actions.ts`  **identificador:** `concluirChecklistContabilidade` — **não** foi encontrado `import` nomeado, default, nem `* as concluirChecklistContabilidade` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/checklist-credito/actions.ts`  **identificador:** `getChecklistCreditoForCard` — **não** foi encontrado `import` nomeado, default, nem `* as getChecklistCreditoForCard` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/checklist-credito/actions.ts`  **identificador:** `saveChecklistCreditoDraft` — **não** foi encontrado `import` nomeado, default, nem `* as saveChecklistCreditoDraft` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/checklist-credito/actions.ts`  **identificador:** `concluirChecklistCredito` — **não** foi encontrado `import` nomeado, default, nem `* as concluirChecklistCredito` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/checklist-credito/actions.ts`  **identificador:** `removeChecklistCreditoFile` — **não** foi encontrado `import` nomeado, default, nem `* as removeChecklistCreditoFile` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/checklist-legal/actions.ts`  **identificador:** `getChecklistLegalForCard` — **não** foi encontrado `import` nomeado, default, nem `* as getChecklistLegalForCard` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/checklist-legal/actions.ts`  **identificador:** `saveChecklistLegalDraft` — **não** foi encontrado `import` nomeado, default, nem `* as saveChecklistLegalDraft` a partir de outro ficheiro de `src`.
- **Ficheiro:** `src/app/steps-viabilidade/checklist-legal/actions.ts`  **identificador:** `concluirChecklistLegal` — **não** foi encontrado `import` nomeado, default, nem `* as concluirChecklistLegal` a partir de outro ficheiro de `src`.

## 4. Hooks (pastas `src/hooks/`, `src/lib/hooks/`): ficheiro não importado

*Nada reportado com esta heurística.*

## 5. Tipos (`export type` / `export interface`) com nome de tipo sem ocorrência noutro ficheiro de `src`

### 5.1. Em `src/types/**` (exceto `.d.ts`)

- `src/types/domain.ts` — `EtapaId` — **não** ocorre o nome noutro ficheiro (texto) em `src` excluindo o próprio ficheiro. *Pode ser falso positivo* (nomes comuns, só usados em ficheiros fora de `src`, etc.).
- `src/types/domain.ts` — `EtapaProgresso` — **não** ocorre o nome noutro ficheiro (texto) em `src` excluindo o próprio ficheiro. *Pode ser falso positivo* (nomes comuns, só usados em ficheiros fora de `src`, etc.).
- `src/types/sirene.ts` — `TopicoStatus` — **não** ocorre o nome noutro ficheiro (texto) em `src` excluindo o próprio ficheiro. *Pode ser falso positivo* (nomes comuns, só usados em ficheiros fora de `src`, etc.).
- `src/types/sirene.ts` — `ChamadoTipo` — **não** ocorre o nome noutro ficheiro (texto) em `src` excluindo o próprio ficheiro. *Pode ser falso positivo* (nomes comuns, só usados em ficheiros fora de `src`, etc.).
- `src/types/sirene.ts` — `RedirecionarHDMInput` — **não** ocorre o nome noutro ficheiro (texto) em `src` excluindo o próprio ficheiro. *Pode ser falso positivo* (nomes comuns, só usados em ficheiros fora de `src`, etc.).

### 5.2. Ficheiros `.ts` de topo em `src/lib/*.ts` (não subpastas) — `export` com nome a começar por maiúscula e nome não reutilizado

- `src/lib/admin-convite-grupos.ts` — `FunilKanbanNome` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/apify-zap.ts` — `ZapRunDebug` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/apify-zap.ts` — `RunZapResult` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/atividades-card-listagem.ts` — `SituacaoChecklistEfetiva` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/autentique.ts` — `CreateDocumentResult` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/bca-calc.ts` — `CenarioNome` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/bca-calc.ts` — `DebtSlice` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/document-diff.ts` — `DiffChange` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/document-diff.ts` — `DiffResult` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/email.ts` — `SendEmailResult` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/next-fk-franquia.ts` — `ParsedFK` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/painel-checklist-atraso.ts` — `ChecklistRowForAtraso` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/painel-checklist-atraso.ts` — `CardRowForAtraso` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/painel-coluna-ordem.ts` — `ProcessoOrdemColuna` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/painel-public-edit.ts` — `PainelDbAuthOk` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/painel-public-edit.ts` — `PainelDbAuth` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/painel-step2-em-casa-checklist.ts` — `Step2EmCasaChecklistItem` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/painel-tarefas-filtros.ts` — `TarefaPainelFiltroRow` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/uf.ts` — `UFSigla` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*
- `src/lib/zap-glue-api.ts` — `FetchZapListingsResult` — **não** ocorre o nome a seguir a `import` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*

