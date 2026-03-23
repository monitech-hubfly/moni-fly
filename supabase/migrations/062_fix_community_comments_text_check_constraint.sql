-- Remover constraint que limitava texto a apenas "Bem-vindo".
-- Isso é necessário para permitir comentários com qualquer texto (senão o INSERT falha no nível de CHECK).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      conname
    FROM pg_constraint
    WHERE conrelid = 'public.community_comments'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%Bem-vindo%'
  LOOP
    EXECUTE format('ALTER TABLE public.community_comments DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

