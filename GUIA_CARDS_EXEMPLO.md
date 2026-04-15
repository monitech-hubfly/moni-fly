# 📋 GUIA: Cards de Exemplo para Funil Step One

## 🎯 Objetivo

Criar cards de exemplo no Funil Step One que demonstrem todos os estados de SLA em dias úteis, conforme as modificações implementadas.

---

## 📦 Scripts Disponíveis

### 1. **CARDS_EXEMPLO_COMPLETO.sql** ⭐ RECOMENDADO

**Quando usar:**
- Ambiente de produção
- Quer testar SLA real com dias úteis
- Precisa de precisão nos cálculos

**O que faz:**
- Remove cards exemplo antigos
- Cria 8 novos cards de exemplo
- Usa função `calcular_dias_uteis()` do banco
- Calcula datas precisas considerando fins de semana e feriados
- Gera relatórios de verificação

**Cards criados:**
- 3 cards ATRASADOS (vermelho, "Atrasado X d.u.")
- 2 cards em ATENÇÃO (dourado, "Vence em X d.u." ou "Vence hoje")
- 3 cards OK (sem tag ou "X d.u. restantes")

**Como executar:**
1. Abra **Supabase Dashboard > SQL Editor**
2. Copie todo o conteúdo de `CARDS_EXEMPLO_COMPLETO.sql`
3. Cole e clique em **Run**
4. Verifique os logs e relatórios gerados

---

### 2. **CARDS_EXEMPLO_SIMPLES.sql** 🚀 MAIS FÁCIL

**Quando usar:**
- Ambiente de desenvolvimento
- Precisa ajustar manualmente
- Quer algo mais simples de entender

**O que faz:**
- Remove cards exemplo antigos
- Cria 8 novos cards de exemplo
- Usa intervalos simples (dias corridos)
- Busca IDs automaticamente
- Não depende de funções complexas

**Como executar:**
1. Abra **Supabase Dashboard > SQL Editor**
2. Copie todo o conteúdo de `CARDS_EXEMPLO_SIMPLES.sql`
3. Cole e clique em **Run**
4. Execute as queries de verificação no final

---

### 3. **ATUALIZAR_CARDS_EXEMPLO.sql** 🔄 ATUALIZAÇÃO

**Quando usar:**
- Já tem cards criados
- Quer apenas ajustar as datas
- Quer atualizar títulos para novo formato

**O que faz:**
- Atualiza datas de cards existentes
- Atualiza títulos para formato "Nome - Fase"
- 3 opções: automático, manual ou por título

**Como executar:**
1. Abra **Supabase Dashboard > SQL Editor**
2. Execute primeiro a query de visualização
3. Escolha uma das 3 opções:
   - **Opção 1**: Automático (executa o bloco DO)
   - **Opção 2**: Manual (descomente e ajuste os IDs)
   - **Opção 3**: Atualizar títulos (executa o UPDATE)
4. Execute a verificação final

---

## 🎨 Estados de SLA Criados

### 🔴 ATRASADO (Vermelho)
- **Tag**: `moni-tag-atrasado`
- **Texto**: "Atrasado X d.u."
- **Critério**: Passou do SLA (>5 dias úteis)
- **Cards de exemplo**:
  - João Silva (14 dias atrás ≈ 10 d.u.)
  - Maria Santos (9 dias atrás ≈ 7 d.u.)
  - Fernanda Lima (8 dias atrás ≈ 6 d.u.)

### 🟡 ATENÇÃO (Dourado)
- **Tag**: `moni-tag-atencao`
- **Texto**: "Vence em X d.u." ou "Vence hoje"
- **Critério**: D-1 ou D-day (4-5 dias úteis)
- **Cards de exemplo**:
  - Pedro Costa (6 dias atrás ≈ 4 d.u., vence em 1 d.u.)
  - Roberto Alves (7 dias atrás ≈ 5 d.u., vence hoje)

### ✅ OK (Sem Tag)
- **Tag**: Nenhuma (ou texto informativo)
- **Texto**: "X d.u. restantes"
- **Critério**: Dentro do prazo (< 4 dias úteis)
- **Cards de exemplo**:
  - Ana Oliveira (3 dias atrás ≈ 2 d.u., 3 d.u. restantes)
  - Carlos Mendes (hoje, 5 d.u. inteiros)
  - Juliana Ferreira (1 dia atrás, 4 d.u. restantes)

---

## 🗂️ Distribuição por Fase

Os 8 cards são distribuídos nas primeiras 5 fases do Funil Step One:

1. **Dados da Cidade** → 2 cards
2. **Lista de Condomínios** → 2 cards
3. **Dados dos Condomínios** → 2 cards
4. **Lotes disponíveis** → 1 card
5. **Mapa de Competidores** → 1 card

Isso permite testar a visualização de múltiplos cards em diferentes colunas.

---

## 📊 Queries Úteis

### Ver todos os cards com status SLA
```sql
SELECT 
  kc.titulo,
  kf.nome as fase,
  kc.created_at::date as criado_em,
  public.calcular_dias_uteis(kc.created_at::date, CURRENT_DATE) as dias_uteis,
  CASE 
    WHEN public.calcular_dias_uteis(kc.created_at::date, CURRENT_DATE) > 5 
    THEN '🔴 ATRASADO'
    WHEN public.calcular_dias_uteis(kc.created_at::date, CURRENT_DATE) >= 4 
    THEN '🟡 ATENÇÃO'
    ELSE '✅ OK'
  END as status
FROM public.kanban_cards kc
JOIN public.kanban_fases kf ON kc.fase_id = kf.id
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One' AND kc.status = 'ativo'
ORDER BY kc.created_at DESC;
```

### Contar cards por status
```sql
SELECT 
  CASE 
    WHEN public.calcular_dias_uteis(kc.created_at::date, CURRENT_DATE) > 5 
    THEN '🔴 ATRASADO'
    WHEN public.calcular_dias_uteis(kc.created_at::date, CURRENT_DATE) >= 4 
    THEN '🟡 ATENÇÃO'
    ELSE '✅ OK'
  END as status,
  COUNT(*) as total
FROM public.kanban_cards kc
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One' AND kc.status = 'ativo'
GROUP BY 1;
```

### Limpar todos os cards de exemplo
```sql
DELETE FROM public.kanban_cards 
WHERE titulo LIKE 'João Silva%' 
   OR titulo LIKE 'Maria Santos%'
   OR titulo LIKE 'Pedro Costa%'
   OR titulo LIKE 'Ana Oliveira%'
   OR titulo LIKE 'Carlos Mendes%'
   OR titulo LIKE 'Fernanda Lima%'
   OR titulo LIKE 'Roberto Alves%'
   OR titulo LIKE 'Juliana Ferreira%';
```

---

## 🔧 Troubleshooting

### Problema: "Kanban não encontrado"
**Solução:** Execute primeiro a migração `091_step_one_kanban.sql`

### Problema: "Nenhum usuário encontrado"
**Solução:** Faça login no sistema antes de executar o script

### Problema: "Função calcular_dias_uteis não existe"
**Solução:** Execute primeiro a migração `102_feriados_dias_uteis.sql`

### Problema: Cards não aparecem no frontend
**Solução:** 
1. Verifique se RLS está configurado corretamente
2. Execute: `SELECT * FROM kanban_cards WHERE status = 'ativo'`
3. Confirme que `franqueado_id` corresponde ao seu usuário
4. Execute: `ATUALIZAR_CARDS_USUARIO.sql` para ajustar

### Problema: SLA não calcula corretamente
**Solução:**
1. Teste a função: `SELECT calcular_dias_uteis('2026-04-01', CURRENT_DATE);`
2. Verifique feriados: `SELECT * FROM feriados_nacionais WHERE data >= CURRENT_DATE LIMIT 10;`
3. Confirme `sla_dias` nas fases: `SELECT nome, sla_dias FROM kanban_fases;`

---

## ✅ Checklist de Execução

### Setup Inicial (uma vez)
- [ ] Execute `091_step_one_kanban.sql` (cria Kanban e fases)
- [ ] Execute `102_feriados_dias_uteis.sql` (cria funções de dias úteis)
- [ ] Confirme que está logado no sistema

### Criar Cards de Exemplo
- [ ] Escolha um dos scripts (COMPLETO ou SIMPLES)
- [ ] Execute no Supabase SQL Editor
- [ ] Verifique os logs de execução
- [ ] Execute as queries de verificação

### Testar no Frontend
- [ ] Acesse `http://localhost:3000/funil-stepone`
- [ ] Verifique se os 8 cards aparecem
- [ ] Confirme as tags de SLA (vermelho/dourado)
- [ ] Clique em um card para abrir o modal
- [ ] Teste o botão "+ Novo card"

---

## 📝 Notas Importantes

1. **Dias Úteis vs Dias Corridos**:
   - O sistema usa **dias úteis** (ignora fins de semana e feriados)
   - As datas nos scripts são aproximadas (dias corridos)
   - O cálculo real é feito pela função `calcular_dias_uteis()`

2. **Feriados**:
   - Feriados de 2025-2027 estão pré-carregados
   - Para adicionar novos anos, execute um INSERT na tabela `feriados_nacionais`

3. **SLA Padrão**:
   - Todas as fases têm SLA de **5 dias úteis** (padrão)
   - Pode ser ajustado por fase na tabela `kanban_fases`

4. **Títulos**:
   - Formato atual: "Nome - Fase"
   - Formato do modal: "FK0001 - Nome - Fase"
   - O prefixo FK é gerado automaticamente no modal

---

## 🚀 Próximos Passos

Após criar os cards de exemplo:

1. **Testar visualmente**:
   - Abra cada fase no Kanban
   - Verifique as cores das tags
   - Confirme os textos dos SLAs

2. **Testar funcionalidades**:
   - Abrir modal de card
   - Avançar para próxima fase
   - Criar novo card
   - Arquivar card

3. **Testar responsividade**:
   - Desktop (> 640px)
   - Mobile (< 640px)
   - Tablet (640-1024px)

4. **Implementar próximas features**:
   - Checklist personalizado por fase
   - Campos dinâmicos por fase
   - Sistema de comentários
   - Atividades vinculadas

---

## 📚 Referências

- `MODAL_CARD_COMPLETO.md` - Documentação do modal
- `AJUSTES_FUNIL_STEPONE.md` - Documentação dos 5 ajustes
- `src/lib/dias-uteis.ts` - Funções TypeScript de dias úteis
- `supabase/migrations/102_feriados_dias_uteis.sql` - Funções SQL

---

**Criado em:** 15/04/2026  
**Versão:** 1.0  
**Status:** ✅ Pronto para uso
