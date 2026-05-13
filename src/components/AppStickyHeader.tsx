'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getStickyRouteTitle } from '@/lib/app-sticky-route-title';

type Props = {
  user: { id: string; email?: string } | null;
  /** Visitante em modo app pública (sem sessão): sem Sair; opcional Entrar */
  publicVisitor?: boolean;
};

export function AppStickyHeader({ user, publicVisitor = false }: Props) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const title = getStickyRouteTitle(pathname);
  const isSirene = pathname.startsWith('/sirene');

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    const dest = pathname.startsWith('/portal-frank') ? '/portal-frank/login' : '/login';
    router.push(dest);
    router.refresh();
  };

  const barClass = isSirene
    ? 'sticky top-0 z-50 flex h-14 w-full shrink-0 items-center justify-between gap-4 border-b bg-stone-900 px-4 md:px-6'
    : 'sticky top-0 z-50 flex h-14 w-full shrink-0 items-center justify-between gap-4 border-b bg-white px-4 md:px-6';

  const borderStyle = isSirene
    ? { borderColor: 'var(--moni-border-strong)' }
    : { borderColor: 'var(--moni-border-default)' };

  const linkClass = isSirene
    ? 'text-sm text-emerald-200 hover:text-white hover:underline'
    : 'text-sm text-moni-primary hover:underline';

  const titleClass = isSirene ? 'text-lg font-semibold text-stone-100' : 'text-lg font-semibold text-[color:var(--moni-text-primary)]';

  const sepClass = isSirene ? 'text-stone-500' : 'text-stone-400';

  return (
    <header className={barClass} style={borderStyle}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link href="/" className={`shrink-0 ${linkClass}`}>
          ← Hub Fly
        </Link>
        <span className={sepClass}>/</span>
        <h1 className={`min-w-0 truncate ${titleClass}`}>{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {publicVisitor && !user ? (
          <Link
            href="/login"
            className={
              isSirene
                ? 'rounded-lg border border-stone-600 px-3 py-1.5 text-xs font-medium text-stone-200 hover:bg-stone-800'
                : 'rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-3 py-1.5 text-xs font-medium text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-100)]'
            }
          >
            Entrar
          </Link>
        ) : user ? (
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className={
              isSirene
                ? 'rounded-lg border border-stone-600 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 hover:bg-stone-700'
                : 'rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-3 py-1.5 text-xs font-medium text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-100)]'
            }
          >
            Sair
          </button>
        ) : null}
      </div>
    </header>
  );
}
