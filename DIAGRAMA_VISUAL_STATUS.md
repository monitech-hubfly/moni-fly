# 📊 DIAGRAMA VISUAL - STATUS DO PROJETO

## 🎯 PROGRESSO GERAL

```
FUNIL STEP ONE (NOVO)
════════════════════════════════════════════════════════════════════
[████████████████████████████░░░░░░░░░░] 70% COMPLETO

✅ Kanban independente funcionando
✅ 7 fases configuradas
✅ Modal duas colunas
✅ SLA em dias úteis
✅ Sistema de cores Moní
✅ Atividades dentro do card
⚠️  Não integrado ao Painel global
❌ Sem auto-criar cards
❌ Sem filtro por franquias
```

```
INTEGRAÇÃO SISTEMAS
════════════════════════════════════════════════════════════════════
[████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 10% COMPLETO

❌ Atividades Step One não aparecem no Painel
🔴 Painel de Tarefas com erro "permission denied"
⚠️  SERVICE_ROLE_KEY é placeholder
```

```
FUNCIONALIDADES AVANÇADAS
════════════════════════════════════════════════════════════════════
[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% COMPLETO

❌ Portal do Franqueado
❌ Vínculos entre cards
❌ Seção Dúvidas
❌ Múltiplos times/responsáveis
❌ Editar atividades
❌ Instruções e Materiais
❌ Progress tracker
❌ Notificações e-mail
```

---

## 🗺️ ARQUITETURA ATUAL DO SISTEMA

```
┌─────────────────────────────────────────────────────────────────┐
│                      NAVEGAÇÃO MONÍ                             │
│  ┌────────────┬────────────┬─────────────┬───────────────────┐  │
│  │  Funil     │ Portfolio  │Contabilidade│    Crédito       │  │
│  │ Step One   │ Operações  │             │                  │  │
│  │   ✅ NOVO  │  ⚠️ ANTIGO │  ⚠️ ANTIGO  │    ⚠️ ANTIGO     │  │
│  └────────────┴────────────┴─────────────┴───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐  ┌──────────────┐  ┌──────┐  ┌──────┐
│ KANBAN      │  │ KANBAN       │  │ ... │  │ ...  │
│ Step One    │  │ Portfolio    │  └──────┘  └──────┘
│             │  │              │
│ kanban_     │  │ processo_    │
│ cards       │  │ cards        │
│             │  │              │
│ kanban_     │  │ processo_    │
│ atividades  │  │ card_        │
│    │        │  │ checklist    │
│    │        │  │     │        │
└────┼────────┘  └─────┼────────┘
     │                 │
     │                 │
     └────────┬────────┘
              ▼
     ┌─────────────────────┐
     │  PAINEL DE TAREFAS  │  🔴 PROBLEMA AQUI!
     │                     │
     │  ❌ Só mostra       │  Causa: SERVICE_ROLE_KEY
     │     atividades do   │        inválida
     │     Portfolio       │
     │                     │
     │  ❌ NÃO mostra      │  Solução: VIEW SQL
     │     atividades do   │           ou
     │     Step One        │           Query Union
     └─────────────────────┘
```

---

## 🔄 FLUXO ATUAL vs FLUXO DESEJADO

### FLUXO ATUAL (QUEBRADO):

```
1. Usuário abre Painel de Tarefas
   └─> TarefasPainelConteudo.tsx
       └─> card-actions.ts: getAtividadesChecklistPainel()
           └─> admin.ts: createAdminClient()
               └─> FALHA! (key inválida)
                   └─> Fallback para cliente normal
                       └─> RLS bloqueia acesso
                           └─> ❌ ERRO: "permission denied"
```

### FLUXO DESEJADO (APÓS CORREÇÃO):

```
1. Usuário abre Painel de Tarefas
   └─> TarefasPainelConteudo.tsx
       └─> card-actions.ts: getAtividadesChecklistPainel()
           └─> admin.ts: createAdminClient()
               └─> ✅ SUCESSO! (key válida)
                   └─> Query em v_atividades_todas (VIEW)
                       └─> ✅ Retorna atividades de:
                           ├─> kanban_atividades (Step One)
                           └─> processo_card_checklist (Portfolio)
```

---

## 🗄️ ESTRUTURA DO BANCO DE DADOS

### SISTEMA NOVO (Step One):

```
┌─────────────────┐
│    kanbans      │
│  id, nome       │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼────────┐
│  kanban_fases   │
│  id, nome, sla  │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼────────┐
│  kanban_cards   │
│  id, titulo     │
│  franqueado_id  │
│  fase_id        │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼─────────────┐
│  kanban_atividades   │
│  id, texto           │
│  time, responsavel   │
│  status, prazo       │
└──────────────────────┘
```

### SISTEMA ANTIGO (Portfolio):

```
┌──────────────────────┐
│  processo_cards      │
│  id, titulo          │
└──────────┬───────────┘
           │ 1
           │
           │ N
┌──────────▼─────────────────┐
│ processo_card_checklist    │  🔴 PROBLEMA!
│ id, texto                  │  RLS bloqueando
│ times[], responsaveis[]    │
│ status, prazo              │
└────────────────────────────┘
```

### SOLUÇÃO: VIEW QUE UNE OS DOIS

```
┌─────────────────────────────────────┐
│      v_atividades_todas (VIEW)      │
│  ═════════════════════════════════  │
│                                     │
│  SELECT * FROM kanban_atividades    │
│       UNION ALL                     │
│  SELECT * FROM processo_card_...    │
│                                     │
└─────────────────────────────────────┘
           │
           │ (TarefasPainelConteudo.tsx faz query aqui)
           ▼
    ✅ MOSTRA TUDO!
```

---

## 📅 CRONOGRAMA PARA 22/04

```
HOJE (15/04) ─────────────────────────► 22/04 (Ingrid entra)
│                                              │
├─ DIA 1-2 (16-17/04) ────────────────────────┤
│  🔴 URGENTE                                  │
│  ✅ Corrigir SERVICE_ROLE_KEY                │
│  ✅ Verificar migrações                      │
│  ✅ Testar Painel de Tarefas                 │
│                                              │
├─ DIA 3-4 (18-21/04) ────────────────────────┤
│  🟡 IMPORTANTE                               │
│  ✅ Criar VIEW SQL integração                │
│  ✅ Auto-criar cards (Trigger)               │
│  ✅ Testar fluxo completo                    │
│                                              │
├─ DIA 5-6 (22-23/04) ────────────────────────┤
│  🟢 DESEJÁVEL                                │
│  ✅ Filtro por franquias                     │
│  ✅ Arquivamento com motivo                  │
│  ✅ UX polish                                │
│                                              │
└─ DIA 7 (24/04) ─────────────────────────────┘
   📚 DOCUMENTAÇÃO
   ✅ Guia para Ingrid
   ✅ Vídeo walkthrough
   ✅ Teste final
```

---

## 🎯 CHECKLIST PRÉ-22/04

### 🔴 BLOQUEANTES (tem que funcionar):

- [ ] Painel de Tarefas sem erro "permission denied"
- [ ] Atividades do Step One aparecem no Painel
- [ ] Cards podem ser criados no Step One
- [ ] SLA calculando corretamente em dias úteis
- [ ] Modal abre e fecha sem problemas

### 🟡 IMPORTANTES (team needs):

- [ ] Auto-criar card ao cadastrar Frank
- [ ] Filtrar por franquia específica
- [ ] Arquivar card com motivo
- [ ] Editar atividades existentes

### 🟢 DESEJÁVEIS (nice to have):

- [ ] Progress tracker visual
- [ ] Toast notifications
- [ ] Breadcrumbs
- [ ] Empty states amigáveis

---

## 📊 COMPARAÇÃO: ANTES vs DEPOIS

### ANTES (sistema antigo):

```
❌ Apenas Portfolio + Operações
❌ Step One dentro de Portfolio
❌ SLA em dias corridos (inclui fim de semana)
❌ Card abre em nova página (navega)
❌ Design inconsistente
❌ Cores com muito azul escuro
❌ Sem sistema centralizado de tokens
```

### DEPOIS (sistema novo):

```
✅ Funil Step One separado
✅ Step One antes de Portfolio no menu
✅ SLA em dias úteis (exclui fim de semana + feriados)
✅ Card abre como modal (overlay)
✅ Design consistente duas colunas
✅ Cores Moní (verde, marrom, dourado)
✅ moni-tokens.css centralizado
```

---

## 🎨 DESIGN SYSTEM MONÍ

```
┌────────────────────────────────────────────┐
│         PALETA MONÍ (moni-tokens.css)      │
├────────────────────────────────────────────┤
│                                            │
│  🟢 VERDE NAVAL #0c2633                    │
│     Textos principais, títulos            │
│                                            │
│  🟢 VERDE MÉDIO #2f4a3a                    │
│     Headers, acentos, botões              │
│                                            │
│  🟤 MARROM TERRA #4a3929                   │
│     Textos secundários                    │
│                                            │
│  🟡 DOURADO #d4ad68                        │
│     Badges, destaques, SLA "Atenção"      │
│                                            │
│  ⚪ OFF-WHITE #f9f7f4                      │
│     Fundos suaves, coluna esquerda        │
│                                            │
│  ⚪ BRANCO #ffffff                          │
│     Fundos principais, cards              │
│                                            │
│  ❌ LARANJA — PROIBIDO                     │
│  ❌ AZUL ESCURO em fundos — PROIBIDO       │
│                                            │
└────────────────────────────────────────────┘
```

---

## 🔒 MATRIZ DE PERMISSÕES

```
┌───────────────┬──────┬──────┬────────────┬───────────┐
│ RECURSO       │ ADMIN│ USER │ FRANQUEADO │ VISITANTE │
├───────────────┼──────┼──────┼────────────┼───────────┤
│ Ver todos     │  ✅  │  ✅  │    ❌      │    ❌     │
│ cards         │      │      │            │           │
├───────────────┼──────┼──────┼────────────┼───────────┤
│ Ver seus      │  ✅  │  ✅  │    ✅      │    ❌     │
│ cards         │      │      │            │           │
├───────────────┼──────┼──────┼────────────┼───────────┤
│ Criar card    │  ✅  │  ✅  │    ❌      │    ❌     │
├───────────────┼──────┼──────┼────────────┼───────────┤
│ Editar card   │  ✅  │  ✅  │    ⚠️      │    ❌     │
│               │      │      │  (campos   │           │
│               │      │      │   limit)   │           │
├───────────────┼──────┼──────┼────────────┼───────────┤
│ Arquivar card │  ✅  │  ✅  │    ❌      │    ❌     │
├───────────────┼──────┼──────┼────────────┼───────────┤
│ Criar         │  ✅  │  ✅  │    ✅      │    ❌     │
│ atividade     │      │      │ (só dúvida)│           │
├───────────────┼──────┼──────┼────────────┼───────────┤
│ Ver Painel    │  ✅  │  ✅  │    ❌      │    ❌     │
│ global        │      │      │            │           │
├───────────────┼──────┼──────┼────────────┼───────────┤
│ Configurar    │  ✅  │  ❌  │    ❌      │    ❌     │
│ SLA           │      │      │            │           │
└───────────────┴──────┴──────┴────────────┴───────────┘
```

---

## 🧩 MÓDULOS DO SISTEMA

```
┌──────────────────────────────────────────────────────┐
│                    MONI-FLY                          │
│                 (Hub Fly Portal)                     │
└──────────────────┬───────────────────────────────────┘
                   │
      ┌────────────┼────────────┐
      │            │            │
      ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ KANBANS  │ │ SISTEMAS │ │  ADMIN   │
│          │ │          │ │          │
│ • Step 1 │ │ • Sirene │ │ • Painel │
│ • Portf. │ │ • Juríd. │ │ • Config │
│ • Contab.│ │ • Docs   │ │ • Users  │
│ • Créd.  │ │          │ │          │
└────┬─────┘ └──────────┘ └──────────┘
     │
     └─────────┬─────────────┐
               │             │
               ▼             ▼
        ┌────────────┐ ┌────────────┐
        │  PAINEL    │ │  ATIVID.   │
        │  TAREFAS   │ │  CARDS     │
        │            │ │            │
        │ 🔴 ERRO    │ │ ✅ OK      │
        │  atual     │ │ (Step 1)   │
        └────────────┘ └────────────┘
```

---

## 📈 MÉTRICAS DE SUCESSO

### Para considerar "pronto para 22/04":

```
┌─────────────────────────────────────────┐
│  MÉTRICA                    │  META     │
├─────────────────────────────┼───────────┤
│  Painel sem erros           │   100%    │
│  Atividades visíveis        │   100%    │
│  Cards auto-criados         │   100%    │
│  Filtros funcionando        │   100%    │
│  SLA correto                │   100%    │
│  Modal responsivo           │   100%    │
│  Documentação completa      │   100%    │
│  Testes manuais OK          │   100%    │
└─────────────────────────────┴───────────┘
```

---

## 🚨 RISCOS E MITIGAÇÕES

```
┌────────────────────────────────────────────────────────┐
│ RISCO                        │ PROB │ IMPACTO │ AÇÃO   │
├──────────────────────────────┼──────┼─────────┼────────┤
│ Migrações não rodadas no DEV │ 🔴   │ ALTO    │ Rodar  │
│                              │ Alta │         │ manual │
├──────────────────────────────┼──────┼─────────┼────────┤
│ SERVICE_ROLE_KEY incorreta   │ 🔴   │ ALTO    │ Copiar │
│                              │ Alta │         │ correta│
├──────────────────────────────┼──────┼─────────┼────────┤
│ VIEW SQL quebrar sistema     │ 🟡   │ MÉDIO   │ Testar │
│ antigo                       │ Méd. │         │ em dev │
├──────────────────────────────┼──────┼─────────┼────────┤
│ Cache do navegador           │ 🟢   │ BAIXO   │ Hard   │
│ interferindo                 │ Baixa│         │ reload │
├──────────────────────────────┼──────┼─────────┼────────┤
│ Ingrid não entender sistema  │ 🟢   │ BAIXO   │ Doc +  │
│                              │ Baixa│         │ vídeo  │
└──────────────────────────────┴──────┴─────────┴────────┘
```

---

## 🎓 RECURSOS DE APRENDIZADO

### Para Ingrid (novo membro):

```
1. DOCUMENTAÇÃO ESCRITA
   ├─ STATUS_COMPLETO_PROJETO.md (este arquivo)
   ├─ GUIA_COMPLETO_VIABILIDADE.md (guia não-dev)
   └─ MAPEAMENTO_COMPLETO_PROJETO.md (detalhes técnicos)

2. GUIAS VISUAIS
   ├─ DIAGRAMA_VISUAL_STATUS.md (este arquivo)
   └─ Prints do sistema funcionando

3. TUTORIAIS PRÁTICOS
   ├─ Como criar um card
   ├─ Como adicionar atividade
   ├─ Como usar filtros
   ├─ Como arquivar com motivo
   └─ Como ver SLA

4. SOLUÇÃO DE PROBLEMAS
   ├─ GUIA_DEBUG_CARDS.md
   ├─ RESOLVER_SERVICE_ROLE_KEY.md
   └─ FORCAR_ATUALIZACAO_VISUAL.md
```

---

## 🔄 CICLO DE VIDA DO CARD

```
1. CRIAÇÃO
   ┌─────────────────────┐
   │  Frank cadastrado   │
   │  em Rede Frank      │
   └──────────┬──────────┘
              │ (Trigger automático)
              ▼
   ┌─────────────────────┐
   │  Card criado na     │
   │  1ª fase Step One   │
   │  "Dados da Cidade"  │
   └──────────┬──────────┘
              │
              ▼
2. TRABALHO
   ┌─────────────────────┐
   │  Time preenche      │
   │  checklist, anexos  │
   │  comentários        │
   └──────────┬──────────┘
              │
              ▼
3. ATIVIDADES
   ┌─────────────────────┐
   │  Cria atividades    │
   │  para outros times  │
   │  (Obras, Jurídico)  │
   └──────────┬──────────┘
              │
              ▼
4. AVANÇO
   ┌─────────────────────┐
   │  Botão "Avançar     │
   │  para próxima fase" │
   └──────────┬──────────┘
              │
              ▼
   ┌─────────────────────┐
   │  Card vai para      │
   │  "Lista Condomínios"│
   └──────────┬──────────┘
              │
              ▼
5. REPEAT (fases 2-7)
              │
              ▼
6. CONCLUSÃO OU ARQUIVO
   ┌─────────────────────┐
   │  Fase 7 concluída   │
   │  Card vai para      │
   │  Portfolio+Oper.    │
   └─────────────────────┘
              OU
   ┌─────────────────────┐
   │  Arquivado com      │
   │  motivo registrado  │
   └─────────────────────┘
```

---

**FIM DO DIAGRAMA VISUAL**

**Próximos passos**: Ver `STATUS_COMPLETO_PROJETO.md` para detalhes técnicos
