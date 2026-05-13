import { guardLoginRequired } from '@/lib/auth-guard';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { salvarSlaFaseFormAction } from './actions';

type KanbanJoin = {
  id: string;
  nome: string | null;
  ordem: number | null;
  ativo: boolean | null;
};

type FaseRow = {
  id: string;
  nome: string | null;
  ordem: number | null;
  sla_dias: number | null;
  kanban_id: string;
  kanbans: KanbanJoin | KanbanJoin[] | null;
};

function kanbanMeta(row: FaseRow): KanbanJoin | null {
  const k = row.kanbans;
  if (!k) return null;
  return Array.isArray(k) ? k[0] ?? null : k;
}

export const dynamic = 'force-dynamic';

export default async function AdminSlaPage({
  searchParams,
}: {
  searchParams?: { err?: string; saved?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (normalizeAccessRole((me as { role?: string } | null)?.role) !== 'admin') {
    redirect('/rede-franqueados');
  }

  const { data: rowsRaw, error: qErr } = await supabase
    .from('kanban_fases')
    .select(
      `
      id,
      nome,
      ordem,
      sla_dias,
      kanban_id,
      kanbans!inner (
        id,
        nome,
        ordem,
        ativo
      )
    `,
    )
    .eq('ativo', true)
    .eq('kanbans.ativo', true);

  if (qErr) {
    return (
      <div className="min-h-screen px-4 py-8" style={{ background: 'var(--moni-surface-50)' }}>
        <p className="text-sm" style={{ color: 'var(--moni-status-overdue-text)' }}>
          Erro ao carregar fases: {qErr.message}
        </p>
      </div>
    );
  }

  const rows = (rowsRaw ?? []) as FaseRow[];
  const sorted = [...rows].sort((a, b) => {
    const ka = kanbanMeta(a);
    const kb = kanbanMeta(b);
    const oa = ka?.ordem ?? 999;
    const ob = kb?.ordem ?? 999;
    if (oa !== ob) return oa - ob;
    return (a.ordem ?? 0) - (b.ordem ?? 0);
  });

  const byKanban = new Map<string, { kanban: KanbanJoin; fases: FaseRow[] }>();
  for (const row of sorted) {
    const k = kanbanMeta(row);
    if (!k?.id) continue;
    const kid = String(k.id);
    if (!byKanban.has(kid)) {
      byKanban.set(kid, { kanban: k, fases: [] });
    }
    byKanban.get(kid)!.fases.push(row);
  }

  const grupos = [...byKanban.values()];

  const errMsg = searchParams?.err ? decodeURIComponent(String(searchParams.err)) : null;
  const saved = searchParams?.saved === '1';

  return (
    <div className="min-h-screen" style={{ background: 'var(--moni-surface-50)' }}>
      <header
        className="border-b bg-[var(--moni-surface-0)]"
        style={{ borderColor: 'var(--moni-border-default)' }}
      >
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/admin" className="hover:underline" style={{ color: 'var(--moni-navy-600)' }}>
              ← Admin
            </Link>
            <span style={{ color: 'var(--moni-text-tertiary)' }}>/</span>
            <span className="font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              SLA das fases
            </span>
          </div>
          <Link href="/" className="text-sm hover:underline" style={{ color: 'var(--moni-navy-600)' }}>
            Início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
          SLA das fases
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          Dias úteis por fase (1–365). Alterações aplicam-se ao cálculo de SLA dos cards nessa coluna.
        </p>

        {saved ? (
          <p
            className="mt-4 rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--moni-status-done-border)',
              background: 'var(--moni-status-done-bg)',
              color: 'var(--moni-status-done-text)',
            }}
          >
            SLA atualizado com sucesso.
          </p>
        ) : null}
        {errMsg ? (
          <p
            className="mt-4 rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--moni-status-overdue-border)',
              background: 'var(--moni-status-overdue-bg)',
              color: 'var(--moni-status-overdue-text)',
            }}
          >
            {errMsg}
          </p>
        ) : null}

        <div className="mt-8 space-y-8">
          {grupos.map(({ kanban, fases }) => (
            <section
              key={kanban.id}
              className="overflow-hidden rounded-xl border bg-[var(--moni-surface-0)] shadow-sm"
              style={{ borderColor: 'var(--moni-border-default)' }}
            >
              <div
                className="border-b px-4 py-3"
                style={{
                  borderColor: 'var(--moni-border-subtle)',
                  background: 'var(--moni-navy-800)',
                  color: 'var(--moni-text-inverse)',
                }}
              >
                <h2 className="text-sm font-semibold tracking-wide">{kanban.nome ?? 'Kanban'}</h2>
              </div>
              <ul className="divide-y" style={{ borderColor: 'var(--moni-border-subtle)' }}>
                {fases.map((f) => {
                  const sla = f.sla_dias != null && Number.isFinite(Number(f.sla_dias)) ? Number(f.sla_dias) : 7;
                  return (
                    <li
                      key={f.id}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                      style={{ background: 'var(--moni-surface-0)' }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                          {f.nome ?? '—'}
                        </p>
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                          Ordem {f.ordem ?? '—'} · SLA atual: {sla} d.u.
                        </p>
                      </div>
                      <form
                        action={salvarSlaFaseFormAction}
                        className="flex flex-wrap items-center gap-2 sm:justify-end"
                      >
                        <input type="hidden" name="fase_id" value={f.id} />
                        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
                          <span className="sr-only">SLA em dias úteis</span>
                          <input
                            type="number"
                            name="sla_dias"
                            min={1}
                            max={365}
                            defaultValue={sla}
                            required
                            className="w-24 rounded-lg border px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-1"
                            style={{
                              borderColor: 'var(--moni-border-default)',
                              background: 'var(--moni-surface-0)',
                              color: 'var(--moni-text-primary)',
                              boxShadow: '0 0 0 1px transparent',
                            }}
                          />
                          <span className="text-xs">d.u.</span>
                        </label>
                        <button
                          type="submit"
                          className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--moni-text-inverse)] transition hover:opacity-95"
                          style={{
                            background: 'var(--moni-green-800)',
                            borderRadius: 'var(--moni-radius-md)',
                          }}
                        >
                          Salvar
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {grupos.length === 0 ? (
          <p className="mt-8 text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
            Nenhuma fase ativa encontrada.
          </p>
        ) : null}
      </main>
    </div>
  );
}
