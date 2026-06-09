-- 264 part 19: inserir fase se não existir — capital_informacoes_obrigatorias
INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
SELECT k.id, 'Informações obrigatórias para subir a oferta', 'capital_informacoes_obrigatorias', 5, 5, true, NULL, '[]'::jsonb
FROM public.kanbans k
WHERE k.nome = 'Funil Moní Capital'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id AND kf.slug = 'capital_informacoes_obrigatorias'
  );
