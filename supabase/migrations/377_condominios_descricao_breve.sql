-- Descrição breve do condomínio (Dados da Cidade + Cadastro Rede).

ALTER TABLE public.condominios
  ADD COLUMN IF NOT EXISTS descricao_breve TEXT;

COMMENT ON COLUMN public.condominios.descricao_breve IS
  'Resumo curto do condomínio para tabela Dados da Cidade e cadastro Rede.';
