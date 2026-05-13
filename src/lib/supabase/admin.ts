import { createClient } from '@supabase/supabase-js';

/**
 * Chave service role: em DEV usa `SUPABASE_DEV_SERVICE_ROLE_KEY`;
 * em PROD (ex.: Vercel) costuma ser só `SUPABASE_SERVICE_ROLE_KEY`.
 * Ignora placeholders do tipo `COLE_AQUI...` para permitir fallback para PROD.
 */
export function resolveSupabaseServiceRoleKey(): string {
  const dev = process.env.SUPABASE_DEV_SERVICE_ROLE_KEY?.trim();
  const prod = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const key =
    (dev && !dev.startsWith('COLE_AQUI') ? dev : null) ??
    (prod && !prod.startsWith('COLE_AQUI') ? prod : null);

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
