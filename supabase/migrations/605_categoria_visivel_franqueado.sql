-- Categoria do Hub e visibilidade ao franqueado em formulários e documentos do repositório.
-- Idempotente. DEV primeiro. PROD só com confirmação.

ALTER TABLE public.formularios ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.formularios ADD COLUMN IF NOT EXISTS visivel_franqueado boolean NOT NULL DEFAULT true;

ALTER TABLE public.repositorio_documentos ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.repositorio_documentos ADD COLUMN IF NOT EXISTS visivel_franqueado boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'formularios_categoria_chk'
  ) THEN
    ALTER TABLE public.formularios
      ADD CONSTRAINT formularios_categoria_chk
      CHECK (
        categoria IS NULL OR categoria IN (
          'Qualificação de Franqueados',
          'Produto',
          'Onboarding',
          'Portfólio',
          'Loteadores',
          'Jurídico',
          'Acoplamento',
          'Projeto Legal',
          'Pré Obra',
          'Crédito',
          'Projetos Locais',
          'Obra',
          'Pós Obra',
          'Moní Care',
          'Marketing'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'repositorio_documentos_categoria_chk'
  ) THEN
    ALTER TABLE public.repositorio_documentos
      ADD CONSTRAINT repositorio_documentos_categoria_chk
      CHECK (
        categoria IS NULL OR categoria IN (
          'Qualificação de Franqueados',
          'Produto',
          'Onboarding',
          'Portfólio',
          'Loteadores',
          'Jurídico',
          'Acoplamento',
          'Projeto Legal',
          'Pré Obra',
          'Crédito',
          'Projetos Locais',
          'Obra',
          'Pós Obra',
          'Moní Care',
          'Marketing'
        )
      );
  END IF;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('605', '605_categoria_visivel_franqueado')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
