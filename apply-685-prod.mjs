/**
 * Script TEMPORÁRIO — aplicar migration 685 no PROD
 * Uso (PowerShell):
 *
 *   $env:PROD_DB_URL = "postgresql://postgres:<SENHA>@db.aydryzoxqnwnbybvgiug.supabase.co:5432/postgres"
 *   node apply-685-prod.mjs
 *
 * Depois de rodar com sucesso, delete este arquivo.
 */
import pg from 'pg';
import { parsePostgresUrl } from './scripts/pg-dev-client.mjs';

const rawUrl = (process.env.PROD_DB_URL || '').trim();
if (!rawUrl) {
  console.error('\nERRO: PROD_DB_URL não definida.');
  console.error('Defina no terminal:');
  console.error('  $env:PROD_DB_URL = "postgresql://postgres:<SENHA>@db.aydryzoxqnwnbybvgiug.supabase.co:5432/postgres"');
  process.exit(1);
}

const cfg = parsePostgresUrl(rawUrl);
const client = new pg.Client({
  host: cfg.host, port: cfg.port,
  user: cfg.user, password: cfg.password, database: cfg.database,
  ssl: { rejectUnauthorized: false },
});

const SQL = `
CREATE TABLE IF NOT EXISTS public.carometro_ausencias (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data       date NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, data)
);

ALTER TABLE public.carometro_ausencias ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'carometro_ausencias' AND policyname = 'ausencias_self'
  ) THEN
    CREATE POLICY ausencias_self
      ON public.carometro_ausencias
      FOR ALL
      USING  (profile_id = auth.uid())
      WITH CHECK (profile_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'carometro_ausencias' AND policyname = 'carometro_ausencias_read_all_auth'
  ) THEN
    CREATE POLICY carometro_ausencias_read_all_auth
      ON public.carometro_ausencias
      FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
`;

try {
  await client.connect();
  console.log('✅ Conectado ao PROD');
  await client.query(SQL);
  console.log('✅ Migration 685 aplicada com sucesso no PROD!');
  console.log('   → Tabela carometro_ausencias garantida');
  console.log('   → RLS configurado');
  console.log('\n⚠  Lembre de deletar este arquivo: apply-685-prod.mjs');
} catch (err) {
  console.error('❌ Erro:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
