# 📦 Cards de Exemplo - Índice Completo

## 🎯 Visão Geral

Este pacote contém **scripts SQL** e **documentação** para criar, gerenciar e testar cards de exemplo no **Funil Step One**, refletindo todas as modificações implementadas (SLA em dias úteis, modal redesenhado, etc).

---

## 📁 Arquivos Disponíveis

### 🚀 SCRIPTS SQL DE CRIAÇÃO

#### 1. **CARDS_EXEMPLO_COMPLETO.sql** ⭐
```
Tipo: Criação de cards
Complexidade: ⭐⭐⭐ (Avançado)
Tempo: ~2 segundos
```

**O que faz:**
- Remove cards exemplo antigos
- Cria 8 novos cards de exemplo
- Usa função `calcular_dias_uteis()` para precisão
- Gera relatórios automáticos
- Testa todos os estados de SLA

**Quando usar:** Produção ou quando precisa de precisão máxima

**Como executar:**
```sql
-- Copie TODO o conteúdo do arquivo e execute no Supabase SQL Editor
```

**Resultado:**
- 3 cards 🔴 ATRASADOS
- 2 cards 🟡 ATENÇÃO
- 3 cards ✅ OK

---

#### 2. **CARDS_EXEMPLO_SIMPLES.sql** 🚀
```
Tipo: Criação de cards
Complexidade: ⭐ (Fácil)
Tempo: ~1 segundo
```

**O que faz:**
- Remove cards exemplo antigos
- Cria 8 novos cards de exemplo
- Usa intervalos simples (dias corridos)
- Não depende de funções complexas
- Busca IDs automaticamente

**Quando usar:** Desenvolvimento ou quando quer algo mais simples

**Como executar:**
```sql
-- Copie TODO o conteúdo e execute no Supabase SQL Editor
-- Não precisa ajustar nada, funciona automaticamente
```

---

#### 3. **ATUALIZAR_CARDS_EXEMPLO.sql** 🔄
```
Tipo: Atualização de cards existentes
Complexidade: ⭐⭐ (Intermediário)
Tempo: ~1 segundo
```

**O que faz:**
- Atualiza datas de cards existentes
- Atualiza títulos para formato "Nome - Fase"
- 3 opções: automático, manual ou por título

**Quando usar:** Quando já tem cards e quer apenas ajustar

**Como executar:**
```sql
-- 1. Execute a query de visualização (linhas 8-17)
-- 2. Escolha uma opção:
--    - Opção 1: Automático (linhas 24-64)
--    - Opção 2: Manual (linhas 71-99, descomente)
--    - Opção 3: Títulos (linhas 106-117)
```

---

### 📊 QUERIES DE CONSULTA

#### 4. **QUERIES_RAPIDAS_CARDS.sql** 🔍
```
Tipo: Queries prontas para uso
Complexidade: ⭐ (Copiar e colar)
Tempo: < 1 segundo cada
```

**O que tem:**
- 15 queries prontas para uso diário
- Verificações rápidas (cards por status, fase, responsável)
- Manutenção (limpar, arquivar, renovar)
- Diagnóstico (fases, feriados, usuários)
- Relatórios (dashboard, evolução, métricas)

**Quando usar:** Sempre! Para ver dados, fazer manutenção ou gerar relatórios

**Como executar:**
```sql
-- Copie APENAS a query que precisa
-- Cole no Supabase SQL Editor
-- Execute
```

**Queries mais usadas:**
1. `#1` - Ver todos os cards com status
2. `#2` - Contar por status
3. `#4` - Ver apenas atrasados
4. `#5` - Ver alertas (vence hoje/amanhã)
5. `#13` - Dashboard completo

---

### 📚 DOCUMENTAÇÃO

#### 5. **GUIA_CARDS_EXEMPLO.md** 📖
```
Tipo: Documentação completa
Páginas: 15
```

**O que tem:**
- Explicação detalhada de cada script
- Como escolher qual usar
- Estados de SLA explicados
- Distribuição por fase
- Queries úteis
- Troubleshooting completo
- Checklist de execução

**Quando usar:** 
- Primeira vez usando os scripts
- Dúvidas sobre como funcionam
- Problemas na execução

---

#### 6. **README_CARDS_EXEMPLO.md** 📋
```
Tipo: Índice visual (este arquivo)
Páginas: 5
```

**O que tem:**
- Visão geral de todos os arquivos
- Fluxogramas de decisão
- Resumo visual de cada arquivo
- Guia rápido de uso

**Quando usar:** Para navegar e escolher qual arquivo usar

---

## 🎯 Fluxograma de Decisão

```
┌─────────────────────────────────────┐
│   Preciso criar cards de exemplo   │
└─────────────┬───────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │  Já tenho cards?    │
    └─────┬───────────┬───┘
          │           │
         SIM         NÃO
          │           │
          ▼           ▼
    ┌──────────┐  ┌────────────────────┐
    │ ATUALIZAR│  │ Quer precisão max? │
    │  #3      │  └──────┬─────────┬───┘
    └──────────┘        SIM       NÃO
                         │         │
                         ▼         ▼
                   ┌──────────┐ ┌──────────┐
                   │COMPLETO  │ │ SIMPLES  │
                   │   #1     │ │    #2    │
                   └──────────┘ └──────────┘

┌──────────────────────────────────────┐
│    Preciso consultar/ver dados      │
└─────────────┬────────────────────────┘
              │
              ▼
        ┌──────────┐
        │ QUERIES  │
        │   #4     │
        └──────────┘
```

---

## 📋 Ordem de Execução Recomendada

### Primeira Vez (Setup Completo)

```
1️⃣ Ler: GUIA_CARDS_EXEMPLO.md
   ↓
2️⃣ Executar: CARDS_EXEMPLO_COMPLETO.sql (ou SIMPLES.sql)
   ↓
3️⃣ Verificar: QUERIES_RAPIDAS_CARDS.sql → Query #1
   ↓
4️⃣ Testar: http://localhost:3000/funil-stepone
```

### Uso Diário

```
1️⃣ Ver status: QUERIES_RAPIDAS_CARDS.sql → Query #1 ou #2
   ↓
2️⃣ Ver alertas: QUERIES_RAPIDAS_CARDS.sql → Query #5
   ↓
3️⃣ Dashboard: QUERIES_RAPIDAS_CARDS.sql → Query #13
```

### Manutenção Periódica

```
1️⃣ Ver cards antigos: QUERIES_RAPIDAS_CARDS.sql → Query #4
   ↓
2️⃣ Arquivar: ATUALIZAR_CARDS_EXEMPLO.sql → Opção 2
   ↓
3️⃣ Limpar exemplos: QUERIES_RAPIDAS_CARDS.sql → Query #6
```

---

## 🎨 Cards Criados - Visual

```
┌─────────────────────────────────────────────────────┐
│  FUNIL STEP ONE - 8 CARDS DE EXEMPLO               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🔴 João Silva - Dados da Cidade                   │
│     Atrasado 10 d.u.                               │
│                                                     │
│  🔴 Maria Santos - Lista de Condomínios            │
│     Atrasado 7 d.u.                                │
│                                                     │
│  🔴 Fernanda Lima - Mapa de Competidores           │
│     Atrasado 6 d.u.                                │
│                                                     │
│  🟡 Roberto Alves - Lista de Condomínios           │
│     Vence hoje                                     │
│                                                     │
│  🟡 Pedro Costa - Dados dos Condomínios            │
│     Vence em 1 d.u.                                │
│                                                     │
│  ✅ Ana Oliveira - Lotes disponíveis               │
│     3 d.u. restantes                               │
│                                                     │
│  ✅ Juliana Ferreira - Dados dos Condomínios       │
│     4 d.u. restantes                               │
│                                                     │
│  ✅ Carlos Mendes - Dados da Cidade                │
│     Recém criado                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Pré-requisitos

Antes de usar os scripts, certifique-se de que você tem:

- [ ] Kanban "Funil Step One" criado (`091_step_one_kanban.sql`)
- [ ] Função de dias úteis criada (`102_feriados_dias_uteis.sql`)
- [ ] Tabela de feriados populada
- [ ] Usuário logado no sistema
- [ ] RLS configurado corretamente

**Verificação rápida:**
```sql
-- Execute isso para verificar se está tudo OK:
SELECT 
  (SELECT COUNT(*) FROM kanbans WHERE nome = 'Funil Step One') as kanban_ok,
  (SELECT COUNT(*) FROM kanban_fases WHERE kanban_id IN (SELECT id FROM kanbans WHERE nome = 'Funil Step One')) as fases_ok,
  (SELECT COUNT(*) FROM feriados_nacionais) as feriados_ok,
  (SELECT COUNT(*) FROM auth.users) as usuarios_ok;

-- Resultado esperado:
-- kanban_ok: 1
-- fases_ok: 7 (ou mais)
-- feriados_ok: 36 (ou mais)
-- usuarios_ok: 1 (ou mais)
```

---

## 🚨 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| "Kanban não encontrado" | Execute `091_step_one_kanban.sql` |
| "Função calcular_dias_uteis não existe" | Execute `102_feriados_dias_uteis.sql` |
| "Nenhum usuário encontrado" | Faça login no sistema |
| Cards não aparecem no frontend | Execute query #12 de QUERIES_RAPIDAS_CARDS.sql |
| SLA não calcula | Execute query #11 de QUERIES_RAPIDAS_CARDS.sql |

---

## 📊 Estatísticas dos Scripts

| Script | Linhas | Cards | Tempo | Complexidade |
|--------|--------|-------|-------|--------------|
| COMPLETO | 250 | 8 | ~2s | ⭐⭐⭐ |
| SIMPLES | 180 | 8 | ~1s | ⭐ |
| ATUALIZAR | 140 | - | ~1s | ⭐⭐ |
| QUERIES | 450 | - | < 1s | ⭐ |

---

## 🎉 Pronto para Começar!

1. **Primeira vez?** 
   - Leia: `GUIA_CARDS_EXEMPLO.md`
   - Execute: `CARDS_EXEMPLO_SIMPLES.sql`

2. **Precisa de precisão?**
   - Execute: `CARDS_EXEMPLO_COMPLETO.sql`

3. **Uso diário?**
   - Use: `QUERIES_RAPIDAS_CARDS.sql`

4. **Dúvidas?**
   - Consulte: `GUIA_CARDS_EXEMPLO.md`

---

## 📝 Changelog

### v1.0 - 15/04/2026
- ✅ Scripts de criação (COMPLETO e SIMPLES)
- ✅ Script de atualização
- ✅ 15 queries prontas
- ✅ Documentação completa
- ✅ Suporte a dias úteis
- ✅ 3 estados de SLA

---

## 🔗 Arquivos Relacionados

- `MODAL_CARD_COMPLETO.md` - Documentação do modal
- `AJUSTES_FUNIL_STEPONE.md` - Documentação dos 5 ajustes
- `src/lib/dias-uteis.ts` - Funções TypeScript
- `supabase/migrations/102_feriados_dias_uteis.sql` - Funções SQL

---

**Criado em:** 15/04/2026  
**Versão:** 1.0  
**Autor:** Sistema Moní  
**Status:** ✅ Pronto para produção
