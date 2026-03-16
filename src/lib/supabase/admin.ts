import { createClient } from "@supabase/supabase-js";

/**
 * Client com service role para uso em cron/jobs (atualização mensal de estudos finalizados).
 * Só deve ser usado em rotas protegidas por CRON_SECRET.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para o admin client.");
  return createClient(url, key);
}
