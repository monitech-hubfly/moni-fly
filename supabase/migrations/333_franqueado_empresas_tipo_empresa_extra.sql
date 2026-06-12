-- Empresas adicionais (tipo `empresa`) — múltiplas por franqueado; FK0000.
-- Incorporadora e gestora continuam únicas por rede.

ALTER TABLE public.franqueado_empresas
  ADD COLUMN IF NOT EXISTS nome TEXT;

ALTER TABLE public.franqueado_empresas
  DROP CONSTRAINT IF EXISTS franqueado_empresas_tipo_check;

ALTER TABLE public.franqueado_empresas
  ADD CONSTRAINT franqueado_empresas_tipo_check
  CHECK (tipo IN ('incorporadora', 'gestora', 'empresa'));

ALTER TABLE public.franqueado_empresas
  DROP CONSTRAINT IF EXISTS franqueado_empresas_rede_franqueado_id_tipo_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_franqueado_empresas_rede_incorporadora
  ON public.franqueado_empresas (rede_franqueado_id)
  WHERE tipo = 'incorporadora';

CREATE UNIQUE INDEX IF NOT EXISTS idx_franqueado_empresas_rede_gestora
  ON public.franqueado_empresas (rede_franqueado_id)
  WHERE tipo = 'gestora';

COMMENT ON COLUMN public.franqueado_empresas.nome IS
  'Rótulo opcional para empresas adicionais (tipo empresa).';
