# ✅ MUDANÇAS: Remoção de Fundos Azul Escuro

**Data**: 15/04/2026

---

## 🎨 O QUE FOI ALTERADO:

### 1. **Design Tokens** (`src/styles/moni-tokens.css`)

**ANTES:**
```css
/* Funil Step One — Verde Naval */
--moni-kanban-stepone:         var(--moni-navy-800);  /* Azul escuro #0c2633 */
--moni-kanban-stepone-light:   var(--moni-navy-50);
--moni-kanban-stepone-accent:  var(--moni-navy-400);
```

**DEPOIS:**
```css
/* Funil Step One — Verde Médio (SEM azul escuro) */
--moni-kanban-stepone:         var(--moni-green-600);  /* Verde #365848 */
--moni-kanban-stepone-light:   var(--moni-green-50);
--moni-kanban-stepone-accent:  var(--moni-green-400);
```

**Resultado visual**: 
- Colunas do Kanban agora têm header verde médio (não mais azul naval)
- Bordas e acentos também usam verde

---

### 2. **Focus States nos Formulários**

**Arquivos modificados:**
- `src/app/funil-stepone/novo/NovoCardForm.tsx`
- `src/app/funil-stepone/[id]/CardDetailClient.tsx`

**ANTES:**
```tsx
focus:border-[var(--moni-navy-800)]
focus:ring-[var(--moni-navy-800)]/20
```

**DEPOIS:**
```tsx
focus:border-stone-300
focus:ring-stone-200
```

**Resultado visual**: 
- Quando você clica em um input, a borda fica cinza claro (não mais azul)

---

### 3. **Background do Preview de Título**

**Arquivo**: `src/app/funil-stepone/novo/NovoCardForm.tsx`

**ANTES:**
```tsx
background: 'var(--moni-navy-50)'  /* Azul muito claro */
```

**DEPOIS:**
```tsx
background: 'var(--moni-surface-50)'  /* Off-white */
```

**Resultado visual**: 
- Preview do título do card agora tem fundo neutro (não mais azulado)

---

### 4. **Modal Headers** (já estava correto)

Os modais (`CardModal.tsx`, `NovoCardModal.tsx`) **já foram corrigidos anteriormente**:
- ✅ Header branco com borda sutil
- ✅ Botões sem fundo azul
- ✅ Badge da fase em dourado (não azul)

---

## 🔍 ONDE AINDA TEM AZUL (propositalmente):

### Módulos com tema próprio (NÃO MEXER):

1. **Sirene** (`src/app/sirene/`)
   - Tema escuro com azul (#1e3a5f)
   - Propositalmente diferente (sistema de chamados)
   - ✅ Manter como está

2. **Jurídico** (`src/app/juridico/`)
   - Tags azuis para status "aberto"
   - ✅ Manter como está

3. **Painel Card** (`src/app/steps-viabilidade/PainelCard.tsx`)
   - Badge azul para "Comitê Aprovado"
   - ✅ Manter como está (sistema antigo)

---

## 🎯 CORES OFICIAIS DO PROJETO (após mudanças):

### Paleta Principal (SEM laranja, SEM azul escuro):

| Cor | Nome | Hex | Uso |
|-----|------|-----|-----|
| 🟢 | Verde Médio | `#2f4a3a` | Texto primário, headers |
| 🟤 | Marrom Terra | `#4a3929` | Texto secundário |
| 🟡 | Dourado | `#d4ad68` | Acentos, badges, atenção |
| ⚪ | Off-white | `#f9f7f4` | Fundos |
| ⚫ | Verde Naval | `#0c2633` | Apenas texto (não mais fundos!) |

### Uso de Verde Naval (`--moni-navy-*`):

- ✅ **PERMITIDO**: Texto, bordas, ícones
- ❌ **PROIBIDO**: Fundos de header, botões primários, backgrounds grandes

**Exceção**: Sistema Sirene (tema próprio escuro)

---

## 📱 COMO VERIFICAR AS MUDANÇAS:

### 1. Reiniciar servidor Next.js
```bash
# Parar (Ctrl+C)
# Limpar cache
Remove-Item -Recurse -Force .next
# Iniciar
npm run dev
```

### 2. Limpar cache do navegador
- Ctrl + Shift + R (hard reload)
- Ou Ctrl + Shift + Delete → Limpar cache

### 3. Verificar visualmente

**Funil Step One** (`/funil-stepone`):
- [ ] Headers das colunas são VERDE (não azul)
- [ ] Ao clicar em inputs, borda fica CINZA (não azul)
- [ ] Preview de título tem fundo OFF-WHITE (não azulado)
- [ ] Modais têm header BRANCO (não azul escuro)
- [ ] Botões principais são NEUTROS ou VERDE (não azul)

**Se ainda aparecer azul escuro**:
- Limpe o cache novamente (várias vezes)
- Feche TODAS as abas do navegador
- Abra novamente

---

## 🚀 IMPACTO DAS MUDANÇAS:

### ✅ O QUE MELHOROU:

1. **Consistência visual**: Cores alinhadas com identidade Moní (verde, marrom, dourado)
2. **Menos peso visual**: Headers claros, não mais escuros
3. **Acessibilidade**: Contraste melhor, menos cores saturadas
4. **Identidade de marca**: Verde natural (casa, natureza) ao invés de azul tecnológico

### ⚠️ O QUE FICOU IGUAL:

1. Funcionalidades (tudo continua funcionando)
2. Layout (apenas cores mudaram)
3. RLS e permissões (não afeta)
4. Performance (não afeta)

---

## 📋 ARQUIVOS MODIFICADOS:

```
✅ src/styles/moni-tokens.css
✅ src/app/funil-stepone/novo/NovoCardForm.tsx
✅ src/app/funil-stepone/[id]/CardDetailClient.tsx
```

**Total**: 3 arquivos, ~10 linhas modificadas

---

## 🎨 ANTES vs DEPOIS:

### Headers das Colunas:
- **ANTES**: Fundo azul naval escuro (#0c2633)
- **DEPOIS**: Fundo verde médio (#365848)

### Focus em Inputs:
- **ANTES**: Borda azul naval ao clicar
- **DEPOIS**: Borda cinza neutra ao clicar

### Modal Headers:
- **ANTES**: Fundo azul naval escuro (já estava corrigido anteriormente)
- **DEPOIS**: Fundo branco com borda (mantido)

---

## 🔧 SE ALGO NÃO FICOU BOM:

### Reverter mudanças:

```bash
git checkout HEAD -- src/styles/moni-tokens.css
git checkout HEAD -- src/app/funil-stepone/novo/NovoCardForm.tsx
git checkout HEAD -- src/app/funil-stepone/[id]/CardDetailClient.tsx
```

### Ou editar manualmente:

Volte os valores antigos em `moni-tokens.css`:
```css
--moni-kanban-stepone: var(--moni-navy-800);
```

---

## ✅ PRÓXIMOS PASSOS:

1. **Testar visualmente** todas as telas do Funil Step One
2. **Verificar contraste** (texto legível sobre novos fundos)
3. **Validar com usuários** (feedback sobre cores)
4. **Aplicar em outros Kanbans** (se aprovado)

**Lembre-se**: Sirene e Jurídico mantêm seus temas próprios!
