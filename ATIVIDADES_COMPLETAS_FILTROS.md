# ✅ ATIVIDADES COM FILTROS E FORMULÁRIO INLINE

## 🎯 ATUALIZAÇÃO IMPLEMENTADA

Adaptei a seção de atividades nos cards para **manter todas as funcionalidades** do sistema antigo:
- ✅ Filtros (Status, Time, Responsável, Ordenação)
- ✅ Formulário inline para adicionar atividade
- ✅ Campo "Time" (equipe responsável)
- ✅ Layout compatível com nova diagramação
- ✅ Mantém cores e estados já definidos

---

## 📋 FUNCIONALIDADES IMPLEMENTADAS

### 1. **Filtros de Atividades** ✅

Quatro filtros disponíveis acima da lista:

| Filtro | Opções | Função |
|--------|--------|--------|
| **Status** | Todos, Pendente, Em andamento, Concluída, Cancelada | Filtra por estado |
| **Time** | Todos, Comercial, Operações, Jurídico, Financeiro | Filtra por equipe |
| **Responsável** | Todos, [Usuários] | Filtra por pessoa |
| **Ordenar por** | Prazo (menor→maior), Prazo (maior→menor) | Ordena resultados |

### 2. **Campo "Time" (Equipe)** ✅

Cada atividade agora tem um time/equipe responsável:
- `comercial` - Time Comercial
- `operacoes` - Time de Operações
- `juridico` - Time Jurídico
- `financeiro` - Time Financeiro

### 3. **Formulário Inline** ✅

Abaixo da lista, formulário para adicionar nova atividade:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| **Atividade** | Text | O que fazer (obrigatório) |
| **Data** | Date | Prazo/vencimento |
| **Time** | Select | Equipe responsável |
| **Responsável** | Select | Pessoa responsável |
| **Botão Adicionar** | Button | Cria atividade |

### 4. **Visual Mantido** ✅

Cores e ícones por status/prioridade:
- ✅ Concluída (verde)
- 🔄 Em andamento (azul)
- 🔴 Urgente (vermelho)
- 🟡 Alta prioridade (dourado)
- ⚪ Normal/Baixa (neutro)

---

## 📁 ARQUIVOS MODIFICADOS/CRIADOS

### Criados
- ✅ `supabase/migrations/104_atividades_add_time.sql` - Adiciona campo "time"
- ✅ `ATIVIDADES_COMPLETAS_FILTROS.md` - Esta documentação

### Modificados
- ✅ `src/app/funil-stepone/CardModal.tsx` - Filtros e formulário inline
- ✅ `ATIVIDADES_EXEMPLO.sql` - Inclui campo "time" nos exemplos

---

## 🗄️ ESTRUTURA DO BANCO DE DADOS

### Campo Adicionado

```sql
ALTER TABLE kanban_atividades
ADD COLUMN time TEXT;
```

**Valores possíveis:**
- `'comercial'`
- `'operacoes'`
- `'juridico'`
- `'financeiro'`
- `NULL` (opcional)

### Índice para Performance

```sql
CREATE INDEX idx_kanban_atividades_time ON kanban_atividades(time);
```

---

## 🎨 LAYOUT FINAL

```
╔═════════════════════════════════════════════╗
║ Atividades vinculadas (4)                   ║
╠═════════════════════════════════════════════╣
║ [Status ▼] [Time ▼] [Responsável ▼] [Ord ▼]║ ← Filtros
╠─────────────────────────────────────────────╣
║ ✅ Levantar dados cadastrais                ║
║    [Concluída] Vence: 10/04 • João          ║
╠─────────────────────────────────────────────╣
║ 🔄 Validar informações                      ║
║    [Em andamento] Vence: 15/04 • Maria      ║
╠─────────────────────────────────────────────╣
║ 🔴 Solicitar certidões                      ║
║    [Pendente] Vence: 16/04 • Pedro          ║
╠═════════════════════════════════════════════╣
║ [Atividade...] [dd/mm] [Time▼] [Resp▼] [+] ║ ← Formulário
╚═════════════════════════════════════════════╝
```

---

## 🚀 COMO APLICAR ATUALIZAÇÕES

### PASSO 1: Adicionar Campo "Time"

Execute no **Supabase Dashboard > SQL Editor**:

```sql
-- Copie todo o conteúdo de:
supabase/migrations/104_atividades_add_time.sql
```

### PASSO 2: Recriar Atividades Exemplo (Opcional)

Se quiser atividades com times definidos:

```sql
-- 1. Limpar atividades antigas
DELETE FROM kanban_atividades;

-- 2. Executar script atualizado
-- Copie todo o conteúdo de:
ATIVIDADES_EXEMPLO.sql
```

### PASSO 3: Ver no Frontend

1. Recarregue a página: `http://localhost:3000/funil-stepone`
2. Abra qualquer card
3. Veja os filtros acima das atividades
4. Use o formulário para adicionar nova atividade
5. Teste os filtros

---

## 🔍 COMO USAR OS FILTROS

### Filtrar por Status

```
Status: [Pendente ▼]
```
→ Mostra apenas atividades pendentes

### Filtrar por Time

```
Time: [Comercial ▼]
```
→ Mostra apenas atividades do time comercial

### Filtrar por Responsável

```
Responsável: [João Silva ▼]
```
→ Mostra apenas atividades de João Silva

### Combinar Filtros

```
Status: [Pendente ▼]
Time: [Jurídico ▼]
Ordenar por: [Prazo (menor→maior) ▼]
```
→ Atividades pendentes do jurídico, ordenadas por prazo

### Mensagem Quando Não Há Resultados

```
┌─────────────────────────────────────────┐
│ Nenhuma atividade encontrada para os    │
│ filtros selecionados                    │
└─────────────────────────────────────────┘
```

---

## ➕ COMO ADICIONAR NOVA ATIVIDADE

### Preenchimento do Formulário

1. **Atividade** (obrigatório):
   - Digite: "Validar proposta comercial"

2. **Data** (opcional):
   - Selecione: 20/04/2026

3. **Time** (opcional):
   - Selecione: Comercial

4. **Responsável** (opcional):
   - Selecione: João Silva

5. **Clique em "Adicionar"**

### Resultado

- ✅ Atividade criada
- ✅ Aparece na lista filtrada
- ✅ Formulário limpo para próxima
- ✅ Contador atualizado

---

## 📊 EXEMPLOS DE ATIVIDADES POR TIME

### Comercial
- Agendar reunião com corretores
- Validar proposta comercial
- Apresentar plano de negócios

### Operações
- Levantar dados cadastrais
- Preparar relatório fotográfico
- Fazer inspeção técnica

### Jurídico
- Solicitar certidões
- Validar informações com prefeitura
- Analisar documentação legal

### Financeiro
- Calcular viabilidade econômica
- Validar orçamento
- Aprovar investimento

---

## 🎯 QUERIES ÚTEIS

### Ver atividades por time

```sql
SELECT 
  time,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'pendente') as pendentes
FROM kanban_atividades
WHERE time IS NOT NULL
GROUP BY time;
```

### Ver atividades urgentes do time jurídico

```sql
SELECT titulo, data_vencimento, status
FROM kanban_atividades
WHERE time = 'juridico'
  AND prioridade = 'urgente'
  AND status = 'pendente'
ORDER BY data_vencimento;
```

### Atualizar time de uma atividade

```sql
UPDATE kanban_atividades
SET time = 'comercial'
WHERE id = 'SEU_ID_AQUI';
```

---

## 🔒 SEGURANÇA

### RLS Mantido

Todas as políticas de segurança continuam ativas:
- Admin/consultor: vê e edita todas as atividades
- Franqueado: vê e edita apenas atividades dos seus cards

### Validação no Frontend

```tsx
// Atividade só é criada se tiver título
disabled={loading || !novaAtividade.titulo.trim()}
```

---

## ✅ CHECKLIST DE FUNCIONALIDADES

- [x] Filtro por Status
- [x] Filtro por Time
- [x] Filtro por Responsável
- [x] Ordenação por prazo
- [x] Formulário inline para adicionar
- [x] Campo "Time" no banco
- [x] Campo "Time" no formulário
- [x] Mensagem quando não há resultados
- [x] Contador de atividades
- [x] Cores por status/prioridade mantidas
- [x] Ícones visuais mantidos
- [x] Layout responsivo (mobile/desktop)
- [x] Compatibilidade com sistema antigo

---

## 🆕 DIFERENÇAS DO SISTEMA ANTIGO

### Mantido Igual
- ✅ Filtros (Status, Time, Responsável, Ordenação)
- ✅ Formulário inline para adicionar
- ✅ Campo "Time" (equipe)
- ✅ Cores e ícones por status
- ✅ Mensagem "Nenhuma atividade encontrada"

### Melhorado
- ✅ Visual atualizado (seguindo moni-tokens.css)
- ✅ Layout mais limpo e organizado
- ✅ Responsivo (funciona bem em mobile)
- ✅ Performance otimizada (índices no banco)
- ✅ RLS configurado corretamente

### Removido
- ❌ Abas superiores (Dados, Comentários, etc.) - Substituídas por layout em duas colunas
- ❌ Status "Não iniciada" - Agora é "Pendente"

---

## 🎉 PRONTO PARA USO!

Execute as 2 migrações SQL e as atividades terão:
- ✅ Filtros funcionais
- ✅ Formulário para adicionar
- ✅ Campo "Time" (equipe)
- ✅ 100% compatível com nova diagramação
- ✅ Mantém regras do sistema antigo

---

**Criado em:** 15/04/2026  
**Versão:** 2.0  
**Status:** ✅ Compatível com sistema antigo

**Próximos passos sugeridos:**
- Implementar edição inline de atividades
- Adicionar drag & drop para reordenar
- Implementar múltiplos responsáveis por atividade
- Adicionar notificações de vencimento
