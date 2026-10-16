-- Fila de edições do franqueado aguardando aprovação do time.
-- bloco/status em TEXT + CHECK (mesmo padrão de kanban_atividades.tipo).
-- time_responsavel é o nome do catálogo em times-responsaveis.ts / kanban_times.nome, sem FK.

CREATE TABLE IF NOT EXISTS public.card_edicoes_pendentes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id           UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  bloco             TEXT NOT NULL CHECK (bloco IN ('condominio', 'negocio', 'empresas')),
  campo             TEXT NOT NULL,
  valor_antigo      TEXT,
  valor_novo        TEXT,
  status            TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  enviado_por       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  enviado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprovado_por      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  aprovado_em       TIMESTAMPTZ,
  motivo_rejeicao   TEXT,
  time_responsavel  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_card_edicoes_pendentes_card
  ON public.card_edicoes_pendentes (card_id);

CREATE INDEX IF NOT EXISTS idx_card_edicoes_pendentes_status_time
  ON public.card_edicoes_pendentes (status, time_responsavel);

ALTER TABLE public.card_edicoes_pendentes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.card_edicoes_pendentes IS
  'Edições de card enviadas pelo franqueado e ainda não definitivas até aprovação do time.';

NOTIFY pgrst, 'reload schema';
