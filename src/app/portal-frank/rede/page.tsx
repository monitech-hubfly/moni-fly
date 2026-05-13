import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  fetchRedeFranqueadosRowsPortalFrank,
  redePortalFrankRowParaDashboardRow,
} from '@/lib/rede-franqueados';
import { RedeDashboard } from '@/app/rede-franqueados/RedeDashboard';
import { TabelaRedePortalFrank } from '@/app/portal-frank/TabelaRedePortalFrank';

export const dynamic = 'force-dynamic';

function isFrankRole(role: string | null | undefined) {
  const r = String(role ?? '').toLowerCase();
  return r === 'frank' || r === 'franqueado';
}

export default async function PortalFrankRedePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/portal-frank/login');

  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = (prof as { role?: string | null } | null)?.role;
  if (!isFrankRole(role)) {
    redirect('/login?motivo=portal_apenas_franqueado');
  }

  const frankRows = await fetchRedeFranqueadosRowsPortalFrank(supabase);
  const dashboardRows =
    frankRows?.map((r) => redePortalFrankRowParaDashboardRow(r)) ?? [];

  return (
    <div className="min-h-screen bg-[var(--moni-surface-50)]">
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <header
          className="flex flex-col gap-4 pb-6"
          style={{ borderBottom: '0.5px solid var(--moni-border-default, #e8e2da)' }}
        >
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-text-primary, #0c2633)' }}>
            Rede de Franqueados
          </h1>
          <p className="max-w-3xl text-sm text-stone-600">
            Visão consolidada da rede (sem dados sensíveis). Os gráficos usam apenas unidades em operação
            (totais agregados). A tabela é somente leitura.
          </p>
        </header>

        {dashboardRows.length > 0 ? (
          <section className="mt-10 space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Visão geral
            </h3>
            <RedeDashboard rows={dashboardRows} modoAggregado visaoFranqueado />
          </section>
        ) : null}

        <section className="mt-10">
          {frankRows ? (
            <TabelaRedePortalFrank rows={frankRows} />
          ) : (
            <p className="text-sm text-red-600">Não foi possível carregar a rede. Tente novamente mais tarde.</p>
          )}
        </section>
      </main>
    </div>
  );
}
