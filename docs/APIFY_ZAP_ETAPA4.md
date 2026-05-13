# Integração Apify ZAP na Etapa 4

A Etapa 4 (casas à venda) permite **varrer a ZAP Imóveis** via Apify e preencher/atualizar a tabela de listagens automaticamente.

## Variáveis de ambiente

No `.env.local` (ou no ambiente de deploy):

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_APIFY_TOKEN` ou `APIFY_API_TOKEN` | Sim | Token da API do Apify. Obtenha em [Apify Console](https://console.apify.com/account/integrations) → API tokens. |
| `APIFY_ACTOR_ZAP_ID` | Não | ID do Actor ZAP. Padrão: `fatihtahta/zap-imoveis-scraper`. Só altere se usar outro actor. |

## Como usar na ferramenta

1. Na **Etapa 4** do Step One, preencha **Cidade** e **Estado** (ex.: São Paulo, SP). Opcionalmente **Condomínio**.
2. Clique em **"Varrer ZAP"**. A ferramenta:
   - Monta a URL de busca ZAP a partir de cidade/estado/condomínio, sempre filtrando **casas à venda acima de R$ 4.000.000** (ex.: `https://www.zapimoveis.com.br/venda/casas/sp+sao-paulo+condominio-x/?transacao=venda&precoMinimo=4000000`).
   - Dispara o Actor no Apify e aguarda o fim do run.
   - Insere novos anúncios e atualiza os que já existem (por link). Anúncios que **não** voltaram na busca são marcados como **despublicado** (não são excluídos).

## Atualização mensal

Para “varrer a ZAP novamente” todo mês: basta rodar **"Varrer ZAP"** de novo na Etapa 4 (manual ou via agendamento externo). Não é obrigatório ter os mesmos campos (cidade/estado/condomínio); o importante é rodar a mesma busca para o processo. Os resultados são mesclados: novos entram, existentes são atualizados, e os que sumiram da busca ficam com status **despublicado**.

## Campos da tabela (listings_casas)

- Cidade, Estado, Fotos (link), Status (a venda / despublicado), Nome do Condomínio, Endereço, quartos, banheiros, vagas, piscina, móveis planejados, Preço, m², R$/m², compatibilidade estilo Moní (editável por linha), data do levantamento, link do anúncio (Listing).

Piscina e móveis planejados são inferidos do objeto `listing` do Apify quando existir; caso contrário ficam como “não”.

## Observações

- O Actor usado é **ZAP Imóveis Scraper** (fatihtahta/zap-imoveis-scraper). Ele recebe `startUrls` (URL de busca ZAP). A ferramenta gera essa URL a partir de cidade, estado e, quando informado, o nome do condomínio (slugs), sempre com `transacao=venda` e `precoMinimo=4000000`.
- **Não compartilhe** o `APIFY_API_TOKEN`. Em caso de vazamento, revogue o token no Apify e crie outro.
