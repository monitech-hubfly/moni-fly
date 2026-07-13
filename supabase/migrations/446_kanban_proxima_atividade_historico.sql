-- 445/446: Histórico de próximas atividades concluídas em kanban_cards
-- Registra o que foi zerado via "Marcar como concluída" no ProximaAtividadeDot,
-- permitindo exibir histórico de atividades já fechadas por card.

CREATE TABLE IF NOT EXISTS kanban_proxima_atividade_historico (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       uuid        NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  descricao     text        NOT NULL,
  prazo_original date       NULL,
  concluido_em  timestamptz NOT NULL DEFAULT now(),
  concluido_por uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_kpah_card_id
  ON kanban_proxima_atividade_historico(card_id);

NOTIFY pgrst, 'reload schema';
