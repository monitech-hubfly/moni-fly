/**
 * Define a senha de um utilizador no Supabase Auth (GoTrue) via Admin API.
 *
 * Requer a chave **service_role** do MESMO projeto que NEXT_PUBLIC_SUPABASE_URL.
 * Nunca commite a service_role; use só em máquina local ou CI seguro.
 *
 * Antes de correr: `npm run auth:check-env` (valida .env.local).
 *
 * Uso (dev — credenciais no .env.local do projeto dev):
 *   npm run auth:set-password -- danilo.n@moni.casa "SenhaForte123!"
 *
 * Uso (prod — substitua pelo URL e JWT reais do painel; NÃO use texto com <ref-prod> ou placeholders):
 *   set NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *   set SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   node scripts/set-user-password.mjs danilo.n@moni.casa "SenhaForte123!"
 *
 * Ou passe o UUID do auth.users como primeiro argumento em vez do e-mail.
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, validateAdminSupabaseEnv, formatSupabaseNetworkError } from './lib/supabase-env-validate.mjs';

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SERVICE_ROLE_KEY?.trim();

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(s ?? '').trim(),
  );
}

async function findUserIdByEmail(supabase, emailLower) {
  const target = emailLower.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  const maxPages = 30;
  while (page <= maxPages) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => String(u.email ?? '').toLowerCase() === target);
    if (hit) return hit.id;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function main() {
  const [, , argIdent, argPassword] = process.argv;
  if (!argIdent || !argPassword) {
    console.error(
      'Uso: node scripts/set-user-password.mjs <email-ou-uuid-auth> "<nova-senha>"\n' +
        'Variáveis: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (service_role do mesmo projeto).\n' +
        'Dica: npm run auth:check-env',
    );
    process.exit(1);
  }
  if (!url) {
    console.error('Falta NEXT_PUBLIC_SUPABASE_URL (ex.: no .env.local).');
    process.exit(1);
  }
  if (!serviceKey) {
    console.error(
      'Falta SUPABASE_SERVICE_ROLE_KEY (secret "service_role" em Supabase → Project Settings → API).',
    );
    process.exit(1);
  }
  if (argPassword.length < 8) {
    console.error('A senha deve ter pelo menos 8 caracteres (requisito comum do GoTrue).');
    process.exit(1);
  }

  const envOk = validateAdminSupabaseEnv(url, serviceKey);
  if (!envOk.ok) {
    console.error(envOk.message);
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId = argIdent.trim();
  if (!isUuid(userId)) {
    userId = await findUserIdByEmail(supabase, userId);
    if (!userId) {
      console.error('Utilizador não encontrado no Auth deste projeto (e-mail não coincide).');
      process.exit(1);
    }
  }

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: argPassword,
  });
  if (error) {
    console.error('Erro ao atualizar senha:', error.message);
    process.exit(1);
  }
  console.log('Senha atualizada com sucesso.');
  console.log('  id:', data.user?.id);
  console.log('  email:', data.user?.email);
}

main().catch((e) => {
  console.error(formatSupabaseNetworkError(e));
  process.exit(1);
});
