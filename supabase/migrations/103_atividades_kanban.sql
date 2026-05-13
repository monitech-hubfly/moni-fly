-- ========================================
-- Tabela de Atividades Vinculadas aos Cards do Kanban
-- ========================================

-- ─── Tabela de Atividades ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kanban_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_vencimento DATE,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluida_em TIMESTAMPTZ,
  ordem INT DEFAULT 0
);

COMMENT ON TABLE public.kanban_atividades IS 'Atividades vinculadas aos cards do Kanban';
COMMENT ON COLUMN public.kanban_atividades.status IS 'Status: pendente, em_andamento, concluida, cancelada';
COMMENT ON COLUMN public.kanban_atividades.prioridade IS 'Prioridade: baixa, normal, alta, urgente';
COMMENT ON COLUMN public.kanban_atividades.ordem IS 'Ordem de exibição dentro do card';

-- Índices para performance
CREATE INDEX idx_kanban_atividades_card_id ON public.kanban_atividades(card_id);
CREATE INDEX idx_kanban_atividades_responsavel_id ON public.kanban_atividades(responsavel_id);
CREATE INDEX idx_kanban_atividades_status ON public.kanban_atividades(status);
CREATE INDEX idx_kanban_atividades_created_at ON public.kanban_atividades(created_at DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_kanban_atividades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    NEW.concluida_em = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_kanban_atividades_updated_at
BEFORE UPDATE ON public.kanban_atividades
FOR EACH ROW
EXECUTE FUNCTION update_kanban_atividades_updated_at();

-- ─── RLS Policies ─────────────────────────────────────────────────

ALTER TABLE public.kanban_atividades ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - Admin/consultor vê tudo, franqueado vê apenas seus cards
CREATE POLICY kanban_atividades_select ON public.kanban_atividades
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- Policy: INSERT - Admin/consultor insere em qualquer card, franqueado apenas em seus
CREATE POLICY kanban_atividades_insert ON public.kanban_atividades
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- Policy: UPDATE - Mesma lógica do SELECT
CREATE POLICY kanban_atividades_update ON public.kanban_atividades
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- Policy: DELETE - Mesma lógica do SELECT
CREATE POLICY kanban_atividades_delete ON public.kanban_atividades
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- ========================================
-- 🎉 MIGRAÇÃO CONCLUÍDA!
-- Tabela kanban_atividades criada com sucesso
-- RLS configurado
-- Pronta para receber atividades
-- ========================================
