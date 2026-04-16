-- ─── 106: Trigger — criar card no Funil Step One ao inserir franqueado ────────
-- Dispara AFTER INSERT em rede_franqueados.
-- Busca o kanban "Funil Step One" e a fase "Dados da Cidade" dinamicamente.
-- Título do card: n_franquia - cidade_casa_frank - area_atuacao (partes nulas omitidas).
-- franqueado_id = auth.uid() (quem inseriu); se NULL (backend/service role) pula criação.
-- Tratamento de erro via EXCEPTION: falhas nunca bloqueiam o INSERT do franqueado.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ─── 1. Função do trigger ─────────────────────────────────────────────────────
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
  -- ── Usuário que disparou o INSERT ──────────────────────────────────────────
  -- auth.uid() retorna NULL quando chamado via service role (backend).
  -- Neste caso não temos um dono válido para o card; pulamos silenciosamente.
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- ── Localiza o kanban "Funil Step One" ────────────────────────────────────
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND ativo = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RETURN NEW; -- kanban inexistente: não bloqueia
  END IF;

  -- ── Localiza a fase "Dados da Cidade" (fase 1) ───────────────────────────
  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND nome = 'Dados da Cidade'
    AND ativo = true
  LIMIT 1;

  -- Fallback: se a fase não existir pelo nome, pega a primeira fase ativa
  IF v_fase_id IS NULL THEN
    SELECT id INTO v_fase_id
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND ativo = true
    ORDER BY ordem ASC
    LIMIT 1;
  END IF;

  IF v_fase_id IS NULL THEN
    RETURN NEW; -- nenhuma fase disponível: não bloqueia
  END IF;

  -- ── Monta o título: FK0001 - Cidade - Área ─────────────────────────────────
  -- CONCAT_WS ignora NULLs automaticamente; convertemos strings vazias em NULL
  -- para que partes ausentes não gerem " -  - " no título.
  v_titulo := CONCAT_WS(
    ' - ',
    NULLIF(TRIM(COALESCE(NEW.n_franquia,        '')), ''),
    NULLIF(TRIM(COALESCE(NEW.cidade_casa_frank,  '')), ''),
    NULLIF(TRIM(COALESCE(NEW.area_atuacao,       '')), '')
  );

  -- Se todos os três campos estavam vazios, usa fallback legível
  IF v_titulo IS NULL OR v_titulo = '' THEN
    v_titulo := 'Novo Franqueado';
  END IF;

  -- ── Insere o card ─────────────────────────────────────────────────────────
  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status)
  VALUES (v_kanban_id, v_fase_id, v_user_id, v_titulo, 'ativo');

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Qualquer erro inesperado (FK violada, lock timeout, etc.) não deve
    -- impedir o INSERT principal na rede_franqueados.
    RAISE WARNING 'fn_criar_card_funil_ao_inserir_franqueado: erro ignorado — %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado() IS
  'Cria automaticamente um card no kanban "Funil Step One" / fase "Dados da Cidade" '
  'sempre que um novo franqueado é inserido em rede_franqueados. '
  'Título: n_franquia - cidade_casa_frank - area_atuacao. '
  'Sem auth.uid() (backend/service role) ou sem kanban/fase cadastrado, pula silenciosamente.';

-- ─── 2. Trigger ───────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_rede_franqueados_criar_card_funil ON public.rede_franqueados;

CREATE TRIGGER trg_rede_franqueados_criar_card_funil
  AFTER INSERT ON public.rede_franqueados
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado();

COMMENT ON TRIGGER trg_rede_franqueados_criar_card_funil ON public.rede_franqueados IS
  'Após INSERT em rede_franqueados: cria card no Funil Step One (fase Dados da Cidade).';
