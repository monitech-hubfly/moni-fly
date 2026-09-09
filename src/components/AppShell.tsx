'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { AdminProvider } from '@/context/AdminContext';
import { isCalculadoraPublicLeituraPath, isExternalTokenAccessPath, isPublicGuiaLeituraPagePath } from '@/lib/access-matrix';
import { PortalSidebar } from './PortalSidebar';
import { AppStickyHeader } from './AppStickyHeader';

type AppShellProps = {
  user: { id: string; email?: string; full_name?: string | null } | null;
  userRole: string;
  children: React.ReactNode;
};

/** Estilos críticos inline: se o CSS chunk falhar/atrasar, sidebar|main NÃO viram coluna. */
const SHELL_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  alignItems: 'stretch',
  height: '100dvh',
  maxHeight: '100dvh',
  minHeight: 0,
  overflow: 'hidden',
};

const SIDEBAR_STYLE: React.CSSProperties = {
  boxSizing: 'border-box',
  flex: '0 0 14rem',
  width: '14rem',
  maxWidth: '14rem',
  minWidth: '14rem',
  minHeight: 0,
  overflow: 'hidden',
  position: 'relative',
  zIndex: 40,
};

const MAIN_STYLE: React.CSSProperties = {
  flex: '1 1 0%',
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
  position: 'relative',
  zIndex: 0,
  display: 'flex',
  flexDirection: 'column',
};

export function AppShell({ user, userRole, children }: AppShellProps) {
  const pathname = usePathname() ?? '';
  const hideGlobalHeader = pathname.startsWith('/sirene');
  const publicStandalone =
    isPublicGuiaLeituraPagePath(pathname) ||
    isCalculadoraPublicLeituraPath(pathname) ||
    isExternalTokenAccessPath(pathname);

  if (!user || publicStandalone) {
    return (
      <div
        className={
          publicStandalone
            ? 'min-h-[100dvh] bg-[var(--moni-surface-50)]'
            : undefined
        }
      >
        {children}
      </div>
    );
  }

  return (
    <AdminProvider accessRole={userRole}>
      {/* Shell isolado: sidebar | main — inline + classes; impossível empilhar sob o menu. */}
      <div className="moni-app-shell bg-stone-50" style={SHELL_STYLE} data-moni-shell="app">
        <aside className="moni-app-sidebar" style={SIDEBAR_STYLE} data-moni-shell="sidebar">
          <Suspense fallback={null}>
            <PortalSidebar user={user} userRole={userRole} />
          </Suspense>
        </aside>
        <div className="moni-app-main" style={MAIN_STYLE} data-moni-shell="main">
          {!hideGlobalHeader && <AppStickyHeader user={user} userRole={userRole} />}
          <div className="moni-app-main-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    </AdminProvider>
  );
}
