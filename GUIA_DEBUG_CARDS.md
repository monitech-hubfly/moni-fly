# GUIA PASSO A PASSO: DEBUGAR ABERTURA DE CARDS

## PROBLEMA: Cards não abrem quando clicados

### SINTOMAS:
- ✅ Cards aparecem no Kanban
- ❌ Ao clicar no card, nada acontece
- ❌ Erros 404 no console do navegador

---

## SOLUÇÃO: PASSO A PASSO

### PASSO 1: Limpar cache do Next.js

```powershell
# No terminal, pressione Ctrl+C para parar o servidor
# Depois execute:

Remove-Item -Recurse -Force .next
npm run dev
```

### PASSO 2: Limpar cache do navegador

1. Abra o DevTools (F12)
2. Clique com botão direito no ícone de refresh
3. Selecione "Limpar cache e recarregar forçado" (Hard Reload)

OU simplesmente:
- **Chrome/Edge**: `Ctrl + Shift + Delete` → Limpar cache → Última hora
- **Firefox**: `Ctrl + Shift + Delete` → Cache → Limpar

### PASSO 3: Verificar se CardModal está sendo importado

Abra o arquivo: `src/app/funil-stepone/page.tsx`

Deve conter:
```tsx
import { KanbanWrapper } from './KanbanWrapper';
```

E no JSX:
```tsx
<KanbanWrapper isAdmin={isAdmin} kanbanId={kanbanId}>
  {/* conteúdo do Kanban */}
</KanbanWrapper>
```

### PASSO 4: Verificar se KanbanWrapper está correto

Abra: `src/app/funil-stepone/KanbanWrapper.tsx`

Deve ter:
```tsx
import { CardModal } from './CardModal';
import { NovoCardModal } from './NovoCardModal';

// ... código ...

{cardId && (
  <CardModal
    cardId={cardId}
    onClose={closeModal}
    isAdmin={isAdmin}
  />
)}
```

### PASSO 5: Verificar se o botão do card está correto

Abra: `src/app/funil-stepone/KanbanColumn.tsx`

Linha ~77-79 deve ter:
```tsx
<button
  key={card.id}
  onClick={() => router.push(`/funil-stepone?card=${card.id}`)}
  // ...
>
```

### PASSO 6: Testar no navegador

1. Acesse: `http://localhost:3000/funil-stepone`
2. Abra o DevTools (F12) → Aba Console
3. Clique em um card
4. Veja o que aparece no console

#### O QUE VOCÊ DEVE VER:

✅ **Sucesso**:
```
[CardModal] Carregando card: <algum-id>
[CardModal] Card data: { id: ..., titulo: ..., ... }
```

❌ **Erro**:
```
[CardModal] Card error: {...}
```

### PASSO 7: Verificar RLS do Supabase

Se aparecer erro de permissão, execute no Supabase SQL Editor:

```sql
-- Verificar se você consegue ver os cards
SELECT id, titulo, franqueado_id 
FROM kanban_cards 
LIMIT 5;

-- Verificar seu role
SELECT id, email, role 
FROM profiles 
WHERE id = auth.uid();
```

Se não aparecer nenhum card, o RLS está bloqueando. Execute:

```sql
-- TEMPORÁRIO: Desabilitar RLS para testar
ALTER TABLE kanban_cards DISABLE ROW LEVEL SECURITY;

-- Depois de testar, REABILITAR:
ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;
```

### PASSO 8: Verificar URL ao clicar

1. Clique em um card
2. Veja se a URL muda para algo como:
   ```
   http://localhost:3000/funil-stepone?card=<id-do-card>
   ```

Se a URL NÃO mudar:
- O problema está no `onClick` do botão (verificar PASSO 5)

Se a URL mudar MAS nada aparecer:
- O problema está no `CardModal` ou `KanbanWrapper` (verificar PASSO 4)

---

## DIAGNÓSTICO RÁPIDO

### Teste 1: Abrir modal manualmente via URL

Copie o ID de um card (ex: `20de1a87-6125-4a7e-85c1-21e4adb25b17`)

Acesse diretamente:
```
http://localhost:3000/funil-stepone?card=20de1a87-6125-4a7e-85c1-21e4adb25b17
```

- ✅ **Se abrir**: O problema é no botão do card
- ❌ **Se não abrir**: O problema é no CardModal ou RLS

### Teste 2: Verificar console.log

Abra `src/app/funil-stepone/CardModal.tsx`

Procure por:
```tsx
console.log('[CardModal] Carregando card:', cardId);
```

Se não aparecer NADA no console quando você clica:
- O `CardModal` não está sendo renderizado (verificar PASSO 4)

Se aparecer mas depois dá erro:
- Problema no Supabase (verificar PASSO 7)

---

## ERROS 404 DO NEXT.JS

Os erros que você está vendo no console:
```
Failed to load resource: /_next/static/chunks/...
```

Isso é causado por cache desatualizado. Execute:

```powershell
# Parar o servidor (Ctrl+C)
Remove-Item -Recurse -Force .next
npm run dev
```

Depois:
1. Feche TODAS as abas do navegador do projeto
2. Limpe o cache do navegador (Ctrl+Shift+Delete)
3. Abra novamente: `http://localhost:3000/funil-stepone`

---

## CHECKLIST FINAL

Antes de abrir um card:

- [ ] Servidor rodando (`npm run dev`)
- [ ] Sem erros 404 no console do navegador
- [ ] Cache do Next.js limpo (pasta `.next` deletada)
- [ ] Cache do navegador limpo (Hard Reload)
- [ ] Console do navegador aberto (F12) para ver logs
- [ ] Você está logado como admin ou franqueado correto

Depois de clicar em um card:

- [ ] URL mudou para `?card=<id>`
- [ ] Apareceu `[CardModal] Carregando card` no console
- [ ] Apareceu `[CardModal] Card data` no console
- [ ] Modal apareceu na tela

Se TODOS os checks acima forem ✅ mas o modal ainda não aparecer:
- Problema de CSS (modal está invisível)
- Abra o DevTools → Elements → Procure por `<div class="fixed inset-0">`

---

## CONTATO

Se nada disso funcionar, me envie:

1. Screenshot do console (F12) APÓS clicar no card
2. URL completa que aparece na barra de endereço
3. Output do terminal onde o `npm run dev` está rodando
4. Resultado do teste manual via URL (Teste 1 acima)
