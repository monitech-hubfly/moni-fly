-- Campos do formulário Novo Step 1 (imagens: franquia, modalidade, responsável, sócios, etc.)
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS numero_franquia TEXT,
  ADD COLUMN IF NOT EXISTS modalidade TEXT,
  ADD COLUMN IF NOT EXISTS status_franquia TEXT,
  ADD COLUMN IF NOT EXISTS classificacao_franqueado TEXT,
  ADD COLUMN IF NOT EXISTS area_atuacao_franquia TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_comercial TEXT,
  ADD COLUMN IF NOT EXISTS tamanho_camiseta_frank TEXT,
  ADD COLUMN IF NOT EXISTS socios TEXT;

COMMENT ON COLUMN public.processo_step_one.numero_franquia IS 'Nº de franquia (formulário Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.modalidade IS 'Modalidade (formulário Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.status_franquia IS 'Status da Franquia (formulário Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.classificacao_franqueado IS 'Classificação do Franqueado (formulário Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.area_atuacao_franquia IS 'Área de Atuação da Franquia (formulário Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.responsavel_comercial IS 'Responsável Comercial (formulário Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.tamanho_camiseta_frank IS 'Tamanho da Camiseta do Frank (formulário Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.socios IS 'Sócios: Nome, Nascimento, Telefone, E-mail, CPF, Endereço Completo, Tamanho etc. (formulário Novo Step 1).';
