# ✅ CORREÇÃO: Título do Card e Header das Colunas

**Data**: 15/04/2026
**Arquivos modificados**: 2

---

## 🎯 PROBLEMAS CORRIGIDOS

### 1. Título do Card no Modal

**ANTES**:
```typescript
// Linha 313 de CardModal.tsx
const cardTitulo = `FK${String(card.id).padStart(4, '0')} - ${card.titulo}`;
```

**Resultado**: Mostrava UUID em vez do código FK
```
FK85a3-2c4f-4e9b-8d1a-9f2e1b3c4d5e - Nome do Franqueado - Área
```

**DEPOIS**:
```typescript
// Usa o título real do card (já vem no formato correto)
const cardTitulo = card.titulo;
```

**Resultado**: Mostra o título real do card
```
FK0001 - Nome do Franqueado - Área de Atuação
```

---

### 2. Header das Colunas do Kanban

**ANTES**:
```tsx
// KanbanColumn.tsx linhas 50-66
<div
  className="border-b px-4 py-3"
  style={{
    background: 'var(--moni-kanban-stepone-light)', // Verde claro
    borderBottom: '0.5px solid var(--moni-border-default)',
  }}
>
  <h2 className="font-semibold text-stone-800">
    {fase.nome}
  </h2>
  <div className="mt-0.5 flex items-center justify-between">
    <p className="text-xs text-stone-600">
      {cards.length} card(s)
    </p>
    {fase.sla_dias && (
      <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-medium text-stone-700">
        SLA: {fase.sla_dias}d
      </span>
    )}
  </div>
</div>
```

**Visual**: Fundo verde claro, textos escuros

**DEPOIS**:
```tsx
<div
  className="border-b px-4 py-3"
  style={{
    background: 'var(--moni-kanban-stepone)', // Verde médio
    borderBottom: '0.5px solid var(--moni-border-default)',
  }}
>
  <h2 className="font-semibold" style={{ color: 'var(--moni-text-inverse)' }}>
    {fase.nome}
  </h2>
  <div className="mt-0.5 flex items-center justify-between">
    <p className="text-xs" style={{ color: 'var(--moni-text-inverse)', opacity: 0.9 }}>
      {cards.length} card(s)
    </p>
    {fase.sla_dias && (
      <span 
        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{
          background: 'rgba(255, 255, 255, 0.2)',
          color: 'var(--moni-text-inverse)',
          border: '0.5px solid rgba(255, 255, 255, 0.3)',
        }}
      >
        SLA: {fase.sla_dias}d
      </span>
    )}
  </div>
</div>
```

**Visual**: Fundo verde médio (marca Moní), textos brancos

---

## 🎨 CORES APLICADAS

### Header das Colunas:

```css
/* Fundo */
background: var(--moni-kanban-stepone) = var(--moni-green-600) = #2f4a3a

/* Textos */
color: var(--moni-text-inverse) = #ffffff (branco)
opacity: 0.9 (para contagem de cards)

/* Badge SLA */
background: rgba(255, 255, 255, 0.2) (branco semi-transparente)
color: var(--moni-text-inverse) = #ffffff
border: 0.5px solid rgba(255, 255, 255, 0.3)
```

### Sem Laranja ✅
### Bordas 0.5px ✅

---

## 🧪 COMO TESTAR

### Teste 1: Título do Card no Modal

```
1. Abrir: http://localhost:3000/funil-stepone

2. Clicar em qualquer card

3. Verificar título no header do modal:
   ✅ DEVE mostrar: "FK0001 - Nome do Franqueado - Área"
   ❌ NÃO deve mostrar: "FK85a3... - Título"

4. Exemplos esperados:
   - FK0001 - São Paulo Capital - Centro
   - FK0002 - Campinas - Zona Norte
   - FK0003 - Belo Horizonte - Zona Sul
```

### Teste 2: Header das Colunas Verde

```
1. Abrir: http://localhost:3000/funil-stepone

2. Ver as 7 colunas do Kanban

3. Verificar header de cada coluna:
   ✅ Fundo verde médio (marca Moní)
   ✅ Título da fase em branco
   ✅ Contador "X card(s)" em branco
   ✅ Badge "SLA: Xd" com fundo semi-transparente branco
   
4. Comparar com visual anterior:
   ❌ ANTES: Fundo verde claro #f0f7f4, textos escuros
   ✅ AGORA: Fundo verde médio #2f4a3a, textos brancos
```

### Teste 3: Responsividade

```
1. Redimensionar janela do navegador (mobile)

2. Verificar que header das colunas:
   ✅ Mantém verde médio
   ✅ Textos continuam legíveis em branco
   ✅ Badge SLA adapta tamanho

3. Abrir modal do card:
   ✅ Título continua legível
   ✅ Quebra de linha funciona se título for longo
```

---

## 📊 VISUAL ESPERADO

### Header da Coluna (ANTES vs DEPOIS):

**ANTES**:
```
┌─────────────────────────────┐
│ 🟢 Dados da Cidade (claro)  │ ← Verde claro #f0f7f4
│ 🔵 3 card(s)  [SLA: 7d]     │ ← Textos escuros
└─────────────────────────────┘
```

**DEPOIS**:
```
┌─────────────────────────────┐
│ ⚪ Dados da Cidade (escuro)  │ ← Verde médio #2f4a3a
│ ⚪ 3 card(s)  [SLA: 7d]      │ ← Textos brancos
└─────────────────────────────┘
```

### Modal do Card (Título):

**ANTES**:
```
┌─────────────────────────────────────────────┐
│ FK85a3-2c4f-4e9b-8d1a-9f2e1b3c4d5e - Título│ ← UUID!!!
│ [Fase] [SLA]                          [X]   │
└─────────────────────────────────────────────┘
```

**DEPOIS**:
```
┌─────────────────────────────────────────────┐
│ FK0001 - São Paulo Capital - Centro    [X]  │ ← Título real
│ [Dados da Cidade] [Vence em 5 d.u.]        │
└─────────────────────────────────────────────┘
```

---

## 🔧 SE O TÍTULO AINDA MOSTRAR UUID

### Possível Causa 1: Cards sem campo titulo preenchido

**Diagnóstico**:
```sql
-- Executar no Supabase SQL Editor:
SELECT id, titulo, created_at 
FROM kanban_cards 
WHERE kanban_id = (
  SELECT id FROM kanbans WHERE nome = 'Funil Step One'
)
LIMIT 5;
```

**Resultado esperado**:
```
id                                   | titulo                        | created_at
-------------------------------------+-------------------------------+------------
85a3...                              | FK0001 - Nome - Área          | 2026-04-10
9f2e...                              | FK0002 - Nome - Área          | 2026-04-11
...
```

**Se titulo estiver NULL ou vazio**:
```sql
-- Corrigir:
UPDATE kanban_cards
SET titulo = 'FK' || LPAD((ROW_NUMBER() OVER (ORDER BY created_at))::text, 4, '0') 
             || ' - ' || COALESCE(profiles.full_name, 'Sem Nome') 
             || ' - ' || 'Área Padrão'
FROM profiles
WHERE kanban_cards.franqueado_id = profiles.id
  AND kanban_cards.titulo IS NULL;
```

---

### Possível Causa 2: Cache do navegador

**Solução**:
```powershell
# 1. Parar servidor (Ctrl+C)

# 2. Limpar cache
Remove-Item -Recurse -Force .next

# 3. Reiniciar
npm run dev

# 4. No navegador:
# Ctrl+Shift+R (5 vezes)
# Ou janela anônima: Ctrl+Shift+N
```

---

### Possível Causa 3: Código não foi salvo

**Verificar**:
```powershell
# Ver mudanças não commitadas:
git diff src/app/funil-stepone/CardModal.tsx

# Deve mostrar:
# -  const cardTitulo = `FK${String(card.id).padStart(4, '0')} - ${card.titulo}`;
# +  const cardTitulo = card.titulo;
```

**Se não mostrar a mudança**:
```powershell
# Arquivo pode não ter sido salvo
# Abrir no Cursor e pressionar Ctrl+S
# Depois reiniciar servidor
```

---

## 📋 CHECKLIST DE VERIFICAÇÃO

Após fazer as mudanças, verificar:

- [ ] Servidor reiniciado (`npm run dev`)
- [ ] Cache do navegador limpo (Ctrl+Shift+R)
- [ ] Abrir Kanban: `http://localhost:3000/funil-stepone`
- [ ] Headers das colunas têm fundo verde médio
- [ ] Textos dos headers são brancos/legíveis
- [ ] Badge SLA semi-transparente
- [ ] Clicar em um card qualquer
- [ ] Título do modal mostra "FK0001 - Nome - Área"
- [ ] Título NÃO mostra UUID
- [ ] Console (F12) sem erros

---

## 🎨 REFERÊNCIAS DE DESIGN

### Cores Moní (confirmadas):

```css
/* Verde Médio - Headers */
--moni-green-600: #2f4a3a;

/* Verde Escuro - Textos */
--moni-green-900: #1a2a21;

/* Verde Claro - Fundos suaves (não mais usado em headers) */
--moni-green-50: #f0f7f4;

/* Texto Inverso - Sobre fundos escuros */
--moni-text-inverse: #ffffff;
```

### Estilo Visual:

- **Inspiração**: Porsche, Vogue
- **Características**: Elegância, sofisticação, limpo
- **Tipografia**: Sans-serif (família Moní)
- **Bordas**: Finas (0.5px), sutis
- **Contraste**: Alto para legibilidade

---

## 📞 SE AINDA TIVER PROBLEMAS

### Problema: Título mostra apenas "undefined" ou vazio

**Causa**: Campo `titulo` não existe na query do card.

**Solução**: Verificar `CardModal.tsx` linha 95:
```typescript
const { data: cardData, error: cardError } = await supabase
  .from('kanban_cards')
  .select('id, titulo, status, created_at, fase_id, franqueado_id, kanban_id')
  //        ^^^^^^ DEVE estar aqui!
  .eq('id', cardId)
  .single();
```

---

### Problema: Header das colunas ainda está claro

**Causa**: Variável CSS não está definida ou cache.

**Solução**:
```powershell
# 1. Verificar moni-tokens.css
cat src/styles/moni-tokens.css | Select-String "kanban-stepone"

# Deve mostrar:
# --moni-kanban-stepone:         var(--moni-green-600);

# 2. Se estiver correto, limpar cache
Remove-Item -Recurse -Force .next
npm run dev

# 3. Hard reload: Ctrl+Shift+R
```

---

### Problema: Texto do header não é branco

**Causa**: `--moni-text-inverse` não está definida.

**Solução**:
```css
/* Adicionar em moni-tokens.css se não existir: */
:root {
  --moni-text-inverse: #ffffff;
}
```

---

## 📊 ARQUIVOS MODIFICADOS

```
✅ src/app/funil-stepone/CardModal.tsx
   Linha 313: Corrigido título para usar card.titulo direto

✅ src/app/funil-stepone/KanbanColumn.tsx
   Linhas 50-66: Header com fundo verde médio e textos brancos

✅ src/styles/moni-tokens.css
   Linha 63: Alterado --moni-text-inverse de #f9f7f4 para #ffffff
   (branco puro para melhor legibilidade sobre fundos escuros)
```

**Total**: 3 arquivos modificados

**Linhas modificadas**: ~30 linhas

**Risco**: BAIXO (apenas visual, não afeta lógica)

---

## 🎯 RESULTADO FINAL ESPERADO

### Kanban Board:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Funil Step One                                    [+ Novo card]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ ⚪ Dados da   │  │ ⚪ Lista de   │  │ ⚪ Dados dos  │            │
│  │   Cidade     │  │   Condomínios│  │   Condomínios│            │
│  │ ⚪ 3 cards    │  │ ⚪ 2 cards    │  │ ⚪ 4 cards    │            │
│  │   [SLA: 7d]  │  │   [SLA: 7d]  │  │   [SLA: 10d] │            │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤            │
│  │              │  │              │  │              │            │
│  │ [Card]       │  │ [Card]       │  │ [Card]       │            │
│  │ FK0001 - ... │  │ FK0004 - ... │  │ FK0007 - ... │            │
│  │              │  │              │  │              │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

(Header verde médio #2f4a3a, textos brancos)
```

### Modal do Card:

```
┌─────────────────────────────────────────────────────────────────────┐
│  FK0001 - São Paulo Capital - Centro Expandido           [X]       │
│  [Dados da Cidade] [Vence em 5 d.u.]                               │
├─────────────────────────┬───────────────────────────────────────────┤
│  📋 HISTÓRICO (40%)     │  ▶️ FASE ATUAL (60%)                     │
│                         │                                           │
│  Fases anteriores...    │  Checklist                                │
│                         │  Campos                                   │
│                         │  Comentários                              │
│                         │  Atividades                               │
│                         │                                           │
│                         │  [Avançar fase] [Arquivar]                │
└─────────────────────────┴───────────────────────────────────────────┘

(Título real "FK0001 - Nome - Área", não UUID)
```

---

**FIM DA DOCUMENTAÇÃO**

**Tempo para testar**: 5 minutos

**Risco**: Baixo

**Impacto visual**: Alto (mais profissional e alinhado com marca Moní)
