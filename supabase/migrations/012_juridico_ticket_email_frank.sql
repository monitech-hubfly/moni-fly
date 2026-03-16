-- E-mail do franqueado no ticket para envio de alertas por e-mail quando o status mudar

ALTER TABLE public.juridico_tickets
  ADD COLUMN IF NOT EXISTS email_frank TEXT;

COMMENT ON COLUMN public.juridico_tickets.email_frank IS 'E-mail do franqueado (preenchido na criação) para envio de notificações de mudança de status';
