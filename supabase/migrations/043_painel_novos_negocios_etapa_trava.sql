-- Painel Novos Negócios: etapa no board (Kanban+Miro) e flag travado no card
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS etapa_painel TEXT NOT NULL DEFAULT 'step_1',
  ADD COLUMN IF NOT EXISTS trava_painel BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.processo_step_one.etapa_painel IS 'Etapa atual no Painel Novos Negócios: step_1, step_2, step_3, step_4, acoplamento, step_5, step_6, step_7, contabilidade, passagem_wayser, planialtimetrico, sondagem, projeto_legal, aprovacao_condominio, aprovacao_prefeitura, credito_terreno, credito_obra';
COMMENT ON COLUMN public.processo_step_one.trava_painel IS 'Card marcado como travado no Painel (bloqueado/destacado).';

-- Backfill: processos existentes mantêm posição pelo step_atual (1-5)
UPDATE public.processo_step_one
SET etapa_painel = CASE
  WHEN step_atual = 1 THEN 'step_1'
  WHEN step_atual = 2 THEN 'step_2'
  WHEN step_atual = 3 THEN 'step_3'
  WHEN step_atual = 4 THEN 'step_4'
  WHEN step_atual = 5 THEN 'step_5'
  ELSE 'step_1'
END
WHERE etapa_painel = 'step_1' AND step_atual BETWEEN 1 AND 5;
