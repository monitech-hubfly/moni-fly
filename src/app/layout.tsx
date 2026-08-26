import type { Metadata } from 'next';
import './globals.css';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';
import { normalizeAccessRole, profileCacheRoleNeedsRefresh } from '@/lib/authz';
/** Sessão + papel vêm de cookies; sem isto o shell pode servir HTML cacheado com papel errado. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'HUB-FLY | Moní',
  description:
    'Ferramenta de viabilidade e análise de praça para franqueados Casa Moní. Da praça à hipótese em PDF.',
};

const PROFILE_CACHE_COOKIE = 'moni_profile_cache';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user: { id: string; email?: string; full_name?: string | null } | null = null;
  let userRole = 'pending';
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user ?? null;
    if (user?.id) {
      // Tenta usar o cache de perfil gravado pelo middleware (evita round-trip ao banco).
      const cookieStore = await cookies();
      const cachedRaw = cookieStore.get(PROFILE_CACHE_COOKIE)?.value;
      let profile: { role?: string | null; full_name?: string | null } | null = null;
      if (cachedRaw) {
        try { profile = JSON.parse(cachedRaw); } catch { /* ignore */ }
      }
      if (profile && profileCacheRoleNeedsRefresh(profile.role)) {
        profile = null;
      }
      // Cache miss (ou pending/blocked no cookie): busca no banco.
      if (!profile) {
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', user.id)
          .single();
        profile = dbProfile;
      }
      userRole = normalizeAccessRole((profile?.role as string) ?? 'pending');
      (user as { full_name?: string | null }).full_name = profile?.full_name ?? null;
    }
  } catch {
    // ignore
  }

  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <AppShell user={user} userRole={userRole}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
