-- 451: Funil Projetos Locais — remover a fase "Aprovação no condomínio"
--   A fase projetos_locais_aprovacao não faz parte do fluxo deste funil. Removida.
--   O Concluído passa a ser a fase terminal (ordem 10). Idempotente.

-- Remove a fase de aprovação (cascata: itens de checklist e respostas)
DELETE FROM public.kanban_fases kf
USING public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Projetos Locais'
  AND kf.slug = 'projetos_locais_aprovacao';

-- Concluído como terminal logo após as 9 fases
UPDATE public.kanban_fases kf
SET ordem = 10, ativo = true
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Projetos Locais'
  AND kf.slug = 'projetos_locais_concluido';

DO $$
DECLARE r record;
BEGIN
  RAISE NOTICE '451: fases do Funil Projetos Locais:';
  FOR r IN
    SELECT kf.ordem, kf.slug, kf.nome
    FROM public.kanban_fases kf JOIN public.kanbans k ON k.id = kf.kanban_id
    WHERE k.nome = 'Funil Projetos Locais'
    ORDER BY kf.ordem
  LOOP
    RAISE NOTICE '  % | % | %', r.ordem, r.slug, r.nome;
  END LOOP;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('451', 'funil_projetos_locais_remover_aprovacao')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
