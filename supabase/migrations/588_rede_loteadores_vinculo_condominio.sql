-- 588: Loteador vincula um condomínio do cadastro central.
-- Não apaga os campos antigos de condomínio/carteira.

ALTER TABLE public.rede_loteadores
  ADD COLUMN IF NOT EXISTS condominio_id uuid REFERENCES public.condominios (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rede_loteadores_condominio_id
  ON public.rede_loteadores (condominio_id);

COMMENT ON COLUMN public.rede_loteadores.condominio_id IS
  'Condomínio vinculado no Cadastro de Condomínios.';

UPDATE public.rede_loteadores l
SET condominio_id = c.id
FROM public.condominios c
WHERE l.condominio_id IS NULL
  AND NULLIF(trim(coalesce(l.condominio_nome, '')), '') IS NOT NULL
  AND lower(trim(l.condominio_nome)) = lower(trim(c.nome));

NOTIFY pgrst, 'reload schema';
