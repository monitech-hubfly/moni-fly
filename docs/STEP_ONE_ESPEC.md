# Step One — Especificação técnica

## Tela de início do processo

- **Rota:** `/step-one` — formulário com **Cidade** (obrigatório) e **Estado (UF)**.
- Ao submeter: criar processo (Supabase `processo_step_one` + `etapa_progresso` para as 11 etapas) e redirecionar para `/step-one/[id]`, onde são listadas as 11 etapas com links para `/step-one/[id]/etapa/[1-11]`.

---

## Etapa 1 — Análise da praça

**Objetivo:** Analisar a área de atuação da cidade com **dados automáticos** (IBGE, Atlas Brasil, Google Maps) e **referência de imagens** com todos os elementos urbanos mapeados.

**Dados automáticos (fontes):**
- **IBGE** (integrado): limites, divisão administrativa, microrregião, mesorregião, região imediata/intermediária — API de Localidades, sem API key.
- **Atlas Brasil (PNUD)** (em breve): demografia, IDHM, indicadores municipais.
- **Google Maps / Places** (em breve): parques, comércio, shoppings, eixos — exige API key.

**Referência de imagens (em breve):**  
A ferramenta deve trazer referência de imagens com: **escolas**, **hospitais**, **principais eixos**, **regiões mapeadas por renda**, **praças**, **shoppings**, **parques** e **demais elementos urbanos mapeados**. Fontes previstas: Atlas Brasil, Google Maps e bases oficiais.

**Fontes mapeadas (10 dimensões):**

| Dimensão | Fonte sugerida | API / uso |
|----------|----------------|-----------|
| Limites e área | IBGE – Malha Municipal | API IBGE / shapefiles |
| Demografia | Atlas Brasil (PNUD) | Dados abertos / CSV |
| Divisão administrativa | IBGE – Localidades | API IBGE |
| Parques e áreas verdes | Google Maps / OpenStreetMap | Places API / Overpass |
| Áreas nobres / valor imobiliário | VivaReal / dados setor | Pesquisa manual ou parceiro |
| Regiões de alimentação / comércio | Google Maps / Prefeitura | Places API / site Prefeitura |
| Shoppings | Google Maps / Prefeitura | Places API |
| Eixo de expansão | Prefeitura (PDDU/planos) | PDF/HTML Prefeitura |
| Infraestrutura | Prefeitura / concessionárias | Sites oficiais |
| Comparativo regional | IBGE / Atlas | APIs e CSVs |

**Entregável:** Dados estruturados + narrativa de análise gerada (ex.: Claude).

---

## Etapa 2 — Condomínios e checklist (16 itens)

**Pré-requisito:** Cidade preenchida na Etapa 1.

**Filtro:** Condomínios da cidade que vendem casa **acima de 5 MM**.

Para cada condomínio, preencher:

### SOBRE OS LOTES
1. Quantos lotes o condomínio tem?
2. Quantos estão disponíveis para venda?
3. Tamanho médio dos lotes?
4. Preço médio do m² de venda dos lotes?
5. Área onde os lotes são mais valorizados e têm maior demanda?

### SOBRE AS CASAS EM CONSTRUÇÃO
6. Quantas casas estão prontas?
7. Quantas estão em construção? Dessas, quantas para venda e quantas para cliente final?
8. Quantas casas estão para venda?
9. Preço do m² de venda das casas?
10. Tempo médio para venda após pronta?
11. Quantas casas vendidas nos últimos 12 meses?
12. O que fez as casas remanescentes demorarem? Características que impactaram negativamente na liquidez? Erros de projeto?
13. Das casas vendidas, características mais elogiadas e que levaram à decisão de compra?
14. Características que os clientes buscam e não encontraram (ex.: depósito na garagem, despensa, suíte térrea, automação)?

### LOCAÇÃO
15. Valor das casas para locação (exemplos).

### GIRO
16. Quantas casas vendem em 6 meses e em 1 ano?

**Checklist legal:** Respostas das perguntas do checklist legal (fonte e nível de automação por item a definir).

---

## Etapa 3 — Tabela resumo e conclusão

**Tabela por condomínio:**
- Nome do condomínio
- Estoque de casas à venda
- Ticket médio lote (R$)
- Ticket médio casas (R$)
- Ticket médio casas (R$/m²)
- Estimativa de casas vendidas por ano

**Conclusão (ranking e texto):**
- Condomínios mais promissores e por quê
- Faixa de preço (R$/m²) com maior liquidez
- Produto que mais vende atualmente
- Principais erros observados no mercado local
- Oportunidade clara para novo projeto

---

## Etapas 4 e 5 — Listagens (casas e lotes à venda)

**Status:** Ainda **não há conexão** com a API do Apify para varrer listagens de casas e lotes à venda (ZAP/imobiliários). Listagem **manual**; integração será conectada em breve.

**Etapa 4 — Casas à venda**

Para cada condomínio, listar casas (hoje manual; futuramente varredura ZAP/Apify) com:

| # | Campo | Fonte | Observação |
|---|--------|--------|------------|
| 1 | Praça (cidade) | Formulário | |
| 2 | Condomínio | ZAP / manual | |
| 3 | Recuos permitidos | Não está na ZAP | Web search → PDF manual de obras → alerta ao Frank se não achar |
| 4 | Localização no condomínio | Descrição | Portaria, lixeira, meio do condomínio, etc. |
| 5 | Corretor | ZAP | |
| 6 | Área do lote (m²) | ZAP | |
| 7 | Área da casa (m²) | ZAP | |
| 8 | Topografia | ZAP / manual | Aclive, declive, plano |
| 9 | Medidas (frente x fundo) | ZAP | |
| 10 | Nº quartos | ZAP | |
| 11 | Nº suítes | ZAP | |
| 12 | Nº banheiros | ZAP | |
| 13 | Nº vagas | ZAP | |
| 14 | Piscina (sim/não) | ZAP | |
| 15 | Móveis planejados / marcenaria (sim/não) | ZAP | |
| 16 | Preço da oferta | ZAP | |
| 17 | Preço da oferta/m² | Calculado | |
| 18 | Foto | ZAP | |
| 19 | Data da publicação | ZAP | |
| 20 | Data da coleta | Sistema | |
| 21 | Link | ZAP | |

**Etapa 5 — Lotes à venda**  
Listar lotes à venda por condomínio e ranquear da melhor para a pior oportunidade.

---

## Etapa 6 — Catálogo Moní

**Premissa:** Será submetida uma **tabela** com as casas do catálogo e suas informações. O sistema utiliza a tabela `catalogo_casas` no Supabase; a estrutura está pronta para receber/importar esses dados.

Dados em banco (catálogo da Moní):

- Largura e profundidade das casas
- Área das casas Moní
- Atende aclive / declive / plano
- Nº quartos, suítes, banheiros, vagas
- Preço da casa: custo e venda
- Preço da casa/m²: custo e venda
- Adicionais: garagem, piscina, marcenaria, gadgets (escolhíveis conforme análise dos concorrentes)
- Fotos da casa Moní

---

## Etapa 7 — Lote escolhido pelo franqueado

Campos (preenchidos pelo Frank):

- Praça, condomínio, recuos permitidos, localização no condomínio
- Área do lote (m²), topografia, medidas (frente x fundo)
- Preço da oferta, preço da oferta/m², foto

---

## Escolher 3 modelos do catálogo (para batalhas e BCA)

O Frank escolhe **3 modelos do catálogo Moní** (Etapa 6). São esses 3 que “batalham” com as casas da ZAP e que viram as 3 opções do BCA (Etapa 10).

## Etapa 8 — Batalhas (preço, produto, localização)

**Todas as casas listadas na ZAP** (Etapa 4) batalham contra **os 3 modelos do catálogo escolhidos**. Para cada casa ZAP vs. cada um desses 3 modelos:

- **Batalha de preço:** nota -2 a +2 (automático)
- **Batalha de produto:** nota -2 a +2 (Frank valida)
- **Batalha de localização:** nota -2 a +2 (automático)

Média por casa ZAP: entender se, no conjunto, ganhamos ou perdemos nas batalhas.

**Rubricas de produto:** tabela completa com indicação do que o sistema detecta sozinho vs. o que o Frank valida.

---

## Etapa 9 — Ranking do catálogo

Com base nas batalhas: ranking de qual casa do catálogo deveria ser escolhida e por quê.

---

## Etapa 10 — BCA (3 opções)

Com base no ranking das 3 melhores casas do catálogo: preencher automaticamente 3 opções de BCA para o franqueado enviar.

---

## Etapa 11 — PDF de hipóteses

O franqueado consolida todas as informações e envia em um **PDF** (hipóteses para aprovação).

**Log de exportação:** cada geração de PDF registra Frank, hipótese, modelo escolhido, timestamp, hash do arquivo.

---

## Adicional

- **Rede:** Lista de contatos (condomínios, corretores, imobiliárias). Atualização quinzenal.
- **Logs:** audit_log, etapa_progresso, pdf_exports, apify_usage, alertas (ver schema Supabase).
- **Painel Moní (consultor/admin):** funil de progresso dos Franks nas 11 etapas, Franks parados, PDFs gerados, consumo Apify, últimas atividades.
- **Resumo manual vs. ferramenta:** 2–3 semanas de trabalho manual → 2–3 horas de revisão com a ferramenta.
