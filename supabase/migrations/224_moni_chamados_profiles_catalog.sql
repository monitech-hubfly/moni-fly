-- 224: Sincroniza full_name em profiles para o catálogo Moní de chamados (@moni.casa)
-- Nota: só atualiza linhas existentes (auth.users + profiles). Usuários ausentes
-- devem ser convidados pelo admin antes de aparecerem como responsáveis.

UPDATE public.profiles SET full_name = 'Neil Hirano' WHERE lower(trim(email)) = 'neil@moni.casa';
UPDATE public.profiles SET full_name = 'Murillo Morale' WHERE lower(trim(email)) = 'murillo@moni.casa';
UPDATE public.profiles SET full_name = 'Ingrid Hora' WHERE lower(trim(email)) = 'ingrid.hora@moni.casa';
UPDATE public.profiles SET full_name = 'Fernanda Lobão' WHERE lower(trim(email)) = 'fernanda.lobao@moni.casa';
UPDATE public.profiles SET full_name = 'Danilo Nyitray' WHERE lower(trim(email)) = 'danilo.n@moni.casa';
UPDATE public.profiles SET full_name = 'Jéssica Ferreira' WHERE lower(trim(email)) = 'jessica.ferreira@moni.casa';
UPDATE public.profiles SET full_name = 'Nathalia Ferezin' WHERE lower(trim(email)) = 'nathalia.ferezin@moni.casa';
UPDATE public.profiles SET full_name = 'Rafael Matta' WHERE lower(trim(email)) = 'rafael.matta@moni.casa';
UPDATE public.profiles SET full_name = 'Bruna Scarpeli' WHERE lower(trim(email)) = 'bruna.scarpeli@moni.casa';
UPDATE public.profiles SET full_name = 'Alef Lopes' WHERE lower(trim(email)) = 'alef.lopes@moni.casa';
UPDATE public.profiles SET full_name = 'Larissa Lima' WHERE lower(trim(email)) = 'larissa.lima@moni.casa';
UPDATE public.profiles SET full_name = 'Letícia Ipolito' WHERE lower(trim(email)) = 'leticia.ipolito@moni.casa';
UPDATE public.profiles SET full_name = 'Elisabete Nucci' WHERE lower(trim(email)) = 'elisabete.nucci@moni.casa';
UPDATE public.profiles SET full_name = 'Renata Silva' WHERE lower(trim(email)) = 'renata.silva@moni.casa';
UPDATE public.profiles SET full_name = 'Helenna Luz' WHERE lower(trim(email)) = 'helenna.luz@moni.casa';
UPDATE public.profiles SET full_name = 'Daniel Viotto' WHERE lower(trim(email)) = 'daniel.viotto@moni.casa';
UPDATE public.profiles SET full_name = 'Karoline Galdino' WHERE lower(trim(email)) = 'karoline.galdino@moni.casa';
UPDATE public.profiles SET full_name = 'Helena Oliveira' WHERE lower(trim(email)) = 'helena.oliveira@moni.casa';
UPDATE public.profiles SET full_name = 'Jéssica Silva' WHERE lower(trim(email)) = 'jessica.silva@moni.casa';
UPDATE public.profiles SET full_name = 'Letícia Duarte' WHERE lower(trim(email)) = 'leticia.duarte@moni.casa';
UPDATE public.profiles SET full_name = 'Vinícius França' WHERE lower(trim(email)) = 'vinicius.fr@moni.casa';
UPDATE public.profiles SET full_name = 'Mateus Palma' WHERE lower(trim(email)) = 'mateus.palma@moni.casa';
UPDATE public.profiles SET full_name = 'Fábio Siano' WHERE lower(trim(email)) = 'fabio.siano@moni.casa';
UPDATE public.profiles SET full_name = 'Rafael Abreu' WHERE lower(trim(email)) = 'rafael.abreu@moni.casa';
UPDATE public.profiles SET full_name = 'João Fernandes' WHERE lower(trim(email)) = 'joao.fernandes@moni.casa';
UPDATE public.profiles SET full_name = 'Isabella Seabra' WHERE lower(trim(email)) = 'isa.seabra@moni.casa';
UPDATE public.profiles SET full_name = 'Felipe Batista' WHERE lower(trim(email)) = 'felipe.batista@moni.casa';
UPDATE public.profiles SET full_name = 'Isabela Correa' WHERE lower(trim(email)) = 'isabela.correa@moni.casa';
UPDATE public.profiles SET full_name = 'Thais Kim' WHERE lower(trim(email)) = 'kim@moni.casa';
UPDATE public.profiles SET full_name = 'Diogo Costa' WHERE lower(trim(email)) = 'diogo.costa@moni.casa';
UPDATE public.profiles SET full_name = 'Paula Cruz' WHERE lower(trim(email)) = 'paula.cruz@moni.casa';

NOTIFY pgrst, 'reload schema';
