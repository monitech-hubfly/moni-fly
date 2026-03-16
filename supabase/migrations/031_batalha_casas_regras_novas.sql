-- Campos extras para regras consolidadas da Batalha de Casas (Atributos do Lote, Preço 4 sub-itens, Produto 5 sub-itens)

ALTER TABLE public.batalha_casas
  ADD COLUMN IF NOT EXISTS atributos_lote_json JSONB,
  ADD COLUMN IF NOT EXISTS preco_dados_json JSONB,
  ADD COLUMN IF NOT EXISTS produto_dados_json JSONB;

COMMENT ON COLUMN public.batalha_casas.atributos_lote_json IS 'Respostas SIM/NÃO dos atributos do lote (vista, área verde, muro, área convivência, lixeira). Nota = soma dos scores dos marcados.';
COMMENT ON COLUMN public.batalha_casas.preco_dados_json IS 'Checklist 8 categorias de reforma + 4 sub-itens (Distância, Esforço, Incerteza, Preço Nominal) e nota preço.';
COMMENT ON COLUMN public.batalha_casas.produto_dados_json IS '5 sub-itens Produto (tamanho, amenidades, quartos, design, idade) e nota produto.';
