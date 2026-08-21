-- 304: Funil Step One — fase «Configurador de casas» após Pré Batalha.
-- Sequência após Lotes: Pré Batalha → Configurador de casas → BCA → Escolha → Hipóteses.

DO $$
DECLARE
  v_kanban_id UUID;
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
    RAISE NOTICE '304: kanban Funil Step One não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT MIN(ordem)
  INTO v_ordem_lotes
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('lotes_disponiveis', 'stepone_lotes')
    AND COALESCE(ativo, true) = true;

  IF v_ordem_lotes IS NULL THEN
    RAISE NOTICE '304: fase Lotes Disponíveis não encontrada; pulando.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug IN ('configurador_casas', 'stepone_configurador_casas')
  ) THEN
    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
    VALUES (
      v_kanban_id,
      'Configurador de casas',
      'configurador_casas',
      v_ordem_lotes + 2,
      1,
      true,
      $instr$
Com os modelos ranqueados na Pré Batalha, abra o Configurador de Casas para cada candidato:
1. Selecione o modelo Moní no catálogo
2. Configure opcionais, acabamentos e pacotes
3. Gere o PDF e registre o custo de construção para o BCA
Acesse: https://moni-configurador.vercel.app (senha: FKMONI)
$instr$,
      '[{"tipo":"link","titulo":"Abrir configurador","url":"https://moni-configurador.vercel.app"}]'::jsonb
    );
  ELSE
    UPDATE public.kanban_fases
    SET
      nome = 'Configurador de casas',
      ativo = true,
      sla_dias = 1,
      instrucoes = $instr$
Com os modelos ranqueados na Pré Batalha, abra o Configurador de Casas para cada candidato:
1. Selecione o modelo Moní no catálogo
2. Configure opcionais, acabamentos e pacotes
3. Gere o PDF e registre o custo de construção para o BCA
Acesse: https://moni-configurador.vercel.app (senha: FKMONI)
$instr$,
      materiais = COALESCE(
        materiais,
        '[{"tipo":"link","titulo":"Abrir configurador","url":"https://moni-configurador.vercel.app"}]'::jsonb
      )
    WHERE kanban_id = v_kanban_id
      AND slug IN ('configurador_casas', 'stepone_configurador_casas');
  END IF;

  UPDATE public.kanban_fases
  SET ordem = CASE slug
    WHEN 'batalha' THEN v_ordem_lotes + 1
    WHEN 'stepone_batalha' THEN v_ordem_lotes + 1
    WHEN 'configurador_casas' THEN v_ordem_lotes + 2
    WHEN 'stepone_configurador_casas' THEN v_ordem_lotes + 2
    WHEN 'bca' THEN v_ordem_lotes + 3
    WHEN 'stepone_bca' THEN v_ordem_lotes + 3
    WHEN 'bca_batalha_casas' THEN v_ordem_lotes + 3
    WHEN 'escolha' THEN v_ordem_lotes + 4
    WHEN 'stepone_escolha' THEN v_ordem_lotes + 4
    WHEN 'hipoteses' THEN v_ordem_lotes + 5
    WHEN 'stepone_hipoteses' THEN v_ordem_lotes + 5
    ELSE ordem
  END
  WHERE kanban_id = v_kanban_id
    AND slug IN (
      'batalha',
      'stepone_batalha',
      'configurador_casas',
      'stepone_configurador_casas',
      'bca',
      'stepone_bca',
      'bca_batalha_casas',
      'escolha',
      'stepone_escolha',
      'hipoteses',
      'stepone_hipoteses'
    )
    AND COALESCE(ativo, true) = true;
END;
$$;
