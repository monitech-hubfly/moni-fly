# ⚡ AÇÃO IMEDIATA - O QUE FAZER AGORA

**Data**: 15/04/2026
**Tempo estimado**: 30 minutos
**Objetivo**: Resolver problema bloqueante do Painel de Tarefas

---

## 🎯 PROBLEMA CRÍTICO

O **Painel de Tarefas** está dando erro:
```
permission denied for table processo_card_checklist
```

**Causa**: `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` é um placeholder, não uma chave válida.

**Impacto**: Time **NÃO consegue ver** atividades no Painel agregado.

---

## 🚀 SOLUÇÃO EM 4 PASSOS (30 min)

### PASSO 1: Validar chave atual (2 min)

Abra o terminal PowerShell na pasta do projeto e execute:

```powershell
node test-env.js
```

**Resultado esperado se estiver ERRADO**:
```
❌ SUPABASE_SERVICE_ROLE_KEY parece inválida
   Não é um JWT válido (falta pontos)
   Valor atual: COLE_AQUI_A_SERVICE_ROLE_KEY_DO_DEV

📋 COMO CORRIGIR:
1. Abra o Supabase Dashboard: https://supabase.com/dashboard
...
```

---

### PASSO 2: Copiar chave correta do Supabase (3 min)

1. **Abra o navegador**
2. **Vá para**: https://supabase.com/dashboard
3. **Clique** no projeto **DEV** (não produção!)
4. **Menu lateral esquerdo** → **Settings** (ícone de engrenagem)
5. **Submenu** → **API**
6. **Role** a página até a seção **Project API keys**
7. **Procure** a chave chamada **"service_role"**
   
   ```
   ┌──────────────────────────────────────────────────────┐
   │ Project API keys                                     │
   ├──────────────────────────────────────────────────────┤
   │                                                      │
   │ anon public                                          │
   │ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ... │  ← NÃO É ESTA!
   │                                                      │
   │ service_role secret                                  │
   │ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ... │  ← ESTA AQUI!
   │ [ícone de copiar] [ícone de revelar]                │
   │                                                      │
   └──────────────────────────────────────────────────────┘
   ```

8. **Clique** no ícone **"revelar"** (ícone de olho)
9. **Clique** no ícone **"copiar"** (ícone de clipboard)
10. **A chave está na área de transferência**

⚠️ **ATENÇÃO**: É a chave **service_role**, NÃO a **anon**!

---

### PASSO 3: Colar chave no .env.local (2 min)

1. **Abra** o arquivo `.env.local` no Cursor
   - Está na raiz do projeto: `C:\Dev\moni-fly\.env.local`

2. **Procure** esta linha:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=COLE_AQUI_A_SERVICE_ROLE_KEY_DO_DEV
   ```

3. **Substitua** o valor à direita do `=` pela chave que você copiou:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZGZhc2Rma...
   ```

4. **Salve** o arquivo (`Ctrl+S`)

⚠️ **IMPORTANTE**: 
- A chave é uma linha MUITO longa (200+ caracteres)
- NÃO adicione espaços antes ou depois
- NÃO quebre em múltiplas linhas
- NÃO adicione aspas

---

### PASSO 4: Reiniciar servidor e testar (5 min)

1. **No terminal do Cursor** onde roda `npm run dev`:
   - Pressione `Ctrl+C` para parar o servidor
   - Aguarde aparecer `^C`

2. **Limpar cache** (IMPORTANTE!):
   ```powershell
   Remove-Item -Recurse -Force .next
   ```

3. **Reiniciar**:
   ```powershell
   npm run dev
   ```

4. **Aguarde** aparecer:
   ```
   ✓ Ready in 3s
   ○ Local:   http://localhost:3000
   ```

5. **Testar no navegador**:
   - Abra: `http://localhost:3000/painel-novos-negocios/tarefas`
   - **Pressione F12** (DevTools)
   - **Vá na aba Console**
   - **Procure por logs** `[createAdminClient]`:
     ```
     [createAdminClient] ✅ Criando cliente Supabase com service_role...
     ```

6. **Veja se o Painel carregou** sem erro

---

## ✅ CHECKLIST DE VERIFICAÇÃO

Depois de fazer os 4 passos, verifique:

- [ ] `node test-env.js` retorna **"✅ SUPABASE_SERVICE_ROLE_KEY É VÁLIDA!"**
- [ ] Servidor reiniciou com `.next` limpo
- [ ] Console do navegador mostra **"✅ Admin client criado com sucesso!"**
- [ ] Painel de Tarefas **NÃO mostra** erro "permission denied"
- [ ] Painel de Tarefas **mostra atividades** do Portfolio

---

## 🔧 SE AINDA DER ERRO

### Erro 1: "node: command not found"

**Solução**: Node.js não está instalado ou não está no PATH

```powershell
# Verificar se Node está instalado:
node --version

# Se não aparecer versão, instalar:
# Baixar de https://nodejs.org (versão LTS)
```

---

### Erro 2: "Cannot find module 'dotenv'"

**Solução**: Dependências não instaladas

```powershell
npm install
```

---

### Erro 3: Chave ainda inválida após colar

**Possíveis causas**:
1. Copiou a chave **anon** em vez da **service_role**
2. Adicionou espaços antes/depois da chave
3. Quebrou a linha no meio da chave
4. Adicionou aspas

**Solução**: Repetir PASSO 2 e 3 com atenção

**Validar**:
```powershell
# Ver primeiros 50 caracteres da chave:
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0,50));"
```

**Deve começar com**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mi...`

---

### Erro 4: Console não mostra logs [createAdminClient]

**Causa**: Arquivo `admin.ts` não foi modificado ou cache do navegador

**Solução**:
```powershell
# No navegador:
# 1. Pressione Ctrl+Shift+R (hard reload)
# 2. Ou abra janela anônima: Ctrl+Shift+N
```

---

## 📊 RESULTADO ESPERADO

### ANTES (com erro):

```
Painel de Tarefas
─────────────────────────────────────────
❌ Erro ao carregar atividades

Error: permission denied for table 
processo_card_checklist

Console (F12):
  [createAdminClient] ❌ ERRO ao criar admin client
  [getAtividadesChecklistPainel] Fazendo fallback...
  [getAtividadesChecklistPainel] ❌ Sem admin...
```

### DEPOIS (funcionando):

```
Painel de Tarefas
─────────────────────────────────────────
✅ Mostrando 127 atividades

┌─────────────────────────────────────┐
│ FK0001 - Dados Cidade               │
│ Status: Aguardando                  │
│ Time: Portfólio                     │
│ Responsável: João Silva             │
│ Prazo: 20/04/2026                   │
└─────────────────────────────────────┘
... (outras atividades)

Console (F12):
  [createAdminClient] ✅ Admin client criado!
  [getAtividadesChecklistPainel] ✅ Usando admin client
  [montarAtividadesChecklistPainel] ✅ 127 atividades
```

---

## ⏭️ PRÓXIMO PASSO (DEPOIS DE RESOLVER)

Depois que o Painel de Tarefas funcionar, o próximo passo é:

**Verificar se as migrações do Funil Step One foram rodadas no banco DEV**

```sql
-- Executar no Supabase SQL Editor:

-- 1. Verificar se tabelas existem
SELECT EXISTS (
  SELECT FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename = 'kanban_cards'
) as tabela_existe;

-- 2. Contar cards exemplo
SELECT COUNT(*) FROM kanban_cards;

-- 3. Verificar função dias úteis
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'calcular_dias_uteis';
```

**Resultado esperado**:
- tabela_existe: `true`
- COUNT: `14` (cards exemplo)
- routine_name: `calcular_dias_uteis`

**Se algum der erro**: As migrações não foram rodadas. Ver `VERIFICAR_MIGRACOES.sql`

---

## 📞 ME ENVIE (para debug se não funcionar)

Se seguir todos os passos e ainda não funcionar, me envie:

1. **Output de** `node test-env.js`:
   ```powershell
   node test-env.js > resultado-teste-env.txt
   # Me envie o arquivo resultado-teste-env.txt
   ```

2. **Screenshot do Console (F12)** no Painel de Tarefas:
   - Procure por logs que começam com `[createAdminClient]`
   - Procure por logs que começam com `[getAtividadesChecklistPainel]`

3. **Confirme**:
   - [ ] Reiniciou o servidor após mudar .env.local?
   - [ ] Limpou .next antes de reiniciar?
   - [ ] Copiou a chave service_role (não anon)?
   - [ ] A chave está toda em uma linha?
   - [ ] Não tem espaços antes/depois da chave?

---

## 🎯 RESUMO EXECUTIVO

**O que fazer AGORA**:
1. `node test-env.js` → Ver se chave está inválida
2. Copiar chave **service_role** do Supabase Dashboard
3. Colar no `.env.local` (substituir placeholder)
4. Reiniciar servidor (`Ctrl+C` → limpar .next → `npm run dev`)
5. Testar Painel de Tarefas

**Tempo**: 30 minutos

**Risco**: BAIXO (só mexe em .env.local)

**Impacto**: ALTO (desbloqueia Painel inteiro)

**Prioridade**: 🔴 CRÍTICO

---

## 📚 ARQUIVOS DE REFERÊNCIA

Se precisar de mais detalhes:

- **`test-env.js`** - Script de validação da chave
- **`RESOLVER_SERVICE_ROLE_KEY.md`** - Guia detalhado
- **`DIAGNOSTICO_SERVICE_ROLE_KEY.md`** - Como interpretar logs
- **`src/lib/supabase/admin.ts`** - Código com logs de debug
- **`STATUS_COMPLETO_PROJETO.md`** - Visão geral do projeto

---

**BOA SORTE! 🚀**

Depois de resolver isso, o Painel de Tarefas vai funcionar e aí podemos partir para integrar as atividades do Funil Step One.
