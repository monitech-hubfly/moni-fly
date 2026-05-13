-- Novos campos na tabela Rede de Franqueados (cabeçalho conforme especificado)
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS n_franquia TEXT,
  ADD COLUMN IF NOT EXISTS nome_completo TEXT,
  ADD COLUMN IF NOT EXISTS status_franquia TEXT,
  ADD COLUMN IF NOT EXISTS classificacao_franqueado TEXT,
  ADD COLUMN IF NOT EXISTS data_ass_cof DATE,
  ADD COLUMN IF NOT EXISTS data_ass_contrato DATE,
  ADD COLUMN IF NOT EXISTS data_expiracao_franquia DATE,
  ADD COLUMN IF NOT EXISTS regional TEXT,
  ADD COLUMN IF NOT EXISTS area_atuacao TEXT,
  ADD COLUMN IF NOT EXISTS email_frank TEXT,
  ADD COLUMN IF NOT EXISTS telefone_frank TEXT,
  ADD COLUMN IF NOT EXISTS cpf_frank TEXT,
  ADD COLUMN IF NOT EXISTS data_nasc_frank DATE,
  ADD COLUMN IF NOT EXISTS endereco_casa_frank TEXT,
  ADD COLUMN IF NOT EXISTS cep_casa_frank TEXT,
  ADD COLUMN IF NOT EXISTS estado_casa_frank TEXT,
  ADD COLUMN IF NOT EXISTS cidade_casa_frank TEXT,
  ADD COLUMN IF NOT EXISTS tamanho_camisa_frank TEXT,
  ADD COLUMN IF NOT EXISTS socios TEXT;

-- Remover colunas antigas (se existirem)
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS nome;
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS unidade;
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS cidade;
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS estado;
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS email;
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS telefone;
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS observacoes;

COMMENT ON COLUMN public.rede_franqueados.socios IS 'Sócios: Nome, Nascimento, Telefone, E-mail, CPF, Endereço Completo, Tamanho da camisa';
