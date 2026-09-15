'use client';

import { useEffect, useTransition } from 'react';
import type { DetalheChamadoRow, DetalheTopicoRow, DrilldownData, DrilldownFiltro } from './actions';
import { buscarDetalheChamados } from './actions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(status: string): { label: string; cls: string } {
  switch (status) {
    case 'nao_iniciado':  return { label: 'Sem aceite',  cls: 'bg-red-50 text-red-700 border-red-200' };
    case 'em_andamento':  return { label: 'Em andamento', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'concluido':     return { label: 'Concluído',   cls: 'bg-green-50 text-green-700 border-green-200' };
    case 'cancelado':     return { label: 'Cancelado',   cls: 'bg-slate-50 text-slate-500 border-slate-200' };
    default:              return { label: status,         cls: 'bg-slate-50 text-slate-500 border-slate-200' };
  }
}

function atribuicaoLabel(status: string | null): { label: string; cls: string } {
  switch (status) {
    case 'aceito':          return { label: 'Aceito',         cls: 'bg-green-50 text-green-700 border-green-200' };
    case 'pendente_aceite': return { label: 'Pendente aceite', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'recusado':        return { label: 'Recusado',       cls: 'bg-red-50 text-red-700 border-red-200' };
    default:                return { label: status ?? '—',    cls: 'bg-slate-50 text-slate-500 border-slate-200' };
  }
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ─── Tabela de chamados ───────────────────────────────────────────────────────

function TabelaChamados({ rows }: { rows: DetalheChamadoRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-[color:var(--moni-text-tertiary)]">
        Nenhum chamado encontrado.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] text-[color:var(--moni-text-secondary)]">
            <th className="px-3 py-2 text-left font-semibold">#</th>
            <th className="px-3 py-2 text-left font-semibold">Assunto</th>
            <th className="px-3 py-2 text-left font-semibold">Status</th>
            <th className="px-3 py-2 text-left font-semibold">Aberto por</th>
            <th className="px-3 py-2 text-right font-semibold">Abertura</th>
            <th className="px-3 py-2 text-right font-semibold">Dias úteis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = statusLabel(r.status);
            return (
              <tr
                key={r.id}
                className="group border-b border-[color:var(--moni-border-default)] last:border-b-0 hover:bg-[var(--moni-surface-50)]"
              >
                <td className="px-3 py-2">
                  <a
                    href={`/sirene/${r.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[color:var(--moni-text-tertiary)] underline-offset-2 hover:text-[color:var(--moni-navy-800)] hover:underline"
                    title="Abrir chamado"
                  >
                    #{String(r.numero).padStart(4, '0')}
                  </a>
                </td>
                <td className="max-w-[200px] px-3 py-2">
                  <a
                    href={`/sirene/${r.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-[color:var(--moni-text-primary)] underline-offset-2 hover:text-[color:var(--moni-navy-800)] hover:underline"
                    title={r.titulo ?? '(sem título)'}
                  >
                    {r.titulo ?? <span className="italic text-[color:var(--moni-text-tertiary)]">(sem título)</span>}
                  </a>
                </td>
                <td className="px-3 py-2">
                  <Badge label={s.label} cls={s.cls} />
                </td>
                <td className="px-3 py-2 text-[color:var(--moni-text-secondary)]">
                  {r.aberto_por_nome ?? '—'}
                </td>
                <td className="px-3 py-2 text-right text-[color:var(--moni-text-secondary)]">
                  {fmtData(r.criado_em)}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`font-semibold tabular-nums ${r.dias_uteis > 30 ? 'text-red-700' : r.dias_uteis > 7 ? 'text-amber-700' : 'text-[color:var(--moni-text-secondary)]'}`}>
                    {r.dias_uteis}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tabela de tópicos ────────────────────────────────────────────────────────

function TabelaTopicos({ rows }: { rows: DetalheTopicoRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-[color:var(--moni-text-tertiary)]">
        Nenhum tópico encontrado.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] text-[color:var(--moni-text-secondary)]">
            <th className="px-3 py-2 text-left font-semibold">Chamado</th>
            <th className="px-3 py-2 text-left font-semibold">Assunto</th>
            <th className="px-3 py-2 text-left font-semibold">Aceite</th>
            <th className="px-3 py-2 text-left font-semibold">Responsável</th>
            <th className="px-3 py-2 text-right font-semibold">Criado em</th>
            <th className="px-3 py-2 text-right font-semibold">Dias úteis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const a = atribuicaoLabel(r.atribuicao_status);
            return (
              <tr
                key={r.topico_id}
                className="border-b border-[color:var(--moni-border-default)] last:border-b-0 hover:bg-[var(--moni-surface-50)]"
              >
                <td className="px-3 py-2">
                  <a
                    href={`/sirene/${r.chamado_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[color:var(--moni-text-tertiary)] underline-offset-2 hover:text-[color:var(--moni-navy-800)] hover:underline"
                    title="Abrir chamado"
                  >
                    #{String(r.chamado_numero).padStart(4, '0')}
                  </a>
                </td>
                <td className="max-w-[180px] px-3 py-2">
                  <a
                    href={`/sirene/${r.chamado_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-[color:var(--moni-text-primary)] underline-offset-2 hover:text-[color:var(--moni-navy-800)] hover:underline"
                    title={r.chamado_titulo ?? '(sem título)'}
                  >
                    {r.chamado_titulo ?? <span className="italic text-[color:var(--moni-text-tertiary)]">(sem título)</span>}
                  </a>
                </td>
                <td className="px-3 py-2">
                  <Badge label={a.label} cls={a.cls} />
                </td>
                <td className="px-3 py-2 text-[color:var(--moni-text-secondary)]">
                  {r.responsavel_nome ?? '—'}
                </td>
                <td className="px-3 py-2 text-right text-[color:var(--moni-text-secondary)]">
                  {fmtData(r.criado_em)}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`font-semibold tabular-nums ${r.dias_espera_uteis > 30 ? 'text-red-700' : r.dias_espera_uteis > 7 ? 'text-amber-700' : 'text-[color:var(--moni-text-secondary)]'}`}>
                    {r.dias_espera_uteis}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type DrawerState =
  | { open: false }
  | { open: true; filtro: DrilldownFiltro; data: DrilldownData | null; loading: boolean };

// ─── Componente principal ─────────────────────────────────────────────────────

export function DetalheDrawer({
  state,
  onClose,
  onLoad,
}: {
  state: DrawerState;
  onClose: () => void;
  onLoad: (data: DrilldownData) => void;
}) {
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!state.open || state.data !== null) return;
    startTransition(async () => {
      const res = await buscarDetalheChamados(state.filtro);
      if (res.ok) onLoad(res.data);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, state.open && (state as { filtro?: DrilldownFiltro }).filtro]);

  // Fechar com Escape
  useEffect(() => {
    if (!state.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.open, onClose]);

  if (!state.open) return null;

  const titulo = state.data?.titulo ?? (state.loading ? 'Carregando…' : 'Detalhamento');
  const totalRows = state.data
    ? (state.data.tipo === 'chamados' ? state.data.rows.length : state.data.rows.length)
    : 0;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[700px] flex-col bg-[var(--moni-surface-0)] shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-[color:var(--moni-border-default)] px-6 py-5">
          <div className="flex-1 min-w-0">
            <h2 className="truncate text-base font-semibold text-[color:var(--moni-text-primary)]">
              {titulo}
            </h2>
            {!state.loading && state.data && (
              <p className="mt-0.5 text-[11px] text-[color:var(--moni-text-tertiary)]">
                {totalRows} {state.data.tipo === 'chamados' ? 'chamados' : 'tópicos'} · clique no número para abrir o chamado
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--moni-border-default)] text-[color:var(--moni-text-tertiary)] hover:bg-[var(--moni-surface-50)] hover:text-[color:var(--moni-text-primary)]"
            aria-label="Fechar"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto">
          {state.loading || !state.data ? (
            <div className="flex flex-col gap-3 p-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-[var(--moni-surface-100)]" />
              ))}
            </div>
          ) : state.data.tipo === 'chamados' ? (
            <TabelaChamados rows={state.data.rows} />
          ) : (
            <TabelaTopicos rows={state.data.rows} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[color:var(--moni-border-default)] px-6 py-3">
          <button
            onClick={onClose}
            className="text-xs text-[color:var(--moni-text-tertiary)] underline-offset-2 hover:text-[color:var(--moni-text-primary)] hover:underline"
          >
            Fechar painel
          </button>
        </div>
      </div>
    </>
  );
}
