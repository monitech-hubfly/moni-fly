# 🔍 DIAGNÓSTICO: SUPABASE_SERVICE_ROLE_KEY

## ✅ O QUE FOI MODIFICADO:

Adicionei **logs detalhados** em:
1. `src/lib/supabase/admin.ts` - Mostra se a key está sendo lida
2. `src/app/steps-viabilidade/card-actions.ts` - Mostra todo o fluxo de autenticação

---

## 🚀 PRÓXIMOS PASSOS:

### PASSO 1: Reiniciar servidor Next.js (OBRIGATÓRIO)

**IMPORTANTE**: Next.js só lê o `.env.local` na inicialização!

```powershell
# No terminal onde está rodando npm run dev:
# 1. Parar o servidor (Ctrl+C)

# 2. Reiniciar
npm run dev
```

---

### PASSO 2: Acessar o Painel de Tarefas

1. Abra: `http://localhost:3000/painel-novos-negocios/tarefas`
2. Abra o Console (F12) → aba **Console**
3. Veja os logs que aparecem

---

### PASSO 3: Interpretar os logs

#### ✅ SUCESSO (deve aparecer):

```
[createAdminClient] URL exists: true
[createAdminClient] URL value: https://bgaadvfucnrkpimaszjv.supabase.co
[createAdminClient] KEY exists: true
[createAdminClient] KEY length: 190+ (ou similar)
[createAdminClient] KEY starts with: eyJhbGciOiJIUzI1NiIsI
[createAdminClient] ✅ Criando cliente Supabase com service_role...
[getAtividadesChecklistPainel] ✅ Admin client criado com sucesso!
[getAtividadesChecklistPainel] Usando admin client (bypass RLS)
```

#### ❌ ERRO: KEY não existe

```
[createAdminClient] KEY exists: false
[createAdminClient] KEY length: undefined
❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não está definida
```

**SOLUÇÃO**: A variável não está sendo lida. Causas possíveis:
1. Servidor não foi reiniciado após editar .env.local
2. Arquivo .env.local não está na raiz do projeto
3. Typo no nome da variável

**COMO CORRIGIR**:
```powershell
# Verificar se o arquivo existe
Test-Path ".env.local"  # Deve retornar True

# Ver conteúdo
Get-Content ".env.local" | Select-String "SUPABASE_SERVICE_ROLE_KEY"

# Deve mostrar:
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... (JWT longo)

# Se não mostrar nada ou mostrar "COLE_AQUI", a key está errada!
```

#### ❌ ERRO: KEY inválida (não é JWT)

```
[createAdminClient] KEY exists: true
[createAdminClient] KEY starts with: COLE_AQUI_A_SERVICE
❌ ERRO: SUPABASE_SERVICE_ROLE_KEY parece inválida
```

**SOLUÇÃO**: A key no .env.local é um placeholder, não a key real!

**COMO CORRIGIR**:
1. Abra o Supabase Dashboard
2. Vá em: **Project Settings** → **API**
3. Role até **Project API keys**
4. Copie a chave **`service_role`** (marcada como "secret" 🔒)
5. Cole no `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...
   ```
6. **REINICIE o servidor** (Ctrl+C e `npm run dev`)

---

### PASSO 4: Testar se funciona

Depois de reiniciar o servidor:

1. Acesse: `http://localhost:3000/painel-novos-negocios/tarefas`
2. Veja o console (F12)
3. Deve aparecer:
   ```
   ✅ Admin client criado com sucesso!
   ```
4. A página deve carregar as tarefas **sem erro**

---

## 🔧 VERIFICAÇÕES ADICIONAIS:

### Verificar se a key é válida (sem iniciar servidor)

Crie um arquivo de teste `test-env.js` na raiz:

```javascript
// test-env.js
require('dotenv').config({ path: '.env.local' });

console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('SUPABASE_SERVICE_ROLE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
console.log('SUPABASE_SERVICE_ROLE_KEY starts with:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20));

// Verificar se é JWT válido
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (key) {
  const parts = key.split('.');
  console.log('JWT parts count:', parts.length, '(esperado: 3)');
  
  if (parts.length === 3) {
    console.log('✅ Formato de JWT válido');
    
    // Decodificar header
    try {
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      console.log('JWT header:', header);
      
      // Decodificar payload
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      console.log('JWT payload:', payload);
      console.log('Role:', payload.role, '(esperado: "service_role")');
      
      if (payload.role === 'service_role') {
        console.log('✅✅✅ KEY VÁLIDA!');
      } else {
        console.log('❌ Role incorreto! Deve ser "service_role", está:', payload.role);
      }
    } catch (err) {
      console.error('❌ Erro ao decodificar JWT:', err.message);
    }
  } else {
    console.log('❌ Formato de JWT inválido');
  }
} else {
  console.log('❌ SUPABASE_SERVICE_ROLE_KEY não está definida!');
}
```

Execute:
```powershell
node test-env.js
```

---

## 🎯 CHECKLIST DE CORREÇÃO:

- [ ] Arquivo `.env.local` existe na raiz do projeto
- [ ] `SUPABASE_SERVICE_ROLE_KEY` está definida no arquivo
- [ ] A key NÃO é "COLE_AQUI..." (é um JWT real)
- [ ] A key tem ~190 caracteres
- [ ] A key tem 3 partes separadas por ponto (JWT válido)
- [ ] A key começa com `eyJhbGci...`
- [ ] Servidor Next.js foi **reiniciado** após editar .env
- [ ] Console do navegador mostra "✅ Admin client criado com sucesso!"
- [ ] Painel de Tarefas carrega sem erro

---

## 🔴 ERROS COMUNS:

### Erro 1: "KEY não está definida"
**Causa**: Next.js não leu o arquivo .env.local
**Solução**: Reiniciar servidor (Ctrl+C e `npm run dev`)

### Erro 2: "KEY parece inválida"
**Causa**: Valor é placeholder ou key copiada errada
**Solução**: Pegar key correta do Supabase Dashboard

### Erro 3: "permission denied"
**Causa**: Admin client não está sendo usado (fallback para cliente normal)
**Solução**: Verificar logs do console para ver por que admin client falhou

### Erro 4: Logs não aparecem
**Causa**: Servidor não foi reiniciado com novo código
**Solução**: 
```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

---

## 📞 SE AINDA NÃO FUNCIONAR:

Me envie:
1. **Screenshot dos logs do console** (toda a saída com os `[createAdminClient]`)
2. **Resultado do test-env.js** (execute e copie a saída)
3. **Primeiros 30 caracteres da sua SUPABASE_SERVICE_ROLE_KEY**:
   ```powershell
   (Get-Content .env.local | Select-String "SUPABASE_SERVICE_ROLE_KEY").Line.Substring(0, 60)
   ```

Aí eu consigo diagnosticar o problema específico!

---

## ✅ OBJETIVO FINAL:

Quando tudo estiver correto, você verá:

**No Console (F12):**
```
[createAdminClient] URL exists: true
[createAdminClient] KEY exists: true
[createAdminClient] KEY length: 190
[createAdminClient] ✅ Criando cliente Supabase com service_role...
[getAtividadesChecklistPainel] ✅ Admin client criado com sucesso!
```

**Na tela:**
- ✅ Painel de Tarefas carrega
- ✅ Lista de atividades aparece
- ✅ Sem erro "permission denied"
