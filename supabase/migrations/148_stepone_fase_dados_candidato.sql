-- Funil Step One: nova fase "Dados do Candidato" antes de "Dados da Cidade".
-- Idempotente:
--   - Se já existir "Dados do Candidato", não altera nada.
--   - Se existir o nome antigo de teste "Descrição do Candidato", renomeia para "Dados do Candidato" e ajusta o slug.
--   - Caso contrário: incrementa ordem das fases ativas e insere a nova fase em ordem 1.

DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND ativo = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '148_stepone_fase_dados_candidato: kanban Funil Step One não encontrado; pulando.';
  ELSIF EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND nome = 'Dados do Candidato'
  ) THEN
    RAISE NOTICE '148_stepone_fase_dados_candidato: fase já existe; pulando.';
  ELSIF EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND nome = 'Descrição do Candidato'
  ) THEN
    UPDATE public.kanban_fases
    SET
      nome = 'Dados do Candidato',
      slug = 'stepone_dados_candidato'
    WHERE kanban_id = v_kanban_id
      AND nome = 'Descrição do Candidato';
  ELSE
    UPDATE public.kanban_fases
    SET ordem = ordem + 1
    WHERE kanban_id = v_kanban_id
      AND ativo = true;

    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
    VALUES (
      v_kanban_id,
      'Dados do Candidato',
      'stepone_dados_candidato',
      1,
      7,
      true
    );
  END IF;
END;
$$;

-- Cards automáticos ao inserir franqueado: primeira fase ativa (menor ordem).
CREATE OR REPLACE FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kanban_id  UUID;
  v_fase_id    UUID;
  v_titulo     TEXT;
  v_user_id    UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND ativo = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND ativo = true
  ORDER BY ordem ASC
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_titulo := CONCAT_WS(
    ' - ',
    NULLIF(TRIM(COALESCE(NEW.n_franquia,        '')), ''),
    NULLIF(TRIM(COALESCE(NEW.cidade_casa_frank,  '')), ''),
    NULLIF(TRIM(COALESCE(NEW.area_atuacao,       '')), '')
  );

  IF v_titulo IS NULL OR v_titulo = '' THEN
    v_titulo := 'Novo Franqueado';
  END IF;

  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status)
  VALUES (v_kanban_id, v_fase_id, v_user_id, v_titulo, 'ativo');

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_criar_card_funil_ao_inserir_franqueado: erro ignorado — %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado() IS
  'Cria automaticamente um card no kanban "Funil Step One" na primeira fase ativa (menor ordem) '
  'sempre que um novo franqueado é inserido em rede_franqueados. '
  'Título: n_franquia - cidade_casa_frank - area_atuacao. '
  'Sem auth.uid() (backend/service role) ou sem kanban/fase cadastrado, pula silenciosamente.';
