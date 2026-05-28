import { getPublicAppUrl } from '@/lib/app-url';
import { sendMencaoEmail } from '@/lib/email';

function emailValido(raw: string | null | undefined): string | null {
  const e = String(raw ?? '').trim();
  return e.includes('@') ? e : null;
}

async function adminClientOrNull() {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    return createAdminClient();
  } catch {
    return null;
  }
}

/** Resolve e-mail do usuário: `profiles.email` e, se vazio, `auth.users`. */
export async function buscarEmailUsuarioMencionado(userId: string): Promise<string | null> {
  const uid = String(userId ?? '').trim();
  if (!uid) return null;

  const admin = await adminClientOrNull();
  if (admin) {
    const { data: prof } = await admin.from('profiles').select('email').eq('id', uid).maybeSingle();
    const fromProfile = emailValido((prof as { email?: string | null } | null)?.email);
    if (fromProfile) return fromProfile;

    const { data: authUser, error } = await admin.auth.admin.getUserById(uid);
    if (!error) {
      const fromAuth = emailValido(authUser.user?.email);
      if (fromAuth) return fromAuth;
    }
    return null;
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: prof } = await supabase.from('profiles').select('email').eq('id', uid).maybeSingle();
  return emailValido((prof as { email?: string | null } | null)?.email);
}

function absolutizarLink(pathOrUrl: string): string {
  const raw = String(pathOrUrl ?? '').trim();
  if (!raw) return getPublicAppUrl();
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = getPublicAppUrl().replace(/\/$/, '');
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${base}${path}`;
}

/** Envia e-mail Resend para cada usuário mencionado (não bloqueia o fluxo principal em falha). */
export async function enviarEmailsMencaoUsuarios(input: {
  userIds: string[];
  autorId: string;
  cardTitulo: string;
  autorNome: string;
  comentarioPreview: string;
  linkPath: string;
}): Promise<void> {
  const linkUrl = absolutizarLink(input.linkPath);
  const ids = [...new Set(input.userIds.map((id) => String(id).trim()).filter(Boolean))];

  for (const uid of ids) {
    if (uid === input.autorId) continue;

    const to = await buscarEmailUsuarioMencionado(uid);
    if (!to) continue;

    const result = await sendMencaoEmail({
      to,
      cardTitulo: input.cardTitulo,
      autorNome: input.autorNome,
      comentarioPreview: input.comentarioPreview,
      linkUrl,
    });

    if (!result.ok) {
      console.error('[mencao-email] falha ao enviar', { userId: uid, error: result.error });
    }
  }
}
