-- Fix: ao excluir linhas de public.rede_franqueados, impedir bloqueio por FK em community_posts.
-- O projeto guarda posts ligados ao franqueado via `community_posts.franqueado_id`.
-- Sem ação ON DELETE, o Postgres impede a exclusão.

DO $$
BEGIN
  -- Drop das constraints antigas (nomes variam conforme typo/existência)
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'community_posts'
      AND constraint_name = 'community_posts_franchiseado_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.community_posts DROP CONSTRAINT community_posts_franchiseado_id_fkey';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'community_posts'
      AND constraint_name = 'community_posts_franqueado_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.community_posts DROP CONSTRAINT community_posts_franqueado_id_fkey';
  END IF;

  -- Recria as constraints com ON DELETE SET NULL (a coluna é nullable).
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'community_posts'
      AND column_name = 'franqueado_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_franqueado_id_fkey
      FOREIGN KEY (franqueado_id) REFERENCES public.rede_franqueados(id) ON DELETE SET NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'community_posts'
      AND column_name = 'franchiseado_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_franchiseado_id_fkey
      FOREIGN KEY (franchiseado_id) REFERENCES public.rede_franqueados(id) ON DELETE SET NULL';
  END IF;
END $$;

-- RLS: precisa permitir UPDATE/DELETE em community_posts para que a ação do FK funcione.
-- Sem política, a mudança para SET NULL pode ser bloqueada.
DROP POLICY IF EXISTS "Update comunidade por admin" ON public.community_posts;
DROP POLICY IF EXISTS "Delete comunidade por admin" ON public.community_posts;

CREATE POLICY "Update comunidade por admin"
  ON public.community_posts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles pf
      WHERE pf.id = auth.uid() AND pf.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles pf
      WHERE pf.id = auth.uid() AND pf.role = 'admin'
    )
  );

CREATE POLICY "Delete comunidade por admin"
  ON public.community_posts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles pf
      WHERE pf.id = auth.uid() AND pf.role = 'admin'
    )
  );

