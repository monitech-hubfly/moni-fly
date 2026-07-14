'use client';

import { usePathname } from 'next/navigation';
import { AdminProvider } from '@/context/AdminContext';
import { normalizeAccessRole } from '@/lib/authz';
import { isCalculadoraPublicLeituraPath, isPublicGuiaLeituraPagePath } from '@/lib/access-matrix';
import { PortalSidebar } from './PortalSidebar';
import { AppStickyHeader } from './AppStickyHeader';

type AppShellProps = {
  user: { id: string; email?: string; full_name?: string | null } | null;
  userRole: string;
  children: React.ReactNode;
};

export function AppShell({ user, userRole, children }: AppShellProps) {
  const pathname = usePathname() ?? '';
  const hideGlobalHeader = pathname.startsWith('/sirene');
  const pendingOnly = Boolean(user) && normalizeAccessRole(userRole) === 'pending';
  const publicStandalone =
    isPublicGuiaLeituraPagePath(pathname) || isCalculadoraPublicLeituraPath(pathname);

  if (!user || pendingOnly || publicStandalone) {
    return (
      <div
        className={
          publicStandalone
            ? 'flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden'
            : undefined
        }
      >
        {children}
      </div>
    );
  }

  return (
    <AdminProvider accessRole={userRole}>
      {/* Shell isolado: sidebar | main — evita colunas do Kanban vazarem sob o menu (regressão histórica). */}
      <div className="moni-app-shell bg-stone-50">
        <aside className="moni-app-sidebar">
          <PortalSidebar user={user} userRole={userRole} />
        </aside>
        <div className="moni-app-main flex flex-col">
          {!hideGlobalHeader && <AppStickyHeader user={user} userRole={userRole} />}
          <div className="moni-app-main-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    </AdminProvider>
  );
}
