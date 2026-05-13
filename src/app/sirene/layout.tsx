import { redirect } from 'next/navigation';
import { getSireneLayoutContext, enviarNotificacoesAtrasoTopicos } from './actions';
import { SireneShell } from './SireneShell';

export default async function SireneLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSireneLayoutContext();
  if (!ctx.ok) redirect('/login');

  // Sinaliza aos times: > 2 dias úteis atrasados e TOP 10 (dedup 24h)
  void enviarNotificacoesAtrasoTopicos();

  return (
    <SireneShell userName={ctx.userName} isBombeiro={ctx.isBombeiro}>
      {children}
    </SireneShell>
  );
}
