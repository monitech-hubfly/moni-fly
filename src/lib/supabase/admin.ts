import { createClient } from '@supabase/supabase-js';

/**
 * Client com service role para uso em cron/jobs (atualização mensal de estudos finalizados).
 * Só deve ser usado em rotas protegidas por CRON_SECRET.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // DEBUG: Log detalhado
  console.log('[createAdminClient] URL exists:', !!url);
  console.log('[createAdminClient] URL value:', url);
  console.log('[createAdminClient] KEY exists:', !!key);
  console.log('[createAdminClient] KEY length:', key?.length);
  console.log('[createAdminClient] KEY starts with:', key?.substring(0, 20));
  
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL não está definida. Verifique seu arquivo .env.local',
    );
  }
  
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não está definida. Verifique seu arquivo .env.local e reinicie o servidor Next.js',
    );
  }
  
  // Verificar se a key parece válida (JWT tem 3 partes separadas por ponto)
  if (!key.includes('.') || key.split('.').length !== 3) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY parece inválida (não é um JWT válido). Valor atual: ${key.substring(0, 50)}...`,
    );
  }
  
  console.log('[createAdminClient] ✅ Criando cliente Supabase com service_role...');
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
