# 🔄 COMO ATUALIZAR CARDS EXEMPLO

**Data**: 15/04/2026  
**Arquivo**: `CARDS_EXEMPLO_ATUALIZADOS.sql`  
**Tempo**: 3 minutos

---

## 🎯 O QUE MUDOU

### Cards ANTES (formato antigo):
```
- João Silva - Dados da Cidade
- Maria Santos - Lista de Condomínios
- Pedro Costa - Dados dos Condomínios
```

### Cards DEPOIS (formato atualizado):
```
- FK0001 - São Paulo Capital - Centro Expandido
- FK0002 - Campinas - Barão Geraldo
- FK0003 - Ribeirão Preto - Zona Sul
- FK0004 - Santos - Ponta da Praia
... até FK0019
```

---

## 📊 NOVA ESTRUTURA

**Total**: 19 cards

**Distribuição pelas 7 fases**:
```
Fase 1 (Dados da Cidade):           4 cards (FK0001-FK0004)
Fase 2 (Lista de Condomínios):      3 cards (FK0005-FK0007)
Fase 3 (Dados dos Condomínios):     4 cards (FK0008-FK0011)
Fase 4 (Lotes disponíveis):         2 cards (FK0012-FK0013)
Fase 5 (Mapa de Competidores):      2 cards (FK0014-FK0015)
Fase 6 (BCA + Batalha de Casas):    2 cards (FK0016-FK0017)
Fase 7 (Hipóteses):                 2 cards (FK0018-FK0019)
```

**Status de SLA**:
- 🔴 Atrasados: ~4 cards
- 🟡 Atenção (D-1): ~2 cards
- ✅ No prazo: ~13 cards

**Cidades representadas**:
- São Paulo Capital
- Campinas
- Ribeirão Preto
- Santos
- Belo Horizonte
- Curitiba
- Porto Alegre
- Florianópolis
- Brasília
- Goiânia
- Salvador
- Recife
- Fortaleza
- Manaus
- Vitória
- São José dos Campos
- Sorocaba
- Uberlândia
- Londrina

---

## 🚀 COMO EXECUTAR (3 minutos)

### PASSO 1: Abrir Supabase Dashboard (1 min)

```
1. Abrir navegador
2. Ir para: https://supabase.com/dashboard
3. Fazer login (se necessário)
4. Selecionar projeto: DEV (não produção!)
5. Menu lateral → SQL Editor (ícone de código)
```

---

### PASSO 2: Executar script (1 min)

```
1. No SQL Editor, clicar em "+ New query"

2. Copiar TODO o conteúdo de:
   CARDS_EXEMPLO_ATUALIZADOS.sql

3. Colar no editor

4. Clicar em "Run" (ou pressionar Ctrl+Enter)

5. Aguardar aparecer:
   ✅ CARDS CRIADOS COM SUCESSO!
   Total: 19 cards
```

**Resultado esperado**:
```sql
✅ CARDS CRIADOS COM SUCESSO!
=======================================
Total: 19 cards
Formato: FK0001 - Nome do Franqueado - Área

Distribuição por fase:
  Fase 1 (Dados da Cidade): 4 cards
  Fase 2 (Lista Condomínios): 3 cards
  ...
```

---

### PASSO 3: Verificar no sistema (1 min)

```
1. Abrir: http://localhost:3000/funil-stepone

2. Ver as 7 colunas (fases)

3. Verificar cards em cada fase:
   ✅ Títulos no formato "FK0001 - Nome - Área"
   ✅ Tags de SLA corretas (Atrasado/Atenção/OK)
   ✅ Distribuídos pelas 7 fases
   ✅ Total de 19 cards
```

**Exemplo visual esperado**:
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Dados da Cidade │  │ Lista Condos    │  │ Dados Condos    │
│ 4 cards         │  │ 3 cards         │  │ 4 cards         │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│                 │  │                 │  │                 │
│ FK0001 - SP     │  │ FK0005 - BH     │  │ FK0008 - Flori  │
│ [Atrasado 10du] │  │ [Atrasado 7du]  │  │ [Atrasado 12du] │
│                 │  │                 │  │                 │
│ FK0002 - Campi  │  │ FK0006 - Curiti │  │ FK0009 - Brasí  │
│ [Vence em 1du]  │  │ [OK - 4du]      │  │ [Atrasado 9du]  │
│                 │  │                 │  │                 │
│ FK0003 - Ribei  │  │ FK0007 - Porto  │  │ FK0010 - Goiân  │
│ [OK - 5du]      │  │ [Recém criado]  │  │ [OK - 5du]      │
│                 │  │                 │  │                 │
│ FK0004 - Santos │  │                 │  │ FK0011 - Salvad │
│ [Recém criado]  │  │                 │  │ [OK - 8du]      │
│                 │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## ✅ CHECKLIST DE VERIFICAÇÃO

Depois de executar, verificar:

### No Supabase:
- [ ] Script executou sem erros
- [ ] Mensagem "✅ CARDS CRIADOS COM SUCESSO!" apareceu
- [ ] Query de verificação mostrou 19 cards

### No Sistema (localhost:3000/funil-stepone):
- [ ] 19 cards visíveis no total
- [ ] Fase 1: 4 cards
- [ ] Fase 2: 3 cards
- [ ] Fase 3: 4 cards
- [ ] Fase 4: 2 cards
- [ ] Fase 5: 2 cards
- [ ] Fase 6: 2 cards
- [ ] Fase 7: 2 cards
- [ ] Títulos no formato "FK0001 - Nome - Área"
- [ ] Tags de SLA corretas (vermelho/dourado/sem tag)
- [ ] Ao clicar em um card, modal abre com título correto

---

## 🔧 SE DER ERRO

### Erro 1: "Kanban 'Funil Step One' não encontrado"

**Causa**: Migração 091 não foi executada.

**Solução**:
```sql
-- Executar primeiro no SQL Editor:
-- Conteúdo de: supabase/migrations/091_step_one_kanban.sql
-- Depois executar CARDS_EXEMPLO_ATUALIZADOS.sql
```

---

### Erro 2: "Nenhum usuário encontrado"

**Causa**: Não fez login ainda.

**Solução**:
```
1. Abrir: http://localhost:3000
2. Fazer login com qualquer conta
3. Depois executar o script novamente
```

---

### Erro 3: "Fases incompletas. Esperado 7, encontrado X"

**Causa**: Algumas fases não foram criadas.

**Solução**:
```sql
-- Verificar quantas fases existem:
SELECT nome, ordem 
FROM kanban_fases 
WHERE kanban_id = (SELECT id FROM kanbans WHERE nome = 'Funil Step One')
ORDER BY ordem;

-- Deve mostrar 7 fases:
-- 1. Dados da Cidade
-- 2. Lista de Condomínios
-- 3. Dados dos Condomínios
-- 4. Lotes disponíveis
-- 5. Mapa de Competidores
-- 6. BCA + Batalha de Casas
-- 7. Hipóteses

-- Se faltando: executar 091_step_one_kanban.sql
```

---

### Erro 4: Cards ainda mostram título antigo

**Causa**: Cache do navegador.

**Solução**:
```powershell
# No navegador:
Ctrl+Shift+R (5 vezes)

# Ou:
Ctrl+Shift+N (janela anônima)
```

---

## 📊 DIFERENÇAS: ANTES vs DEPOIS

### Estrutura do Título:

**ANTES**:
```
João Silva - Dados da Cidade
```

**DEPOIS**:
```
FK0001 - São Paulo Capital - Centro Expandido
```

### Quantidade de Cards:

**ANTES**: 14 cards (mais concentrados em fases iniciais)

**DEPOIS**: 19 cards (melhor distribuídos pelas 7 fases)

### Cidades:

**ANTES**: Nomes genéricos (João Silva, Maria Santos, etc.)

**DEPOIS**: Cidades reais brasileiras + áreas específicas

### SLA:

**ANTES**: Cálculo simples em dias corridos

**DEPOIS**: SLA em dias úteis (exclui fins de semana + feriados)

---

## 🎯 CARDS DETALHADOS

### Fase 1: Dados da Cidade (4 cards)

```
FK0001 - São Paulo Capital - Centro Expandido
  Status: Atrasado grave (10 d.u.)
  Criado: ~14 dias atrás
  Tag: 🔴 Atrasado 5 d.u.

FK0002 - Campinas - Barão Geraldo
  Status: Atenção (vence em 1 d.u.)
  Criado: ~6 dias atrás
  Tag: 🟡 Vence em 1 d.u.

FK0003 - Ribeirão Preto - Zona Sul
  Status: OK (3 d.u. restantes)
  Criado: ~3 dias atrás
  Tag: (sem tag)

FK0004 - Santos - Ponta da Praia
  Status: Recém criado
  Criado: hoje
  Tag: (sem tag)
```

### Fase 2: Lista de Condomínios (3 cards)

```
FK0005 - Belo Horizonte - Pampulha
  Status: Atrasado leve (2 d.u.)
  Tag: 🔴 Atrasado 2 d.u.

FK0006 - Curitiba - Batel
  Status: OK (4 d.u. restantes)
  Tag: (sem tag)

FK0007 - Porto Alegre - Moinhos de Vento
  Status: Muito recente
  Tag: (sem tag)
```

### Fase 3: Dados dos Condomínios (4 cards)

```
FK0008 - Florianópolis - Jurerê Internacional
  Status: Muito atrasado (7 d.u.)
  Tag: 🔴 Atrasado 7 d.u.

FK0009 - Brasília - Lago Sul
  Status: Atrasado (4 d.u.)
  Tag: 🔴 Atrasado 4 d.u.

FK0010 - Goiânia - Setor Bueno
  Status: OK (5 d.u. restantes)
  Tag: (sem tag)

FK0011 - Salvador - Patamares
  Status: OK (8 d.u. restantes)
  Tag: (sem tag)
```

### Fases 4-7: (10 cards restantes)

Ver detalhes completos no script SQL!

---

## 📚 ARQUIVOS RELACIONADOS

- **`CARDS_EXEMPLO_ATUALIZADOS.sql`** - Script para executar (este arquivo)
- **`091_step_one_kanban.sql`** - Migração base (se precisar)
- **`102_feriados_dias_uteis.sql`** - Feriados e funções de SLA
- **`VERIFICAR_MIGRACOES.sql`** - Checklist de migrações
- **`STATUS_COMPLETO_PROJETO.md`** - Visão geral do projeto

---

## 💡 DICAS

### Testar diferentes estados de SLA:

```sql
-- Ver cards atrasados:
SELECT titulo, created_at 
FROM kanban_cards 
WHERE created_at < (CURRENT_DATE - INTERVAL '10 days');

-- Ver cards em atenção:
SELECT titulo, created_at 
FROM kanban_cards 
WHERE created_at BETWEEN (CURRENT_DATE - INTERVAL '6 days') 
                     AND (CURRENT_DATE - INTERVAL '4 days');
```

### Adicionar mais cards manualmente:

```sql
-- Template:
INSERT INTO kanban_cards (
  kanban_id,
  fase_id,
  franqueado_id,
  titulo,
  status,
  created_at
) VALUES (
  (SELECT id FROM kanbans WHERE nome = 'Funil Step One'),
  (SELECT id FROM kanban_fases WHERE nome = 'Dados da Cidade' LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
  'FK0020 - Sua Cidade - Sua Área',
  'ativo',
  CURRENT_DATE
);
```

### Resetar cards (começar do zero):

```sql
-- ⚠️ CUIDADO: Remove TODOS os cards do Funil Step One!
DELETE FROM kanban_cards 
WHERE kanban_id = (
  SELECT id FROM kanbans WHERE nome = 'Funil Step One'
);

-- Depois executar CARDS_EXEMPLO_ATUALIZADOS.sql novamente
```

---

## 🎉 RESULTADO FINAL

Após executar o script, você terá:

✅ **19 cards realistas** com nomes de cidades brasileiras  
✅ **Formato profissional**: FK0001 - Nome - Área  
✅ **Distribuídos pelas 7 fases** do Funil Step One  
✅ **SLA em dias úteis** funcionando corretamente  
✅ **Estados variados**: Atrasado, Atenção, OK, Recém criado  
✅ **Fácil de entender** para novo membro do time (Ingrid)  

---

**Tempo total**: 3 minutos

**Risco**: Baixo (apenas dados de exemplo)

**Reversível**: Sim (só executar script de limpeza)

**PRONTO PARA USAR!** 🚀
