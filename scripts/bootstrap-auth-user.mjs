/**
 * Cria utilizador em Auth (GoTrue) + alinha public.profiles (role, aprovação).
 * Usa SUPABASE_SERVICE_ROLE_KEY — só em dev/CI confiável; nunca commitar a secret.
 *
 * Uso:
 *   npm run auth:bootstrap-user -- danilo.n@moni.casa "Canetaverde123" admin
 *   npm run auth:bootstrap-user -- danilo.n@moni.casa
 * (sem senha: usa BOOTSTRAP_USER_PASSWORD no env ou a senha por defeito só para o e-mail pedido no projeto)
 *
 * Por defeito, se omitir senha e omitir BOOTSTRAP_USER_PASSWORD, usa Canetaverde123 (pedido de bootstrap interno).
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, validateAdminSupabaseEnv, formatSupabaseNetworkError } from './lib/supabase-env-validate.mjs';

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SERVICE_ROLE_KEY?.trim();

const VALID_ROLES = new Set(['admin', 'team', 'frank', 'parceiro', 'fornecedor', 'cliente']);

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
    if (hit) return hit;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

function displayNameFromEmail(email) {
  const local = String(email ?? '').split('@')[0] ?? 'Utilizador';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

async function ensureProfile(supabase, userId, email, role, fullName) {
  const now = new Date().toISOString();
  const row = {
    id: userId,
    role,
    email: email.trim().toLowerCase(),
    full_name: fullName,
    nome_completo: fullName,
    aprovado_em: now,
    updated_at: now,
  };

  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) throw error;
  console.log('profiles: upsert OK (role + aprovação).');
}

async function main() {
  const [, , emailArg, passwordArg, roleArg, nameArg] = process.argv;
  const email = (emailArg ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error(
      'Uso: npm run auth:bootstrap-user -- <email> [senha] [role] [nome_completo]\n' +
        'Ex.: npm run auth:bootstrap-user -- danilo.n@moni.casa "Canetaverde123" admin\n' +
        'Variáveis: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (mesmo projeto).',
    );
    process.exit(1);
  }

  const password =
    (passwordArg ?? '').trim() ||
    (process.env.BOOTSTRAP_USER_PASSWORD ?? '').trim() ||
    'Canetaverde123';

  if (password.length < 8) {
    console.error('A senha deve ter pelo menos 8 caracteres.');
    process.exit(1);
  }

  const role = (roleArg ?? 'admin').trim().toLowerCase();
  if (!VALID_ROLES.has(role)) {
    console.error(`Role inválida: ${role}. Use uma de: ${[...VALID_ROLES].join(', ')}`);
    process.exit(1);
  }

  const fullName = (nameArg ?? '').trim() || displayNameFromEmail(email);

  if (!url || !serviceKey) {
    console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY (.env.local).');
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

  let userId;
  const existing = await findUserIdByEmail(supabase, email);

  if (existing?.id) {
    userId = existing.id;
    const { error: pwdErr } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (pwdErr) throw pwdErr;
    console.log('Auth: utilizador já existia — senha atualizada e e-mail confirmado.');
  } else {
    const { data: created, error: crErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, nome_completo: fullName },
    });
    if (crErr) throw crErr;
    userId = created.user?.id;
    if (!userId) {
      console.error('Auth: createUser não devolveu id.');
      process.exit(1);
    }
    console.log('Auth: utilizador criado.');
  }

  await new Promise((r) => setTimeout(r, 300));
  await ensureProfile(supabase, userId, email, role, fullName);

  console.log('Concluído.');
  console.log('  id:', userId);
  console.log('  email:', email);
  console.log('  role (profiles):', role);
  console.log('  senha: (a que passou no comando ou a por defeito — peça ao utilizador para alterar no primeiro login se for prod)');
}

main().catch((e) => {
  console.error(formatSupabaseNetworkError(e));
  process.exit(1);
});
