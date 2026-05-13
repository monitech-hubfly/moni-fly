-- Ao criar um processo pelo formulário Novo Step 1, criar também uma linha na rede de franqueados.
-- Função executada como definer para poder inserir mesmo com RLS (apenas admin podia inserir).

CREATE OR REPLACE FUNCTION public.inserir_rede_franqueados_ao_criar_step1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proxima_ordem INT;
BEGIN
  -- Só prosseguir se for processo criado na etapa Step 1 e tiver dados do formulário Step 1
  IF NEW.etapa_painel IS DISTINCT FROM 'step_1' THEN
    RETURN NEW;
  END IF;
  IF NEW.numero_franquia IS NULL AND NEW.nome_franqueado IS NULL AND NEW.email_franqueado IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO proxima_ordem FROM public.rede_franqueados;

  INSERT INTO public.rede_franqueados (
    ordem,
    n_franquia,
    nome_completo,
    status_franquia,
    classificacao_franqueado,
    area_atuacao,
    email_frank,
    tamanho_camisa_frank,
    socios
  ) VALUES (
    proxima_ordem,
    NULLIF(TRIM(NEW.numero_franquia), ''),
    NULLIF(TRIM(NEW.nome_franqueado), ''),
    NULLIF(TRIM(NEW.status_franquia), ''),
    NULLIF(TRIM(NEW.classificacao_franqueado), ''),
    NULLIF(TRIM(NEW.area_atuacao_franquia), ''),
    NULLIF(TRIM(NEW.email_franqueado), ''),
    NULLIF(TRIM(NEW.tamanho_camiseta_frank), ''),
    NULLIF(TRIM(NEW.socios), '')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_processo_step_one_inserir_rede ON public.processo_step_one;
CREATE TRIGGER trg_processo_step_one_inserir_rede
  AFTER INSERT ON public.processo_step_one
  FOR EACH ROW
  EXECUTE PROCEDURE public.inserir_rede_franqueados_ao_criar_step1();

COMMENT ON FUNCTION public.inserir_rede_franqueados_ao_criar_step1() IS 'Ao inserir processo com etapa_painel=step_1 e dados do formulário, cria linha na rede_franqueados.';
