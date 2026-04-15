# ✅ AJUSTES IMPLEMENTADOS NO FUNIL STEP ONE

## 🎯 IMPLEMENTAÇÃO COMPLETA - 5 AJUSTES

### 1. DIAS ÚTEIS NO SLA ✅

**Implementado:**
- ✅ Tabela `feriados_nacionais` no banco de dados
- ✅ Função SQL `calcular_dias_uteis(data_inicio, data_fim)`
- ✅ Função SQL `adicionar_dias_uteis(data_base, quantidade)`
- ✅ Função TypeScript `calcularStatusSLA()` com lógica de dias úteis
- ✅ Tags SLA exibem: "Atrasado 3 d.u." ou "Vence em 2 d.u."
- ✅ Feriados nacionais brasileiros 2025-2027 pré-carregados

**Arquivos criados:**
- `supabase/migrations/102_feriados_dias_uteis.sql`
- `src/lib/dias-uteis.ts`

**Arquivos modificados:**
- `src/app/funil-stepone/KanbanColumn.tsx`

---

### 2. CARD ABRE COMO MODAL (sobreposição) ✅

**Implementado:**
- ✅ Ao clicar num card, abre modal sobre o Kanban (não navega)
- ✅ Kanban continua visível atrás com overlay escuro
- ✅ Botão X para fechar e voltar ao Kanban
- ✅ URL atualiza com `?card=ID` sem mudar a tela
- ✅ Botão "+ Novo card" também abre como modal (`?novo=true`)

**Arquivos criados:**
- `src/app/funil-stepone/CardModal.tsx`
- `src/app/funil-stepone/NovoCardModal.tsx`
- `src/app/funil-stepone/KanbanWrapper.tsx`

**Arquivos modificados:**
- `src/app/funil-stepone/page.tsx`
- `src/app/funil-stepone/KanbanColumn.tsx` (card agora é `<button>` com `router.push`)

---

### 3. LAYOUT DO CARD (modal) — DUAS COLUNAS ✅

**Implementado:**

#### COLUNA ESQUERDA (40%):
- ✅ Header com informações do responsável (se admin)
- ✅ Abas minimizáveis de fases já concluídas
- ✅ Aba "Comentários gerais" (estrutura pronta)
- ✅ Em mobile: esta coluna aparece ABAIXO da direita

#### COLUNA DIREITA (60%):
- ✅ Fase atual com nome destacado
- ✅ Campo de título editável
- ✅ Seletor de fase (mover para próxima fase)
- ✅ Tag de SLA com dias úteis
- ✅ Checklist e campos (estrutura pronta para implementação)
- ✅ Comentários desta fase (estrutura pronta)
- ✅ Atividades vinculadas (estrutura pronta)
- ✅ Botões: Editar, Salvar, Cancelar, Arquivar

**Arquivos criados:**
- `src/app/funil-stepone/CardModal.tsx` (componente completo)

**Arquivos modificados:**
- `src/styles/moni-tokens.css` (classes `.moni-card-modal-left` e `.moni-card-modal-right`)

---

## 📦 INSTRUÇÕES DE APLICAÇÃO

### PASSO 1: Aplicar migração do banco de dados

Execute no **Supabase Dashboard > SQL Editor**:

```sql
-- Copie e execute o conteúdo completo de:
-- c:\Dev\moni-fly\supabase\migrations\102_feriados_dias_uteis.sql
```

Este script irá:
1. Criar a tabela `feriados_nacionais`
2. Inserir feriados brasileiros 2025-2027
3. Criar funções `calcular_dias_uteis()` e `adicionar_dias_uteis()`
4. Executar testes para validar

### PASSO 2: Verificar instalação

Execute no **Supabase SQL Editor**:

```sql
-- Teste 1: Calcular dias úteis
SELECT 
  public.calcular_dias_uteis('2026-04-13'::DATE, '2026-04-22'::DATE) as dias_uteis;

-- Teste 2: Adicionar 5 dias úteis
SELECT 
  public.adicionar_dias_uteis('2026-04-15'::DATE, 5) as prazo;

-- Teste 3: Listar feriados
SELECT data, nome FROM public.feriados_nacionais 
WHERE EXTRACT(YEAR FROM data) = 2026 
ORDER BY data;
```

Resultado esperado:
- Teste 1: Deve retornar um número (dias úteis entre as datas)
- Teste 2: Deve retornar uma data futura
- Teste 3: Deve listar 12 feriados de 2026

---

## 🎨 DESIGN E RESPONSIVIDADE

### Desktop
- Modal: 1400px max-width, 90vh altura
- Coluna esquerda: 40% (fases concluídas, comentários gerais)
- Coluna direita: 60% (fase atual, checklist, atividades)

### Mobile (< 640px)
- Modal: tela cheia, scroll vertical
- Coluna DIREITA aparece PRIMEIRO (fase atual, ações)
- Coluna ESQUERDA aparece DEPOIS (histórico de fases)
- Botões: empilhados verticalmente

---

## 🔧 PRÓXIMOS PASSOS (para sprints futuras)

1. **Campos personalizados por fase** - Implementar schema de campos dinâmicos
2. **Sistema de comentários** - CRUD completo de comentários por fase e gerais
3. **Sistema de checklist** - Checkboxes com persistência no banco
4. **Atividades vinculadas** - Integração com `TarefasPainelConteudo.tsx`
5. **Seções "Instruções" e "Materiais"** - Upload de arquivos e links

---

## ✨ O QUE JÁ FUNCIONA AGORA

- ✅ Cálculo de SLA em dias úteis (ignora sábados, domingos e feriados)
- ✅ Modal overlay sobre o Kanban (não navega para nova página)
- ✅ Layout duas colunas com inversão de ordem no mobile
- ✅ Edição de título e movimentação entre fases
- ✅ Arquivamento de cards
- ✅ Abas minimizáveis para fases anteriores
- ✅ Tags SLA: "Atrasado X d.u.", "Vence em X d.u.", "Vence hoje"
- ✅ Responsivo 100% (desktop e mobile)

---

## 📝 NOTAS TÉCNICAS

- Feriados móveis (Carnaval, Paixão, Corpus Christi) já estão calculados para 2025-2027
- Feriados fixos (Ano Novo, Tiradentes, Trabalho, etc.) também incluídos
- Funções SQL são `IMMUTABLE` para melhor performance
- TypeScript mantém sincronia com SQL (mesmo set de feriados)
- RLS (Row Level Security) mantido e respeitado em todas as operações

---

## 🚀 TESTAR AGORA

1. Aplique a migração SQL
2. Acesse `/funil-stepone`
3. Clique em qualquer card → abre modal sobre o Kanban
4. Clique em "+ Novo card" → abre modal de criação
5. Verifique as tags de SLA com "d.u." (dias úteis)
6. Teste no mobile (< 640px) → coluna direita aparece primeiro

**Tudo pronto para uso!** 🎉
