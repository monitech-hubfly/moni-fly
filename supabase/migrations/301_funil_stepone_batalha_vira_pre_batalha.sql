-- 301: Funil Step One — fase «Batalha» vira «Pré Batalha» (regras completas 3 eixos).
-- Absorve pre_batalha («Batalha das Casas»): cards migrados, coluna legada desativada.
-- Sequência após Lotes: BCA → Escolha → Pré Batalha → Hipóteses.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_pre_batalha_id UUID;
  v_fase_batalha_id UUID;
  v_ordem_lotes INT;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
     OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  ORDER BY CASE WHEN id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '301: kanban Funil Step One não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id
  INTO v_fase_batalha_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('batalha', 'stepone_batalha')
    AND COALESCE(ativo, true) = true
  ORDER BY CASE WHEN slug = 'batalha' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT id
  INTO v_fase_pre_batalha_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('pre_batalha', 'stepone_pre_batalha')
    AND COALESCE(ativo, true) = true
  ORDER BY CASE WHEN slug = 'pre_batalha' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_batalha_id IS NULL THEN
    RAISE NOTICE '301: fase batalha não encontrada; pulando.';
    RETURN;
  END IF;

  IF v_fase_pre_batalha_id IS NOT NULL THEN
    UPDATE public.kanban_cards
    SET fase_id = v_fase_batalha_id
    WHERE fase_id = v_fase_pre_batalha_id;

    UPDATE public.kanban_fases
    SET ativo = false,
        instrucoes = NULL
    WHERE id = v_fase_pre_batalha_id;
  END IF;

  UPDATE public.kanban_fases
  SET
    nome = 'Pré Batalha',
    instrucoes = $instr$
Com o mapa de competidores preenchido, selecione até 3 modelos Moní do catálogo e aplique a
Pré-Batalha completa contra a listagem: Atributos do Lote + Preço (checklist de reforma)
+ Produto (7 sub-itens). Nota final = soma dos três eixos; desempate: Lote > Preço > Produto.
Acesse: /step-one/[id]/etapa/5?modo=pre-batalha
$instr$
  WHERE id = v_fase_batalha_id;

  SELECT MIN(ordem)
  INTO v_ordem_lotes
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('lotes_disponiveis', 'stepone_lotes')
    AND COALESCE(ativo, true) = true;

  IF v_ordem_lotes IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET ordem = CASE slug
      WHEN 'bca' THEN v_ordem_lotes + 1
      WHEN 'stepone_bca' THEN v_ordem_lotes + 1
      WHEN 'bca_batalha_casas' THEN v_ordem_lotes + 1
      WHEN 'escolha' THEN v_ordem_lotes + 2
      WHEN 'stepone_escolha' THEN v_ordem_lotes + 2
      WHEN 'batalha' THEN v_ordem_lotes + 3
      WHEN 'stepone_batalha' THEN v_ordem_lotes + 3
      WHEN 'hipoteses' THEN v_ordem_lotes + 4
      WHEN 'stepone_hipoteses' THEN v_ordem_lotes + 4
      ELSE ordem
    END
    WHERE kanban_id = v_kanban_id
      AND slug IN (
        'bca',
        'stepone_bca',
        'bca_batalha_casas',
        'escolha',
        'stepone_escolha',
        'batalha',
        'stepone_batalha',
        'hipoteses',
        'stepone_hipoteses'
      )
      AND COALESCE(ativo, true) = true;
  END IF;
END;
$$;
