# PLANO ESTRATÉGICO DE INTEGRAÇÃO
**Data**: 15/04/2026
**Status**: PLANEJAMENTO (NÃO IMPLEMENTAR AINDA)

---

## DIAGNÓSTICO DOS PROBLEMAS

### 1. PROBLEMA: "Permission denied for table processo_card_checklist"

#### CAUSA RAIZ IDENTIFICADA:

**✅ O problema NÃO é falta de SERVICE_ROLE_KEY**

Analisando `src/lib/supabase/admin.ts` e `src/app/steps-viabilidade/card-actions.ts`:

```typescript
// admin.ts linha 8-14
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // ✅ EXISTE no .env.local
  if (!url || !key)
    throw new Error('...');
  return createClient(url, key);
}

// card-actions.ts linha 1321-1338
export async function getAtividadesChecklistPainel() {
  let supabase: SupabaseClient;
  try {
    supabase = createAdminClient(); // ✅ Tenta usar admin client primeiro
  } catch {
    const s = await createClient(); // ⚠️ Fallback para cliente normal
    const { data: { user } } = await s.auth.getUser();
    if (!user) {
      return { ok: false, error: '...' };
    }
    return montarAtividadesChecklistPainel(s); // ❌ USA CLIENTE NORMAL COM RLS
  }
  return montarAtividadesChecklistPainel(supabase); // ✅ USA ADMIN CLIENT
}
```

**CAUSA REAL**: O código tem um **try/catch silencioso**. Se `createAdminClient()` falhar (por qualquer motivo), ele usa o cliente normal que está sujeito a RLS.

**POSSÍVEIS CAUSAS DO ERRO**:

1. **A** - A SERVICE_ROLE_KEY no `.env.local` está **incorreta ou expirada**
2. **B** - O Next.js não está lendo a variável de ambiente (problema de cache)
3. **C** - A função está rodando no **lado do cliente** (onde .env não está disponível)
4. **D** - RLS da tabela `processo_card_checklist` está **muito restritivo** (bloqueia até admin)

**COMO VERIFICAR**:

```typescript
// Adicionar log temporário em card-actions.ts linha 1322:
try {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('[DEBUG] SERVICE_ROLE_KEY exists:', !!key);
  console.log('[DEBUG] SERVICE_ROLE_KEY length:', key?.length);
  supabase = createAdminClient();
  console.log('[DEBUG] Admin client created successfully');
} catch (err) {
  console.error('[DEBUG] Admin client failed:', err);
  // ... resto do código
}
```

**SOLUÇÃO RECOMENDADA** (em ordem de segurança):

1. ✅ **Verificar se a key no .env.local está correta** (comparar com Supabase Dashboard)
2. ✅ **Reiniciar o servidor Next.js** após qualquer mudança no .env
3. ✅ **Verificar RLS da tabela** `processo_card_checklist`:
   ```sql
   -- Ver políticas RLS atuais
   SELECT * FROM pg_policies WHERE tablename = 'processo_card_checklist';
   
   -- Testar acesso direto (no SQL Editor do Supabase)
   SELECT COUNT(*) FROM processo_card_checklist;
   ```
4. ✅ **Temporariamente desabilitar RLS** para testar (APENAS EM DEV):
   ```sql
   ALTER TABLE processo_card_checklist DISABLE ROW LEVEL SECURITY;
   -- Testar
   -- Depois reabilitar:
   ALTER TABLE processo_card_checklist ENABLE ROW LEVEL SECURITY;
   ```

---

### 2. PROBLEMA: Integrar atividades do Funil Step One no Painel de Tarefas global

#### ANÁLISE DAS OPÇÕES:

| Critério | Opção A: VIEW SQL | Opção B: Modificar TypeScript |
|----------|-------------------|-------------------------------|
| **Segurança** | ⭐⭐⭐⭐⭐ Mais segura | ⭐⭐⭐ Menos segura |
| **Complexidade** | ⭐⭐⭐ Média | ⭐⭐ Baixa |
| **Performance** | ⭐⭐⭐⭐ Melhor | ⭐⭐⭐ OK |
| **Testabilidade** | ⭐⭐⭐⭐⭐ Fácil de testar | ⭐⭐ Requer testes manuais |
| **Reversibilidade** | ⭐⭐⭐⭐⭐ Fácil (DROP VIEW) | ⭐⭐ Requer rollback de código |
| **Risco para sistema antigo** | ⭐⭐⭐⭐⭐ Zero risco | ⭐⭐⭐ Risco médio |

#### RECOMENDAÇÃO: **OPÇÃO A - VIEW SQL**

**POR QUÊ?**

1. ✅ **Não toca no código TypeScript do sistema antigo** (zero risco de quebrar)
2. ✅ **Fácil de testar isoladamente** no SQL Editor do Supabase
3. ✅ **Fácil de reverter** (`DROP VIEW`) se algo der errado
4. ✅ **Melhor performance** (banco faz o JOIN, não o JS)
5. ✅ **RLS aplicado automaticamente** pela VIEW
6. ✅ **Modificação mínima no TypeScript** (apenas mudar o `.from('processo_card_checklist')` para `.from('view_atividades_unificadas')`)

#### IMPLEMENTAÇÃO PROPOSTA:

**PASSO 1: Criar VIEW unificada (SQL)**

```sql
-- Migration: 105_view_atividades_unificadas.sql

CREATE OR REPLACE VIEW public.view_atividades_unificadas AS
-- Atividades do sistema ANTIGO (processo_card_checklist)
SELECT
  id,
  processo_id AS card_id, -- Normaliza nome
  'portfolio' AS origem_sistema, -- Tag de origem
  etapa_painel,
  titulo,
  times_nomes,
  responsaveis_nomes,
  time_nome,
  responsavel_nome,
  prazo,
  status,
  concluido,
  NULL AS prioridade, -- Sistema antigo não tem
  NULL AS data_vencimento, -- Usar 'prazo' convertido
  NULL AS time, -- Sistema antigo não tem
  created_at,
  updated_at
FROM processo_card_checklist

UNION ALL

-- Atividades do sistema NOVO (kanban_atividades)
SELECT
  ka.id,
  ka.card_id,
  'funil_stepone' AS origem_sistema,
  kf.nome AS etapa_painel, -- Nome da fase como 'etapa_painel'
  ka.titulo,
  ARRAY[]::text[] AS times_nomes, -- Sistema novo não usa arrays
  CASE 
    WHEN p.full_name IS NOT NULL THEN ARRAY[p.full_name]
    ELSE ARRAY[]::text[]
  END AS responsaveis_nomes,
  NULL AS time_nome,
  p.full_name AS responsavel_nome,
  TO_CHAR(ka.data_vencimento, 'DD/MM/YYYY') AS prazo, -- Converte DATE para formato antigo
  CASE ka.status
    WHEN 'pendente' THEN 'nao_iniciada'
    WHEN 'em_andamento' THEN 'em_andamento'
    WHEN 'concluido' THEN 'concluido'
    ELSE 'nao_iniciada'
  END AS status,
  (ka.status = 'concluido') AS concluido,
  ka.prioridade,
  ka.data_vencimento,
  ka.time,
  ka.created_at,
  ka.updated_at
FROM kanban_atividades ka
LEFT JOIN kanban_cards kc ON kc.id = ka.card_id
LEFT JOIN kanban_fases kf ON kf.id = kc.fase_id
LEFT JOIN profiles p ON p.id = ka.responsavel_id;

COMMENT ON VIEW public.view_atividades_unificadas IS 
'View unificada de atividades dos sistemas antigo (Portfolio) e novo (Funil Step One).
Permite que o Painel de Tarefas exiba todas as atividades sem modificar código TypeScript.';
```

**PASSO 2: Modificação mínima no TypeScript**

```typescript
// src/app/steps-viabilidade/card-actions.ts
// Linha ~1200

async function montarAtividadesChecklistPainel(supabase: SupabaseClient) {
  // ANTES:
  // const { data: checklistRows } = await supabase
  //   .from('processo_card_checklist')
  //   ...

  // DEPOIS:
  const { data: checklistRows } = await supabase
    .from('view_atividades_unificadas') // ✅ ÚNICA MUDANÇA
    .select('...')
    ...
}
```

**PASSO 3: RLS da VIEW** (opcional, VIEW herda RLS das tabelas base)

```sql
-- Se necessário, criar políticas específicas para a VIEW
ALTER VIEW public.view_atividades_unificadas OWNER TO postgres;

-- VIEW automaticamente respeita RLS das tabelas base:
-- - processo_card_checklist (RLS já configurado)
-- - kanban_atividades (RLS já configurado)
```

#### VANTAGENS DESTA ABORDAGEM:

1. ✅ **Código TypeScript quase intocado** (1 linha modificada)
2. ✅ **Sistema antigo continua funcionando** exatamente como antes
3. ✅ **Fácil de testar** (query direto no SQL Editor)
4. ✅ **Fácil de reverter** (DROP VIEW + voltar código)
5. ✅ **Performance melhor** (JOIN no banco)
6. ✅ **RLS mantido** (VIEW herda das tabelas)

#### DESVANTAGENS:

1. ⚠️ **Requer migração SQL** (mas é simples e segura)
2. ⚠️ **VIEW pode não suportar INSERT/UPDATE direto** (mas não precisa, já que cada sistema usa sua tabela original)

---

### 3. PROBLEMA: Aplicar novo layout ao CardDetalheModal.tsx (~6000 linhas)

#### ANÁLISE DO RISCO:

**⚠️ ALTAMENTE ARRISCADO**

Motivos:
- 📊 **6000+ linhas de código** (complexo demais para refatorar de uma vez)
- 🏭 **Sistema em produção** (qualquer bug afeta usuários reais)
- 🔗 **Muitas dependências** (Autentique, formulários públicos, checklists, etc.)
- 🧪 **Sem testes automatizados** (impossível validar todas as features)
- 🎨 **Layout atual funciona** (não há urgência técnica)

#### RECOMENDAÇÃO: **NÃO MEXER NO CardDetalheModal.tsx**

**ALTERNATIVA SEGURA**: Aplicar novo layout APENAS no Funil Step One (já feito)

**ESTRATÉGIA DE LONGO PRAZO** (se realmente precisar):

##### Opção 1: **Extração Gradual de Componentes** (MAIS SEGURA)

```
Fase 1: Extrair componentes reutilizáveis do CardDetalheModal.tsx
  ├─ CommentsSection.tsx (seção de comentários)
  ├─ ChecklistSection.tsx (seção de checklist)
  ├─ DocumentsSection.tsx (seção de documentos)
  └─ ActivityHistory.tsx (histórico)

Fase 2: Testar componentes extraídos em NOVA página de teste
  └─ /test/modal-refactored (página oculta para testes)

Fase 3: Criar CardDetalheModalV2.tsx (novo modal usando componentes)
  └─ Testar paralelamente sem afetar o antigo

Fase 4: Feature flag para trocar entre V1 e V2
  └─ Migrar usuário por usuário

Fase 5: Desativar V1 após 100% de confiança
```

**TEMPO ESTIMADO**: 4-6 semanas de trabalho cuidadoso

##### Opção 2: **Manter Dois Modais Separados** (MAIS PRAGMÁTICA)

```
Sistema Antigo (Portfolio):
  └─ CardDetalheModal.tsx (6000 linhas, layout antigo, mantém como está)

Sistema Novo (Funil Step One):
  └─ CardModal.tsx (900 linhas, layout novo, já implementado)

Benefícios:
  ✅ Zero risco para sistema antigo
  ✅ Novo sistema já tem layout moderno
  ✅ Manutenção independente
  ✅ Melhor separação de responsabilidades
```

**RECOMENDAÇÃO FINAL**: **OPÇÃO 2 - Manter separado**

**JUSTIFICATIVA**:
- ✅ Sistema antigo funciona e está em produção
- ✅ Sistema novo já tem o layout desejado
- ✅ Usuários usam sistemas diferentes (Funil Step One vs. Portfolio)
- ✅ Zero risco de quebrar algo crítico
- ✅ Permite evolução independente

**QUANDO CONSIDERAR OPÇÃO 1**:
- Se houver demanda explícita dos usuários
- Se houver bugs críticos no modal antigo
- Se houver tempo para 4-6 semanas de refatoração cuidadosa
- Se houver orçamento para testes extensivos

---

### 4. PROBLEMA: Verificar quais migrações foram rodadas

#### MIGRAÇÕES CRIADAS NESTA SESSÃO:

```
✅ 091_step_one_kanban.sql          - Tabelas kanbans, kanban_fases, kanban_cards
✅ 102_feriados_dias_uteis.sql      - Tabela feriados_nacionais + funções PL/pgSQL
✅ 103_atividades_kanban.sql        - Tabela kanban_atividades
✅ 104_atividades_add_time.sql      - Coluna 'time' em kanban_atividades
```

#### MIGRAÇÕES RELACIONADAS (já existentes):

```
⚠️ 090_processo_card_checklist_multi_times_responsaveis.sql - Sistema antigo de atividades
⚠️ 092_seed_stepone.sql             - Seed do Funil (pode ter sido criado depois do 091)
⚠️ 093_fix_kanban_duplicates.sql    - Fix de cards duplicados
⚠️ 094_fix_rls_kanbans.sql          - Fix de RLS dos kanbans
⚠️ 095_atividades_aprimoradas.sql   - Outra versão de atividades?
⚠️ 096_sla_arquivamento.sql         - SLA e arquivamento
⚠️ 097_fase_materiais.sql           - Materiais por fase
⚠️ 098_portal_franqueado.sql        - Portal do franqueado
⚠️ 099_seed_card_exemplo.sql        - Cards de exemplo (versão antiga?)
⚠️ 099_fix_rls_permissive.sql       - Fix de RLS (duplicado com 094?)
⚠️ 100_fix_kanban_cards_fk.sql      - Fix de FK (versão 1)
⚠️ 100_kanban_cards_rede_franqueado.sql - Fix de FK (versão 2)
⚠️ 101_fix_rls_policies.sql         - Outro fix de RLS
```

**⚠️ PROBLEMA IDENTIFICADO: Numeração duplicada!**

- Dois arquivos `099_*`
- Dois arquivos `100_*`

#### COMO VERIFICAR QUAIS FORAM RODADAS:

```sql
-- No Supabase SQL Editor, execute:

-- Ver histórico de migrações (se Supabase usa supabase_migrations)
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 20;

-- OU (se usa outro sistema)
SELECT * FROM _prisma_migrations
ORDER BY applied_at DESC;

-- OU verificar diretamente se as tabelas existem:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name IN (
    'kanbans',
    'kanban_fases', 
    'kanban_cards',
    'kanban_atividades',
    'feriados_nacionais'
  );

-- Verificar se as colunas existem:
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'kanban_atividades'
  AND column_name IN ('time', 'prioridade', 'ordem');

-- Verificar se as funções existem:
SELECT proname, prokind 
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('calcular_dias_uteis', 'adicionar_dias_uteis');
```

#### SCRIPT DE VERIFICAÇÃO AUTOMÁTICA:

```sql
-- Criar e executar (salvar como: VERIFICAR_MIGRACOES.sql)

DO $$
DECLARE
  resultado TEXT := E'=== VERIFICAÇÃO DE MIGRAÇÕES ===\n\n';
BEGIN
  -- 1. Verificar tabelas
  resultado := resultado || E'📊 TABELAS:\n';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kanbans') THEN
    resultado := resultado || E'  ✅ kanbans\n';
  ELSE
    resultado := resultado || E'  ❌ kanbans (migration 091 não rodou)\n';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kanban_fases') THEN
    resultado := resultado || E'  ✅ kanban_fases\n';
  ELSE
    resultado := resultado || E'  ❌ kanban_fases (migration 091 não rodou)\n';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kanban_cards') THEN
    resultado := resultado || E'  ✅ kanban_cards\n';
  ELSE
    resultado := resultado || E'  ❌ kanban_cards (migration 091 não rodou)\n';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kanban_atividades') THEN
    resultado := resultado || E'  ✅ kanban_atividades\n';
  ELSE
    resultado := resultado || E'  ❌ kanban_atividades (migration 103 não rodou)\n';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feriados_nacionais') THEN
    resultado := resultado || E'  ✅ feriados_nacionais\n';
  ELSE
    resultado := resultado || E'  ❌ feriados_nacionais (migration 102 não rodou)\n';
  END IF;
  
  -- 2. Verificar coluna 'time' em kanban_atividades
  resultado := resultado || E'\n📋 COLUNAS:\n';
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kanban_atividades' AND column_name = 'time'
  ) THEN
    resultado := resultado || E'  ✅ kanban_atividades.time\n';
  ELSE
    resultado := resultado || E'  ❌ kanban_atividades.time (migration 104 não rodou)\n';
  END IF;
  
  -- 3. Verificar funções
  resultado := resultado || E'\n⚙️  FUNÇÕES:\n';
  
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'calcular_dias_uteis'
  ) THEN
    resultado := resultado || E'  ✅ calcular_dias_uteis()\n';
  ELSE
    resultado := resultado || E'  ❌ calcular_dias_uteis() (migration 102 não rodou)\n';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'adicionar_dias_uteis'
  ) THEN
    resultado := resultado || E'  ✅ adicionar_dias_uteis()\n';
  ELSE
    resultado := resultado || E'  ❌ adicionar_dias_uteis() (migration 102 não rodou)\n';
  END IF;
  
  -- 4. Verificar dados
  resultado := resultado || E'\n📦 DADOS:\n';
  
  DECLARE
    count_kanbans INT;
    count_fases INT;
    count_cards INT;
    count_atividades INT;
    count_feriados INT;
  BEGIN
    SELECT COUNT(*) INTO count_kanbans FROM kanbans WHERE nome = 'Funil Step One';
    SELECT COUNT(*) INTO count_fases FROM kanban_fases WHERE kanban_id IN (SELECT id FROM kanbans WHERE nome = 'Funil Step One');
    SELECT COUNT(*) INTO count_cards FROM kanban_cards;
    SELECT COUNT(*) INTO count_atividades FROM kanban_atividades;
    SELECT COUNT(*) INTO count_feriados FROM feriados_nacionais;
    
    resultado := resultado || '  Kanbans "Funil Step One": ' || count_kanbans || E'\n';
    resultado := resultado || '  Fases do Funil: ' || count_fases || E' (esperado: 7)\n';
    resultado := resultado || '  Cards total: ' || count_cards || E'\n';
    resultado := resultado || '  Atividades total: ' || count_atividades || E'\n';
    resultado := resultado || '  Feriados: ' || count_feriados || E' (esperado: ~20)\n';
  EXCEPTION WHEN OTHERS THEN
    resultado := resultado || E'  ⚠️  Erro ao contar dados (tabelas podem não existir)\n';
  END;
  
  RAISE NOTICE '%', resultado;
END $$;
```

---

## PLANO DE AÇÃO (ORDEM DE RISCO)

### 🟢 RISCO BAIXO (fazer primeiro):

#### 1. Verificar migrações rodadas (5 min)
```bash
# Copiar script VERIFICAR_MIGRACOES.sql acima
# Colar no Supabase SQL Editor
# Executar
# Ver resultado no painel "Messages"
```

**Resultado esperado**: Lista de ✅ e ❌ indicando o que está rodado

---

#### 2. Corrigir SERVICE_ROLE_KEY (10 min)

```bash
# A. Abrir Supabase Dashboard
# B. Project Settings → API
# C. Copiar "service_role" key (secret)
# D. Colar no .env.local:

SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# E. Reiniciar servidor:
# Ctrl+C no terminal
# npm run dev

# F. Adicionar log temporário em card-actions.ts (linha 1322):
console.log('[DEBUG] SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
```

**Resultado esperado**: Painel de Tarefas funciona sem erro

---

#### 3. Testar VIEW unificada isoladamente (30 min)

```sql
-- Não implementar ainda! Apenas TESTAR a query:

-- Copiar query da VIEW (seção 2 acima)
-- Executar direto no SQL Editor
-- Ver se retorna dados de ambas as tabelas
-- Ver se RLS funciona (trocar de usuário e testar)

-- Se funcionar, criar a VIEW:
-- CREATE OR REPLACE VIEW ...

-- Testar query usando a VIEW:
SELECT * FROM view_atividades_unificadas LIMIT 10;
```

**Resultado esperado**: Query retorna dados de ambos os sistemas, RLS funciona

---

### 🟡 RISCO MÉDIO (fazer depois):

#### 4. Criar VIEW unificada (1 hora)

```bash
# A. Criar migration: 105_view_atividades_unificadas.sql
# B. Copiar código da VIEW (seção 2)
# C. Testar no SQL Editor primeiro
# D. Aplicar migration (Supabase CLI ou manual)
# E. Verificar se VIEW foi criada:

SELECT * FROM view_atividades_unificadas LIMIT 5;
```

**Resultado esperado**: VIEW criada, retorna dados de ambos os sistemas

---

#### 5. Modificar TypeScript para usar VIEW (30 min)

```typescript
// src/app/steps-viabilidade/card-actions.ts
// Linha ~1200

// ANTES:
.from('processo_card_checklist')

// DEPOIS:
.from('view_atividades_unificadas')

// Testar no navegador:
// http://localhost:3000/painel-novos-negocios/tarefas
```

**Resultado esperado**: Painel de Tarefas exibe atividades de ambos os sistemas

**Rollback fácil**: Voltar para `.from('processo_card_checklist')`

---

### 🔴 RISCO ALTO (NÃO FAZER AINDA):

#### 6. Refatorar CardDetalheModal.tsx ❌

**NÃO IMPLEMENTAR**

Motivos:
- 6000+ linhas
- Em produção
- Sem testes automatizados
- Novo sistema já tem layout moderno
- Risco de quebrar features críticas

**Alternativa**: Manter dois modais separados (já implementado)

---

## CHECKLIST DE EXECUÇÃO

### Antes de começar:

- [ ] Fazer backup do banco de dados (Supabase Dashboard → Database → Backups)
- [ ] Criar branch Git: `git checkout -b feature/integracao-atividades`
- [ ] Documentar estado atual (screenshots do Painel de Tarefas)

### Durante implementação:

- [ ] **PASSO 1**: Executar VERIFICAR_MIGRACOES.sql
- [ ] **PASSO 2**: Corrigir SERVICE_ROLE_KEY e reiniciar servidor
- [ ] **PASSO 3**: Testar query da VIEW isoladamente
- [ ] **PASSO 4**: Criar VIEW no banco (via SQL Editor primeiro, migration depois)
- [ ] **PASSO 5**: Modificar TypeScript para usar VIEW
- [ ] **PASSO 6**: Testar Painel de Tarefas com ambos os sistemas

### Testes obrigatórios:

- [ ] Painel de Tarefas exibe atividades do sistema antigo ✅
- [ ] Painel de Tarefas exibe atividades do Funil Step One ✅
- [ ] Filtros funcionam para ambos os sistemas
- [ ] RLS funciona (admin vê tudo, franqueado vê só o seu)
- [ ] Sistema antigo continua funcionando (Portfolio)
- [ ] Sistema novo continua funcionando (Funil Step One)

### Rollback (se algo der errado):

```sql
-- Opção 1: Remover VIEW
DROP VIEW IF EXISTS public.view_atividades_unificadas;

-- Opção 2: Voltar código TypeScript
-- Trocar .from('view_atividades_unificadas') 
-- para .from('processo_card_checklist')
```

---

## RESUMO EXECUTIVO

### ✅ O QUE FAZER (ordem de prioridade):

1. **Verificar migrações** (5 min, risco zero)
2. **Corrigir SERVICE_ROLE_KEY** (10 min, risco baixo)
3. **Criar VIEW unificada** (1h, risco médio, fácil de reverter)
4. **Modificar TypeScript mínimo** (30 min, risco médio, fácil de reverter)

### ❌ O QUE NÃO FAZER:

1. **Refatorar CardDetalheModal.tsx** (6000 linhas, risco alto)
2. **Migrar dados entre tabelas** (pode corromper sistema antigo)
3. **Modificar RLS sem backup** (pode travar produção)

### 📊 TEMPO ESTIMADO TOTAL:

- **Mínimo viável**: 2 horas (passos 1-3)
- **Integração completa**: 3-4 horas (passos 1-5)
- **Com testes extensivos**: 1 dia

### 🎯 MÉTRICA DE SUCESSO:

**ANTES**: Painel de Tarefas exibe apenas atividades do sistema antigo (Portfolio)

**DEPOIS**: Painel de Tarefas exibe atividades de AMBOS os sistemas (Portfolio + Funil Step One)

**SEM QUEBRAR**: Sistema antigo continua funcionando exatamente como antes

---

## PRÓXIMOS PASSOS IMEDIATOS

1. **Executar script de verificação** (VERIFICAR_MIGRACOES.sql)
2. **Me enviar o resultado** para eu analisar
3. **Então eu dou os próximos comandos** específicos baseado no que encontrarmos

**NÃO IMPLEMENTAR NADA AINDA** até termos o diagnóstico completo!
