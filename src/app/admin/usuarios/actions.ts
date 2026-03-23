'use server';

import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { normalizeAccessRole } from '@/lib/authz';
import { sendEmailViaResend } from '@/lib/email';

type UpdatableRole = 'admin' | 'team' | 'pending' | 'blocked';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (normalizeAccessRole((profile as { role?: string } | null)?.role) !== 'admin') {
    return { ok: false as const, error: 'Apenas admin.' };
  }
  return { ok: true as const, supabase, actorId: user.id };
}

export async function updateUserRole(profileId: string, role: UpdatableRole) {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const { supabase, actorId } = guard;
  const patch: Record<string, unknown> = {
    role,
    updated_at: new Date().toISOString(),
  };
  if (role === 'admin' || role === 'team') {
    patch.aprovado_em = new Date().toISOString();
    patch.aprovado_por = actorId;
  }
  const { error } = await supabase.from('profiles').update(patch).eq('id', profileId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/admin/usuarios');
  return { ok: true as const };
}

/**
 * Wrapper para `<form action={...}>`: o React 19 tipa a ação como
 * `(formData: FormData) => void | Promise<void>` — não pode retornar o objeto de `updateUserRole`.
 */
export async function updateUserRoleFormAction(
  profileId: string,
  role: UpdatableRole,
  _formData: FormData,
): Promise<void> {
  await updateUserRole(profileId, role);
}

function allowedEmailDomain() {
  return (process.env.ALLOWED_EMAIL_DOMAIN ?? 'moni.casa').toLowerCase();
}

/**
 * Envia e-mail de convite (link /aceitar-convite) para todos os perfis com role pending.
 */
export async function inviteAllPendingUsers() {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const domain = allowedEmailDomain();
  const admin = createAdminClient();
  const { data: pending, error: qErr } = await admin
    .from('profiles')
    .select('id, email, nome_completo, full_name')
    .eq('role', 'pending');
  if (qErr) return { ok: false as const, error: qErr.message };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  let sent = 0;
  const failures: string[] = [];

  for (const row of pending ?? []) {
    const email = String((row as { email?: string | null }).email ?? '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@')) continue;
    if ((email.split('@')[1] ?? '') !== domain) continue;

    const token = randomUUID();
    const { error: upErr } = await admin
      .from('profiles')
      .update({
        invite_token: token,
        convidado_por: guard.actorId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (row as { id: string }).id);
    if (upErr) {
      failures.push(email);
      continue;
    }

    const inviteLink = `${appUrl}/aceitar-convite?token=${encodeURIComponent(token)}`;
    const mail = await sendEmailViaResend({
      to: email,
      subject: 'Convite de acesso — Plataforma Moní',
      text:
        'Você possui cadastro pendente na plataforma Moní.\n\n' +
        `Acesse o link para concluir o acesso:\n${inviteLink}\n`,
      html: `<p>Você possui cadastro <strong>pendente</strong> na plataforma Moní.</p><p><a href="${inviteLink}">Aceitar convite e definir senha</a></p>`,
    });
    if (!mail.ok) failures.push(email);
    else sent++;
  }

  revalidatePath('/admin/usuarios');
  return { ok: true as const, sent, failures };
}

