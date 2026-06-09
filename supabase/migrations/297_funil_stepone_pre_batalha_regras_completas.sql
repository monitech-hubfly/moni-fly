-- 297: Batalha das Casas (slug pre_batalha) — regras completas (3 eixos).

UPDATE public.kanban_fases
SET instrucoes = $instr$
Com o mapa de competidores preenchido, selecione até 3 modelos Moní do catálogo e aplique a
Batalha de Casas completa contra a listagem: Atributos do Lote + Preço (checklist de reforma)
+ Produto (7 sub-itens). Nota final = soma dos três eixos; desempate: Lote > Preço > Produto.
Acesse: /step-one/[id]/etapa/5?modo=pre-batalha
$instr$
WHERE slug = 'pre_batalha'
  AND kanban_id IN (
    SELECT id FROM public.kanbans
    WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
       OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  );
