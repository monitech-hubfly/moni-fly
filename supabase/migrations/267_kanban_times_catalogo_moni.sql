-- Garante todos os times do catálogo Moní em kanban_times (chamados/atividades usam UUID desta tabela).
-- Ex.: Jurídico → Isabela Correa como responsável no dropdown de atividades.

INSERT INTO public.kanban_times (nome)
SELECT v.nome
FROM (
  VALUES
    ('Acoplamento'),
    ('Administrativo'),
    ('Bombeiro'),
    ('Caneta Verde'),
    ('Controladoria'),
    ('Diretoria'),
    ('Executivo Local'),
    ('Homologações'),
    ('Jurídico'),
    ('Marketing'),
    ('Modelo Virtual'),
    ('Moní Capital'),
    ('Moní Inc'),
    ('Novos Franqueados'),
    ('Portfólio'),
    ('Produto'),
    ('Waysers')
) AS v(nome)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_times kt WHERE kt.nome = v.nome
);
