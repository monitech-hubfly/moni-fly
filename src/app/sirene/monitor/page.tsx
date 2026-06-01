import { redirect } from 'next/navigation';

/** Rota legada — Monitor dos times removido. */
export default function SireneMonitorRedirectPage() {
  redirect('/sirene/chamados');
}
