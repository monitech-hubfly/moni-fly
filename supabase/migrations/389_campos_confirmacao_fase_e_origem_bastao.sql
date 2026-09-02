-- 389: confirmações de fase (Opção / Comitê / Contrato) e rastreio de origem do bastão.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS opcao_assinada boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS opcao_assinada_em timestamptz DEFAULT null,
  ADD COLUMN IF NOT EXISTS comite_aprovado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS comite_aprovado_em timestamptz DEFAULT null,
  ADD COLUMN IF NOT EXISTS contrato_assinado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contrato_assinado_em timestamptz DEFAULT null,
  ADD COLUMN IF NOT EXISTS origem_kanban_id uuid DEFAULT null,
  ADD COLUMN IF NOT EXISTS origem_kanban_nome text DEFAULT null;

COMMENT ON COLUMN public.kanban_cards.opcao_assinada IS
  'Confirmação de fase Opção assinada (bastão / gate de fase).';
COMMENT ON COLUMN public.kanban_cards.comite_aprovado IS
  'Confirmação de aprovação em Comitê (bastão / gate de fase).';
COMMENT ON COLUMN public.kanban_cards.contrato_assinado IS
  'Confirmação de contrato assinado (bastão / gate de fase).';
COMMENT ON COLUMN public.kanban_cards.origem_kanban_id IS
  'Kanban de origem quando o card foi criado via bastão de outro funil.';
COMMENT ON COLUMN public.kanban_cards.origem_kanban_nome IS
  'Nome denormalizado do kanban de origem (snapshot no momento do bastão).';

NOTIFY pgrst, 'reload schema';
