-- 554: Garantir colunas de lead do Funil Corretores em kanban_cards.
-- Causa: KANBAN_CARD_SELECT_BASE referencia telefone_lead/email_lead/mensagem_lead;
-- se ausentes, o PostgREST falha o SELECT e TODOS os boards ficam vazios.
-- Idempotente (ADD COLUMN IF NOT EXISTS).

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS nome_corretor text,
  ADD COLUMN IF NOT EXISTS imobiliaria_corretor text,
  ADD COLUMN IF NOT EXISTS empreendimento_interesse text,
  ADD COLUMN IF NOT EXISTS tipologia_interesse text,
  ADD COLUMN IF NOT EXISTS orcamento_lead numeric(14,2),
  ADD COLUMN IF NOT EXISTS probabilidade_fechamento text,
  ADD COLUMN IF NOT EXISTS cidade_interesse text,
  ADD COLUMN IF NOT EXISTS telefone_lead text,
  ADD COLUMN IF NOT EXISTS email_lead text,
  ADD COLUMN IF NOT EXISTS mensagem_lead text;

COMMENT ON COLUMN public.kanban_cards.telefone_lead IS 'Funil Corretores — telefone do lead.';
COMMENT ON COLUMN public.kanban_cards.email_lead IS 'Funil Corretores — e-mail do lead.';
COMMENT ON COLUMN public.kanban_cards.mensagem_lead IS 'Funil Corretores — mensagem livre do formulário.';

NOTIFY pgrst, 'reload schema';
