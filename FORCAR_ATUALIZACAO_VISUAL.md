# ⚡ FORÇAR ATUALIZAÇÃO VISUAL - Remover Fundo Azul

## 🔴 PROBLEMA: Modal ainda aparece com fundo azul escuro

**CAUSA**: Cache do navegador está mostrando versão antiga

---

## ✅ SOLUÇÃO GARANTIDA (faça TUDO):

### PASSO 1: Parar servidor e limpar cache Next.js

No terminal (onde está rodando `npm run dev`):

```powershell
# 1. Parar o servidor (Ctrl+C)

# 2. Limpar TUDO
Remove-Item -Recurse -Force .next
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

# 3. Reiniciar
npm run dev
```

---

### PASSO 2: Limpar cache do navegador (CRÍTICO!)

#### Opção A: Hard Reload (mais rápido)
1. Abra a página: `http://localhost:3000/funil-stepone`
2. Pressione **Ctrl + Shift + R** (5 vezes!)
3. Ou **Ctrl + F5** (5 vezes!)

#### Opção B: Limpar cache completo (mais garantido)
1. Pressione **Ctrl + Shift + Delete**
2. Selecione "Última hora"
3. Marque APENAS:
   - ✅ Imagens e arquivos em cache
   - ✅ Dados de sites hospedados
4. Clique em **Limpar dados**

#### Opção C: Modo Anônimo (para testar)
1. Abra uma janela anônima: **Ctrl + Shift + N** (Chrome/Edge)
2. Acesse: `http://localhost:3000/funil-stepone`
3. Abra um card

---

### PASSO 3: Verificar arquivos fonte

Execute este comando para confirmar que os arquivos estão corretos:

```powershell
# Verificar CardModal.tsx
Select-String -Path "src\app\funil-stepone\CardModal.tsx" -Pattern "background.*surface" -Context 1

# Deve mostrar:
# background: 'var(--moni-surface-0)'     (coluna direita - branco)
# background: 'var(--moni-surface-50)'    (coluna esquerda - off-white)
```

---

### PASSO 4: Inspecionar elemento (se ainda aparecer azul)

1. Abra o modal do card
2. Pressione **F12** (DevTools)
3. Clique no ícone de seleção (canto superior esquerdo)
4. Clique no fundo azul
5. Veja a aba **Styles** (lado direito)
6. Procure por:
   - `background-color`
   - `background`
7. **Me envie screenshot** dessa seção

---

## 🎨 CORES ESPERADAS (após limpeza de cache):

| Elemento | Cor | Hex |
|----------|-----|-----|
| **Coluna esquerda** (Histórico) | Off-white | `#f9f7f4` |
| **Coluna direita** (Fase atual) | Branco | `#ffffff` |
| **Header do modal** | Branco | `#ffffff` |
| **Overlay** (fundo atrás) | Preto transparente | `rgba(0,0,0,0.5)` |

**NENHUM azul escuro** (`#0c2633`, `#1b3a4f`, etc.)

---

## 🔍 TESTE DEFINITIVO:

### Criar arquivo de teste HTML puro

Crie o arquivo `teste-cores.html` na raiz:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Teste Cores Moní</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .box { width: 200px; height: 100px; margin: 10px; display: inline-block; }
  </style>
</head>
<body>
  <h1>Cores do Sistema</h1>
  
  <div class="box" style="background: #f9f7f4; border: 1px solid #ccc;">
    <p>Coluna Esquerda<br>#f9f7f4</p>
  </div>
  
  <div class="box" style="background: #ffffff; border: 1px solid #ccc;">
    <p>Coluna Direita<br>#ffffff</p>
  </div>
  
  <div class="box" style="background: #0c2633; color: white;">
    <p>❌ REMOVIDO<br>#0c2633</p>
  </div>
  
  <div class="box" style="background: #365848; color: white;">
    <p>✅ NOVO (headers)<br>#365848</p>
  </div>
</body>
</html>
```

Abra no navegador: `file:///c:/Dev/moni-fly/teste-cores.html`

---

## 📱 SE ESTIVER NO MOBILE/TABLET:

O problema pode ser ainda pior no mobile por causa do cache. Faça:

1. **Chrome Mobile**: Menu → Mais ferramentas → Limpar dados de navegação
2. **Safari iOS**: Ajustes → Safari → Limpar Histórico e Dados
3. **Ou** acesse via **modo anônimo**

---

## 🚨 SE NADA FUNCIONAR:

Execute este script de "reset total":

```powershell
# RESET TOTAL DO PROJETO
cd c:\Dev\moni-fly

# 1. Parar servidor
# (Ctrl+C no terminal)

# 2. Limpar TUDO
Remove-Item -Recurse -Force .next
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .turbo -ErrorAction SilentlyContinue

# 3. Reinstalar dependências (opcional, se suspeitar de corrupção)
# npm ci

# 4. Reiniciar
npm run dev

# 5. No navegador:
# - Fechar TODAS as abas
# - Fechar o navegador completamente
# - Reabrir
# - Ctrl+Shift+Delete → Limpar cache
# - Abrir http://localhost:3000/funil-stepone
```

---

## ✅ CONFIRMAÇÃO VISUAL:

Quando funcionar, você vai ver:

**MODAL DO CARD:**
```
┌─────────────────────────────────────────┐
│ ⚪ Header BRANCO                        │
├──────────────┬──────────────────────────┤
│ 📋 Histórico │ ▶️ Fase atual           │
│ (off-white)  │ (branco)                 │
│ #f9f7f4      │ #ffffff                  │
│              │                          │
└──────────────┴──────────────────────────┘
```

**NÃO DEVE TER:**
- ❌ Fundo azul naval (`#0c2633`)
- ❌ Fundo azul escuro (`#1b3a4f`)
- ❌ Qualquer tom de azul nos fundos

---

## 📸 ME ENVIE:

Se ainda aparecer azul após TODOS os passos:

1. Screenshot do modal aberto
2. Screenshot do DevTools → Styles (elemento selecionado)
3. Screenshot do console (F12) mostrando erros
4. Resultado do comando:
   ```powershell
   Get-FileHash "src\app\funil-stepone\CardModal.tsx"
   ```

Aí eu investigo se há outro problema (pode ser extensão do navegador, antivírus, etc.)

---

## 🎯 CHECKLIST FINAL:

- [ ] Servidor parado e reiniciado
- [ ] Cache `.next` deletado
- [ ] Cache do navegador limpo (Ctrl+Shift+Delete)
- [ ] Hard reload feito (Ctrl+Shift+R) 5 vezes
- [ ] Testado em janela anônima
- [ ] Modal abre com fundos BRANCOS/OFF-WHITE
- [ ] Nenhum azul escuro visível

Se TODOS os checks acima forem ✅ e ainda aparecer azul:
- Problema de cache muito agressivo
- Ou extensão do navegador modificando CSS
- Ou antivírus bloqueando atualização

**Solução radical**: Testar em outro navegador (Firefox, Brave, etc.)
