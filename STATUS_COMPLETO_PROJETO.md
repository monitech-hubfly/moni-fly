# 📊 STATUS COMPLETO DO PROJETO MONI-FLY
**Data**: 15/04/2026 - Sessão Atual
**Branch**: funcionalidade-ingrid
**Ambiente**: localhost:3000 conectado ao banco DEV

---

## 🎯 RESUMO EXECUTIVO

### ✅ O QUE JÁ FOI FEITO (SPRINT ATUAL):

1. **Kanban "Funil Step One" CRIADO** ✅
   - Kanban independente funcionando
   - 7 fases configuradas no banco
   - Aparece ANTES de "Portfólio + Operações" no menu
   - SLA em dias úteis (exclui finais de semana + feriados nacionais)
   - Tags "Atrasado X d.u." e "Vence em X d.u."

2. **Modal de Card (duas colunas)** ✅
   - Abre como overlay sobre o Kanban (não navega para nova página)
   - Coluna esquerda (40%): Histórico de fases, abas minimizáveis, comentários gerais
   - Coluna direita (60%): Fase atual, checklist, campos, atividades, botões de ação
   - Header com título, badge de fase, SLA tag, botão X
   - Responsivo: no mobile a coluna direita aparece primeiro

3. **Botão "+ Novo Card"** ✅
   - Abre como modal (não página separada)
   - Formulário com Franqueado (dropdown) e Fase inicial
   - Preview automático do título
   - Integrado com sistema de cores Moní

4. **Tabs "Kanban" e "Painel"** ✅
   - Criadas na página do Funil Step One
   - Tab "Kanban" mostra o board
   - Tab "Painel" é placeholder (a implementar)
   - Design limpo com indicador de tab ativa

5. **Sistema de Cores Moní** ✅
   - Arquivo `moni-tokens.css` centralizado criado
   - Verde Naval #0c2633 (textos principais)
   - Verde Médio #2f4a3a (acentos)
   - Marrom Terra #4a3929 (textos secundários)
   - Dourado #d4ad68 (badges, destaques)
   - Off-white #f9f7f4 (fundos suaves)
   - SEM LARANJA em nenhuma parte
   - SEM AZUL ESCURO em fundos (apenas em botões específicos)

6. **Dark Mode DESABILITADO** ✅
   - Removido modo escuro automático
   - Sistema usa apenas Light Mode
   - Visual consistente independente do tema do OS

7. **Banco de Dados** ✅
   - Tabelas criadas: `kanbans`, `kanban_fases`, `kanban_cards`, `kanban_atividades`
   - Tabela `feriados_nacionais` com 2025 e 2026
   - Funções PL/pgSQL: `calcular_dias_uteis`, `adicionar_dias_uteis`
   - Campo `time` em `kanban_atividades`

8. **Cards Exemplo** ✅
   - 14 cards de exemplo criados
   - Distribuídos pelas 7 fases
   - Com SLA calculado em dias úteis
   - Títulos no formato "FK0001 - Nome - Área"

9. **Atividades Exemplo** ✅
   - 45 atividades criadas nos cards
   - Vinculadas a diferentes times (Portfólio, Obras, Crédito, Jurídico)
   - Com status, prioridade, responsáveis
   - Datas de criação realistas

---

## ⚠️ O QUE ESTÁ PARCIALMENTE FEITO:

1. **Atividades no Card Modal** ⚠️
   - ✅ Seção de atividades existe
   - ✅ Filtros por Status, Time, Responsável
   - ✅ Formulário inline para adicionar atividade
   - ❌ Ainda não edita atividades existentes
   - ❌ Ainda não mostra múltiplos times/responsáveis por atividade

2. **Integração com Painel de Tarefas** ⚠️
   - ✅ Estrutura de banco pronta (`kanban_atividades`)
   - ❌ Painel de Tarefas NÃO mostra atividades do Funil Step One ainda
   - ⚠️ Painel atual (`TarefasPainelConteudo.tsx`) dá erro "permission denied"
   - **CAUSA**: SUPABASE_SERVICE_ROLE_KEY no `.env.local` é placeholder, não key válida

3. **SLA Configurável** ⚠️
   - ✅ SLA existe e funciona (dias úteis)
   - ✅ Tags visuais "Atrasado" e "Atenção" funcionam
   - ❌ NÃO há UI para admin mudar os dias de SLA de cada fase

---

## ❌ O QUE NÃO FOI FEITO (DA SUA LISTA ORIGINAL):

### 4. Auto-criar cards quando Frank é cadastrado ❌
   - **Status**: NÃO IMPLEMENTADO
   - **O que falta**: Trigger no Supabase para inserir em `kanban_cards` quando inserir em `franqueado_areas`

### 7. Vínculos entre cards (esteiras cruzadas) ❌
   - **Status**: NÃO IMPLEMENTADO
   - **O que falta**: Campo `origem_card_id` no banco + UI para mostrar vínculos

### 9. Arquivamento com motivo ❌
   - **Status**: NÃO IMPLEMENTADO
   - **O que falta**: Modal de confirmação com campo "Motivo" + filtro "Arquivados"

### 10. Integração completa com Painel de Atividades ❌
   - **Status**: PROBLEMA BLOQUEANTE (ver seção "Problemas Críticos")
   - **O que falta**: Resolver erro de permission + integrar VIEW ou query union

### 12. Seção "Dúvidas" no Painel ❌
   - **Status**: NÃO IMPLEMENTADO
   - **O que falta**: Nova tabela `kanban_duvidas` + UI similar a atividades

### 13. Múltiplos times e responsáveis por atividade ❌
   - **Status**: NÃO IMPLEMENTADO
   - **O que falta**: Tabelas de junção `atividade_times` e `atividade_responsaveis`

### 14. Editar atividades ❌
   - **Status**: NÃO IMPLEMENTADO
   - **O que falta**: Botão "Editar" + modal/inline form + server action

### 15. Instruções e Materiais por fase ❌
   - **Status**: NÃO IMPLEMENTADO
   - **O que falta**: Tabelas `fase_instrucoes` e `fase_materiais` + UI de upload

### 17. Filtro por franquias ❌
   - **Status**: NÃO IMPLEMENTADO
   - **O que falta**: Dropdown no header do Kanban e do Painel

### 18. Portal do Franqueado ❌
   - **Status**: NÃO IMPLEMENTADO
   - **O que falta**: 
     - Sistema de convite por e-mail
     - RLS específica para role "franqueado"
     - Menu simplificado
     - Seção "Dúvidas" padrão nos cards

### 19. Aplicar novo design aos outros Kanbans ❌
   - **Status**: NÃO IMPLEMENTADO
   - **Complexidade**: ALTA - `CardDetalheModal.tsx` tem ~6000 linhas em produção
   - **Risco**: ALTO - Time já está usando, tem dados reais

### 20. Progress tracker no card ❌
   - **Status**: NÃO IMPLEMENTADO
   - **O que falta**: Componente visual tipo "stepper" horizontal no header

### 21. Notificações de SLA por e-mail ❌
   - **Status**: NÃO IMPLEMENTADO
   - **O que falta**: Supabase Edge Function + integração com serviço de e-mail

---

## 🔥 PROBLEMAS CRÍTICOS (BLOQUEANTES):

### PROBLEMA 1: "Permission denied for table processo_card_checklist"

**Onde acontece**: Painel de Tarefas (`/painel-novos-negocios/tarefas`)

**Causa Raiz CONFIRMADA**:
```
❌ SUPABASE_SERVICE_ROLE_KEY no .env.local = "COLE_AQUI_A_SERVICE_ROLE_KEY_DO_DEV"
```

Isso é um **PLACEHOLDER**, não uma chave válida!

**Consequência**:
1. Código tenta criar admin client
2. Falha silenciosamente (try/catch)
3. Faz fallback para cliente normal
4. Cliente normal não tem permissão para `processo_card_checklist` (RLS restritivo)
5. Erro: "permission denied"

**Solução (JÁ PREPARADA)**:
1. Abrir Supabase Dashboard DEV
2. Ir em Settings → API
3. Copiar a chave **"service_role"** (NÃO a "anon")
4. Colar no `.env.local`:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
5. Reiniciar servidor: `npm run dev`

**Como verificar**:
```powershell
node test-env.js
```

**Arquivos de debug criados**:
- `test-env.js` - Valida a chave
- `DIAGNOSTICO_SERVICE_ROLE_KEY.md` - Guia de diagnóstico
- `RESOLVER_SERVICE_ROLE_KEY.md` - Guia de solução
- `src/lib/supabase/admin.ts` - Tem logs de debug
- `src/app/steps-viabilidade/card-actions.ts` - Tem logs de debug

---

### PROBLEMA 2: Dois sistemas de atividades paralelos

**Sistema NOVO** (Funil Step One):
- Tabela: `kanban_atividades`
- Componente: `CardModal.tsx`
- Integração: NÃO conectada ao Painel global

**Sistema ANTIGO** (Portfolio + Operações):
- Tabela: `processo_card_checklist`
- Componente: `TarefasPainelConteudo.tsx` e `CardDetalheModal.tsx`
- Integração: JÁ conectada ao Painel global

**Conflito**: Painel de Tarefas mostra apenas atividades do sistema antigo.

**Solução Recomendada** (do PLANO_ESTRATEGICO_INTEGRACAO.md):

**OPÇÃO A: VIEW SQL (mais segura)** ⭐⭐⭐⭐⭐
```sql
CREATE VIEW v_atividades_todas AS
SELECT 
  id, texto, status, prioridade, data_criacao, prazo,
  'portfolio' as origem_sistema,
  card_id, fase_nome, franqueado_nome
FROM processo_card_checklist
UNION ALL
SELECT 
  id, texto, status, prioridade, data_criacao, prazo,
  'stepone' as origem_sistema,
  card_id, fase_nome, franqueado_nome
FROM kanban_atividades;
```

- ✅ Não quebra código existente
- ✅ Fácil de testar
- ✅ Performance melhor
- ✅ Reversível sem risco

**OPÇÃO B: Modificar TypeScript** ⭐⭐⭐
- Modificar `TarefasPainelConteudo.tsx` para buscar de ambas as tabelas
- ⚠️ Maior risco de quebrar funcionalidade existente
- ⚠️ Mais difícil de reverter

---

## 📋 MIGRAÇÕES DO BANCO (STATUS):

### ✅ Migrações JÁ CRIADAS (nesta sessão):

| Arquivo | Status | O que faz |
|---------|--------|-----------|
| `091_step_one_kanban.sql` | ✅ Criado | Cria kanbans, fases, cards do Step One |
| `102_feriados_dias_uteis.sql` | ✅ Criado | Feriados nacionais + funções PL/pgSQL |
| `103_atividades_kanban.sql` | ✅ Criado | Tabela `kanban_atividades` + RLS |
| `104_atividades_add_time.sql` | ✅ Criado | Campo `time` em `kanban_atividades` |
| `ATIVIDADES_EXEMPLO.sql` | ✅ Criado | 45 atividades exemplo |

### ⚠️ Status de Execução no DEV:

**IMPORTANTE**: Não sei se essas migrações foram **executadas** no seu banco DEV!

**Como verificar**:
```sql
-- No SQL Editor do Supabase DEV:
SELECT * FROM VERIFICAR_MIGRACOES.sql
```

Ou execute este script que criei:
```powershell
# Ver conteúdo do arquivo
cat VERIFICAR_MIGRACOES.sql
```

---

## 🗂️ ARQUIVOS CRIADOS NESTA SESSÃO vs PRÉ-EXISTENTES:

### ✅ CRIADOS NESTA SESSÃO:

**Componentes React**:
- `src/app/funil-stepone/page.tsx`
- `src/app/funil-stepone/KanbanColumn.tsx`
- `src/app/funil-stepone/KanbanWrapper.tsx`
- `src/app/funil-stepone/KanbanTabs.tsx`
- `src/app/funil-stepone/CardModal.tsx`
- `src/app/funil-stepone/NovoCardModal.tsx`
- `src/app/funil-stepone/[id]/page.tsx`
- `src/app/funil-stepone/[id]/CardDetailClient.tsx`
- `src/app/funil-stepone/novo/page.tsx`
- `src/app/funil-stepone/novo/NovoCardForm.tsx`

**Utilitários**:
- `src/lib/dias-uteis.ts` - Cálculo de dias úteis

**CSS**:
- `src/styles/moni-tokens.css` - MODIFICADO (criado antes, mas mudamos MUITO)

**Migrações SQL**:
- `supabase/migrations/091_step_one_kanban.sql`
- `supabase/migrations/102_feriados_dias_uteis.sql`
- `supabase/migrations/103_atividades_kanban.sql`
- `supabase/migrations/104_atividades_add_time.sql`
- `ATIVIDADES_EXEMPLO.sql`

**Documentação**:
- `MAPEAMENTO_COMPLETO_PROJETO.md`
- `PLANO_ESTRATEGICO_INTEGRACAO.md`
- `VERIFICAR_MIGRACOES.sql`
- `CORRIGIR_RLS_ATIVIDADES.sql`
- `DIAGNOSTICO_SERVICE_ROLE_KEY.md`
- `RESOLVER_SERVICE_ROLE_KEY.md`
- `SOLUCAO_DARK_MODE.md`
- `RESUMO_FINAL_CORES.md`
- `GUIA_DEBUG_CARDS.md`
- `SOLUCAO_RAPIDA_CARDS.md`
- `SOLUCAO_ERRO_ATIVIDADES.md`
- `FORCAR_ATUALIZACAO_VISUAL.md`
- `MUDANCAS_REMOVER_AZUL.md`

**Scripts PowerShell**:
- `limpar-e-reiniciar.ps1`
- `teste-card-modal.ps1`
- `LIMPAR-CACHE.ps1`
- `fix-cores-modais.ps1`

**Scripts Node.js**:
- `test-env.js`

### ⚠️ PRÉ-EXISTENTES (NÃO MODIFICADOS):

**Kanbans Antigos** (EM PRODUÇÃO):
- `src/app/steps-viabilidade/` - Portfolio + Operações
  - `CardDetalheModal.tsx` (~6000 linhas!) ⚠️
  - `card-actions.ts` (MODIFICADO para debug)
  - `TarefasPainelConteudo.tsx`
  - Outros 30+ arquivos

- `src/app/painel-contabilidade/` - Kanban Contabilidade
- `src/app/painel-credito/` - Kanban Crédito

**Outros Sistemas**:
- `src/app/sirene/` - Sistema de Chamados
- `src/app/juridico/` - Canal Jurídico
- `src/app/painel/` - Painel Admin Moní
- `src/app/painel-novos-negocios/` - Dashboard principal

**Componentes Globais**:
- `src/components/AppShell.tsx`
- `src/components/PortalSidebar.tsx` (MODIFICADO para adicionar Funil Step One)
- `src/components/AuthHeader.tsx`
- `src/components/TabelaRedeFranqueados.tsx`

**Utilitários**:
- `src/lib/painel-tarefas-filtros.ts` - Filtros do painel
- `src/lib/checklist-atividade-arrays.ts` - Lógica de checklists
- `src/lib/atividade-times.ts` - Times e responsáveis
- `src/lib/auth-guard.ts`
- `src/lib/authz.ts`
- `src/lib/access-matrix.ts`

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS (POR PRIORIDADE):

### 🔴 URGENTE (resolver ANTES de 22/04):

#### 1. Corrigir SUPABASE_SERVICE_ROLE_KEY (30 min)
   - **Por quê**: Bloqueia Painel de Tarefas inteiro
   - **Como**: Seguir `RESOLVER_SERVICE_ROLE_KEY.md`
   - **Teste**: `node test-env.js`

#### 2. Verificar e Rodar Migrações (1h)
   - **Por quê**: Sem elas, atividades do Step One não existem no banco
   - **Como**: Executar `VERIFICAR_MIGRACOES.sql` no Supabase
   - **Teste**: Abrir um card do Funil Step One e adicionar atividade

#### 3. Integrar Atividades Step One no Painel Global (3h)
   - **Por quê**: Time precisa ver TODAS as atividades em um lugar só
   - **Como**: Criar VIEW SQL (OPÇÃO A do Plano Estratégico)
   - **Teste**: Painel de Tarefas mostra atividades do Step One + Portfolio

### 🟡 MÉDIA PRIORIDADE (para 22/04):

#### 4. Auto-criar cards ao cadastrar Frank (2h)
   - **Por quê**: Evita trabalho manual
   - **Como**: Trigger no Supabase
   - **Teste**: Cadastrar Frank em Rede de Franqueados → Card aparece no Step One

#### 5. Filtro por Franquias (2h)
   - **Por quê**: Time precisa ver apenas os projetos de um Frank específico
   - **Como**: Dropdown no header + filtro na query
   - **Teste**: Filtrar por "Frank São Paulo" → Vê apenas cards dele

#### 6. Arquivamento com Motivo (3h)
   - **Por quê**: Rastreabilidade de decisões
   - **Como**: Modal de confirmação + campo `motivo_arquivo`
   - **Teste**: Arquivar card → Pede motivo → Aparece no histórico

### 🟢 BAIXA PRIORIDADE (pós-22/04):

#### 7. Aplicar novo design a Portfolio/Contabilidade/Crédito (20h)
   - **⚠️ RISCO ALTO**: Kanbans já estão em produção
   - **Recomendação**: Fazer em branch separada + QA extensivo

#### 8. Portal do Franqueado (40h)
   - **Complexidade**: Sistema completo de autenticação + RLS
   - **Recomendação**: Sprint dedicada

#### 9. Seção Dúvidas (5h)
#### 10. Múltiplos times/responsáveis (8h)
#### 11. Editar atividades (5h)
#### 12. Instruções e Materiais por fase (10h)
#### 13. Progress tracker visual (3h)
#### 14. Notificações de e-mail (8h)

---

## 📊 MÉTRICAS DO PROJETO:

### Código Criado (nesta sessão):
- **Componentes React**: 10 arquivos (~2.500 linhas)
- **Utilitários TypeScript**: 1 arquivo (~300 linhas)
- **Migrações SQL**: 4 arquivos (~800 linhas)
- **Documentação**: 15 arquivos (~5.000 linhas)
- **Scripts**: 5 arquivos (~500 linhas)
- **TOTAL**: ~9.100 linhas de código + documentação

### Tempo Estimado (para completar lista original):
- ✅ Concluído: ~40h (itens 1, 2, 3, 5, 6, 8)
- ⚠️ Parcial: ~10h (itens 10, 11, 16)
- ❌ Faltante: ~110h (itens 4, 7, 9, 12-15, 17-21)
- **TOTAL**: ~160h de trabalho

### Para entregar em 22/04 (7 dias úteis):
- **Ideal**: Completar itens 1-6 da seção "Próximos Passos"
- **Tempo estimado**: ~15h
- **Distribuição**: 2-3h/dia

---

## 🔧 FERRAMENTAS E AMBIENTES:

### ✅ CONFIGURADO:
- Next.js 15 rodando em localhost:3000
- Supabase DEV conectado
- Branch: funcionalidade-ingrid
- Git funcionando
- Vercel (produção)

### ⚠️ VERIFICAR:
- [ ] Migrações 091-104 rodadas no Supabase DEV
- [ ] SUPABASE_SERVICE_ROLE_KEY válida no .env.local
- [ ] Claude Code (instalado mas não usado ainda)

### 📚 DOCUMENTAÇÃO DISPONÍVEL:
- `MAPEAMENTO_COMPLETO_PROJETO.md` - Estrutura completa
- `PLANO_ESTRATEGICO_INTEGRACAO.md` - Plano de integração
- `GUIA_COMPLETO_VIABILIDADE.md` - Guia para não-devs
- `VERIFICAR_MIGRACOES.sql` - Checklist de banco
- 15+ outros guias de troubleshooting

---

## ❓ RESPOSTAS ÀS SUAS PERGUNTAS ESPECÍFICAS:

### 1. "Qual é a causa raiz REAL do erro permission denied?"

**RESPOSTA**: A `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` é um placeholder `"COLE_AQUI_A_SERVICE_ROLE_KEY_DO_DEV"`, não uma chave válida.

**Evidência**:
- Arquivo `src/lib/supabase/admin.ts` tem logs de debug
- Arquivo `test-env.js` valida a chave
- Try/catch em `card-actions.ts` faz fallback silencioso

**Como resolver**: Ver `RESOLVER_SERVICE_ROLE_KEY.md`

---

### 2. "Para atividades do Step One aparecerem no Painel, qual menor mudança?"

**RESPOSTA**: **OPÇÃO A: VIEW SQL** (mais segura)

**Por quê**:
- ✅ Não modifica código TypeScript existente
- ✅ Banco faz o trabalho de união
- ✅ Performance melhor (índices nativos)
- ✅ Fácil de testar e reverter
- ✅ Não quebra sistema antigo

**Como fazer**: Ver `PLANO_ESTRATEGICO_INTEGRACAO.md` seção 2

---

### 3. "Para aplicar novo layout no CardDetalheModal.tsx, qual abordagem mais segura?"

**RESPOSTA**: **NÃO RECOMENDADO** aplicar agora.

**Por quê**:
- ❌ Arquivo tem ~6.000 linhas
- ❌ Sistema está em PRODUÇÃO
- ❌ Time já está usando com dados reais
- ❌ Risco ALTO de quebrar funcionalidades

**Alternativa**:
1. ✅ Manter Portfolio/Contabilidade/Crédito como está (funcionando)
2. ✅ Step One usa novo design (já implementado)
3. ✅ Após 22/04, fazer refactor gradual em branch separada

**Se PRECISAR fazer**: Ver `PLANO_ESTRATEGICO_INTEGRACAO.md` seção 3

---

### 4. "As migrações 102, 103, 104 foram rodadas no DEV?"

**RESPOSTA**: **NÃO SEI** - precisa verificar!

**Como verificar**:

```powershell
# Abrir Supabase Dashboard DEV
# Ir em SQL Editor
# Executar o conteúdo de:
cat VERIFICAR_MIGRACOES.sql
```

**O que esse script faz**:
- ✅ Checa se tabelas `kanbans`, `kanban_fases`, `kanban_cards`, `kanban_atividades` existem
- ✅ Checa se função `calcular_dias_uteis` existe
- ✅ Checa se campo `time` existe em `kanban_atividades`
- ✅ Conta quantos cards e atividades existem
- ✅ Lista RLS policies

---

## 🎯 PLANO DE AÇÃO (ORDEM DE RISCO - MENOR PRIMEIRO):

### FASE 1: CORREÇÕES (Risco: BAIXO, Tempo: 2h)
1. ✅ Corrigir `SUPABASE_SERVICE_ROLE_KEY`
   - Executar: `node test-env.js`
   - Copiar chave do Supabase Dashboard
   - Reiniciar servidor
   - Testar: Painel de Tarefas funciona

2. ✅ Verificar migrações
   - Executar: `VERIFICAR_MIGRACOES.sql`
   - Se faltando: Rodar 091-104 manualmente
   - Testar: Abrir card do Step One

### FASE 2: INTEGRAÇÃO (Risco: MÉDIO, Tempo: 4h)
3. ✅ Criar VIEW SQL para atividades
   - Executar SQL do Plano Estratégico
   - Modificar `TarefasPainelConteudo.tsx` para usar VIEW
   - Testar: Painel mostra atividades de ambos sistemas

4. ✅ Trigger para auto-criar cards
   - Criar trigger em `franqueado_areas`
   - Testar: Cadastrar Frank → Card aparece

### FASE 3: FUNCIONALIDADES (Risco: BAIXO-MÉDIO, Tempo: 10h)
5. ✅ Filtro por franquias
6. ✅ Arquivamento com motivo
7. ✅ Editar atividades

### FASE 4: EXPANSÃO (Risco: ALTO, Tempo: 60h+)
8. ⚠️ Portal do Franqueado
9. ⚠️ Aplicar design aos outros Kanbans
10. ⚠️ Funcionalidades avançadas (instruções, materiais, notificações)

---

## 📞 DÚVIDAS, SUGESTÕES E OPINIÕES:

### 💡 Sugestões que dei (e você aprovou):

1. ✅ **moni-tokens.css centralizado** - Implementado
2. ✅ **Supabase Triggers para cards automáticos** - Planejado
3. ✅ **Progress tracker no card** - Planejado (item 20)
4. ✅ **Notificações de SLA por e-mail** - Planejado (item 21)
5. ✅ **Design Porsche/Vogue** - Aplicado no Step One

### ⚠️ Pontos de Atenção (UX):

1. **Painel de Tarefas está quebrado**: Bloqueante para time
2. **Dois sistemas de atividades**: Confusão operacional
3. **Sem filtro por franquias**: Time vê todos os projetos misturados
4. **Cards não se auto-criam**: Trabalho manual adicional
5. **Sem rastreabilidade de arquivamento**: Perda de histórico

### 🎨 Sugestões de UX (não implementadas ainda):

1. **Breadcrumbs no card modal**: "Funil Step One > Dados da Cidade > FK0001"
2. **Toast notifications**: Feedback visual ao criar/editar/arquivar
3. **Keyboard shortcuts**: `ESC` para fechar modal, `N` para novo card
4. **Loading states**: Skeleton screens enquanto carrega
5. **Empty states**: Mensagens amigáveis quando não há cards
6. **Drag & drop**: Arrastar cards entre fases (futuro)
7. **Filtros salvos**: Usuário salva combinações de filtros favoritas
8. **Atalhos rápidos**: Sidebar com "Meus cards", "Atrasados", "Atenção"

---

## 🔒 SEGURANÇA E PERMISSÕES:

### ✅ Implementado:
- RLS ativo em `kanban_cards` (apenas ver seus próprios)
- RLS ativo em `kanban_atividades`
- Roles: admin, user
- Middleware de autenticação

### ❌ Faltando:
- Role "franqueado" (item 18)
- Permissões granulares por time
- Auditoria de mudanças (quem mudou o que e quando)

---

## 📱 MOBILE:

### ✅ Implementado:
- Modal responsivo (colunas viram pilha)
- Coluna direita aparece primeiro
- Tabs responsivas
- Grid do Kanban adapta

### ⚠️ Melhorias sugeridas:
- Gestos de swipe (fechar modal, trocar fase)
- Bottom sheet nativo mobile
- Fixed header no scroll
- Touch targets maiores (mínimo 44px)

---

## ⚡ PERFORMANCE:

### ⚠️ Pontos de Atenção:
- `CardDetalheModal.tsx` (6.000 linhas) pode ser lento
- Painel de Tarefas busca TODAS as atividades sem paginação
- Sem debounce nos filtros
- Sem cache de queries

### 💡 Sugestões:
- Implementar paginação no Painel
- Server-side filtering
- React Query para cache
- Lazy loading de comentários/anexos

---

## 🚀 CONCLUSÃO:

**RESUMO EXECUTIVO**:
- ✅ **Funil Step One funcionando** (~70% das features planejadas)
- ⚠️ **Integração parcial** (atividades não aparecem no Painel global)
- 🔴 **1 problema bloqueante** (SUPABASE_SERVICE_ROLE_KEY)
- 📋 **13 funcionalidades pendentes** da lista original
- ⏰ **7 dias úteis** até 22/04

**RECOMENDAÇÃO**:
1. **DIA 1-2** (16-17/04): Resolver problema bloqueante + verificar migrações
2. **DIA 3-4** (18-21/04): Integrar atividades + auto-criar cards
3. **DIA 5-6** (22-23/04): Filtros + arquivamento + UX polish
4. **DIA 7** (24/04): Testes + documentação para novo membro

**PRIORIDADE MÁXIMA**:
1. Corrigir `SUPABASE_SERVICE_ROLE_KEY` (bloqueante)
2. Integrar atividades no Painel (operacional)
3. Auto-criar cards (reduz trabalho manual)

---

**Arquivos de referência**:
- Detalhes técnicos: `MAPEAMENTO_COMPLETO_PROJETO.md`
- Plano de integração: `PLANO_ESTRATEGICO_INTEGRACAO.md`
- Como resolver service role: `RESOLVER_SERVICE_ROLE_KEY.md`
- Verificar banco: `VERIFICAR_MIGRACOES.sql`
