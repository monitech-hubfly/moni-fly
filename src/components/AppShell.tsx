'use client';

import { usePathname } from 'next/navigation';
import { PortalSidebar } from './PortalSidebar';
import { AppStickyHeader } from './AppStickyHeader';

type AppShellProps = {
  user: { id: string; email?: string; full_name?: string | null } | null;
  userRole: string;
  /** Visitante em app pública: mostra sidebar Rede + Novos Negócios (como equipa). */
  showPublicPortalNav?: boolean;
  children: React.ReactNode;
};

export function AppShell({ user, userRole, showPublicPortalNav = false, children }: AppShellProps) {
  const pathname = usePathname() ?? '';
  const hideGlobalHeader = pathname.startsWith('/sirene') || pathname.startsWith('/onboarding');

  if (!user && !showPublicPortalNav) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden bg-stone-50">
      <PortalSidebar user={user} userRole={userRole} publicVisitor={showPublicPortalNav} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!hideGlobalHeader && <AppStickyHeader user={user} publicVisitor={showPublicPortalNav} />}
        <div
          className={
            pathname.startsWith('/onboarding')
              ? 'min-h-0 flex-1 overflow-hidden'
              : 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden'
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
