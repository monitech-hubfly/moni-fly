import type { ClientConfig } from 'pg';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRedeAnexoColumnSchemaError } from '@/lib/rede-ensure-anexo-column';

const SQL_HINT =
  'Não foi possível preparar o banco para documentos de empresa. No Supabase → SQL Editor, execute scripts/rede-docs-empresas.sql e em Settings → API use Reload schema.';

const ENSURE_SQL = `
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_contrato_social_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_contrato_social_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_cnpj_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_cnpj_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_inscricao_municipal_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_inscricao_municipal_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_certidao_junta_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_certidao_junta_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_conta_bancaria_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_conta_bancaria_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_incorp_inscricao_estadual_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_contrato_social_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_contrato_social_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_cnpj_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_cnpj_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_inscricao_municipal_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_inscricao_municipal_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_certidao_junta_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_certidao_junta_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_conta_bancaria_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_conta_bancaria_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_emp_gest_inscricao_estadual_path TEXT;

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

/** Garante colunas de docs de empresa + reload schema PostgREST (idempotente). */
export async function ensureRedeEmpresaDocsColumns(): Promise<{ ok: true } | { ok: false; error: string }> {
  const viaPg = await ensureViaPg();
  if (!viaPg.ok) return viaPg;

  try {
    const admin = createAdminClient();
    await admin.from('rede_franqueados').select('anexo_emp_incorp_contrato_social_path').limit(1);
  } catch {
    /* postgrest pode demorar a recarregar */
  }

  return { ok: true };
}

export function isRedeEmpresaDocColumnSchemaError(message: string, column: string): boolean {
  if (!column.startsWith('anexo_emp_')) return false;
  return isRedeAnexoColumnSchemaError(message, column);
}
