-- 242: Funil Step One — slugs, ordem e SLAs alinhados ao PROD (11 fases)
-- Idempotente: PROD já tem slugs canónicos; DEV/staging com legado são normalizados.

DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
     OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  ORDER BY CASE WHEN id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '242: kanban Funil Step One não encontrado; pulando.';
    RETURN;
  END IF;

  -- BCA (fase_id PROD; slug legado bca_batalha_casas / stepone_bca)
  UPDATE public.kanban_fases
  SET slug = 'bca',
      nome = CASE
        WHEN TRIM(nome) IN ('BCA + Batalha de Casas', 'BCA + Batalha') THEN 'BCA'
        ELSE nome
      END,
      ordem = 9,
      sla_dias = 1
  WHERE kanban_id = v_kanban_id
    AND (
      id = '8fda525c-720d-4db7-821d-52625867a000'::uuid
      OR slug IN ('bca_batalha_casas', 'stepone_bca')
      OR nome = 'BCA + Batalha de Casas'
    );

  UPDATE public.kanban_fases SET slug = 'dados_candidato', ordem = 1, sla_dias = 1
    WHERE kanban_id = v_kanban_id AND nome = 'Dados do Candidato' AND COALESCE(ativo, true) = true;

  UPDATE public.kanban_fases SET slug = 'dados_cidade', ordem = 2, sla_dias = 1
    WHERE kanban_id = v_kanban_id AND nome = 'Dados da Cidade' AND COALESCE(ativo, true) = true;

  UPDATE public.kanban_fases
  SET slug = 'lista_condominios', ordem = 3, sla_dias = 1, nome = 'Condomínios'
  WHERE kanban_id = v_kanban_id
    AND nome IN ('Lista de Condomínios', 'Condomínios')
    AND COALESCE(ativo, true) = true;

  UPDATE public.kanban_fases SET slug = 'dados_condominios', ordem = 4, sla_dias = 3
    WHERE kanban_id = v_kanban_id AND nome = 'Dados dos Condomínios' AND COALESCE(ativo, true) = true;

  UPDATE public.kanban_fases SET slug = 'lotes_disponiveis', ordem = 5, sla_dias = 1
    WHERE kanban_id = v_kanban_id AND nome = 'Lotes disponíveis' AND COALESCE(ativo, true) = true;

  UPDATE public.kanban_fases SET slug = 'mapa_competidores', ordem = 6, sla_dias = 3
    WHERE kanban_id = v_kanban_id AND nome = 'Mapa de Competidores' AND COALESCE(ativo, true) = true;

  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'pre_batalha'
  ) THEN
    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
    VALUES (v_kanban_id, 'Pré-Batalha', 'pre_batalha', 7, 1, true);
  ELSE
    UPDATE public.kanban_fases
    SET ordem = 7, sla_dias = 1, nome = 'Pré-Batalha', ativo = true
    WHERE kanban_id = v_kanban_id AND slug = 'pre_batalha';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'escolha'
  ) THEN
    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
    VALUES (v_kanban_id, 'Escolha', 'escolha', 8, 1, true);
  ELSE
    UPDATE public.kanban_fases
    SET ordem = 8, sla_dias = 1, nome = 'Escolha', ativo = true
    WHERE kanban_id = v_kanban_id AND slug = 'escolha';
  END IF;

  UPDATE public.kanban_fases
  SET ordem = 9, sla_dias = 1
  WHERE kanban_id = v_kanban_id AND slug = 'bca' AND COALESCE(ativo, true) = true;

  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'batalha'
  ) THEN
    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
    VALUES (v_kanban_id, 'Batalha', 'batalha', 10, 1, true);
  ELSE
    UPDATE public.kanban_fases
    SET ordem = 10, sla_dias = 1, nome = 'Batalha', ativo = true
    WHERE kanban_id = v_kanban_id AND slug = 'batalha';
  END IF;

  UPDATE public.kanban_fases
  SET slug = 'hipoteses', ordem = 11, sla_dias = 1
  WHERE kanban_id = v_kanban_id
    AND (
      id = 'bf21d44c-e1d3-49cc-861d-7b39356e0bb8'::uuid
      OR nome = 'Hipóteses'
      OR slug IN ('stepone_hipoteses', 'hipoteses')
    )
    AND COALESCE(ativo, true) = true;

END;
$$;
