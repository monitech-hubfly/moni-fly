-- 151: Colunas de e-mail e controle de cobrança em kanban_card_form_tokens

ALTER TABLE public.kanban_card_form_tokens
  ADD COLUMN IF NOT EXISTS email_candidato     TEXT,
  ADD COLUMN IF NOT EXISTS nome_candidato      TEXT,
  ADD COLUMN IF NOT EXISTS cobranca_enviada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cobrancas_enviadas  INTEGER DEFAULT 0;
