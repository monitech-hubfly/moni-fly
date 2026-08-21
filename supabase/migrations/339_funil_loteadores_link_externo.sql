-- 339: Funil Loteadores — link externo, auditoria ficha e colunas de compatibilidade.

ALTER TABLE public.rede_loteadores
  ADD COLUMN IF NOT EXISTS condominio_estado TEXT;

ALTER TABLE public.rede_loteadores
  ADD COLUMN IF NOT EXISTS ultima_atualizacao_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.rede_loteadores.condominio_estado IS
  'UF do condomínio prospectado (spec: estado). Fallback de leitura: coluna estado do loteador.';
COMMENT ON COLUMN public.rede_loteadores.ultima_atualizacao_por IS
  'Usuário que realizou a última alteração na ficha (Dados do Loteador).';

-- Compat: copia estado legado para condominio_estado quando vazio
UPDATE public.rede_loteadores
SET condominio_estado = estado
WHERE condominio_estado IS NULL
  AND estado IS NOT NULL
  AND btrim(estado) <> '';

CREATE TABLE IF NOT EXISTS public.kanban_loteador_externo_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  UNIQUE (card_id)
);

CREATE INDEX IF NOT EXISTS idx_loteador_externo_tokens_token
  ON public.kanban_loteador_externo_tokens (token);

CREATE INDEX IF NOT EXISTS idx_loteador_externo_tokens_card
  ON public.kanban_loteador_externo_tokens (card_id);

ALTER TABLE public.kanban_loteador_externo_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loteador_externo_tokens_select_interno" ON public.kanban_loteador_externo_tokens;
CREATE POLICY "loteador_externo_tokens_select_interno" ON public.kanban_loteador_externo_tokens
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "loteador_externo_tokens_insert_interno" ON public.kanban_loteador_externo_tokens;
CREATE POLICY "loteador_externo_tokens_insert_interno" ON public.kanban_loteador_externo_tokens
  FOR ALL USING (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_loteador_externo_tokens TO authenticated;

COMMENT ON TABLE public.kanban_loteador_externo_tokens IS
  'Token de link externo compartilhável para edição da ficha Dados do Loteador (rede.moni/loteador/{token}).';
