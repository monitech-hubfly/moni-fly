# Briefing — Simulador de Pagamentos (Helena + corretor)

**Para:** Ingrid  
**De:** Fernanda  
**Data:** 14 de setembro de 2026  
**Objetivo:** contexto completo do que já existe no Hub Fly para você criar a **página do customizador de casas**, alimentando o valor da casa (e, no futuro, a customização) no simulador.

**Ainda não existe:** tela do customizador. Hoje `valor_casa` e `valor_customizacao` são digitados à mão.

**Ambiente:** implementação no DEV (`bgaadvfucnrkpimaszjv`). Não aplicar em PROD sem alinhamento.

---

## 1. O que é este produto (e o que não é)

Há **dois blocos no card** do Funil Loteadores, que as pessoas misturam:

| Bloco | Para quê | Quem usa |
|---|---|---|
| **Modelo e Simulações IMOB** | Dados comerciais do empreendimento (modelo, metragem, imagens, status). Depois da oferta da Helena, mostra à vista / entrada / mensais / parcela única **somente leitura**. | Time interno no card |
| **Simulador de Pagamentos (Helena)** | Motor financeiro: percentuais do loteamento → ofertas por cliente → QR para o corretor. | Helena (admin/team) + corretor (público, sem login) |

O customizador **não substitui** o simulador. Ele deve **entregar números** (`valor_casa`, depois `valor_customizacao`) para o corretor (e, se fizer sentido, para a calculadora da Helena).

Não confundir com a Calculadora BCA (`/calculadora/[token]/leitura`) nem com o Motor 01.

**Escopo deste trabalho:** Funil Loteadores (`/loteadores`), accordion Modelo e Simulações IMOB, template da Helena, ofertas internas, página pública do corretor (`/simulador/[token]`).

---

## 2. Jornada completa (como está hoje)

```
Card Funil Loteadores
  └─ Accordion “Modelo e Simulações IMOB”
        ├─ Status do loteamento + imagem principal (imob_card_modelo)
        ├─ Botão Criar Template / Ver Template
        ├─ N empreendimentos (e opcionalmente showroom)
        │     ├─ produto/modelo, título da oferta, quartos, links, imagem…
        │     └─ botão Criar Oferta  →  só depois do template salvo
        └─ (outro accordion) Lista de Lotes / planilha

1) Helena salva o TEMPLATE  →  gera link + QR
   /loteadores/[cardId]/simulador-template

2) Helena cria UMA OFERTA por empreendimento
   /loteadores/[cardId]/simulador-template/ofertas?empreendimento=[uuid]
   Ao salvar, grava em simulacoes_pagamento e espelha no card IMOB:
     valor_avista, entrada, parcelas_mensais, parcela_unica, simulacao_pagamento_id

3) Corretor abre o QR (sem login)
   /simulador/[link_token]
   Escolhe lote, informa casa/customização (hoje: digitado), calcula, personaliza, salva, baixa PDF
```

### Regras de botão no card

- Sem template → **Criar Template** (navy). Com template → **Ver Template**. Os dois abrem a mesma rota do template.
- **Criar Oferta** só aparece se o template já existe. Senão: *“Crie o template do loteador acima antes de gerar a oferta.”*
- Depois de vincular: **Ver detalhes da oferta** + campos financeiros em leitura.
- Showroom **não** cria oferta Helena.
- Não há mais “Criar oferta” na página do template. Oferta nasce **só do card**, por empreendimento.

---

## 3. Atores e permissões

| Quem | Acesso |
|---|---|
| **admin / team** (Helena) | Template, ofertas, card IMOB, planilha |
| **Corretor / lead** | Só `/simulador/[token]` — **sem login**, via RPC `SECURITY DEFINER` |
| **anon** | Lê planilha no Storage só em paths `*/imob/planilha-lotes/*` (bucket `processo-docs`) |

A página pública está na access matrix (`isSimuladorPublicoPath`) — não exige sessão.

---

## 4. Rotas

| Rota | Auth | Função |
|---|---|---|
| `/loteadores?card={id}` | logado | Kanban + modal do card |
| `/loteadores/[cardId]/simulador-template` | admin/team | Form do template + QR |
| `/loteadores/[cardId]/simulador-template/ofertas` | admin/team | Lista das ofertas do card |
| `/loteadores/[cardId]/simulador-template/ofertas?empreendimento={uuid}` | admin/team | Calculadora da Helena **vinculada** àquele empreendimento |
| `/loteadores/[cardId]/simulador-template/ofertas/[ofertaId]` | admin/team | Detalhe leitura + impressão |
| `/simulador/[token]` | **público** | Página do corretor |
| `/simulador/[token]/pdf-route` | público | PDF da proposta |

Deep link de volta ao card: `/loteadores?card={id}`.

---

## 5. Modelo de dados (o que o customizador precisa encaixar)

### 5.1 Template — `loteamento_simulador_templates`

**1 por card** (índice único em `kanban_card_id`).

Parâmetros do loteamento, **não** do cliente:

- Percentuais (fração no banco, % na UI): ITBI, impostos, taxa plataforma, taxa gestão, lucros (loteadora / Moní / franqueado), comissão do corretor
- `prazo_obra_meses` (default 7, mínimo 3)
- `entrada_minima_loteadora` JSON `{ tipo: "percentual" | "valor_fixo", valor }`
- `taxa_juros_parcelado_mes` (sem default)
- `taxa_juros_credito_ponte` (default 2,5% a.m.)
- `taxa_juros_financiamento_anual` (default 10% a.a.)
- `link_token` — URL pública `/simulador/{token}`
- `nome` — se vazio, usa o título do card

**Não** guarda valor de casa, lote do cliente nem customização.

Padrões de UI (Helena): ITBI 3%, impostos 4,4%, plataforma 8%, gestão 7%, comissão 5%, crédito-ponte 2,5%, financiamento 10%. Lucros sem default.

### 5.2 Oferta — `simulacoes_pagamento`

**N por template.** Cada linha = uma simulação de um cliente.

Campos que o **customizador precisa preencher no futuro**:

| Coluna | Hoje | Esperado com o customizador |
|---|---|---|
| `valor_casa` | digitado na calculadora / no corretor | **saída da tela da Ingrid** (preço da casa configurada) |
| `valor_customizacao` | digitado, default 0 | **no futuro:** acoplamento + upgrades da customização |

Outros campos da oferta:

- `nome` (Helena: livre; corretor: `"{cliente} — {codigo do lote}"`)
- `valor_lote`, `valor_ja_pago`, `prazo_meses` (**Fase 1**, sem obra), `parcela_mensal`, `renda_cliente`
- `prazo_financiamento_anos`, `taxa_financiamento_anual`
- cliente: `cliente_nome`, `cliente_telefone`, `cliente_email`
- lote: `lote_id` (FK `lotes_template`) **ou** `lote_valor_manual` se já adquirido
- confirmados: `entrada_confirmada`, `parcela_mensal_confirmada`, `parcela_unica_confirmada`
- `personalizada` = true se o corretor salvou pelo bloco Personalizar
- `inputs` / `resultado` / `alertas` JSON (snapshot do cálculo)
- `status`: `rascunho` \| `salva` \| `pdf_gerado`
- `created_by`: profile se logado; **null** no QR

Na UI do corretor, **prazo total = prazo_meses (fase 1) + prazo_obra**. O banco guarda só a fase 1 em `prazo_meses`.

### 5.3 Vínculo oferta ↔ empreendimento IMOB — `imob_card_empreendimentos`

Uma oferta Helena por empreendimento (índice único parcial em `simulacao_pagamento_id`).

Ao salvar a oferta da Helena:

- `simulacao_pagamento_id`
- `valor_avista` ← `vte_avista`
- `entrada` ← confirmada ?? sugerida
- `parcelas_mensais` ← confirmada ?? sugerida
- `parcela_unica` ← confirmada ?? sugerida

Showroom (`tipo = 'showroom'`) não entra nesse fluxo.

Campos comerciais do empreendimento (flyer): `produto_modelo`, `titulo_oferta`, ano, quartos, banheiros, vagas, `area_vendas_m2`, `link_modelo`, `descricao`, `link_imagens_planta`, imagem da oferta.

**Pista para o customizador:** `produto_modelo` + `link_modelo` já existem no empreendimento. A casa “oficial” daquele empreendimento provavelmente nasce daí; o corretor ainda precisa poder customizar **por cliente**.

### 5.4 Lotes

**A) Cadastro no template** — `lotes_template`  
`codigo`, `valor`, `disponivel`, `area_m2`. Fallback se não houver planilha.

**B) Planilha no card** — `imob_card_modelo.planilha_lotes_*`  
Upload CSV/XLSX no card, Storage `processo-docs`: `{cardId}/imob/planilha-lotes/...`  
**Parse só no simulador público.** Prioridade: planilha > `lotes_template`.

Parse (`src/lib/simulador/parse-planilha-lotes.ts`):

- Colunas: código do lote + valor
- **Última coluna = Valor de Acoplamento** — lida para não contaminar o preço do lote
- **Não usar agora** em `valor_casa` nem `valor_customizacao`
- Comentário no código: no futuro o acoplamento **compõe a customização** quando a tela da Ingrid alimentar o corretor

Se o lote veio da planilha, no save do corretor: `lote_id` nulo + `lote_valor_manual` (IDs `planilha:i:codigo` não existem em `lotes_template`).

---

## 6. Motor (`src/lib/simulador/calcular-oferta.ts`) — contrato numérico

Função pura, sem banco. **Mesmo motor** na Helena, no corretor e no PDF.

```
base_calc  = valor_lote + valor_casa + valor_customizacao
custo_obra = valor_casa + valor_customizacao
```

- ITBI: % × **lote**
- Plataforma, gestão, lucros: % × **base_calc**
- Comissão: % × VTP à vista (sem juros) — paga na **entrada**
- Impostos: % × VTP (com juros) — último mês de obra

**Entrada sugerida** = entrada mínima da loteadora (sobre o lote) − já pago + comissão.

**Parcela mensal sugerida** (se o usuário não informar):

- lote < R$ 300 mil → R$ 7 mil
- lote < R$ 800 mil → R$ 10 mil
- senão → R$ 15 mil

**Parcela única** = máximo entre:

1. mínimo para quitar o lote no fim da Fase 1
2. o que falta para chegar a **30% do VTE** antes da obra

Fase 2 (obra) e VTE são circulares; o código itera até 8 vezes.

**Valores confirmados** (Personalizar) **não** recalculam VTE/VTP do resumo — só o **fluxo de caixa**.

Curva de desembolso canônica 7 meses: `[2,21%  11,3%  22,33%  27,34%  14,24%  18,18%  4,4%]`. Prazo 3–6 comprime as primeiras etapas.

Alertas (não bloqueiam salvar): capacidade de pagamento, parcela mensal baixa, parcela única zero.

---

## 7. Página do template (Helena)

Arquivo: `src/app/loteadores/[id]/simulador-template/SimuladorTemplateForm.tsx`

Seções:

1. Nome do template
2. Percentuais do empreendimento
3. Prazo de obra
4. Premissas da loteadora (entrada mínima % ou R$ + juros parcelado a.m.)
5. Bloco **Link + QR** para corretores

Ao salvar: persiste o template, gera `link_token` se ainda não existir, atualiza o botão do card (Criar Template → Ver Template).

“Gerar novo link” invalida o QR antigo (pede confirmação).

---

## 8. Página de ofertas (Helena)

- Sem `?empreendimento=` → lista das ofertas do card
- Com `?empreendimento=` → calculadora já amarrada àquele UUID

Calculadora da Helena (ordem):

1. Nome da oferta
2. Valor do lote, valor da casa, customização, já pago, prazo, parcela mensal, renda, prazo/taxa financiamento
3. Calcular → cards VTE/VTP, cascata, entrada/mensal/única sugeridas, SAC
4. Bloco Salvar: pode confirmar entrada / mensal / única (avisos se abaixo do mínimo); gerar fluxo final; gravar rascunho

Ao gravar com `empreendimento_id`, chama `vincularOfertaAoEmpreendimentoImob`. Sem a migration **550** no banco, aparece aviso de coluna faltando.

Uma oferta por empreendimento (índice único). Recriar substitui o vínculo.

Detalhe `/ofertas/[ofertaId]`: leitura + impressão. Links de volta ao template e ao card. Rótulo: `Empreendimento: {produto} — {titulo_oferta}`.

---

## 9. Página do corretor (pública) — o que o customizador deve “plugar”

Arquivos:

- Página: `src/app/simulador/[id]/SimuladorClient.tsx`
- Carga: RPC `simulador_publico_carregar` + parse da planilha (`src/lib/simulador/carregar-simulador-publico.ts`)
- Save: `salvarOfertaCorretor` → RPC `simulador_publico_salvar` (`created_by` null, status `rascunho`)

### Fluxo de tela

1. **Dados do cliente** — nome (obrigatório), telefone, e-mail
2. **Lote** — dropdown dos lotes disponíveis **ou** “lote já adquirido” + valor manual
3. **Casa** — hoje: **campo numérico livre** `valor_casa` (obrigatório para calcular)
4. **Customização** — hoje: **campo numérico livre** `valor_customizacao` (opcional, default 0)
5. Já pago à loteadora, prazo total (meses, deve ser **> prazo de obra**), parcela mensal (pré-preenchida pela faixa do lote), renda, prazo/taxa financiamento
6. **Calcular** → resumo (VTE, entrada, mensal, única, SAC) + tabela de fluxo
7. **Personalizar** (opcional) — entrada / mensal / única confirmadas; hint de mínimo da única
8. **Salvar oferta sugerida** ou **salvar personalizada**
9. **Baixar PDF** (`proposta-moni-{ref}.pdf`)

O corretor **não vê** percentuais do template. Só o resultado.

### Onde o customizador entra (contrato sugerido)

Hoje o corretor **digita** casa e customização. A tela nova deve, no mínimo:

1. Produzir um **`valor_casa` (R$)** e, quando existir, um **`valor_customizacao` (R$)**.
2. Entregar esses números **antes** do botão Calcular (estado inicial ou via query/deep link).
3. Não recalcular o motor — só **preencher `OfertaConfig`**.

Gancho natural no código:

```ts
valor_casa: valorCasa,                      // ← customizador
valor_customizacao: valorCustomizacao ?? 0  // ← customizador + (futuro) acoplamento da planilha
```

Acoplamento da planilha: o parse já lê `valorAcoplamento`, **não envia à UI**. Combinado: somar em `valor_customizacao` **só depois** que o customizador existir.

`produto_modelo` do empreendimento IMOB é o modelo de catálogo; o customizador provavelmente parte desse modelo e gera o preço daquela configuração.

---

## 10. PDF da proposta

Arquivos: `PropostaPDF.tsx`, `proposta-pdf-data.ts`, rota `pdf-route`.

Inclui loteamento, lote, cliente, valores (lote / casa / customização), fluxo, entrada/mensal/única.

Pode ser gerado após salvar (GET com `simulacaoId`) ou POST com payload (fallback).

---

## 11. Accordion IMOB no card (contexto comercial)

Ordem aproximada no modal do Funil Loteadores:

- Dados do Condomínio
- Dados do Negócio
- **Modelo e Simulações IMOB** (template + empreendimentos + Criar Oferta)
- Lista de Lotes (planilha / cadastro)
- Simulador de Pagamentos (atalhos)
- Atas, Chamados, Vínculos, Checklist, Histórico

Status do loteamento (`imob_card_modelo.status_imovel`) é do **card**, não do empreendimento.

Storage de imagens IMOB: `{cardId}/imob/principal/...` e `{cardId}/imob/oferta/{empreendimentoId}/...` no bucket `processo-docs`.

---

## 12. Migrations (DEV — não aplicar em PROD sem revisão)

Arquivos em `supabase/migrations/`. Idempotentes.

| Nº | Arquivo | O quê |
|---|---|---|
| 540 | `imob_card_empreendimentos` | Tabela de empreendimentos (campos antigos de balão/financiamento) |
| 541 | `imob_card_modelo` | 1:1 card + oferta por empreendimento |
| 542 | `tipo` | `empreendimento` \| `showroom` |
| 543 | `entrada`, `parcelas_mensais` | Substitui balões na UI |
| 544 | template + `simulacoes_pagamento` | Base do simulador |
| 545 | `prazo_obra_meses`, `entrada_minima_loteadora` | Ajustes do template |
| 546 | `valor_casa`, `valor_customizacao`, etc. | **Colunas que o customizador vai gravar** |
| 547 | `parcela_mensal` | |
| 548 | `nome` da oferta | |
| 549 | `lotes_template` + RPCs públicas + campos do corretor | |
| 550 | `parcela_unica` + `simulacao_pagamento_id` no empreendimento | Arquivo no repo; aplicar no DEV se o aviso ainda aparecer |
| 551 | `lotes_template.area_m2` | |
| 552 | `planilha_lotes_*` em `imob_card_modelo` | |
| 553 | RPC lê path da planilha + policy Storage | |

---

## 13. Arquivos-chave (mapa para implementar o customizador)

| Área | Path |
|---|---|
| Motor | `src/lib/simulador/calcular-oferta.ts` |
| Tipos públicos | `src/app/simulador/[id]/types.ts` |
| Página corretor | `src/app/simulador/[id]/SimuladorClient.tsx` |
| Save público | `src/app/simulador/[id]/actions.ts` |
| Carga pública | `src/lib/simulador/carregar-simulador-publico.ts` |
| Parse planilha | `src/lib/simulador/parse-planilha-lotes.ts` |
| Template form | `src/app/loteadores/[id]/simulador-template/SimuladorTemplateForm.tsx` |
| Calculadora Helena | `src/components/simulador/CalculadoraOferta.tsx` |
| Lista/detalhe ofertas | `src/app/loteadores/[id]/simulador-template/ofertas/` |
| Actions template/oferta | `src/lib/actions/loteamento-simulador-template.ts` |
| Helpers + espelho IMOB | `src/lib/loteamento-simulador-template.ts` |
| Accordion IMOB | `src/components/kanban-shared/KanbanCardModalSimulacoesImob.tsx` |
| Vínculo oferta → card | `src/lib/actions/imob-simulacoes-card.ts` (`vincularOfertaAoEmpreendimentoImob`) |
| Design tokens | `styles/moni-tokens.css` (navy `#0C2633`, bordas 0,5px, sem laranja) |

---

## 14. O que o customizador **não** deve fazer

- Não reimplementar VTE/VTP/fluxo — reutilizar `calcularOferta`.
- Não gravar percentuais do loteamento — isso é o template.
- Não parsear a planilha de lotes para preço de casa. Lote = lote; acoplamento fica para customização **depois**.
- Não exigir login na página do corretor.
- Não escrever em PROD (`aydryzoxqnwnbybvgiug`) sem alinhamento.
- Não criar segunda tabela de “oferta IMOB” — a oferta canônica é `simulacoes_pagamento`.

---

## 15. Decisões em aberto (para fechar com produto)

1. **O customizador é público (corretor), interno (Helena), ou os dois?** Hoje só o corretor “precisa” do preço da casa na hora de simular; a Helena também digita `valor_casa` na oferta do empreendimento.
2. **1 configuração de casa por empreendimento** (preço oficial no flyer) **vs.** N configurações por cliente (cada oferta). O banco já permite N ofertas; o vínculo IMOB é 1:1 empreendimento ↔ uma oferta Helena.
3. **Como devolver o preço:** query string (`?valorCasa=&valorCustom=`), postMessage, ou tabela nova referenciada na oferta (`customizacao_id`). Ainda não há FK.
4. **Acoplamento da planilha:** somar em `valor_customizacao` automaticamente ou deixar o customizador decidir? O código reserva o campo e **não usa**.
5. **`produto_modelo` + `link_modelo` do IMOB** devem ser o ponto de partida do customizador?

---

## 16. Resumo em uma frase

Helena configura o **loteamento** (template + QR); no card cadastra **empreendimentos** e cria **uma oferta financeira** por empreendimento; o corretor, sem login, escolhe **lote** (planilha ou lista), informa **casa + customização** (hoje na mão) e gera proposta; o customizador deve **substituir essa digitação** entregando `valor_casa` (e depois `valor_customizacao`) para o mesmo motor.
