-- Vínculo explícito Funil Step One → processo_step_one (distinto de projeto_id → projeto_negocio).

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS processo_step_one_id UUID
  REFERENCES public.processo_step_one(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_processo_step_one_id
  ON public.kanban_cards (processo_step_one_id)
  WHERE processo_step_one_id IS NOT NULL;

COMMENT ON COLUMN public.kanban_cards.processo_step_one_id IS
  'Processo Step One vinculado ao card (Funil Step One). Distinto de projeto_id (Portfolio / projeto_negocio).';

-- Correção imediata: card FK0012 (Genesis II, Santana de Parnaíba) sem processo.
DO $$
DECLARE
  v_card_id uuid;
  v_user_id uuid;
  v_rede_id uuid;
  v_processo_id uuid;
BEGIN
  SELECT kc.id, kc.franqueado_id, kc.rede_franqueado_id
  INTO v_card_id, v_user_id, v_rede_id
  FROM public.kanban_cards kc
  JOIN public.kanbans k ON k.id = kc.kanban_id
  WHERE k.nome = 'Funil Step One'
    AND kc.arquivado IS NOT TRUE
    AND (
      kc.titulo ILIKE 'FK0012%'
      OR kc.titulo ILIKE '%Genesis II%'
    )
    AND kc.processo_step_one_id IS NULL
  ORDER BY kc.created_at DESC
  LIMIT 1;

  IF v_card_id IS NULL THEN
    RETURN;
  END IF;

  IF v_user_id IS NULL THEN
    SELECT p.id INTO v_user_id FROM public.profiles p LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '324: FK0012 — sem user_id para criar processo';
    RETURN;
  END IF;

  INSERT INTO public.processo_step_one (
    user_id,
    cidade,
    estado,
    status,
    etapa_atual,
    updated_at,
    nome_condominio,
    numero_franquia,
    origem_rede_franqueados_id
  )
  VALUES (
    v_user_id,
    'Santana de Parnaíba',
    'SP',
    'em_andamento',
    1,
    now(),
    'Genesis II',
    'FK0012',
    v_rede_id
  )
  RETURNING id INTO v_processo_id;

  UPDATE public.kanban_cards
  SET processo_step_one_id = v_processo_id,
      updated_at = now()
  WHERE id = v_card_id;
END $$;

NOTIFY pgrst, 'reload schema';
