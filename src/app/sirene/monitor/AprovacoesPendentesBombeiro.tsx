'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  aprovarPassagemFase,
  rejeitarPassagemFase,
  type AprovacaoFasePendente,
} from '@/lib/actions/card-actions';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';

export function AprovacoesPendentesBombeiro({ initial }: { initial: AprovacaoFasePendente[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onAprovar(id: string) {
    setErr(null);
    setBusyId(id);
    const r = await aprovarPassagemFase(id);
    setBusyId(null);
    if (!r.ok) {
      setErr(r.error ?? 'Falha ao aprovar.');
      return;
    }
    router.refresh();
  }

  async function onRejeitar(id: string) {
    setErr(null);
    setBusyId(id);
    const r = await rejeitarPassagemFase(id);
    setBusyId(null);
    if (!r.ok) {
      setErr(r.error ?? 'Falha ao rejeitar.');
      return;
    }
    router.refresh();
  }

  return (
    <section
      className="mb-10 rounded-xl border border-amber-500/30 bg-stone-800/60 p-4"
      aria-labelledby="sirene-aprovacoes-heading"
    >
      <h2
        id="sirene-aprovacoes-heading"
        className="text-lg font-semibold text-amber-400/95"
      >
        Aprovações pendentes
      </h2>
      <p className="mt-1 text-sm text-stone-400">
        Passagens de fase com itens pendentes no checklist — aprove para mover o card ou rejeite para
        notificar o solicitante.
      </p>

      {err && (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </p>
      )}

      {initial.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">Nenhuma aprovação de fase pendente no momento.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {initial.map((row) => {
            const href = hrefAbrirCardKanban(row.funil_nome, row.card_id);
            const n = row.itens_pendentes;
            const pendText =
              n === 0
                ? 'Nenhum item de checklist pendente (revisar e aprovar)'
                : n === 1
                  ? '1 item pendente no checklist'
                  : `${n} itens pendentes no checklist`;
            const busy = busyId === row.id;
            return (
              <li
                key={row.id}
                className="flex flex-col gap-3 rounded-lg border border-stone-600 bg-stone-900/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={href}
                    className="font-medium text-stone-100 hover:text-amber-300 hover:underline"
                  >
                    {row.card_titulo}
                  </Link>
                  <p className="mt-1 text-xs text-stone-500">
                    Funil: {row.funil_nome} · Solicitante: {row.solicitante_nome}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-200/80">{pendText}</p>
                </div>
                <div className="flex flex-shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAprovar(row.id)}
                    className="rounded-lg border border-emerald-500/50 bg-emerald-600/20 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-600/30 disabled:opacity-50"
                  >
                    {busy ? '…' : 'Aprovar'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRejeitar(row.id)}
                    className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {busy ? '…' : 'Rejeitar'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
