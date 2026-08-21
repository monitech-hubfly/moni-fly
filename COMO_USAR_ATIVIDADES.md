# 🚀 GUIA RÁPIDO: Atividades nos Cards

## ⚡ 3 Passos para Ver Atividades Funcionando

### 📋 PASSO 1: Aplicar Migração

Abra **Supabase Dashboard > SQL Editor** e execute:

```sql
-- Copie e cole TODO o conteúdo deste arquivo:
supabase/migrations/103_atividades_kanban.sql
```

✅ **O que isso faz:**
- Cria tabela `kanban_atividades`
- Configura segurança (RLS)
- Cria índices para velocidade
- Adiciona trigger automático

---

### 📦 PASSO 2: Criar Atividades Exemplo

Ainda no **Supabase SQL Editor**, execute:

```sql
-- Copie e cole TODO o conteúdo deste arquivo:
ATIVIDADES_EXEMPLO.sql
```

✅ **O que isso faz:**
- Remove atividades exemplo antigas (se existirem)
- Cria 4-5 atividades para cada card ativo
- Varia status: concluída, em andamento, pendente
- Varia prioridades: baixa, normal, alta, urgente

---

### 👀 PASSO 3: Ver no Frontend

1. Acesse: `http://localhost:3000/funil-stepone`
2. Clique em **qualquer card**
3. Role até **"Atividades vinculadas"**
4. 🎉 Veja as atividades coloridas!

---

## 🎨 O Que Você Vai Ver

```
╔════════════════════════════════════════╗
║  Atividades vinculadas (4)             ║
╠════════════════════════════════════════╣
║  ✅ Levantar dados cadastrais          ║ ← CONCLUÍDA (verde)
║     Coletar informações básicas...     ║
║     [Concluída] • João Silva           ║
╠────────────────────────────────────────╣
║  🔄 Validar informações                ║ ← EM ANDAMENTO (azul)
║     Confirmar dados junto aos...       ║
║     [Em andamento] Vence: 17/04        ║
╠────────────────────────────────────────╣
║  🔴 Solicitar certidões                ║ ← URGENTE (vermelho)
║     Reunir toda documentação...        ║
║     [Pendente] Vence: 16/04            ║
╠────────────────────────────────────────╣
║  🟡 Agendar reunião                    ║ ← ALTA (dourado)
║     Marcar encontro para...            ║
║     [Pendente] Vence: 17/04            ║
╚════════════════════════════════════════╝
```

---

## 🎯 Estados e Cores

| Ícone | Estado | Cor | Quando Usar |
|-------|--------|-----|-------------|
| ✅ | Concluída | Verde | Tarefa finalizada |
| 🔄 | Em andamento | Azul | Trabalhando agora |
| 🔴 | Urgente | Vermelho | Prioridade máxima |
| 🟡 | Alta | Dourado | Importante |
| ⚪ | Normal/Baixa | Neutro | Rotina |

---

## 📊 Verificar se Funcionou

Execute no **Supabase SQL Editor**:

```sql
-- Ver total de atividades criadas
SELECT COUNT(*) as total FROM kanban_atividades;

-- Ver atividades por status
SELECT status, COUNT(*) as qtd 
FROM kanban_atividades 
GROUP BY status;

-- Ver atividades de um card específico
SELECT 
  ka.titulo,
  ka.status,
  ka.prioridade
FROM kanban_atividades ka
JOIN kanban_cards kc ON ka.card_id = kc.id
WHERE kc.titulo LIKE '%João Silva%'
ORDER BY ka.ordem;
```

---

## 🔧 Troubleshooting Rápido

### ❌ "Atividades não aparecem"

1. **Verifique a tabela existe:**
```sql
SELECT COUNT(*) FROM kanban_atividades;
```
- Se erro: Execute PASSO 1 novamente
- Se 0: Execute PASSO 2 novamente

2. **Verifique seus cards:**
```sql
SELECT titulo FROM kanban_cards WHERE status = 'ativo';
```
- Se vazio: Execute `CARDS_EXEMPLO_SIMPLES.sql` primeiro

3. **Limpe o cache do navegador:**
- Chrome: Ctrl + Shift + R (Windows) ou Cmd + Shift + R (Mac)

---

### ❌ "Permission denied"

Execute:
```sql
-- Veja seu role
SELECT role FROM profiles WHERE id = auth.uid();

-- Se não retornar 'admin', execute:
UPDATE profiles SET role = 'admin' WHERE id = auth.uid();
```

Depois faça **logout e login novamente**.

---

### ❌ "Nenhum card ativo encontrado"

Execute primeiro:
```sql
-- Copie e execute:
CARDS_EXEMPLO_SIMPLES.sql
```

Depois execute novamente:
```sql
ATIVIDADES_EXEMPLO.sql
```

---

## ✨ Recursos Extras

### Limpar Todas as Atividades Exemplo

```sql
DELETE FROM kanban_atividades 
WHERE titulo LIKE 'Levantar dados%' 
   OR titulo LIKE 'Validar informações%'
   OR titulo LIKE 'Agendar reunião%'
   OR titulo LIKE 'Solicitar certidões%'
   OR titulo LIKE 'Preparar relatório%';
```

### Ver Atividades Urgentes

```sql
SELECT 
  kc.titulo as card,
  ka.titulo as atividade,
  ka.data_vencimento
FROM kanban_atividades ka
JOIN kanban_cards kc ON ka.card_id = kc.id
WHERE ka.prioridade = 'urgente'
  AND ka.status = 'pendente'
ORDER BY ka.data_vencimento;
```

### Marcar Atividade como Concluída

```sql
UPDATE kanban_atividades 
SET status = 'concluida'
WHERE titulo = 'Nome da Atividade';
```

---

## 📚 Documentação Completa

Para mais detalhes técnicos, consulte:
- `ATIVIDADES_KANBAN.md` - Documentação completa
- `supabase/migrations/103_atividades_kanban.sql` - Schema do banco
- `ATIVIDADES_EXEMPLO.sql` - Script de exemplo

---

## 🎉 Pronto!

Agora você tem atividades funcionando nos cards do Funil Step One!

**O que vem depois:**
- ✅ Atividades aparecem no modal (feito!)
- ⏳ Criar novas atividades via interface (próximo)
- ⏳ Editar atividades (próximo)
- ⏳ Marcar como concluída com checkbox (próximo)
- ⏳ Deletar atividades (próximo)

---

**Criado em:** 15/04/2026  
**Tempo para configurar:** ~5 minutos  
**Status:** ✅ Funcionando
