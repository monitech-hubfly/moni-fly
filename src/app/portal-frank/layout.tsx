import type { ReactNode } from 'react';
import { PortalFrankShell } from './PortalFrankShell';

export default function PortalFrankLayout({ children }: { children: ReactNode }) {
  return <PortalFrankShell>{children}</PortalFrankShell>;
}
