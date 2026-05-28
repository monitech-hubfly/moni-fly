-- Migration 210: colunas de bastão de retorno em kanban_cards
-- Todas as colunas já existem no PROD — IF NOT EXISTS garante idempotência

ALTER TABLE kanban_cards
  ADD COLUMN IF NOT EXISTS origem_card_id uuid REFERENCES kanban_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acoplamento_concluido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credito_terreno_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credito_obra_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contabilidade_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS juridico_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capital_ok boolean NOT NULL DEFAULT false;

-- Tipo de vínculo em kanban_card_vinculos
ALTER TABLE kanban_card_vinculos
  ADD COLUMN IF NOT EXISTS tipo_vinculo text NOT NULL DEFAULT 'relacionado'
    CHECK (tipo_vinculo IN ('relacionado','originou','depende_de','bloqueia','retornou')),
  ADD COLUMN IF NOT EXISTS kanban_origem_slug text,
  ADD COLUMN IF NOT EXISTS kanban_destino_slug text,
  ADD COLUMN IF NOT EXISTS fase_origem_slug text,
  ADD COLUMN IF NOT EXISTS fase_destino_slug text;

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_kanban_cards_origem_card_id
  ON kanban_cards(origem_card_id) WHERE origem_card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_projeto_id
  ON kanban_cards(projeto_id) WHERE projeto_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_card_vinculos_tipo
  ON kanban_card_vinculos(tipo_vinculo);
