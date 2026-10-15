import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/server';
import { fetchRedeFranqueadosRows } from '@/lib/rede-franqueados';

const RedeDashboard = dynamic(() =>
  import('@/app/rede-franqueados/RedeDashboard').then((m) => ({ default: m.RedeDashboard })),
);

export async function DashboardsGeraisVisaoGeral() {
  const supabase = await createClient();
  const redeRows = await fetchRedeFranqueadosRows(supabase);

  if (!redeRows) {
    return (
      <p className="text-sm" style={{ color: 'var(--moni-status-overdue-text)' }}>
        Erro ao carregar a visão geral.
      </p>
    );
  }

  return <RedeDashboard rows={redeRows} />;
}
