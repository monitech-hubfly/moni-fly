-- 276: Funil Step One — fase "Onboarding" antes de "Dados do Candidato" (ordem 1).
-- Idempotente: se a fase já existir (slug ou nome), não altera ordem das demais.

DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '276: kanban Funil Step One não encontrado; pulando.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND (
        slug IN ('onboarding', 'stepone_onboarding')
        OR nome = 'Onboarding'
      )
  ) THEN
    RAISE NOTICE '276: fase Onboarding já existe; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id
    AND COALESCE(ativo, true) = true;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes)
  VALUES (
    v_kanban_id,
    'Onboarding',
    'onboarding',
    1,
    1,
    true,
    $instr$
<p>Bem-vindo ao Funil Step One. Conclua os itens desta fase antes de avançar para <strong>Dados do Candidato</strong>.</p>
$instr$
  );
END;
$$;
