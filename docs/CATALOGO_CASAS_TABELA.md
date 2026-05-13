# Catálogo de casas Moní — estrutura para importação

Será submetida uma **tabela** com as casas do catálogo e suas informações. O sistema já possui a tabela `catalogo_casas` no Supabase pronta para receber esses dados.

## Colunas da tabela `catalogo_casas`

| Coluna           | Tipo        | Obrigatório | Descrição |
|------------------|-------------|-------------|-----------|
| `id`             | UUID        | auto        | Gerado automaticamente. |
| `nome`           | TEXT        | sim         | Nome do modelo (ex.: "Modelo A"). |
| `largura_m`      | NUMERIC     | não         | Largura em metros. |
| `profundidade_m` | NUMERIC     | não         | Profundidade em metros. |
| `area_m2`        | NUMERIC     | não         | Área da casa em m². |
| `topografia`      | TEXT        | não         | `'aclive'`, `'declive'` ou `'plano'`. |
| `quartos`        | INT         | não         | Número de quartos. |
| `suites`         | INT         | não         | Número de suítes. |
| `banheiros`      | INT         | não         | Número de banheiros. |
| `vagas`          | INT         | não         | Número de vagas de garagem. |
| `preco_custo`    | NUMERIC     | não         | Preço de custo (R$). |
| `preco_venda`    | NUMERIC     | não         | Preço de venda (R$). |
| `preco_custo_m2` | NUMERIC     | não         | Preço de custo por m². |
| `preco_venda_m2` | NUMERIC     | não         | Preço de venda por m². |
| `ativo`          | BOOLEAN     | não         | Default `true`. |
| `created_at`     | TIMESTAMPTZ | auto        | Gerado automaticamente. |

Quando você submeter a tabela com as casas do catálogo, podemos mapear as colunas da sua planilha para essa estrutura e definir o fluxo de importação (CSV, planilha ou inserção em lote).
