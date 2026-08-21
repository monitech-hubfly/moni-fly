-- 264 instruções completas (opcional) — capital_abertura_spe
UPDATE public.kanban_fases
SET instrucoes = $instr$Primeiro passo para estruturar a oferta. Quando a SPE estiver em andamento ou com os dados básicos definidos, já é possível avançar para a próxima fase.

Documento orientativo — passo a passo de abertura da SPE:
https://docs.google.com/document/d/1gcwz3EiDYyATKDcB112ey8J6Tih0ls4Yuag4NEGCENQ/edit?tab=t.0$instr$
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_abertura_spe';
