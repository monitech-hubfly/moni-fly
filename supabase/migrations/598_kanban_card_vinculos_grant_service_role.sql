-- O bastão grava kanban_card_vinculos com o client admin (service_role).
-- PROD já tinha o GRANT. DEV não tinha, e o insert falhava antes da tag.
-- Idempotente. Não altera dados.

GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON TABLE public.kanban_card_vinculos
  TO service_role;
