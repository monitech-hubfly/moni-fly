import { createClient } from '@supabase/supabase-js';

function supabaseHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.trim();
  }
}

function validServiceRoleKey(key: string | undefined | null): string | null {
  const k = key?.trim();
  if (!k || k.startsWith('COLE_AQUI')) return null;
  return k;
}

/**
 * Service role alinhada ao host de `NEXT_PUBLIC_SUPABASE_URL`.
 * Priorizar DEV key com URL PROD quebra o enrich de bolinhas (Invalid API key → RLS).
 */
export function resolveSupabaseServiceRoleKey(): string {
  const activeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!activeUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não está definida');
  }
  const activeHost = supabaseHost(activeUrl);

  const devUrl = process.env.SUPABASE_DEV_URL?.trim();
  const prodUrl = process.env.SUPABASE_PROD_URL?.trim();

  const devKey = validServiceRoleKey(process.env.SUPABASE_DEV_SERVICE_ROLE_KEY);
  const prodKey = validServiceRoleKey(process.env.SUPABASE_PROD_SERVICE_ROLE_KEY);
  const legacyProdKey = validServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (devUrl && supabaseHost(devUrl) === activeHost && devKey) return devKey;

  if (prodUrl && supabaseHost(prodUrl) === activeHost) {
    const key = prodKey ?? legacyProdKey;
    if (key) return key;
  }

  const key = prodKey ?? legacyProdKey ?? devKey;
  if (!key) {
    throw new Error('Nenhuma SUPABASE_SERVICE_ROLE_KEY válida encontrada');
  }
  return key;
}

/**
 * Client com service role para uso em cron/jobs (atualização mensal de estudos finalizados).
 * Só deve ser usado em rotas protegidas por CRON_SECRET.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = resolveSupabaseServiceRoleKey();

  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL não está definida. Verifique seu arquivo .env.local',
    );
  }

  if (!key.includes('.') || key.split('.').length !== 3) {
    throw new Error(
      `SUPABASE_DEV_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY parece inválida (não é um JWT válido). Valor atual: ${key.substring(0, 50)}...`,
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** Service role quando disponível; senão o cliente autenticado (RLS). */
export function tryCreateAdminClient(): ReturnType<typeof createAdminClient> | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}
