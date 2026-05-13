# Refatoração das sprints — premissas

Este documento registra as premissas para refazer/ajustar as sprints do Step One (Viabilidade Moní).

---

## 1. Análise da praça (Etapa 1): dados automáticos e referência de imagens

A **Etapa 1 — Análise da praça** deve trazer **dados automáticos** a partir de fontes oficiais e, no futuro, **referência de imagens** com todos os elementos urbanos mapeados.

### Fontes de dados automáticos

| Fonte        | Uso na análise                         | Status / Observação |
|-------------|----------------------------------------|----------------------|
| **IBGE**    | Limites, área, divisão administrativa, regiões (microrregião, mesorregião, região imediata) | **Integrado** — API de Localidades (sem API key). |
| **Atlas Brasil (PNUD)** | Demografia, IDHM, indicadores municipais | **Em breve** — dados por planilha/CSV ou integração futura; não há API pública REST. |
| **Google Maps** | Parques, áreas verdes, comércio, shoppings, eixos, regiões de alimentação | **Em breve** — exige configuração de API key (Places API). |

### Referência de imagens (em breve)

A ferramenta deve trazer **referência de imagens** com todos os seguintes elementos mapeados para a praça:

- Escolas  
- Hospitais  
- Principais eixos  
- Regiões mapeadas por renda  
- Praças  
- Shoppings  
- Parques  
- Demais elementos urbanos mapeados  

Fontes previstas para essas imagens/mapeamento: **Atlas Brasil**, **Google Maps** e bases oficiais. A integração está em desenvolvimento.

- O sistema já busca e exibe dados do **IBGE** (município, região, microrregião etc.) assim que a praça (cidade + UF) está definida.
- A narrativa de análise continua editável pelo Frank; os dados automáticos e as referências de imagens servem de base quando disponíveis.

---

## 2. Listagens de casas e lotes (Etapas 4 e 5): Apify ainda não conectado

- **Ainda não há conexão** com a API do **Apify** para varrer listagens de casas e lotes à venda (ZAP/imobiliários).
- Nas **Etapas 4 e 5** o Frank **cadastra manualmente** casas e lotes.
- A interface deixa explícito que a listagem é **manual** e que a **integração com Apify será conectada em breve**.

Quando a integração Apify estiver disponível, as etapas 4 e 5 poderão passar a incluir varredura automática, mantendo a possibilidade de ajuste manual.

---

## 3. Batalhas com todas as casas ZAP × 3 modelos do catálogo

- **Batalhas (Etapa 8):** são feitas com **todas as casas listadas na ZAP** (Etapa 4). Cada casa ZAP é comparada (preço, produto, localização) com os modelos do catálogo Moní.
- **Escolha das 3 “casas”:** o Frank escolhe **3 modelos do catálogo Moní** (não 3 casas ZAP). São esses 3 modelos que “batalham” contra as casas da ZAP e que serão usados no **BCA** (Etapa 10) como as 3 opções.
- Fluxo:
  1. Etapa 4: Frank cadastra as casas à venda (manual até Apify).
  2. Etapa 6: catálogo Moní tem vários modelos.
  3. Na Etapa 8, o Frank **escolhe 3 modelos do catálogo** (ex.: Modelo A, B, C).
  4. As batalhas são exibidas: **cada casa ZAP** × **cada um dos 3 modelos escolhidos** (notas preço, produto, localização).
  5. O BCA (Etapa 10) usa esses mesmos 3 modelos do catálogo como opções.

Assim, todas as casas da ZAP entram nas batalhas; a escolha de 3 é apenas dos **modelos do nosso catálogo** que vão competir e ir para o BCA.

---

## 4. Catálogo de casas Moní (Etapa 6)

- O **catálogo de casas** (modelos Moní) será preenchido a partir de uma **tabela** que será submetida com as casas do catálogo e suas informações.
- O sistema utiliza a tabela **`catalogo_casas`** no Supabase; a estrutura está pronta para receber os dados (nome, área, quartos, preços etc.). Quando a tabela for fornecida, os dados poderão ser importados ou inseridos conforme o layout acordado.

---

## Resumo

| Premissa | O que foi feito / o que fazer |
|----------|------------------------------|
| Etapa 1 — dados automáticos | IBGE integrado; Atlas Brasil e Google Maps previstos (em breve). |
| Etapa 1 — referência de imagens | UI com lista de elementos (escolas, hospitais, eixos, regiões por renda, praças, shoppings, parques, elementos urbanos); integração em desenvolvimento. |
| Apify não conectado | Etapas 4 e 5 manuais; mensagem explícita de que ainda não há conexão com a API do Apify; integração em breve. |
| 3 modelos do catálogo | Escolher 3 modelos do catálogo Moní; batalhas = todas as casas ZAP × esses 3; BCA usa os 3 modelos. |
| Catálogo Moní | Tabela com casas do catálogo será submetida; sistema pronto para receber em `catalogo_casas`. |

As demais sprints (etapas 2, 3, 6, 7, 9, 11) seguem conforme a especificação do Step One, podendo ser refinadas depois com base nessas premissas.
