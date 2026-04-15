# ⚡ SOLUÇÃO RÁPIDA: Cards não abrem

## O PROBLEMA
Os erros 404 no console são causados por **cache desatualizado do Next.js**.

---

## 🚀 SOLUÇÃO EM 3 PASSOS

### 1️⃣ PARAR O SERVIDOR
No terminal onde está rodando `npm run dev`:
- Pressione `Ctrl + C`
- Aguarde até parar completamente

### 2️⃣ LIMPAR CACHE
No terminal, execute:

```powershell
Remove-Item -Recurse -Force .next
```

### 3️⃣ REINICIAR
```powershell
npm run dev
```

Aguarde aparecer:
```
✓ Ready in Xms
○ Local: http://localhost:3000
```

### 4️⃣ LIMPAR NAVEGADOR
1. Feche **TODAS** as abas do projeto
2. Abra o navegador
3. Pressione `Ctrl + Shift + Delete`
4. Selecione "Última hora"
5. Marque apenas "Cache" ou "Imagens e arquivos em cache"
6. Clique em "Limpar dados"

OU simplesmente:
- **Hard Reload**: `Ctrl + Shift + R` (várias vezes)

### 5️⃣ TESTAR
1. Acesse: `http://localhost:3000/funil-stepone`
2. Abra o DevTools: `F12` → aba **Console**
3. Clique em um card
4. Veja os logs:
   ```
   [CardModal] Carregando card: <id>
   [CardModal] Card data: {...}
   [CardModal] Card carregado com sucesso
   ```

---

## ✅ SE FUNCIONAR
Você verá:
- URL muda para: `?card=<id>`
- Modal aparece sobre o Kanban
- Sem erros 404 no console

## ❌ SE NÃO FUNCIONAR

### Teste Manual:
Copie um ID de card (ex: `20de1a87-6125-4a7e-85c1-21e4adb25b17`)

Cole na URL:
```
http://localhost:3000/funil-stepone?card=20de1a87-6125-4a7e-85c1-21e4adb25b17
```

**Se abrir assim**: O problema é no botão do card (improvável)
**Se não abrir**: Problema de RLS no Supabase (veja abaixo)

---

## 🔒 SE FOR PROBLEMA DE RLS

Abra o Supabase SQL Editor e execute:

```sql
-- Verificar se você consegue ver os cards
SELECT id, titulo, franqueado_id 
FROM kanban_cards 
LIMIT 5;
```

**Se não aparecer nada**:

```sql
-- TEMPORÁRIO: Desabilitar RLS (apenas para teste)
ALTER TABLE kanban_cards DISABLE ROW LEVEL SECURITY;
```

Teste novamente. Se funcionar, o problema é RLS. Execute:

```sql
-- Reabilitar RLS
ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;

-- Ver seu usuário
SELECT id, email, role FROM profiles WHERE id = auth.uid();
```

Se o `role` for `NULL` ou diferente de `admin`/`consultor`/`frank`, o RLS está bloqueando.

---

## 📞 AINDA NÃO FUNCIONA?

Me envie:
1. Screenshot do **Console** (F12) após clicar no card
2. Screenshot do **terminal** onde roda `npm run dev`
3. Resultado do teste manual via URL acima
4. Seu `role` no Supabase (query acima)
