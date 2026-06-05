-- 258: Tabela de Condomínios pertence à fase Dados da Cidade (cadastro + prospects).
-- Garante placeholder correto e remove itens legados da fase Dados dos Condomínios (255).

DO $$
DECLARE
  v_fase_cidade_id UUID;
  v_fase_cond_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_cidade_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('dados_cidade', 'stepone_dados_cidade')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'dados_cidade' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT f.id
  INTO v_fase_cond_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('dados_condominios', 'stepone_dados_cond')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'dados_condominios' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_cidade_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET placeholder = $ph$
Selecione condomínios do cadastro (Rede → Condomínios) ou cadastre novos. Preencha tickets e estimativa de giro; confirme ou atualize o cadastro em cada linha.
$ph$
    WHERE fase_id = v_fase_cidade_id
      AND label = 'Tabela de Condomínios';

    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
    SELECT
      v_fase_cidade_id,
      10,
      'Tabela de Condomínios',
      'tabela',
      true,
      true,
      $ph$
Selecione condomínios do cadastro (Rede → Condomínios) ou cadastre novos. Preencha tickets e estimativa de giro; confirme ou atualize o cadastro em cada linha.
$ph$
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = v_fase_cidade_id AND i.label = 'Tabela de Condomínios'
    );
  ELSE
    RAISE NOTICE '258: fase dados_cidade não encontrada; pulando tabela.';
  END IF;

  -- Remove itens da 255 que não pertencem a Dados dos Condomínios (cadastro/tabela).
  IF v_fase_cond_id IS NOT NULL THEN
    DELETE FROM public.kanban_fase_checklist_respostas r
    USING public.kanban_fase_checklist_itens i
    WHERE r.item_id = i.id
      AND i.fase_id = v_fase_cond_id
      AND i.label IN ('Condomínio do cadastro', 'Dados do cadastro', 'Tabela de Condomínios');

    DELETE FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_cond_id
      AND label IN ('Condomínio do cadastro', 'Dados do cadastro', 'Tabela de Condomínios');
  END IF;
END;
$$;
