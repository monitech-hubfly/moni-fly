-- 248: Remove fase "Condomínios" (lista_condominios) do Funil Step One.
-- Fluxo passa a ser Dados da Cidade → Dados dos Condomínios (10 fases).
-- Campos de condomínio vivem em `condominios` + seção "Dados do Condomínio" no card.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_lista_id UUID;
  v_fase_cidade_id UUID;
  v_fase_dados_cond_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
     OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  ORDER BY CASE WHEN id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '248: kanban Funil Step One não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_lista_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('lista_condominios', 'stepone_lista_cond')
  ORDER BY CASE WHEN slug = 'lista_condominios' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT id INTO v_fase_cidade_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('dados_cidade', 'stepone_dados_cidade')
  ORDER BY CASE WHEN slug = 'dados_cidade' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT id INTO v_fase_dados_cond_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('dados_condominios', 'stepone_dados_cond')
  ORDER BY CASE WHEN slug = 'dados_condominios' THEN 0 ELSE 1 END
  LIMIT 1;

  -- Checklist da fase Condomínios (legado)
  IF v_fase_lista_id IS NOT NULL THEN
    DELETE FROM public.kanban_fase_checklist_respostas r
    USING public.kanban_fase_checklist_itens i
    WHERE r.item_id = i.id
      AND i.fase_id = v_fase_lista_id;

    DELETE FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_lista_id;

    UPDATE public.kanban_fases
    SET instrucoes = NULL
    WHERE id = v_fase_lista_id;
  END IF;

  -- Checklist duplicado em Dados dos Condomínios (dados vivem em `condominios`)
  IF v_fase_dados_cond_id IS NOT NULL THEN
    DELETE FROM public.kanban_fase_checklist_respostas r
    USING public.kanban_fase_checklist_itens i
    WHERE r.item_id = i.id
      AND i.fase_id = v_fase_dados_cond_id
      AND i.label IN (
        'Nome do condomínio',
        'CNPJ do condomínio',
        'Área total do terreno m²',
        'Área disponível para construção m²',
        'Documentação regularizada',
        'Observações'
      );

    DELETE FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_dados_cond_id
      AND label IN (
        'Nome do condomínio',
        'CNPJ do condomínio',
        'Área total do terreno m²',
        'Área disponível para construção m²',
        'Documentação regularizada',
        'Observações'
      );
  END IF;

  -- Cards nativos: realoca antes de desativar a fase
  IF v_fase_lista_id IS NOT NULL AND v_fase_cidade_id IS NOT NULL AND v_fase_dados_cond_id IS NOT NULL THEN
    UPDATE public.kanban_cards c
    SET fase_id = v_fase_cidade_id,
        updated_at = now()
    WHERE c.fase_id = v_fase_lista_id
      AND COALESCE(TRIM(c.condominio_id::text), '') = '';

    UPDATE public.kanban_cards c
    SET fase_id = v_fase_dados_cond_id,
        updated_at = now()
    WHERE c.fase_id = v_fase_lista_id
      AND COALESCE(TRIM(c.condominio_id::text), '') <> '';
  ELSIF v_fase_lista_id IS NOT NULL AND v_fase_dados_cond_id IS NOT NULL THEN
    UPDATE public.kanban_cards c
    SET fase_id = v_fase_dados_cond_id,
        updated_at = now()
    WHERE c.fase_id = v_fase_lista_id;
  END IF;

  -- Legado processo_step_one (etapa_painel)
  UPDATE public.processo_step_one p
  SET etapa_painel = 'dados_cidade',
      updated_at = now()
  WHERE p.etapa_painel IN ('lista_condominios', 'stepone_lista_cond')
    AND COALESCE(TRIM(p.condominio_id::text), '') = '';

  UPDATE public.processo_step_one p
  SET etapa_painel = 'dados_condominios',
      updated_at = now()
  WHERE p.etapa_painel IN ('lista_condominios', 'stepone_lista_cond')
    AND COALESCE(TRIM(p.condominio_id::text), '') <> '';

  -- Desativa fase Condomínios (não deleta — cards órfãos ainda resolvem via augment)
  IF v_fase_lista_id IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET ativo = false,
        instrucoes = NULL
    WHERE id = v_fase_lista_id;
  END IF;

  -- Renumera fases ativas: 11 → 10 colunas
  UPDATE public.kanban_fases
  SET ordem = CASE slug
    WHEN 'dados_candidato' THEN 1
    WHEN 'stepone_dados_candidato' THEN 1
    WHEN 'dados_cidade' THEN 2
    WHEN 'stepone_dados_cidade' THEN 2
    WHEN 'dados_condominios' THEN 3
    WHEN 'stepone_dados_cond' THEN 3
    WHEN 'lotes_disponiveis' THEN 4
    WHEN 'stepone_lotes' THEN 4
    WHEN 'mapa_competidores' THEN 5
    WHEN 'stepone_mapa' THEN 5
    WHEN 'pre_batalha' THEN 6
    WHEN 'escolha' THEN 7
    WHEN 'bca' THEN 8
    WHEN 'stepone_bca' THEN 8
    WHEN 'bca_batalha_casas' THEN 8
    WHEN 'batalha' THEN 9
    WHEN 'stepone_batalha' THEN 9
    WHEN 'hipoteses' THEN 10
    WHEN 'stepone_hipoteses' THEN 10
    ELSE ordem
  END,
  slug = CASE slug
    WHEN 'stepone_dados_candidato' THEN 'dados_candidato'
    WHEN 'stepone_dados_cidade' THEN 'dados_cidade'
    WHEN 'stepone_dados_cond' THEN 'dados_condominios'
    WHEN 'stepone_lotes' THEN 'lotes_disponiveis'
    WHEN 'stepone_mapa' THEN 'mapa_competidores'
    WHEN 'stepone_bca' THEN 'bca'
    WHEN 'bca_batalha_casas' THEN 'bca'
    WHEN 'stepone_batalha' THEN 'batalha'
    WHEN 'stepone_hipoteses' THEN 'hipoteses'
    ELSE slug
  END
  WHERE kanban_id = v_kanban_id
    AND COALESCE(ativo, true) = true
    AND slug NOT IN ('lista_condominios', 'stepone_lista_cond');

  -- Instruções da fase Dados dos Condomínios
  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Vincule o condomínio ao card em "Dados do Condomínio" (painel esquerdo do modal).
Os campos (nome, endereço, tickets, giro e extrato) vêm do cadastro em Rede → Condomínios
e podem ser editados ali pelo time administrativo.
$instr$
  WHERE kanban_id = v_kanban_id
    AND slug = 'dados_condominios'
    AND COALESCE(ativo, true) = true;

END;
$$;
