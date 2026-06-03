-- 238: Funil Step One — instrucoes das fases lotes, mapa, BCA e hipoteses

UPDATE public.kanban_fases
SET instrucoes = $instr$
Mapeie todos os lotes disponíveis no condomínio escolhido.
Para cada lote, registre identificação, área, valor estimado e
situação documental. Fotografe o lote e registre os Atributos do Lote
(vista, área verde, muro, proximidade de convivência e lixeira) —
essas informações serão usadas diretamente na Batalha de Casas.
Acesse o condomínio via: /step-one/[id]/etapa/lotes
$instr$
WHERE id = 'a6afabd9-2409-49a7-ab11-d2df4d3784e7'
  AND kanban_id = '4d89f111-cef6-48aa-93ff-72d6406f0a32';

UPDATE public.kanban_fases
SET instrucoes = $instr$
Levante todas as casas anunciadas e vendidas no condomínio e região,
na faixa de valor de venda estimada. Para cada casa, preencha os campos
do Mapa de Competidores. Com base nesse levantamento:
1. Identifique valores target e faixas de venda do mercado local
2. Compreenda programas, metragens e estilos das casas vendidas
3. Aplique a Batalha de Casas só no eixo Produto para ranquear
   quais modelos Moní são candidatos para este mercado.
Acesse a ferramenta: /step-one/[id]/etapa/5
$instr$
WHERE id = 'ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0'
  AND kanban_id = '4d89f111-cef6-48aa-93ff-72d6406f0a32';

UPDATE public.kanban_fases
SET instrucoes = $instr$
Com as casas candidatas identificadas no Mapa de Competidores:
1. Selecione as 3 casas mais promissoras do catálogo Moní
2. Aplique o Configurador de Casas para cada uma e gere os PDFs
3. Aplique o BCA com os custos do Configurador
4. Aplique a Batalha de Casas completa (3 eixos) contra todos
   os concorrentes da faixa de valor de cada casa
5. Interprete o resultado em relação ao Giro: posição ≤ giro → vende
6. Escreva a tese de vendas da casa escolhida
Acesse: /step-one/[id]/etapa/6 (Batalha) e /step-one/[id]/etapa/10 (BCA)
$instr$
WHERE id = '8fda525c-720d-4db7-821d-52625867a000'
  AND kanban_id = '4d89f111-cef6-48aa-93ff-72d6406f0a32';

UPDATE public.kanban_fases
SET instrucoes = $instr$
Com base em tudo levantado (Mapa de Competidores, BCA e Batalha),
registre a hipótese central do negócio para este condomínio:
qual casa, por qual preço, para qual perfil de comprador,
com qual retorno esperado. Documente premissas, riscos e
próximos passos para validação com o comitê.
$instr$
WHERE id = 'bf21d44c-e1d3-49cc-861d-7b39356e0bb8'
  AND kanban_id = '4d89f111-cef6-48aa-93ff-72d6406f0a32';
