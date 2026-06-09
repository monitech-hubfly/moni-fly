-- 264 part 20: inserir fase se não existir — capital_formalizacao
INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
SELECT k.id, 'Formalização', 'capital_formalizacao', 6, 5, true, NULL, '[]'::jsonb
FROM public.kanbans k
WHERE k.nome = 'Funil Moní Capital'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id AND kf.slug = 'capital_formalizacao'
  );
