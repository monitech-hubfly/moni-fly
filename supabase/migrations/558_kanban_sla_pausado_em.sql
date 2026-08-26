-- Coluna para congelar SLA quando há chamado Sirene com trava ativa no card.
-- Setada quando sirene_chamados.trava=true é criado para o card.
-- Limpa (com sla_iniciado_em=NOW()) quando último chamado com trava é resolvido.
ALTER TABLE kanban_cards
  ADD COLUMN IF NOT EXISTS sla_pausado_em TIMESTAMPTZ DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
