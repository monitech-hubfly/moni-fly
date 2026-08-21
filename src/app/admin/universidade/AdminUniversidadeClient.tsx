'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminFrankProgressoRow, EntregaPendenteAdminRow } from '@/lib/universidade/actions';
import { aprovarEntrega } from '@/lib/universidade/actions';

export function AdminUniversidadeClient({
  rows,
  entregas,
}: {
  rows: AdminFrankProgressoRow[];
  entregas: EntregaPendenteAdminRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function handleAprovar(id: string, ok: boolean) {
    setBusy(id);
    const r = await aprovarEntrega(id, ok);
    setBusy(null);
    if (!r.ok) {
      alert(r.error ?? 'Erro');
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8">
      <h1 className="text-2xl font-semibold text-stone-900">Progresso geral — franqueados</h1>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Nível</th>
              <th className="px-4 py-3">Casas</th>
              <th className="px-4 py-3">Módulos</th>
              <th className="px-4 py-3">Última atividade</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className="border-b border-stone-100">
                <td className="px-4 py-3 font-medium text-stone-900">{r.full_name ?? r.email ?? r.user_id}</td>
                <td className="px-4 py-3">{r.nivel}</td>
                <td className="px-4 py-3">{r.casas_concluidas}</td>
                <td className="px-4 py-3">{r.modulos_feitos}</td>
                <td className="px-4 py-3 text-xs text-stone-500">
                  {r.ultima_atividade ? new Date(r.ultima_atividade).toLocaleString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/universidade/franqueado/${r.user_id}`}
                    className="text-xs font-semibold text-moni-primary hover:underline"
                  >
                    Ver detalhes
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-stone-900">Entregas pendentes</h2>
        {entregas.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Nenhuma entrega pendente.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {entregas.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <div>
                  <p className="font-medium text-stone-900">{e.franqueado_nome ?? e.user_id}</p>
                  <span className="font-mono text-[10px] text-stone-400">{e.user_id}</span>
                  <p className="mt-1 text-stone-800">{e.valor ?? '—'}</p>
                  <p className="text-xs text-stone-500">{e.tipo ?? '—'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy === e.id}
                    onClick={() => void handleAprovar(e.id, true)}
                    className="rounded bg-green-700 px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    disabled={busy === e.id}
                    onClick={() => void handleAprovar(e.id, false)}
                    className="rounded bg-stone-600 px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Reprovar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
