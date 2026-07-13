-- 449: Funil Projetos Locais — remover fases antigas e cards do funil
--   • Após a 448 reorganizar o funil nos grupos 100–900, remove definitivamente
--     as fases antigas (as 7 etapas de fluxo + as 5 fases legadas projloc_*),
--     mantendo apenas as fases 100–900 (pl_*) + terminais (aprovação, concluído).
--   • Remove também os cards do funil (e seus dados por cascata).
--   • A remoção das fases apaga por cascata os itens de checklist e respostas.
-- ATENÇÃO: destrutivo. Em DEV o funil está sem cards. Em PROD, conferir antes de aplicar.

-- ─── 1. Remove os cards do funil (cascata: comentários, checklist respostas, etc.) ───
DELETE FROM public.kanban_cards c
USING public.kanban_fases kf, public.kanbans k
WHERE c.fase_id = kf.id
  AND kf.kanban_id = k.id
  AND k.nome = 'Funil Projetos Locais';

-- ─── 2. Remove as fases antigas (tudo que não é 100–900 nem terminal) ───
DELETE FROM public.kanban_fases kf
USING public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Projetos Locais'
  AND kf.slug NOT LIKE 'pl_%'
  AND kf.slug NOT IN ('projetos_locais_aprovacao', 'projetos_locais_concluido');

-- ─── 3. Verificação ───
DO $$
DECLARE r record;
BEGIN
  RAISE NOTICE '449: fases restantes no Funil Projetos Locais:';
  FOR r IN
    SELECT kf.ordem, kf.slug, kf.nome, kf.ativo
    FROM public.kanban_fases kf
    JOIN public.kanbans k ON k.id = kf.kanban_id
    WHERE k.nome = 'Funil Projetos Locais'
    ORDER BY kf.ordem
  LOOP
    RAISE NOTICE '  % | % | ativo=% | %', r.ordem, r.slug, r.ativo, r.nome;
  END LOOP;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('449', 'funil_projetos_locais_limpar_fases_antigas')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
