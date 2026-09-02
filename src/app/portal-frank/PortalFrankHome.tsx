'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { PortalFrankCardRow } from '@/lib/portal-frank/fetch-portal-cards';
import type { RedeFrankCadastroPayload, RedeFrankFranquiaSomenteLeitura } from '@/lib/portal-frank/rede-cadastro-types';
import { FrankValidacaoBloqueante } from './FrankValidacaoBloqueante';
import { PortalFrankModalHost } from './PortalFrankModalHost';

function groupByKanban(cards: PortalFrankCardRow[]) {
  const m = new Map<string, PortalFrankCardRow[]>();
  for (const c of cards) {
    const k = c.kanban_nome || 'Kanban';
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(c);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
}

export function PortalFrankHome({
  initialCards,
  bloqueioValidacao,
  redeValidacaoEditavel,
  redeValidacaoFranquiaRo,
}: {
  initialCards: PortalFrankCardRow[];
  bloqueioValidacao: { periodo: string; titulo: string } | null;
  redeValidacaoEditavel: RedeFrankCadastroPayload | null;
  redeValidacaoFranquiaRo: RedeFrankFranquiaSomenteLeitura | null;
}) {
  const grupos = useMemo(() => groupByKanban(initialCards), [initialCards]);

  const mostrarBloqueio = Boolean(
    bloqueioValidacao && redeValidacaoEditavel != null && redeValidacaoFranquiaRo != null,
  );

  return (
    <div className="min-h-screen bg-[var(--moni-surface-50)]">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-stone-900">Portal do Franqueado</h1>
          <p className="text-xs text-stone-500">Seus cards em todos os funis</p>
        </div>
        {initialCards.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-500">
            Nenhum card atribuído a você no momento.
          </p>
        ) : (
          <div className="space-y-8">
            {grupos.map(([nomeKanban, lista]) => (
              <section key={nomeKanban}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
                  {nomeKanban}
                </h2>
                <ul className="space-y-2">
                  {lista.map((c) => {
                    const qs = new URLSearchParams();
                    qs.set('card', c.id);
                    qs.set('origem', c.origem);
                    qs.set('kb', c.kanban_nome);
                    return (
                      <li key={`${c.origem}-${c.id}`}>
                        <Link
                          href={`/portal-frank?${qs.toString()}`}
                          className="block rounded-lg border bg-white px-4 py-3 text-sm font-medium text-stone-800 shadow-sm transition hover:border-stone-300 hover:shadow"
                          style={{ borderColor: 'var(--moni-border-default)' }}
                        >
                          {c.titulo}
                          <span className="mt-1 block text-xs font-normal text-stone-500">
                            {c.origem === 'legado' ? 'Legado' : 'Nativo'}
                            {c.concluido ? ' · Concluído' : ''}
                            {c.arquivado ? ' · Arquivado' : ''}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      <PortalFrankModalHost />

      {mostrarBloqueio && bloqueioValidacao && redeValidacaoEditavel && redeValidacaoFranquiaRo ? (
        <FrankValidacaoBloqueante
          key={bloqueioValidacao.periodo}
          periodo={bloqueioValidacao.periodo}
          titulo={bloqueioValidacao.titulo}
          valoresEditaveis={redeValidacaoEditavel}
          franquiaSomenteLeitura={redeValidacaoFranquiaRo}
        />
      ) : null}
    </div>
  );
}
