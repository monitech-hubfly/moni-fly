# Simulador de Pagamentos — contexto do projeto

**Atualizado:** 16 de outubro de 2026  
**Ambiente:** DEV (`bgaadvfucnrkpimaszjv.supabase.co`). Não aplicar em PROD sem alinhamento.  
**Não confundir com:** Calculadora BCA, Motor 01 (`/funil-motor01`), Crédito Obra.

Este documento descreve o estado **atual do código**, as duas superfícies que compartilham o mesmo engine e as regras financeiras vigentes. Serve de contexto para mudanças no fluxo da Fase 2 / crédito-ponte.

---

## 1. O que é

Motor financeiro da **incorporação em nuvem**: transforma percentuais do loteamento + valores de um negócio (lote, casa, customização, acoplamento) em VTE/VTP, fluxo mês a mês e saldo a financiar (SAC).

Há **dois produtos de UI** que **devem calcular igual**:

| Superfície | Quem usa | Auth | Rota |
|---|---|---|---|
| Template + ofertas da **Helenna** | Time interno (admin/team) | logado | `/loteadores/[cardId]/simulador-template` e `.../ofertas` |
| **Jornada do cliente** | Comprador / corretor na página pública | sem login | `/empreendimento/[slug]` |
| Simulador público por token (legado do QR) | Corretor | sem login | `/simulador/[link_token]` |

O cálculo **não** vive em cada tela. Todas chamam `calcularOferta` em `src/lib/simulador/calcular-oferta.ts`, depois de passar o template por `montarTemplateParaEngine` (`src/lib/simulador/montar-template-jornada.ts`).

---

## 2. Jornada operacional (Helenna)

```
Card Funil Loteadores (/loteadores?card={id})
  ├─ Accordion “Modelo e Simulações IMOB”
  │     ├─ Template (1 por card)
  │     └─ Empreendimentos IMOB → botão Criar Oferta (só depois do template salvo)
  └─ Lista de lotes / planilha

1) Helenna salva o TEMPLATE
   /loteadores/[cardId]/simulador-template
   → loteamento_simulador_templates
   → slug da jornada em imob_card_modelo.page_slug
   → Link Moní /empreendimento/[slug]

2) Helenna cria UMA OFERTA por empreendimento
   /loteadores/[cardId]/simulador-template/ofertas?empreendimento={uuid}
   → simulacoes_pagamento
   → espelha à vista / entrada / mensais / parcela única no card IMOB

3) Cliente abre a jornada pública
   /empreendimento/[slug]
   RPC empreendimento_publico_carregar (SECURITY DEFINER)
```

Showroom **não** cria oferta Helenna. Oferta nasce **do card**, por empreendimento — não da página do template.

---

## 3. Arquivos-chave

| Arquivo | Papel |
|---|---|
| `src/lib/simulador/calcular-oferta.ts` | Engine puro. Sem Supabase. |
| `src/lib/simulador/montar-template-jornada.ts` | Único mapeamento RPC/banco → `TemplateConfig` |
| `src/lib/loteamento-simulador-template.ts` | Draft da Helenna, parse de %, tipos, row |
| `src/lib/actions/loteamento-simulador-template.ts` | Save template/oferta |
| `src/app/loteadores/[id]/simulador-template/SimuladorTemplateForm.tsx` | UI do template |
| `src/components/simulador/CalculadoraOferta.tsx` | Calculadora da Helenna |
| `src/app/empreendimento/[slug]/JornadaClient.tsx` | Jornada pública |
| `src/lib/empreendimento/carregar-empreendimento.ts` | Parse da RPC pública |
| `src/lib/actions/jornada-cliente.ts` | Grava rascunho da jornada em `simulacoes_pagamento` |

---

## 4. Modelo de dados

### 4.1 Template — `loteamento_simulador_templates`

**1 por card** (índice único em `kanban_card_id`). Percentuais no banco são **fração** (0.03 = 3%), exceto gestão **fixo**, que grava R$ em `pct_taxa_gestao`.

Campos relevantes hoje:

| Coluna | Significado |
|---|---|
| `pct_itbi`, `pct_impostos`, `pct_taxa_plataforma`, `pct_comissao_corretor` | Frações |
| `pct_lucro_loteadora`, `pct_lucro_moni`, `pct_lucro_franqueado` | Frações sobre lote + obra |
| `pct_taxa_gestao` + `tipo_taxa_gestao` | `percentual` = fração sobre custo da obra; `fixo` = R$ absoluto |
| `pct_plataforma_entrada` | Fração da taxa de plataforma cobrada no mês 0 (0 = nada na entrada) |
| `taxa_juros_credito_ponte` | Taxa a.m. do CP (fração, ex. 0.025) |
| `tipo_juros_cp` | `mes_a_mes` (padrão) ou `total` |
| `prazo_obra_meses` | Meses de obra (mín. 3; o engine limita 3–7) |
| `entrada_minima_loteadora` | JSON `{ tipo: percentual \| valor_fixo, valor }` |
| `taxa_juros_parcelado_mes` | Juros do saldo do lote na Fase 1 |
| `taxa_juros_financiamento_anual` | Taxa do SAC pós-entrega |
| `link_token` | QR legado `/simulador/{token}` |

UI da Helenna (defaults de campo vazio, não fallback de zero gravado): ITBI 3%, impostos 6%, plataforma 8%, gestão 7% ou R$ 90.000 no fixo, comissão 6%, CP 2,5% a.m., financiamento 10% a.a.

Zero gravado é valor válido (`??`, nunca `||`).

### 4.2 Oferta / simulação — `simulacoes_pagamento`

**N por template.** Uma linha = um negócio (Helenna ou jornada).

Entradas típicas do engine: `valor_lote`, `valor_casa` (custo de construção / `valor_base_casa`), `valor_customizacao`, `valor_acoplamento`, `valor_ja_pago`, `prazo_meses` (Fase 1), `parcela_mensal`, `renda_cliente`, `prazo_financiamento_anos`, `taxa_financiamento_anual`, valores confirmados de entrada/mensal/única.

### 4.3 Jornada pública

- Slug em `imob_card_modelo.page_slug`
- RPC `empreendimento_publico_carregar(p_slug)` devolve card, template, itens de customização e ofertas IMOB
- Lotes vêm da planilha no Storage (`processo-docs`, coluna Acoplamento)
- Na jornada, `valor_base_casa` da oferta é o `valor_casa` do engine; acoplamento vem do **lote**, não da oferta

Migrations do template/jornada recentes: `544` (nascimento), `545–549`, `571` (acoplamento), `575` (gestão fixo + plataforma na entrada), `576` (`tipo_juros_cp` + RPC).

---

## 5. Mapeamento único → engine

`montarTemplateParaEngine(tpl)` aceita row do banco **ou** JSON da RPC (nomes diferentes: `pct_itbi` / `itbi_percentual`, `taxa_juros_credito_ponte` / `perc_cp`).

Regras:

- Ausente / null / undefined → **0** (sem constante de fallback no mapper)
- `n >= 1` em campos percentuais → trata como % gravado como 3 e divide por 100
- Gestão `fixo`: **não** divide; o número é R$
- `tipo_juros_cp` ausente → `mes_a_mes`

Não montar o `TemplateConfig` de novo na Helenna nem na jornada.

---

## 6. Bases do preço (antes do fluxo)

```
custo_obra     = valor_casa + acoplamento + customização
base_calc      = valor_lote + custo_obra
plataforma     = % plataforma × custo_obra
gestão         = % × custo_obra   ou   valor fixo em R$
lucros         = % × base_calc    (loteadora + Moní + franqueado)
ITBI           = % × valor_lote
VTP_base       = base_calc + ITBI + plataforma + gestão + lucros
comissão       = % × VTP_base     (sem juros de lote nem de CP)
impostos       = % × VTP          (VTP já inclui juros; há iteração)
VTE            = VTP + impostos + comissão
VTE à vista    = VTP_base × (1 + % impostos + % comissão)
```

Parcela única sugerida = `max(quitação do lote, 30% do VTE − já pago até a única)`.

---

## 7. Fluxo mês a mês (o que o código faz hoje)

`N` = meses de obra (clamp 3–7). Curva de 7 meses:

`2,21% / 11,3% / 22,33% / 27,34% / 14,24% / 18,18% / 4,4%`

Se `N < 7`, os primeiros pesos são somados no mês 1 da obra.

### Mês 0

- Entrada do lote (mínima do template, menos já pago)
- Comissão do corretor
- Fatia da plataforma `pct_plataforma_entrada`, se > 0
- Se já houve pagamento à loteadora, linha extra de pré-contrato

### Fase 1 (mês 1 até `prazo−1`)

- Parcelas mensais do lote
- Juros sobre o saldo do lote (`taxa_juros_parcelado_mes`) — **não está nas regras de desembolso “só parcela”**

### Mês `prazo` (antes da obra)

- Parcela mensal **e** parcela única **e** ITBI na mesma linha
- A única pode ser maior que a quitação (regra dos 30% do VTE)
- O que sobra da única depois da quitação (+ reserva se o lote já estava pago) vira **excedente** de caixa para a obra

### Fase 2 — cada mês de obra

Desembolso de caixa da linha (`saidas_obra`):

- Construção × peso da curva
- Gestão `1/N` (todo mês, inclusive o último)
- Plataforma restante (`total − mês 0`) em **⅓ nos 3 primeiros meses**, sempre (com ou sem fatia na entrada)

No **último mês**, `saidas_total` ainda soma lucros + impostos (`liquidacao_entrega`) — apresentação do fluxo, **não** saque de CP.

Entrada do cliente na Fase 2: parcela mensal continua. No `mes_a_mes` ela abate o `cpSacado` todo mês. No `total` ela **não** entra no `cpSacado` — só é descontada de uma vez no `saldo_financiar` (`N × parcela`).

---

## 8. Crédito-ponte (CP)

`BUFFER_MESES_CP = 3`. Não cria linhas extras: o buffer entra no último mês da obra.

**Excedente inicial** (caixa da única que não quita o lote):

`max(0, parcela_única − quitação) + reserva da Fase 1`

Esse saldo vive **fora** do loop e é consumido mês a mês. Enquanto cobre o `cp_necessário`, `cp_sacado = 0` e saldo CP = 0.

### `mes_a_mes` (padrão)

- `cp_necessário` em todos os N meses = obra + gestão + plataforma do mês − parcela mensal
- Lucros e impostos **não** entram no `cpSacado` (só no `saldo_financiar`, após a transferência ao banco)
- Juros do mês = saldo CP **anterior** × taxa
- Último mês: `saldo × ((1+taxa)^3 − 1)` somado no juro e no saldo
- `saldo_financiar` = `saldo_cp_final + lucros + impostos`

### `total`

- `cpSacado`: **não** abate a parcela mensal. Só o excedente da única (e reserva da Fase 1) cobre desembolso antes de sacar CP
- `base_juros` = só o total CP sacado (sem lucros/impostos)
- Juros compostos: `base × ((1+taxa)^(N+3) − 1)`, rateados igualmente nos N meses
- No último mês o saldo CP da linha recebe o juro total
- `saldo_financiar` = `saldo_cp_final + lucros + impostos − (N × parcela_mensal)`

---

## 9. Últimas alterações (aplicadas)

1. Método `total`: `cpSacado` sem a parcela mensal; `saldo_financiar` desconta `N × parcela`.
2. Lucros e impostos **não** são financiados pelo CP em nenhum método. Entram só no `saldo_financiar`:
   - `mes_a_mes`: `saldo_cp_final + lucros + impostos`
   - `total`: `saldo_cp_final + lucros + impostos − (N × parcela_mensal)`

---

## 10. Convenções que não podem quebrar

- Percentuais no banco = fração. UI = 3 para 3%.
- Zero é valor válido: `??`, nunca `||` em numéricos.
- Engine compartilhado: mudança de fórmula em `calcular-oferta.ts` vale Helenna **e** jornada.
- Mapper compartilhado: campo novo do template entra em `montar-template-jornada.ts` + RPC + draft/save.
- Migrations idempotentes, só DEV primeiro.
- Sem laranja; tokens em `moni-tokens.css`.

---

## 11. Relação com outros docs

- Briefing antigo (set/2026, customizador): `BRIEFING-simulador-pagamentos-para-ingrid.md` — ainda útil para IMOB/card, desatualizado no engine (gestão fixo, plataforma na entrada, tipo de juros CP, jornada pública).
- Funil Loteadores no Kanban: `docs/02-operacoes/motor-01-loteadores.md` (esteira ≠ este simulador).
