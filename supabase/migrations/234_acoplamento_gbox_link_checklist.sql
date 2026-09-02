-- Funil Acoplamento: coluna link_gbox e checklist "Gbox" (substitui BCA na modelagem)

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS link_gbox TEXT;

COMMENT ON COLUMN public.processo_step_one.link_gbox IS
  'Link do Gbox (Funil Acoplamento — modelagem casa + GBox). Distinto de link_bca (planilha BCA).';

-- Renomear item de checklist BCA → Gbox na fase modelagem_casa_gbox
UPDATE public.kanban_fase_checklist_itens i
SET label = 'Gbox'
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Acoplamento'
WHERE i.fase_id = f.id
  AND f.slug = 'modelagem_casa_gbox'
  AND lower(trim(i.label)) = 'bca'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i2
    WHERE i2.fase_id = f.id
      AND lower(trim(i2.label)) = 'gbox'
      AND i2.id <> i.id
  );

-- Inserir Gbox se a fase ainda não tiver o item (ex.: DB sem migration 232)
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, 1, 'Gbox', 'url', true, true, 'https://…'
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Acoplamento'
WHERE f.slug = 'modelagem_casa_gbox'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND lower(trim(i.label)) IN ('gbox', 'bca')
  );

-- Propagar respostas do checklist Gbox/BCA para processo.link_gbox (gate e painel)
UPDATE public.processo_step_one p
SET link_gbox = src.valor,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (c.projeto_id)
    c.projeto_id AS processo_id,
    NULLIF(trim(r.valor), '') AS valor
  FROM public.kanban_cards c
  INNER JOIN public.kanban_fase_checklist_respostas r ON r.card_id = c.id
  INNER JOIN public.kanban_fase_checklist_itens i ON i.id = r.item_id
  INNER JOIN public.kanban_fases f ON f.id = i.fase_id AND f.slug = 'modelagem_casa_gbox'
  INNER JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Acoplamento'
  WHERE c.kanban_id = k.id
    AND c.projeto_id IS NOT NULL
    AND lower(trim(i.label)) IN ('gbox', 'bca')
    AND NULLIF(trim(r.valor), '') IS NOT NULL
  ORDER BY c.projeto_id, r.preenchido_em DESC NULLS LAST
) AS src
WHERE p.id = src.processo_id
  AND (p.link_gbox IS NULL OR trim(p.link_gbox) = '');
