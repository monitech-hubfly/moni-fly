'use client';

import { usePathname } from 'next/navigation';
import { AdminProvider } from '@/context/AdminContext';
import { normalizeAccessRole } from '@/lib/authz';
import { isPublicGuiaLeituraPagePath } from '@/lib/access-matrix';
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
  const publicStandalone = isPublicGuiaLeituraPagePath(pathname);

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
      <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden bg-stone-50">
        <PortalSidebar user={user} userRole={userRole} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!hideGlobalHeader && <AppStickyHeader user={user} userRole={userRole} />}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    </AdminProvider>
  );
}
