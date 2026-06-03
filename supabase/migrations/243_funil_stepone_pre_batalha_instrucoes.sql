-- 243: Instruções da fase Pré-Batalha (link etapa 5 com modo pré-batalha)

UPDATE public.kanban_fases
SET instrucoes = $instr$
Com o mapa de competidores preenchido, selecione até 3 modelos Moní do catálogo e
ranqueie os anúncios usando apenas Produto e Atributos do Lote (sem Preço nem
checklist de reforma). As notas ficam nesta sessão para apoiar a escolha; a
batalha completa (3 eixos) e persistência ocorrem na etapa 6.
Acesse: /step-one/[id]/etapa/5?modo=pre-batalha
$instr$
WHERE slug = 'pre_batalha'
  AND kanban_id IN (
    SELECT id FROM public.kanbans
    WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
       OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  );
