-- 319: Pré Batalha — ranking por faixa com Preço (INC + Kit Moní) + Produto + Lote.

UPDATE public.kanban_fases
SET instrucoes = $instr$
Com o mapa de competidores preenchido e a topografia do lote definida em Lotes Disponíveis,
o sistema ranqueia automaticamente todos os modelos Moní compatíveis com o lote, separados
por faixa de mercado (Entrada, Intermediária, Premium, Premium+, etc.).

Em cada faixa, cada modelo batalha contra todos os anúncios daquela faixa nos três eixos:
• Lote — atributos de localização do lote
• Preço — VGV Moní (preço INC + Kit Moní do catálogo) vs. preço de cada anúncio
• Produto — quartos, banheiros, vagas e metragem vs. cada anúncio

Nota final = Lote + Preço + Produto (médias na faixa). Todos os modelos elegíveis aparecem
em cada faixa com anúncios. Desempate: Lote > Preço > Produto.

O campo «Ranking inicial — casas candidatas confirmadas» é preenchido automaticamente ao abrir
esta fase. Acesse também: /step-one/[id]/etapa/5?modo=pre-batalha
$instr$
WHERE slug = 'batalha'
  AND kanban_id IN (
    SELECT id FROM public.kanbans
    WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
       OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  );
