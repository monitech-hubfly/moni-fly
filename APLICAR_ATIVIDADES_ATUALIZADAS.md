# 🚀 GUIA RÁPIDO: Aplicar Atividades com Filtros

## ⚡ 2 Passos para Atualizar

### 📋 PASSO 1: Adicionar Campo "Time"

Abra **Supabase Dashboard > SQL Editor** e execute:

```sql
-- Copie e cole TODO o conteúdo deste arquivo:
supabase/migrations/104_atividades_add_time.sql
```

✅ **O que isso faz:**
- Adiciona coluna `time` (equipe) na tabela
- Cria índice para performance
- Atualiza atividades exemplo existentes

---

### 🔄 PASSO 2: Recriar Atividades (Opcional)

Se quiser limpar e recriar com times definidos:

```sql
-- A. Limpar atividades antigas
DELETE FROM kanban_atividades;

-- B. Criar novas com campo "time"
-- Copie e cole TODO o conteúdo deste arquivo:
ATIVIDADES_EXEMPLO.sql
```

**OU se já tem atividades e quer manter:**

Pule este passo. O PASSO 1 já atribuiu times automaticamente às atividades existentes.

---

## ✨ O QUE VOCÊ VAI VER

```
╔════════════════════════════════════════════╗
║ Atividades vinculadas (4)                  ║
╠════════════════════════════════════════════╣
║ FILTROS:                                   ║
║ [Status ▼] [Time ▼] [Responsável ▼] [Ord] ║
╠────────────────────────────────────────────╣
║ ✅ Levantar dados cadastrais (Operações)   ║
║ 🔄 Validar informações (Jurídico)          ║
║ 🔴 Solicitar certidões (Jurídico)          ║
║ 🟡 Agendar reunião (Comercial)             ║
╠════════════════════════════════════════════╣
║ ADICIONAR NOVA:                            ║
║ [Atividade...] [Data] [Time▼] [Resp▼] [+] ║
╚════════════════════════════════════════════╝
```

---

## 🎯 FILTROS DISPONÍVEIS

### Status
- Todos
- Pendente
- Em andamento
- Concluída
- Cancelada

### Time (Equipe)
- Todos
- **Comercial** - Reuniões, propostas, vendas
- **Operações** - Dados, relatórios, execução
- **Jurídico** - Certidões, validações, documentos
- **Financeiro** - Orçamentos, viabilidade

### Responsável
- Todos
- [Usuários do sistema]

### Ordenação
- Prazo (menor → maior) - Vence primeiro no topo
- Prazo (maior → menor) - Vence último no topo

---

## ➕ ADICIONAR NOVA ATIVIDADE

### Campos do Formulário

1. **Atividade** ⭐ (obrigatório)
   ```
   Exemplo: "Validar proposta comercial"
   ```

2. **Data** (opcional)
   ```
   Selecione: dd/mm/aaaa
   ```

3. **Time** (opcional)
   ```
   Selecione: Comercial, Operações, Jurídico, Financeiro
   ```

4. **Responsável** (opcional)
   ```
   Selecione: Usuário do sistema
   ```

5. **Clique em "Adicionar"**

---

## 🧪 TESTAR

### 1. Teste os Filtros

```
1. Abra qualquer card
2. Clique em [Status ▼]
3. Selecione "Pendente"
4. → Vê apenas atividades pendentes
```

### 2. Filtre por Time

```
1. Clique em [Time ▼]
2. Selecione "Jurídico"
3. → Vê apenas atividades do time jurídico
```

### 3. Adicione Nova Atividade

```
1. Digite: "Testar funcionalidade"
2. Selecione data: Amanhã
3. Selecione time: Operações
4. Clique "Adicionar"
5. → Atividade aparece na lista!
```

---

## 🔍 VERIFICAR SE FUNCIONOU

Execute no **Supabase SQL Editor**:

```sql
-- 1. Verificar se coluna "time" existe
SELECT time, COUNT(*) as total 
FROM kanban_atividades 
WHERE time IS NOT NULL 
GROUP BY time;

-- Resultado esperado:
-- operacoes  | X atividades
-- juridico   | X atividades
-- comercial  | X atividades

-- 2. Ver total de atividades
SELECT COUNT(*) FROM kanban_atividades;

-- 3. Ver atividades de um card específico
SELECT titulo, time, status 
FROM kanban_atividades 
WHERE card_id = (
  SELECT id FROM kanban_cards LIMIT 1
);
```

---

## ❌ TROUBLESHOOTING

### "Nenhuma atividade encontrada"

**Causa:** Filtros muito restritivos ou sem dados

**Solução:**
```sql
-- Resetar para "Todos"
Status: [Todos ▼]
Time: [Todos ▼]
Responsável: [Todos ▼]
```

---

### Erro ao adicionar atividade

**Causa:** Campo "Atividade" vazio

**Solução:** Digite algo no campo "Atividade (o que fazer)"

---

### Campo "Time" não aparece

**Causa:** Migração 104 não foi executada

**Solução:**
```sql
-- Execute novamente:
supabase/migrations/104_atividades_add_time.sql
```

---

## 📊 COMPARAÇÃO: ANTES vs AGORA

### ✅ ANTES (Sistema Antigo)
- Filtros: Status, Time, Responsável, Ordenação
- Formulário inline
- Abas superiores
- Visual antigo

### ✅ AGORA (Sistema Novo)
- ✅ Filtros: Status, Time, Responsável, Ordenação (mantido)
- ✅ Formulário inline (mantido)
- ✅ Layout em duas colunas (novo)
- ✅ Visual moderno com moni-tokens.css
- ✅ Cores por status/prioridade
- ✅ Ícones visuais
- ✅ Responsivo

---

## 🎉 PRONTO!

Agora você tem:
- ✅ Filtros funcionando
- ✅ Formulário inline para adicionar
- ✅ Campo "Time" (equipe)
- ✅ 100% compatível com funcionalidades antigas
- ✅ Visual atualizado

---

## 📚 DOCUMENTAÇÃO COMPLETA

- `ATIVIDADES_COMPLETAS_FILTROS.md` - Documentação técnica detalhada
- `ATIVIDADES_KANBAN.md` - Documentação da estrutura base
- `COMO_USAR_ATIVIDADES.md` - Guia básico

---

**Tempo para aplicar:** ~3 minutos  
**Criado em:** 15/04/2026  
**Status:** ✅ Pronto para produção
