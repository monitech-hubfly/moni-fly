import type { ClientConfig } from 'pg';
import { createAdminClient } from '@/lib/supabase/admin';

const SQL_HINT =
  'Não foi possível preparar o banco para o documento de número de franquia. No Supabase → SQL Editor, execute scripts/rede-anexo-numero-franquia.sql e em Settings → API use Reload schema.';

const ENSURE_SQL = `
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_numero_franquia_path TEXT;

COMMENT ON COLUMN public.rede_franqueados.anexo_numero_franquia_path IS
  'Caminho no bucket rede-attachments para o documento do número de franquia';

CREATE OR REPLACE FUNCTION public.ensure_rede_anexo_numero_franquia_column()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE public.rede_franqueados
    ADD COLUMN IF NOT EXISTS anexo_numero_franquia_path TEXT;
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_rede_anexo_numero_franquia_column() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_rede_anexo_numero_franquia_column() TO service_role;

NOTIFY pgrst, 'reload schema';
`;

function pgEnvRaw(): string | null {
  for (const key of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PROD_DB_URL', 'DEV_DB_URL'] as const) {
    const v = process.env[key]?.trim();
    if (v) return v.replace(/^["']|["']$/g, '');
  }
  return null;
}

function pgClientConfig(raw: string): ClientConfig {
  const ssl = { rejectUnauthorized: false } as const;
  const pgUrlMatch = raw.match(/^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:/?#]+)(?::(\d+))?\/([^?#]+)/i);
  if (pgUrlMatch) {
    const [, user, password, host, port = '5432', database] = pgUrlMatch;
    return {
      user: decodeURIComponent(user),
      password: decodeURIComponent(password),
      host,
      port: Number(port),
      database: decodeURIComponent(database),
      ssl,
    };
  }
  try {
    const u = new URL(raw.replace(/^postgresql:/i, 'http:'));
    return {
      user: decodeURIComponent(u.username || 'postgres'),
      password: decodeURIComponent(u.password || ''),
      host: u.hostname,
      port: Number(u.port || 5432),
      database: (u.pathname || '/postgres').replace(/^\//, '') || 'postgres',
      ssl,
    };
  } catch {
    return { connectionString: raw, ssl };
  }
}

async function ensureViaPg(): Promise<{ ok: true } | { ok: false; error: string }> {
  const raw = pgEnvRaw();
  if (!raw) return { ok: false, error: SQL_HINT };

  try {
    const { Client } = await import('pg');
    const client = new Client(pgClientConfig(raw));
    await client.connect();
    await client.query(ENSURE_SQL);
    await client.end();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || SQL_HINT };
  }
}

/** Garante coluna + RPC; usa Postgres direto quando a migration ainda não foi aplicada. */
export async function ensureRedeAnexoNumeroFranquiaColumn(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc('ensure_rede_anexo_numero_franquia_column');
    if (!error) return { ok: true };
  } catch {
    /* segue para pg */
  }

  const viaPg = await ensureViaPg();
  if (!viaPg.ok) return viaPg;

  try {
    const admin = createAdminClient();
    const { error: retry } = await admin.rpc('ensure_rede_anexo_numero_franquia_column');
    if (!retry) return { ok: true };
  } catch {
    /* coluna já criada via pg; postgrest pode demorar a recarregar */
  }

  return { ok: true };
}

export function isRedeAnexoNumeroFranquiaSchemaError(message: string, column: string): boolean {
  const m = message.toLowerCase();
  const col = column.toLowerCase();
  return (m.includes('schema cache') || m.includes('could not find')) && m.includes(col);
}
