-- 303: Pré Batalha — ranking por compatibilidade (sem limite de 3 modelos).

UPDATE public.kanban_fases
SET instrucoes = $instr$
Com o mapa de competidores preenchido, os modelos Moní do catálogo são ranqueados automaticamente
por compatibilidade com a listagem (alta → baixa). Aplique a Pré-Batalha completa contra cada
anúncio: Atributos do Lote + Preço (checklist de reforma) + Produto (7 sub-itens).
Nota final = soma dos três eixos; desempate: Lote > Preço > Produto.
Acesse: /step-one/[id]/etapa/5?modo=pre-batalha
$instr$
WHERE slug = 'batalha'
  AND kanban_id IN (
    SELECT id FROM public.kanbans
    WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
       OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  );
