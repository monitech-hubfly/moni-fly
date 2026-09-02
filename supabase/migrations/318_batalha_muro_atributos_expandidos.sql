-- 318: Atributos de muro expandidos (rodovia, comunidade, vegetação) — batalha e cadastro de lote.

ALTER TABLE public.condominios_lotes
  ADD COLUMN IF NOT EXISTS muro_rodovia BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muro_comunidade BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muro_vegetacao BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.condominios_lotes.muro_rodovia IS 'Atributo do lote — muro com rodovia.';
COMMENT ON COLUMN public.condominios_lotes.muro_comunidade IS 'Atributo do lote — muro com comunidade.';
COMMENT ON COLUMN public.condominios_lotes.muro_vegetacao IS 'Atributo do lote — muro com vegetação.';

-- Checklist Lotes disponíveis: substituir checkbox genérico «Muro» por três opções.
DO $$
DECLARE
  v_fase_id UUID;
  v_ordem_muro INT;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('lotes_disponiveis', 'stepone_lotes')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'lotes_disponiveis' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '318: fase lotes_disponiveis não encontrada; pulando checklist.';
    RETURN;
  END IF;

  SELECT ordem INTO v_ordem_muro
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND label = 'Muro'
  LIMIT 1;

  IF v_ordem_muro IS NULL THEN
    RAISE NOTICE '318: item Muro não encontrado no checklist; pulando.';
    RETURN;
  END IF;

  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id AND i.fase_id = v_fase_id AND i.label = 'Muro';

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND label = 'Muro';

  UPDATE public.kanban_fase_checklist_itens
  SET ordem = ordem + 2
  WHERE fase_id = v_fase_id AND ordem > v_ordem_muro;

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
  SELECT v_fase_id, v.ordem, v.label, 'checkbox', false, true
  FROM (VALUES
    (v_ordem_muro,     'Muro com rodovia'),
    (v_ordem_muro + 1, 'Muro com comunidade'),
    (v_ordem_muro + 2, 'Muro com vegetação')
  ) AS v(ordem, label)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id AND i.label = v.label
  );
END;
$$;
