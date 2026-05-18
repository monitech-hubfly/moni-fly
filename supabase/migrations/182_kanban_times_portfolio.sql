-- 182: Garante o time Moní «Portfólio» em kanban_times (novo chamado / atividades em todos os funis).
INSERT INTO public.kanban_times (id, nome)
SELECT gen_random_uuid(), 'Portfólio'
WHERE NOT EXISTS (SELECT 1 FROM public.kanban_times WHERE nome = 'Portfólio');
