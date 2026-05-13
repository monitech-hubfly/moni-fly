-- Campos adicionais do formulário Novo Step 1: datas (COF, contrato, expiração), telefone, CPF, data nasc. do franqueado.
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS data_ass_cof DATE,
  ADD COLUMN IF NOT EXISTS data_ass_contrato DATE,
  ADD COLUMN IF NOT EXISTS data_expiracao_franquia DATE,
  ADD COLUMN IF NOT EXISTS telefone_frank TEXT,
  ADD COLUMN IF NOT EXISTS cpf_frank TEXT,
  ADD COLUMN IF NOT EXISTS data_nasc_frank DATE;

COMMENT ON COLUMN public.processo_step_one.data_ass_cof IS 'Data de Assinatura COF (formulário Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.data_ass_contrato IS 'Data de Assinatura do Contrato (formulário Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.data_expiracao_franquia IS 'Data de Expiração da Franquia (geralmente Data Ass. Contrato + 5 anos).';
COMMENT ON COLUMN public.processo_step_one.telefone_frank IS 'Telefone do franqueado (formulário Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.cpf_frank IS 'CPF do franqueado (formulário Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.data_nasc_frank IS 'Data de nascimento do franqueado (formulário Novo Step 1).';

-- Atualizar trigger para copiar para rede_franqueados
CREATE OR REPLACE FUNCTION public.inserir_rede_franqueados_ao_criar_step1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proxima_ordem INT;
BEGIN
  IF NEW.origem_rede_franqueados_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
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
    telefone_frank,
    cpf_frank,
    data_nasc_frank,
    data_ass_cof,
    data_ass_contrato,
    data_expiracao_franquia,
    tamanho_camisa_frank,
    socios,
    endereco_casa_frank,
    cep_casa_frank,
    estado_casa_frank,
    cidade_casa_frank
  ) VALUES (
    proxima_ordem,
    NULLIF(TRIM(NEW.numero_franquia), ''),
    NULLIF(TRIM(NEW.nome_franqueado), ''),
    NULLIF(TRIM(NEW.status_franquia), ''),
    NULLIF(TRIM(NEW.classificacao_franqueado), ''),
    NULLIF(TRIM(NEW.area_atuacao_franquia), ''),
    NULLIF(TRIM(NEW.email_franqueado), ''),
    NULLIF(TRIM(NEW.telefone_frank), ''),
    NULLIF(TRIM(NEW.cpf_frank), ''),
    NEW.data_nasc_frank,
    NEW.data_ass_cof,
    NEW.data_ass_contrato,
    NEW.data_expiracao_franquia,
    NULLIF(TRIM(NEW.tamanho_camiseta_frank), ''),
    NULLIF(TRIM(NEW.socios), ''),
    NULLIF(TRIM(NEW.endereco_casa_frank), ''),
    NULLIF(TRIM(NEW.cep_casa_frank), ''),
    NULLIF(TRIM(NEW.estado_casa_frank), ''),
    NULLIF(TRIM(NEW.cidade_casa_frank), '')
  );

  RETURN NEW;
END;
$$;
