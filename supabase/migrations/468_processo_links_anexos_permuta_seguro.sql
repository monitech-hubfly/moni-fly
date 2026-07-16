-- Links opcionais ao lado dos anexos: Opção/Contrato de Permuta ou CCV e Seguro garantia.
-- Não altera anexos existentes; colunas novas nullable.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS link_opcao_permuta TEXT,
  ADD COLUMN IF NOT EXISTS link_contrato_permuta TEXT,
  ADD COLUMN IF NOT EXISTS link_seguro_garantia TEXT;

COMMENT ON COLUMN public.processo_step_one.link_opcao_permuta IS
  'Link opcional (URL) — opção de permuta ou CCV (ao lado do anexo).';
COMMENT ON COLUMN public.processo_step_one.link_contrato_permuta IS
  'Link opcional (URL) — contrato de permuta ou CCV (ao lado do anexo).';
COMMENT ON COLUMN public.processo_step_one.link_seguro_garantia IS
  'Link opcional (URL) — seguro garantia (ao lado do anexo).';

NOTIFY pgrst, 'reload schema';
