import { redirect } from 'next/navigation';
import { getSireneLayoutContext } from './actions';
import { SireneShell } from './SireneShell';

export default async function SireneLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSireneLayoutContext();
  if (!ctx.ok) redirect('/login');

  // Notificações de atraso são enviadas via cron /api/cron/sirene-notificacoes
  // (movido para fora do render path — era chamado aqui a cada carregamento de página)

  return (
    <SireneShell userName={ctx.userName} isBombeiro={ctx.isBombeiro}>
      {children}
    </SireneShell>
  );
}
