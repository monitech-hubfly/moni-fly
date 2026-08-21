-- Funil Acoplamento: checklist BCA/Acoplamento (links), tipo url, fase Reprovado e motivo

ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
  CHECK (tipo IN (
    'texto_curto',
    'texto_longo',
    'email',
    'telefone',
    'numero',
    'url',
    'anexo',
    'anexo_template',
    'checkbox',
    'data',
    'hora',
    'tabela'
  ));

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS motivo_reprovacao_acoplamento text;

COMMENT ON COLUMN public.kanban_cards.motivo_reprovacao_acoplamento IS
  'Motivo ao mover card para fase Reprovado no Funil Acoplamento.';

-- Fase terminal Reprovado (Funil Acoplamento)
INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
SELECT k.id, 'Reprovado', 'acoplamento_reprovado', 5, 7, true
FROM public.kanbans k
WHERE k.nome = 'Funil Acoplamento'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases f
    WHERE f.kanban_id = k.id AND f.slug = 'acoplamento_reprovado'
  );

-- Checklist: BCA e Acoplamento (links) na fase Modelagem da Casa + GBox
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, 'url', true, true, 'https://…'
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Acoplamento'
CROSS JOIN (VALUES
  (1, 'BCA'),
  (2, 'Acoplamento')
) AS v(ordem, label)
WHERE f.slug = 'modelagem_casa_gbox'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND lower(trim(i.label)) = lower(trim(v.label))
  );
