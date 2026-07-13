-- 452: Funil Projetos Locais — fase de entrada "Novo Projeto"
--   Cria a fase onde os cards que entram no funil caem (antes de 100 - Layout).
--   Renumera as demais fases. Sem SLA (fase de recebimento/triagem). Idempotente.

INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, sla_tipo, ativo, instrucoes, materiais)
SELECT k.id, 'Novo Projeto', 'pl_000_novo_projeto', 1, NULL, 'uteis', true,
  $instr$Fase de entrada do funil. Os cards criados automaticamente (bastão a partir de "Aprovação Condomínio" do Funil Pré Obra e Obra) caem aqui.

Use esta fase para triagem inicial antes de iniciar o Layout (100). Ao começar o trabalho, mova o card para "100 - Projeto Layout casa + terreno".$instr$,
  '[]'::jsonb
FROM public.kanbans k
WHERE k.nome = 'Funil Projetos Locais'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id AND kf.slug = 'pl_000_novo_projeto'
  );

-- Renumera todas as fases do funil (Novo Projeto=1, 100..900=2..10, Concluído=11)
UPDATE public.kanban_fases kf
SET ordem = v.ordem
FROM public.kanbans k, (
  VALUES
    ('pl_000_novo_projeto',       1),
    ('pl_100_layout',             2),
    ('pl_200_preparacao_terreno', 3),
    ('pl_300_estruturas',         4),
    ('pl_400_infraestrutura',     5),
    ('pl_500_garagem',            6),
    ('pl_600_piscina',            7),
    ('pl_700_deck',               8),
    ('pl_800_escada_pisantes',    9),
    ('pl_900_paisagismo',        10),
    ('projetos_locais_concluido', 11)
) AS v(slug, ordem)
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Projetos Locais'
  AND kf.slug = v.slug;

DO $$
DECLARE r record;
BEGIN
  RAISE NOTICE '452: fases do Funil Projetos Locais:';
  FOR r IN
    SELECT kf.ordem, kf.slug, kf.nome, kf.sla_dias
    FROM public.kanban_fases kf JOIN public.kanbans k ON k.id = kf.kanban_id
    WHERE k.nome = 'Funil Projetos Locais' AND kf.ativo = true
    ORDER BY kf.ordem
  LOOP
    RAISE NOTICE '  % | % | SLA % | %', r.ordem, r.slug, COALESCE(r.sla_dias::text,'—'), r.nome;
  END LOOP;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('452', 'funil_projetos_locais_fase_novo_projeto')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
