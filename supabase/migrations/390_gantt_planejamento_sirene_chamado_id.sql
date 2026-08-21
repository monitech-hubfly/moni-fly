-- 390: Gantt ↔ Sirene — FK explícita para sirene_chamados (pai da interação).
-- Espelha o padrão de kanban_atividades.sirene_chamado_id (164).
-- Não usar sirene_topicos.id como FK: o chamado é a entidade estável.

ALTER TABLE public.gantt_planejamento
  ADD COLUMN IF NOT EXISTS sirene_chamado_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gantt_planejamento_sirene_chamado_id_fkey'
  ) THEN
    ALTER TABLE public.gantt_planejamento
      ADD CONSTRAINT gantt_planejamento_sirene_chamado_id_fkey
      FOREIGN KEY (sirene_chamado_id) REFERENCES public.sirene_chamados(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.gantt_planejamento.sirene_chamado_id IS
  'Chamado Sirene vinculado à tarefa Gantt (opcional). Preferir sirene_chamados.id; card via sirene_chamados.card_id.';

CREATE INDEX IF NOT EXISTS idx_gantt_planejamento_sirene_chamado_id
  ON public.gantt_planejamento (sirene_chamado_id)
  WHERE sirene_chamado_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
