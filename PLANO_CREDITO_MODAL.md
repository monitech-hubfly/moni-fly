# 📋 PLANO: Modal Estilo Step One no Crédito

**Objetivo**: Replicar mecanismo de modal do Funil Step One no Kanban de Crédito

---

## 🎯 SITUAÇÃO ATUAL

### Funil Step One:
- ✅ Modal duas colunas (histórico + ação)
- ✅ Abre como overlay via URL (?card=ID)
- ✅ KanbanWrapper gerencia modal
- ✅ SLA em dias úteis
- ✅ Sistema de atividades integrado
- ✅ Formato FK0001 - Nome - Área

### Kanban de Crédito:
- ❌ Usa CardDetalheModal (~6000 linhas)
- ❌ Modal antigo, uma única coluna
- ❌ Estrutura diferente
- ❌ Não usa URL query params
- ❌ SLA em dias corridos
- ❌ Formato: Nº Franquia - Condomínio - Quadra

---

## 🔧 DESAFIOS

1. **Banco de dados diferente**:
   - Step One: `kanban_cards`, `kanban_fases`, `kanban_atividades`
   - Crédito: `processo_step_one`, `processo_card_checklist`

2. **Estrutura de fases**:
   - Step One: 7 fases fixas
   - Crédito: 2 fases (`credito_terreno`, `credito_obra`)

3. **Componentes compartilhados**:
   - `StepsKanbanColumn` usado por Portfolio, Contabilidade E Crédito
   - `PainelCard` usado por todos
   - Modificações afetam múltiplos Kanbans

4. **Dados em produção**:
   - Sistema já está sendo usado
   - Não pode quebrar funcionalidade existente

---

## 💡 ABORDAGENS POSSÍVEIS

### OPÇÃO A: Wrapper Gradual (RECOMENDADA) ⭐⭐⭐⭐⭐

**Estratégia**: Criar wrapper que usa modal novo OU antigo

**Vantagens**:
- ✅ Não quebra sistema existente
- ✅ Pode testar gradualmente
- ✅ Fácil de reverter
- ✅ Migração suave

**Desvantagens**:
- ⚠️ Código duplicado temporariamente
- ⚠️ Duas estruturas convivendo

**Implementação**:
```typescript
// PainelCreditoClient.tsx
<CreditoModalWrapper 
  cards={filtered.credito_terreno}
  useNewModal={true}  // Flag para escolher modal
/>

// Se useNewModal = true → CardModalCredito (novo)
// Se useNewModal = false → CardDetalheModal (antigo)
```

---

### OPÇÃO B: Refatorar CardDetalheModal (NÃO RECOMENDADA) ❌

**Estratégia**: Modificar CardDetalheModal para ter duas colunas

**Vantagens**:
- ✅ Uma única estrutura

**Desvantagens**:
- ❌ ALTO RISCO (6000 linhas)
- ❌ Quebra Portfolio, Contabilidade
- ❌ Difícil de testar
- ❌ Não reversível
- ❌ Afeta produção

**Conclusão**: **NÃO FAZER**

---

### OPÇÃO C: Criar Estrutura Paralela Completa (DEMORADA) ⏱️

**Estratégia**: Criar sistema Crédito separado (como Step One)

**Vantagens**:
- ✅ Sistema limpo e moderno
- ✅ Não afeta código antigo

**Desvantagens**:
- ❌ Muito trabalho (~20h)
- ❌ Requer migração de dados
- ❌ Dois sistemas convivendo
- ❌ Complexo de manter

---

## ✅ OPÇÃO ESCOLHIDA: A (Wrapper Gradual)

### Passo 1: Criar Modal Novo para Crédito

**Arquivo**: `src/app/painel-credito/CreditoCardModal.tsx`

**Baseado em**: `CardModal.tsx` do Funil Step One

**Adaptações**:
- Busca de `processo_step_one` (não `kanban_cards`)
- Fases: `credito_terreno` → `credito_obra`
- Atividades de `processo_card_checklist` (não `kanban_atividades`)
- Título: Nº Franquia - Condomínio - Quadra

---

### Passo 2: Criar Wrapper de Modal

**Arquivo**: `src/app/painel-credito/CreditoModalWrapper.tsx`

**Função**: Gerencia qual modal abrir baseado em URL

```typescript
'use client';

export function CreditoModalWrapper({ 
  processos, 
  useNewModal = false 
}) {
  const searchParams = useSearchParams();
  const cardId = searchParams.get('card');
  
  if (!cardId) return null;
  
  if (useNewModal) {
    return <CreditoCardModal cardId={cardId} />;
  } else {
    return <CardDetalheModal processoId={cardId} />;
  }
}
```

---

### Passo 3: Atualizar PainelCard para URL Query

**Modificação**: `src/app/steps-viabilidade/PainelCard.tsx`

**Mudança**:
```typescript
// ANTES
onClick={() => setModalOpen(true)}

// DEPOIS (se useUrlModal = true)
onClick={() => router.push(`?card=${p.id}`)}
```

---

### Passo 4: Integrar em PainelCreditoClient

**Arquivo**: `src/app/painel-credito/PainelCreditoClient.tsx`

**Adicionar**:
```typescript
<CreditoModalWrapper 
  processos={[...filtered.credito_terreno, ...filtered.credito_obra]}
  useNewModal={true}
/>
```

---

## 📊 ESTRUTURA DE DADOS

### Mapeamento: Step One → Crédito

| Step One | Crédito | Observação |
|----------|---------|------------|
| `kanban_cards.id` | `processo_step_one.id` | ID do card |
| `kanban_cards.titulo` | Calculado | Nº - Condo - Quadra |
| `kanban_fases.nome` | `etapa_painel` | Nome da fase |
| `kanban_atividades` | `processo_card_checklist` | Atividades |
| `created_at` | `updated_at` | Data |
| `sla_dias` | Manual | 7 dias (fixo) |

---

## 🎨 VISUAL ESPERADO

### Modal de Card do Crédito (duas colunas):

```
┌─────────────────────────────────────────────────────────────────────┐
│  FK123 - Condomínio Exemplo - Quadra A Lote 10          [X]        │
│  🔵 Crédito Terreno  |  Vence em 3 d.u.                            │
├─────────────────────────┬───────────────────────────────────────────┤
│  📋 HISTÓRICO (40%)     │  ▶️ FASE ATUAL (60%)                     │
│                         │                                           │
│  (sem histórico no      │  Checklist Crédito Terreno                │
│   Crédito - apenas      │  - Análise de renda                       │
│   1→2 fases)            │  - Documentação                           │
│                         │  - Aprovação banco                        │
│  Comentários gerais     │                                           │
│                         │  Campos desta fase                        │
│                         │  - Valor solicitado                       │
│                         │  - Taxa aprovada                          │
│                         │                                           │
│                         │  Atividades vinculadas                    │
│                         │  - 3 atividades                           │
│                         │                                           │
│                         │  [Avançar para Crédito Obra] [Arquivar]  │
└─────────────────────────┴───────────────────────────────────────────┘
```

---

## ⚠️ PONTOS DE ATENÇÃO

### 1. Compatibilidade com sistema antigo
- ✅ Manter `CardDetalheModal` funcionando
- ✅ Não quebrar Portfolio e Contabilidade
- ✅ Feature flag para escolher modal

### 2. Dados em produção
- ✅ Não modificar banco de dados
- ✅ Ler de tabelas existentes
- ✅ Testar com dados reais

### 3. Migração gradual
- ✅ Fase 1: Crédito com novo modal
- ✅ Fase 2: Contabilidade (se funcionar)
- ✅ Fase 3: Portfolio (último)

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Estrutura Base (2h)
- [ ] Criar `CreditoCardModal.tsx` baseado em `CardModal.tsx`
- [ ] Adaptar queries para `processo_step_one`
- [ ] Testar busca de dados

### Fase 2: Modal Funcional (3h)
- [ ] Implementar duas colunas
- [ ] Buscar atividades de `processo_card_checklist`
- [ ] Calcular SLA em dias úteis
- [ ] Botões "Avançar fase" e "Arquivar"

### Fase 3: Integração (2h)
- [ ] Criar `CreditoModalWrapper.tsx`
- [ ] Modificar `PainelCard` para aceitar URL query
- [ ] Integrar em `PainelCreditoClient`
- [ ] Testar navegação

### Fase 4: UX Polish (2h)
- [ ] Estilos com `moni-tokens.css`
- [ ] Responsivo (mobile)
- [ ] Loading states
- [ ] Validações

### Fase 5: Testes (1h)
- [ ] Abrir cards existentes
- [ ] Criar atividades
- [ ] Avançar fase
- [ ] Arquivar
- [ ] Verificar não quebrou Portfolio

---

## 🚀 ALTERNATIVA RÁPIDA (1h)

Se o tempo for crítico para 22/04:

**Opção Minimalista**: Apenas atualizar visual do `CardDetalheModal`

1. Aplicar cores `moni-tokens.css`
2. Melhorar header
3. Manter estrutura atual

**Resultado**: Visual melhor, mas sem duas colunas

---

## 💬 RECOMENDAÇÃO FINAL

### Para entregar até 22/04 (7 dias):

**FAZER AGORA**:
1. ✅ Criar `CreditoCardModal.tsx` simples (4h)
2. ✅ Integrar via wrapper (2h)
3. ✅ Testar básico (1h)

**FAZER DEPOIS** (pós-22/04):
4. ⏰ SLA em dias úteis
5. ⏰ Sistema de atividades completo
6. ⏰ Migrar Portfolio e Contabilidade

**NÃO FAZER**:
- ❌ Refatorar `CardDetalheModal` (alto risco)
- ❌ Migrar todos os Kanbans agora (falta tempo)
- ❌ Mudar banco de dados (complexo)

---

## 📞 PRÓXIMA AÇÃO

**Quer que eu**:
- **A)** Implemente o wrapper + modal novo para Crédito (7h total)?
- **B)** Apenas melhore visual do modal atual (1h)?
- **C)** Deixe Crédito como está e foque em outras prioridades?

**Recomendação**: **Opção B** (visual melhor) se tempo for crítico, **Opção A** se tiver 1-2 dias disponíveis.
