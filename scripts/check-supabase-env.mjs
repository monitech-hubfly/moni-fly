/**
 * Valida variáveis Supabase no ambiente (útil antes de `npm run dev` ou `auth:set-password`).
 * Carrega `.env.local` se existir; não imprime segredos.
 *
 * Uso: npm run auth:check-env
 */

import {
  loadEnvLocal,
  validatePublicSupabaseUrl,
  validateAnonKey,
  validateAdminSupabaseEnv,
} from './lib/supabase-env-validate.mjs';

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const service =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SERVICE_ROLE_KEY?.trim();

let failed = false;

console.log('— Supabase (app Next + login) —');
const u1 = validatePublicSupabaseUrl(url);
if (u1.ok) console.log('  NEXT_PUBLIC_SUPABASE_URL: OK');
else {
  console.error(' ', u1.message);
  failed = true;
}

const a1 = validateAnonKey(anon);
if (a1.ok) console.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY: OK (formato)');
else {
  console.error(' ', a1.message);
  failed = true;
}

console.log('— Scripts Admin (definir senha, import rede, etc.) —');
if (!service) {
  console.log('  SUPABASE_SERVICE_ROLE_KEY: omitida (opcional até usar auth:set-password / import)');
} else {
  const s1 = validateAdminSupabaseEnv(url, service);
  if (s1.ok) console.log('  SUPABASE_SERVICE_ROLE_KEY: OK (formato + URL alinhados)');
  else {
    console.error(' ', s1.message);
    failed = true;
  }
}

if (failed) {
  console.error('\nCorrija o .env.local ou as variáveis do terminal e volte a correr: npm run auth:check-env');
  process.exit(1);
}
console.log('\nTudo certo para desenvolvimento local com este ficheiro de env.');
process.exit(0);
