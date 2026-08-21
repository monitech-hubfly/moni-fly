# Checklist de validação — Dashboard de Análise do Funil/Kanban

Painel: aba **Painel** (`?tab=painel`) · componentes `PainelPerformance` → `PainelPerformanceDashboard` · compute `computePainelPerformance`.

**Pré-requisitos**

- Migration `387_kanban_fase_conversao.sql` aplicada no ambiente DEV.
- Usuário staff (admin/consultor) para ver todos os cards.
- Pelo menos um funil com cards ativos e, idealmente, chamados vinculados.

**Como marcar:** ☐ = pendente · ✅ = ok · ❌ = falha (anotar funil + print)

---

## 1. Carregamento em todos os funis nativos

Abrir cada rota com `?tab=painel`. Esperado: título **Painel do Funil**, 5 seções (Operação, Conversão, Gargalos, Chamados, Insights), sem erro 500/blank screen.

| Rota | ☐ |
|------|---|
| `/funil-stepone?tab=painel` | |
| `/portfolio?tab=painel` | |
| `/operacoes?tab=painel` | |
| `/funil-acoplamento?tab=painel` | |
| `/loteadores?tab=painel` | |
| `/funil-juridico?tab=painel` | |
| `/funil-moni-capital?tab=painel` | |
| `/funil-contratacoes?tab=painel` | |
| `/funil-projeto-legal?tab=painel` | |
| `/funil-produto?tab=painel` | |
| `/funil-modelo-virtual?tab=painel` | |
| `/funil-homologacoes?tab=painel` | |
| `/projetos-locais?tab=painel` | |
| `/projetos-legais?tab=painel` | |
| `/funil-credito-obra?tab=painel` (se kanban nativo cadastrado) | |
| `/painel-contabilidade?tab=painel` (se kanban nativo cadastrado) | |

**Degradação esperada:** funil sem cards → KPIs zerados e mensagens “Sem dados” / “Sem entradas no período”, não crash.

---

## 2. Fase de conversão lida corretamente

1. Em `/admin/fases-conversao`, marcar uma fase como conversão no funil de teste (ex.: Portfólio).
2. Recarregar `?tab=painel` desse funil.

**Esperado:**

- Tag(s) **Conversão: {nome da fase}** na seção 2.
- Se nenhuma fase marcada: aviso discreto **“Fase de conversão não configurada”** (não quebra a tela).
- Campo vem de `kanban_fases.fase_conversao` (carregado em `PainelPerformance` → `mapFases`).

---

## 3. Cards convertidos (chegaram ou passaram da fase de conversão)

**Regra implementada** (`cardAlcancouConversao` em `painel-performance-compute.ts`):

- Card **na** fase de conversão → convertido.
- Card **visitou** a fase (histórico) → convertido.
- Card com ordem máxima alcançada **> ordem** da fase de conversão → convertido.

**Teste manual (coorte = cards criados no período):**

1. Período **Tudo** ou **30 dias**.
2. Escolher 3–5 cards da coorte:
   - A) parado **antes** da conversão → **não** conta em Conversões.
   - B) **na** fase de conversão → conta.
   - C) **após** a fase de conversão → conta.
3. Conferir KPI **Conversões** e tabela **Conversão por fase**.

---

## 4. Taxa de conversão bate com contagem manual

```
Taxa = (Convertidos da coorte / Entradas da coorte) × 100
```

1. Anotar **Entradas** (cards criados no período).
2. Contar convertidos (critério do item 3).
3. Calcular taxa e comparar com KPI **Taxa** (tolerância: arredondamento 0,1 p.p.).

**SQL auxiliar (DEV)** — ajustar `kanban_id` e datas:

```sql
SELECT id, titulo, created_at, fase_id
FROM kanban_cards
WHERE kanban_id = '<UUID_DO_FUNIL>'
  AND created_at >= now() - interval '30 days'
ORDER BY created_at DESC;
```

---

## 4.1 Cards arquivados na análise

**Regras** (`cardInAnalysisPeriod` em `painel-performance-compute.ts`):

- Cards **ativos/concluídos** no recorte: criação ou conclusão no período.
- Cards **arquivados** no recorte: também entram se foram **movimentados** ou **arquivados** no período (mesmo criados antes).
- Arquivado **antes** da fase de conversão → perda do funil (`arquivamento.antesConversao`).
- Arquivado **depois** da conversão → convertido e depois arquivado (`arquivamento.depoisConversao`).

**Esperado na UI (seção 1 — Operação):**

| Elemento | Conferência |
|----------|-------------|
| Tabela **Cards por fase** | Colunas **Ativos** e **Arquivados** separadas |
| Painel **Arquivamento no período** | KPIs: total, antes/depois conversão, taxa |
| Tabelas por fase / responsável / unidade | Breakdown de arquivados |

**Teste manual:**

1. Arquivar card **antes** da conversão no período → incrementa **Antes da conversão**.
2. Mover card antigo e arquivar no período → entra no recorte mesmo sem criação recente.
3. Arquivar card **após** passar pela conversão → **Depois da conversão**.

**Taxa de arquivamento** = arquivados no recorte ÷ cards analisados no recorte.

### Motivos de arquivamento

**Fonte de dados** (`painel-motivo-arquivamento.ts`):

- Campo principal: `kanban_cards.motivo_arquivamento` (mesmo do modal de arquivamento).
- Fallback: detalhe do histórico `card_arquivado` (chaves `motivo`, `motivo_arquivamento`, etc.).
- Sem valor → **Sem motivo informado**.

**Esperado:**

| Elemento | Conferência |
|----------|-------------|
| **Motivos mais frequentes** | Ranking com total e split antes/depois conversão |
| **Impacto na perda** | Motivos ordenados por perdas antes da conversão |
| **Por fase / responsável / unidade** | Breakdown cruzado |
| Insight **Arquivamento** | Quando ≥20% sem motivo ou ≥3 cards |
| Aviso de sugestão | Texto sobre obrigatoriedade futura no modal |

### Bloco Perdas e Arquivamentos

Seção dedicada (`id="perdas-arquivamentos"`) entre Operação e Conversão.

**KPIs:** total arquivados, % do período, antes/depois conversão, principal fase, principal motivo, % sem motivo.

**Tabela por fase:** Fase | Arquivados | % do total | Principal motivo | Antes/depois conv.

**Impacto na conversão:** linha com % das entradas da coorte arquivadas antes da conversão.

---

## 5. Conversão entre fases vs histórico

1. Seção **Transições adjacentes**: para cada par A → B, **Destino ≤ Origem** (cards não “criam” passagem).
2. **Passagem %** = Destino / Origem quando Origem > 0.
3. Para 2–3 cards conhecidos, conferir em `kanban_historico` (`acao` = `fase_avancada` / `fase_retrocedida` / `card_criado`) se as fases batem.

**Esperado:** números coerentes com movimentos registrados; funil legado pode usar posição atual quando histórico falta.

---

## 6. Histórico parcial

**Quando aparece:** badge **“histórico parcial”** no funil visual (`ConversionFunnelTree`) e texto abaixo da tabela de tempo quando `funnelTree.historicoParcial === true`.

**Como provocar:** funil com cards antigos **sem** movimentos em `kanban_historico` (só posição atual).

**Esperado:**

- Badge visível, não erro.
- Texto: *“Tempos parciais: histórico incompleto…”*
- Modo legado: banner **“Modo legado: histórico de fases limitado…”**

---

## 7. GargaloScore por fase

Seção **3. Gargalos** → tabela **Detalhe** e **Ranking**.

**Esperado:** uma linha por fase do funil; colunas Score, Cards, Atraso, Arq., Antes conv., Cham., Trava; classificação Baixo / Atenção / Crítico.

**Fórmula (pesos):**

```
Score = volume×15 + atraso×20 + inatividade×15 + perda_conversão×20 + chamados×15 + arquivamento×15
```

(todos normalizados 0–100 entre fases, exceto atraso/inatividade/perda que já são %)

**Arquivamento no score:** cards arquivados na fase, arquivamentos antes da conversão e sem motivo informado.

**Principal motivo:** tag + frase narrativa (ex.: concentra X% dos arquivamentos antes da conversão e Y% dos chamados com trava).

---

## 8. Fases críticas no topo do ranking

GargaloScore considera: volume parado, % atrasados, inatividade, perda de conversão, chamados abertos e arquivamento (normalizados 0–100).

**Teste:**

1. Identificar fase com mais cards atrasados (SLA) ou chamados com trava.
2. Verificar se aparece no **topo** do Ranking (score maior).
3. KPI **Fases críticas** = count com classificação **Crítico** (score ≥ 70).

---

## 9. Chamados vinculados ao card no bloco Chamados

1. Abrir card no Kanban com chamado aberto (`kanban_atividades` ou `sirene_chamados.card_id`).
2. No painel, seção **4. Chamados** → tabelas **Por fase** / **Prioritários**.

**Esperado:** chamado listado na fase atual do card; link de edição aponta para Sirene (`/sirene/chamados?...`), não edição inline no painel.

---

## 10. Chamados sem vínculo não contaminam o funil

`fetchPainelChamados` só busca por `card_id IN (cards do funil)`.

**Teste:**

1. Criar chamado Sirene **sem** `card_id` do funil (ou de outro funil).
2. Recarregar painel.

**Esperado:** KPIs de chamados **não** incluem esse registro; totais batem só com cards do funil atual.

---

## 11. Pastelaria — indicador only

Chamado com vínculo em `sirene_pastelaria_vinculos` → `emPastelaria: true`.

**Esperado:**

- Pode influenciar ordenação em **Prioritários** (peso no rank).
- **Sem** botão/ação de editar Pastelaria no painel.
- Edição continua via card modal ou Sirene.

---

## 12. Insights só com base suficiente

Seção **5. Insights** — até 5 frases automáticas.

| Cenário | Esperado |
|---------|----------|
| Coorte vazia no período | Uma mensagem: *“Poucos dados no recorte…”* |
| Dados mínimos (ex.: ≥4 atrasos concentrados, ≥3 arquivados no período) | Insights tipados (Atrasos, Conversão, Chamados, **Arquivamento**, etc.) |
| Arquivamento | Perda antes da conversão, concentração por fase/unidade, motivo frequente, sem motivo, tempo médio, pós-conversão — só com base mínima |
| Base insuficiente para regras | *“Dados insuficientes para insights acionáveis.”* |

---

## 13. Filtros alteram todos os blocos

Aplicar cada filtro e verificar se **Operação, Conversão, Gargalos, Chamados e Insights** recalculam (contador “N cards no recorte” muda).

| Filtro | Teste | Esperado |
|--------|-------|----------|
| Período 7d / 30d / 90d / Tudo | Alternar | Entradas e coorte mudam |
| Franquia / Unidade | Uma unidade | Só cards dessa rede |
| Responsável | Um responsável | Métricas filtradas |
| Fase | Uma fase | Recorte coerente |
| Status Ativos | Ativos | Arquivados saem da operação; aviso discreto; **Conversão e Perdas** mantêm arquivados do recorte |
| Status Arquivados | Arquivados | Só arquivados |
| Arquivamento | Antes / Depois conversão | Só arquivados na condição; não-arquivados ocultos se filtro ativo |
| Motivo / Com-Sem motivo / Fase arquivamento | Variar | Recorte coerente com bloco Perdas e Arquivamentos |
| Chamados Com/Sem | Com abertos | Só cards com chamado aberto |
| Trava Com/Sem | Com trava | Só cards com chamado trava |
| Limpar filtros | Botão | Volta ao estado inicial |

---

## 14. Card, fase real e painel alinhados

Para 3 cards amostra:

1. Anotar **fase atual** no Kanban (coluna).
2. No painel **Operação → Cards por fase**, conferir mesma fase e contagem.
3. Abrir card pelo link em **Retrocessos** ou **Prioritários** → modal abre na aba Kanban com card correto.

**Esperado:** `kanban_cards.fase_id` = fase exibida; responsável da fase bate com filtro Responsável.

---

## 15. Aba Kanban continua normal

Em cada funil testado:

1. Clicar aba **Kanban** (URL sem `tab=painel`).
2. Abrir modal de card, mover fase (se permitido), criar chamado.

**Esperado:** board, DnD e modal intactos; alternar Kanban ↔ Painel sem perder sessão.

---

## Regressão técnica (CI local)

Rodar antes de merge:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

| Comando | Resultado | Data | Responsável |
|---------|-----------|------|-------------|
| `npm run lint` | | | |
| `npx tsc --noEmit` | | | |
| `npm run build` | | | |

---

## Sign-off

| Papel | Nome | Data | Observações |
|-------|------|------|-------------|
| QA / Produto | | | |
| Dev | | | |
