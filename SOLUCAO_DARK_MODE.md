# ✅ SOLUÇÃO: Fundo Azul Escuro Removido

## 🔴 PROBLEMA ENCONTRADO:

O fundo azul escuro que você via era causado pelo **DARK MODE AUTOMÁTICO** do CSS!

**Arquivo**: `src/styles/moni-tokens.css` linhas 225-252

```css
@media (prefers-color-scheme: dark) {
  :root {
    --moni-surface-0:   #0f1a20;    /* AZUL ESCURO! */
    --moni-surface-50:  #131f27;    /* AZUL ESCURO! */
    --moni-text-primary:   #e8eef1; /* TEXTO CLARO */
    ...
  }
}
```

**Quando seu Windows estava em Dark Mode**, o CSS aplicava automaticamente cores escuras no modal!

---

## ✅ O QUE FOI CORRIGIDO:

### 1. **Desabilitado Dark Mode automático** (`moni-tokens.css`)
   - ✅ Comentado o bloco `@media (prefers-color-scheme: dark)`
   - ✅ Sistema agora usa **apenas Light Mode**
   - ✅ Cores consistentes independente do tema do sistema operacional

### 2. **NovoCardModal.tsx** - Cores explícitas
   - ✅ Labels: `var(--moni-text-primary)` (verde naval)
   - ✅ Preview: fundo `var(--moni-surface-50)` (off-white)
   - ✅ Botão Criar: fundo `var(--moni-navy-800)` (azul só no botão)
   - ✅ Campos: fundo branco, bordas neutras

### 3. **CardModal.tsx** - Cores explícitas
   - ✅ Título: `var(--moni-text-primary)`
   - ✅ Coluna direita: `var(--moni-surface-0)` (branco)
   - ✅ Coluna esquerda: `var(--moni-surface-50)` (off-white)
   - ✅ Checkboxes: fundo branco explícito
   - ✅ Textos: variáveis Moní (não mais stone-*)

---

## 🎨 CORES FINAIS DO MODAL:

| Elemento | Variável | Cor | Hex |
|----------|----------|-----|-----|
| **Overlay** | - | Preto 50% | `rgba(0,0,0,0.5)` |
| **Header** | branco | Branco | `#ffffff` |
| **Coluna Direita** | `--moni-surface-0` | Branco puro | `#ffffff` |
| **Coluna Esquerda** | `--moni-surface-50` | Off-white quente | `#f9f7f4` |
| **Título** | `--moni-text-primary` | Verde naval | `#0c2633` |
| **Labels** | `--moni-text-primary` | Verde naval | `#0c2633` |
| **Texto corpo** | `--moni-text-secondary` | Marrom terra | `#4a3929` |
| **Hints** | `--moni-text-tertiary` | Cinza muted | `#7a6e65` |
| **Botão Criar** | `--moni-navy-800` | Azul (só botão) | `#0c2633` |

---

## 🚀 COMO TESTAR:

### PASSO 1: Reiniciar servidor

```powershell
# Ctrl+C no terminal do npm run dev

# Limpar cache (IMPORTANTE!)
Remove-Item -Recurse -Force .next

# Reiniciar
npm run dev
```

### PASSO 2: Limpar cache do navegador

**CRÍTICO**: O navegador também cacheia CSS!

```powershell
# No navegador:
# 1. Fechar TODAS as abas
# 2. Ctrl+Shift+Delete
# 3. Marcar "Imagens e arquivos em cache"
# 4. Limpar
```

OU simplesmente:
- **Ctrl + Shift + R** (várias vezes)
- **Ou abrir janela anônima**: Ctrl + Shift + N

### PASSO 3: Verificar visual

Acesse: `http://localhost:3000/funil-stepone`

Abra um card e veja:

#### ✅ O QUE VOCÊ DEVE VER:

```
┌─────────────────────────────────────────┐
│ ⚪ Header BRANCO                        │ ← #ffffff
│    Título verde, badge dourado          │
├──────────────┬──────────────────────────┤
│ 📋 Histórico │ ▶️ Fase atual           │
│              │                          │
│ Off-white    │ Branco                   │
│ #f9f7f4      │ #ffffff                  │
│              │                          │
│ Cards brancos│ Seções off-white         │
│ Texto verde  │ Texto verde/marrom       │
│              │                          │
└──────────────┴──────────────────────────┘
```

#### ❌ O QUE NÃO DEVE TER:

- ❌ Fundo azul escuro (#0f1a20, #131f27)
- ❌ Texto branco no corpo (só no overlay)
- ❌ Coluna esquerda escura
- ❌ Coluna direita escura

---

## 🎯 ARQUIVOS MODIFICADOS:

```
✅ src/styles/moni-tokens.css
   → Desabilitado dark mode automático

✅ src/app/funil-stepone/CardModal.tsx
   → Todas as cores usando variáveis Moní
   → Checkboxes com fundo branco explícito
   → Textos: primary/secondary/tertiary

✅ src/app/funil-stepone/NovoCardModal.tsx
   → Labels e preview com cores corretas
   → Botão Criar com navy-800
   → Campos com fundo branco

✅ src/app/funil-stepone/novo/NovoCardForm.tsx
   → Focus states neutros (não azul)

✅ src/app/funil-stepone/[id]/CardDetailClient.tsx
   → Focus states neutros
```

**Total**: 5 arquivos modificados

---

## 🔧 SE AINDA APARECER AZUL ESCURO:

### Opção 1: Cache muito agressivo

```powershell
# Limpar TUDO
Remove-Item -Recurse -Force .next
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

# Reiniciar
npm run dev

# No navegador:
# Janela anônima (Ctrl+Shift+N)
```

### Opção 2: Sistema operacional em Dark Mode

**Se você tem Dark Mode no Windows**:
1. Configurações do Windows → Personalização → Cores
2. Escolha: **Claro** (temporariamente)
3. Recarregue o navegador

OU:

Configure o navegador para sempre usar Light Mode:
- **Chrome**: `chrome://flags` → buscar "dark" → Desabilitar "Auto Dark Mode"
- **Edge**: Mesmo procedimento

### Opção 3: Inspecionar elemento

1. Abra o modal
2. F12 → Inspecionar elemento
3. Clique no fundo escuro
4. Veja na aba **Styles** qual CSS está sendo aplicado
5. Screenshot e me envie

---

## 📋 CHECKLIST:

- [ ] Servidor reiniciado com cache limpo
- [ ] Cache do navegador limpo (Ctrl+Shift+R)
- [ ] Testado em janela anônima
- [ ] Modal abre com fundo BRANCO/OFF-WHITE
- [ ] Coluna esquerda: off-white (#f9f7f4)
- [ ] Coluna direita: branco (#ffffff)
- [ ] Textos verde/marrom (não branco)
- [ ] Sem azul escuro no corpo do modal

---

## 🎉 RESULTADO ESPERADO:

**ANTES** (Dark Mode ativo):
- 🔵 Corpo do modal azul escuro
- ⚪ Textos brancos
- 😞 Difícil de ler

**DEPOIS** (Light Mode fixo):
- ⚪ Corpo do modal branco/off-white
- 🟢 Textos verde/marrom
- 😊 Fácil de ler, visual leve

---

## 📞 ME ENVIE:

Se ainda aparecer azul:

1. **Screenshot do modal** aberto
2. **Screenshot do DevTools** → Styles (elemento selecionado no fundo)
3. **Confirme**: Seu Windows está em Dark Mode? (Configurações → Personalização → Cores)
4. **Teste**: Abrir em janela anônima resolve?

---

**TEMPO ESTIMADO**: 2 minutos (limpar cache e testar)

**ARQUIVO CRIADO**: `SOLUCAO_DARK_MODE.md` (este arquivo)
