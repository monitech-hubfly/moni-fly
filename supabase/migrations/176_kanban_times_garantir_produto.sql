-- Garante o time Moní "Produto" em kanban_times (novo chamado / interações usam UUID desta tabela).
INSERT INTO public.kanban_times (id, nome)
SELECT gen_random_uuid(), 'Produto'
WHERE NOT EXISTS (SELECT 1 FROM public.kanban_times WHERE nome = 'Produto');
