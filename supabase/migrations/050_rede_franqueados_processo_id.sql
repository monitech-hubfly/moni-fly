-- Vincular rede_franqueados ao card (processo) criado no Painel.
-- Quando um processo é criado A PARTIR de uma linha da rede, não duplicar a linha (trigger não insere).

-- 1) Coluna na rede: qual processo/card foi criado para esta linha
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS processo_id UUID REFERENCES public.processo_step_one(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.rede_franqueados.processo_id IS 'Processo (card) criado no Painel Novos Negócios a partir desta linha. Preenchido ao rodar "Criar cards a partir da tabela".';

-- 2) Coluna no processo: indica que o card veio de uma linha da rede (trigger não cria nova linha)
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS origem_rede_franqueados_id UUID REFERENCES public.rede_franqueados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.processo_step_one.origem_rede_franqueados_id IS 'Se preenchido, o processo foi criado a partir desta linha da rede; o trigger não deve criar nova linha em rede_franqueados.';

-- 3) Trigger: não inserir em rede_franqueados quando o processo já veio da rede
CREATE OR REPLACE FUNCTION public.inserir_rede_franqueados_ao_criar_step1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proxima_ordem INT;
BEGIN
  -- Não criar linha se o processo foi criado a partir de uma linha da rede
  IF NEW.origem_rede_franqueados_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
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
