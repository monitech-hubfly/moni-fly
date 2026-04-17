'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PortalFrankCardRow } from '@/lib/portal-frank/fetch-portal-cards';
import type { RedeFrankCadastroPayload } from '@/lib/portal-frank/rede-cadastro-types';
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
  redeValidacaoInicial,
}: {
  initialCards: PortalFrankCardRow[];
  bloqueioValidacao: { periodo: string; titulo: string } | null;
  redeValidacaoInicial: RedeFrankCadastroPayload | null;
}) {
  const router = useRouter();
  const grupos = useMemo(() => groupByKanban(initialCards), [initialCards]);

  async function handleSair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/portal-frank/login');
    router.refresh();
  }

  const mostrarBloqueio = Boolean(bloqueioValidacao && redeValidacaoInicial);

  return (
    <div className="min-h-screen bg-[var(--moni-surface-50)]">
      <header
        className="border-b bg-white px-4 py-3 sm:px-6"
        style={{ borderColor: 'var(--moni-border-default)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">Portal do Franqueado</h1>
            <p className="text-xs text-stone-500">Seus cards em todos os funis</p>
          </div>
          <button
            type="button"
            onClick={() => void handleSair()}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
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

      {mostrarBloqueio && bloqueioValidacao && redeValidacaoInicial ? (
        <FrankValidacaoBloqueante
          key={bloqueioValidacao.periodo}
          periodo={bloqueioValidacao.periodo}
          titulo={bloqueioValidacao.titulo}
          dadosIniciais={redeValidacaoInicial}
        />
      ) : null}
    </div>
  );
}
