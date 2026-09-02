# ⚡ GUIA RÁPIDO: Resolver "permission denied" no Painel de Tarefas

## 🔴 PROBLEMA:
```
permission denied for table processo_card_checklist
```

## ✅ SOLUÇÃO EM 4 PASSOS:

---

### PASSO 1: Testar se a key está correta (1 min)

Execute no terminal (PowerShell):

```powershell
node test-env.js
```

**Resultado esperado:**
```
✅✅✅ SUPABASE_SERVICE_ROLE_KEY É VÁLIDA!
```

**Se der erro**: Siga as instruções que aparecem na tela.

---

### PASSO 2: Reiniciar servidor Next.js (1 min)

**IMPORTANTE**: Next.js só lê .env.local ao iniciar!

```powershell
# No terminal onde roda npm run dev:
# Pressione Ctrl+C para parar

# Limpar cache (opcional mas recomendado):
Remove-Item -Recurse -Force .next

# Reiniciar:
npm run dev
```

Aguarde aparecer: `✓ Ready in Xms`

---

### PASSO 3: Acessar o Painel e ver logs (1 min)

1. Abra: `http://localhost:3000/painel-novos-negocios/tarefas`
2. Pressione **F12** (DevTools)
3. Vá na aba **Console**
4. Procure por logs `[createAdminClient]`

**Resultado esperado:**
```
[createAdminClient] URL exists: true
[createAdminClient] KEY exists: true
[createAdminClient] KEY length: 190
[createAdminClient] ✅ Criando cliente Supabase com service_role...
[getAtividadesChecklistPainel] ✅ Admin client criado com sucesso!
```

---

### PASSO 4: Verificar se funciona (10 seg)

- ✅ Painel de Tarefas carrega
- ✅ Lista de atividades aparece
- ❌ **SEM** erro "permission denied"

---

## 🔧 RESOLUÇÃO DE PROBLEMAS:

### Erro: "KEY não está definida"

**Causa**: .env.local não foi lido ou key não existe

**Solução**:
```powershell
# Verificar se arquivo existe
Test-Path .env.local  # Deve retornar: True

# Ver conteúdo da key
Get-Content .env.local | Select-String "SUPABASE_SERVICE_ROLE_KEY"

# Deve mostrar algo como:
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...

# Se mostrar "COLE_AQUI...", a key está errada!
```

**Corrigir**:
1. Abra Supabase Dashboard
2. Vá em: **Project Settings** → **API**
3. Copie a chave **service_role** (🔒 secret)
4. Edite `.env.local` e cole a chave:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc...
   ```
5. Salve o arquivo
6. **Reinicie o servidor** (Ctrl+C e `npm run dev`)

---

### Erro: "KEY parece inválida"

**Causa**: Key copiada incorretamente ou é placeholder

**Solução**:
```powershell
# Executar teste:
node test-env.js

# Ver o que está errado e seguir instruções
```

---

### Erro: Logs não aparecem

**Causa**: Servidor não foi reiniciado após modificar código

**Solução**:
```powershell
# Parar servidor (Ctrl+C)

# Limpar cache completamente
Remove-Item -Recurse -Force .next

# Reiniciar
npm run dev
```

---

### Erro: "Admin client falhou", mas key é válida

**Causa**: Problema no Supabase ou conexão

**Solução**:
1. Verificar se o Supabase está online
2. Testar conexão: `https://bgaadvfucnrkpimaszjv.supabase.co/rest/v1/`
3. Ver logs completos do erro no console
4. Me enviar screenshot dos logs

---

## 📋 CHECKLIST RÁPIDO:

Execute estes comandos em ordem:

```powershell
# 1. Testar key
node test-env.js

# 2. Se passou, reiniciar servidor
# (Ctrl+C no terminal do npm run dev)
npm run dev

# 3. Acessar e verificar console
# http://localhost:3000/painel-novos-negocios/tarefas
# F12 → Console → Procurar [createAdminClient]

# 4. Se ainda der erro, limpar cache
Remove-Item -Recurse -Force .next
npm run dev
```

---

## 🎯 COMO SABER SE DEU CERTO:

### ✅ ANTES (com erro):
```
Console:
  [getAtividadesChecklistPainel] ❌ ERRO ao criar admin client
  Error: SUPABASE_SERVICE_ROLE_KEY não está definida

Tela:
  ❌ permission denied for table processo_card_checklist
```

### ✅ DEPOIS (funcionando):
```
Console:
  [createAdminClient] ✅ Criando cliente Supabase com service_role...
  [getAtividadesChecklistPainel] ✅ Admin client criado com sucesso!
  [getAtividadesChecklistPainel] Usando admin client (bypass RLS)

Tela:
  ✅ Painel de Tarefas carrega
  ✅ Lista de atividades aparece
  ✅ Sem erros
```

---

## 📞 SE NADA FUNCIONAR:

Me envie:

1. **Output de `node test-env.js`** (copie tudo)
2. **Screenshot do Console (F12)** após acessar o Painel
3. **Primeiros 30 caracteres da key**:
   ```powershell
   (Get-Content .env.local | Select-String "SUPABASE_SERVICE_ROLE_KEY").Line.Substring(25, 30)
   ```

Aí eu diagnostico o problema específico!

---

## 📚 ARQUIVOS DE APOIO:

- `DIAGNOSTICO_SERVICE_ROLE_KEY.md` - Guia detalhado completo
- `test-env.js` - Script de teste da key
- `PLANO_ESTRATEGICO_INTEGRACAO.md` - Plano geral de integração

---

**TEMPO ESTIMADO**: 3-5 minutos

**DIFICULDADE**: Baixa (só seguir os passos)
