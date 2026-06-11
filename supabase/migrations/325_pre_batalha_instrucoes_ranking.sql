-- 325: Atualiza instruções da fase Pré Batalha (remove link auto-fill; corrige lógica do ranking).

UPDATE public.kanban_fases
SET instrucoes = $instr$
Com o mapa de competidores preenchido e os atributos do lote definidos em Lotes Disponíveis, o sistema ranqueia automaticamente todos os modelos Moní do catálogo, separados por faixa de mercado (Entrada, Intermediária, Premium, Premium+, etc.).

Em cada faixa, cada modelo elegível batalha contra todos os anúncios daquela faixa nos eixos Preço e Produto.
$instr$
WHERE slug = 'batalha'
  AND kanban_id IN (
    SELECT id FROM public.kanbans
    WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
       OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  );

NOTIFY pgrst, 'reload schema';
