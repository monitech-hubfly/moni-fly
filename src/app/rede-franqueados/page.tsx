import { createClient } from '@/lib/supabase/server';
import { isAdminRole } from '@/lib/authz';
import { isAppFullyPublic, isPublicRedeNovosNegociosEnabled } from '@/lib/public-rede-novos';
import { fetchRedeFranqueadosRows } from '@/lib/rede-franqueados';
import { TabelaRedeFranqueadosEditavel } from '@/components/TabelaRedeFranqueadosEditavel';
import { contarLinhasSemCard } from './actions';
import { CriarCardsDesdeRedeButton } from './CriarCardsDesdeRedeButton';
import { ImportarRedeCSVButton } from './ImportarRedeCSVButton';
import { ExportarRedeCSVButton } from './ExportarRedeCSVButton';
import { NovoFranqueadoModal } from './NovoFranqueadoModal';
import { AdicionarRedeECardButton } from './AdicionarRedeECardButton';
import { RedeDashboard } from './RedeDashboard';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function RedeFranqueadosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const publicAccess = isPublicRedeNovosNegociosEnabled();

  let db = supabase;
  if (!user && (publicAccess || isAppFullyPublic())) {
    try {
      db = createAdminClient();
    } catch {
      /* sem service role: RLS pode ocultar linhas */
    }
  }

  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null };
  const role = (profile?.role as string) ?? 'frank';
  const canManage =
    (Boolean(user) && isAdminRole(role)) || publicAccess || isAppFullyPublic();

  const [rows, countResult] = await Promise.all([
    fetchRedeFranqueadosRows(db),
    canManage ? contarLinhasSemCard() : Promise.resolve({ ok: true as const, total: 0 }),
  ]);
  const linhasSemCard = countResult.ok ? countResult.total : 0;

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
            Tabela de franqueados gerenciada dentro da ferramenta (fonte: banco de dados).
          </p>
        </header>

        {rows && rows.length > 0 ? (
          <section className="mt-10 space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Visão geral
            </h3>
            <RedeDashboard rows={rows} />
          </section>
        ) : null}

        {canManage ? (
          <div className="mt-10 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <AdicionarRedeECardButton />
            </div>
            <ImportarRedeCSVButton />
            <CriarCardsDesdeRedeButton linhasSemCard={linhasSemCard} />
          </div>
        ) : null}

        <section className="mt-10 space-y-3">
          {rows ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              {canManage ? <NovoFranqueadoModal /> : null}
              <ExportarRedeCSVButton rows={rows} />
            </div>
          ) : null}
          {rows ? (
            <TabelaRedeFranqueadosEditavel rows={rows} canEditRows={canManage} />
          ) : (
            <p className="text-sm text-red-600">Erro ao carregar a tabela.</p>
          )}
        </section>
      </main>
    </div>
  );
}
