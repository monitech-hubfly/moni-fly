# ⚡ SOLUÇÃO: Erro "permission denied for table kanban_atividades"

## 🔴 O PROBLEMA QUE VOCÊ ESTÁ VENDO:

```
permission denied for table kanban_atividades
```

No console do navegador quando abre um card do Funil Step One.

---

## ✅ CAUSA RAIZ:

A tabela `kanban_atividades` tem **RLS (Row Level Security) ativo** mas:
- As **policies** podem não estar criadas corretamente
- OU a migration **103_atividades_kanban.sql não foi executada**
- OU você está logado com um usuário sem **role** configurado

---

## 🚀 SOLUÇÃO RÁPIDA (3 PASSOS):

### PASSO 1: Verificar se a tabela existe

Abra o **Supabase SQL Editor** e execute:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'kanban_atividades';
```

**Resultado esperado**: 1 linha com `kanban_atividades`

**Se não aparecer nada**: A migration **103_atividades_kanban.sql** não foi executada!
- Vá para o Supabase Dashboard → SQL Editor
- Abra o arquivo `supabase/migrations/103_atividades_kanban.sql`
- Copie todo o conteúdo
- Cole no SQL Editor
- Execute

---

### PASSO 2: Executar script de correção

Copie o arquivo **`CORRIGIR_RLS_ATIVIDADES.sql`** (que acabei de criar)

Cole no **Supabase SQL Editor** e execute.

Ele vai:
1. ✅ Remover policies antigas (se existirem)
2. ✅ Recriar todas as 4 policies (SELECT, INSERT, UPDATE, DELETE)
3. ✅ Garantir que RLS está ativo
4. ✅ Testar se funciona

**Resultado esperado**: 
```
✅ 4 policies criadas
✅ COUNT(*) retorna número (não erro)
```

---

### PASSO 3: Verificar seu usuário e role

No **Supabase SQL Editor**, execute:

```sql
SELECT 
  auth.uid() AS meu_id,
  email,
  role 
FROM profiles 
WHERE id = auth.uid();
```

**Resultado esperado**: 
```
meu_id: <seu-uuid>
email: seu@email.com
role: admin (ou consultor ou frank)
```

**Se `role` for NULL**:
```sql
-- CORRIGIR: Atribuir role ao seu usuário
UPDATE profiles 
SET role = 'admin' 
WHERE id = auth.uid();
```

---

## 🔍 DIAGNÓSTICO AVANÇADO

Se ainda der erro depois dos 3 passos, execute:

```sql
-- Ver se você é dono dos cards
SELECT 
  ka.id AS atividade_id,
  ka.card_id,
  kc.franqueado_id AS dono_do_card,
  auth.uid() AS meu_id,
  (kc.franqueado_id = auth.uid()) AS sou_dono,
  p.role AS meu_role
FROM kanban_atividades ka
JOIN kanban_cards kc ON kc.id = ka.card_id
LEFT JOIN profiles p ON p.id = auth.uid()
LIMIT 5;
```

**Problema comum**: 
- ❌ `sou_dono = false` E `meu_role = NULL`
- ✅ Solução: Ou atribuir role 'admin', ou criar cards com seu usuário

---

## ⚠️ SOLUÇÃO TEMPORÁRIA (apenas DEV):

Se você precisa testar AGORA e não quer mexer no RLS:

```sql
-- DESABILITAR RLS (APENAS EM DEV! NUNCA EM PRODUÇÃO!)
ALTER TABLE public.kanban_atividades DISABLE ROW LEVEL SECURITY;
```

**IMPORTANTE**: Depois de testar, **REABILITAR**:
```sql
ALTER TABLE public.kanban_atividades ENABLE ROW LEVEL SECURITY;
```

---

## ✅ COMO SABER SE FUNCIONOU:

1. Execute o script `CORRIGIR_RLS_ATIVIDADES.sql`
2. Volte ao navegador
3. Recarregue a página (F5)
4. Abra um card do Funil Step One
5. Veja o console (F12)

**ANTES** (com erro):
```
❌ permission denied for table kanban_atividades
```

**DEPOIS** (sem erro):
```
✅ [CardModal] Atividades não carregadas: (sem erro OU lista vazia)
✅ Seção "Atividades vinculadas" aparece (mesmo que vazia)
```

---

## 📋 CHECKLIST FINAL:

- [ ] Tabela `kanban_atividades` existe (PASSO 1)
- [ ] Script `CORRIGIR_RLS_ATIVIDADES.sql` executado (PASSO 2)
- [ ] Seu usuário tem `role` definido (PASSO 3)
- [ ] 4 policies criadas (ver resultado do script)
- [ ] Navegador recarregado (F5)
- [ ] Card abre sem erro no console

---

## 🎯 PRÓXIMOS PASSOS:

Se tudo funcionar, você vai ver:
- ✅ Card abre normalmente
- ✅ Seção "Atividades vinculadas" aparece
- ✅ Se houver atividades, elas aparecem na lista
- ✅ Se não houver, aparece "Nenhuma atividade vinculada"
- ✅ Formulário para adicionar atividade funciona

Para criar atividades de exemplo:
```sql
-- Executar: ATIVIDADES_EXEMPLO.sql
-- (Arquivo já existe na raiz do projeto)
```

---

## 📞 AINDA COM PROBLEMA?

Me envie:
1. Screenshot do resultado do PASSO 1 (verificar tabela)
2. Screenshot do resultado do PASSO 2 (policies criadas)
3. Screenshot do resultado do PASSO 3 (seu role)
4. Screenshot do erro no console do navegador

Aí eu ajudo a diagnosticar o problema específico!
