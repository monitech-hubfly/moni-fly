'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GitBranch, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { isKanbanIdInterno } from '@/lib/kanban/filtrar-kanbans-internos';
import {
  agruparCardsProjetoPorKanban,
  fetchCardsProjetoEsteiras,
  statusIndicadorCardProjeto,
  type CardProjetoEsteiraRow,
} from '@/lib/kanban/fetch-cards-projeto-esteiras';

type Props = {
  projetoId: string | null | undefined;
  cardIdAtual: string;
  /** Frank/franqueado: não listar esteiras Jurídico, Moní Capital, Contratações. */
  ocultarKanbansInternos?: boolean;
};

export function KanbanCardModalProjetoTab({
  projetoId,
  cardIdAtual,
  ocultarKanbansInternos = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rows, setRows] = useState<CardProjetoEsteiraRow[]>([]);

  const pid = projetoId != null && String(projetoId).trim() !== '' ? String(projetoId).trim() : null;

  useEffect(() => {
    if (!pid) {
      setRows([]);
      setErro(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErro(null);

    void (async () => {
      try {
        const supabase = createClient();
        const list = await fetchCardsProjetoEsteiras(supabase, pid, cardIdAtual);
        if (!cancelled) setRows(list);
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setErro(e instanceof Error ? e.message : 'Erro ao carregar esteiras do projeto');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pid, cardIdAtual]);

  if (!pid) {
    return (
      <p className="text-sm text-stone-500">Este card ainda não tem projeto vinculado.</p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-stone-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando esteiras do projeto…
      </div>
    );
  }

  if (erro) {
    return <p className="text-sm text-red-600">{erro}</p>;
  }

  const rowsVisiveis = ocultarKanbansInternos
    ? rows.filter((row) => !isKanbanIdInterno(row.kanban_id))
    : rows;

  if (rowsVisiveis.length === 0) {
    return (
      <p className="text-sm text-stone-500">Nenhuma outra esteira ativa para este projeto.</p>
    );
  }

  const grupos = agruparCardsProjetoPorKanban(rowsVisiveis);

  return (
    <div className="space-y-6">
      {grupos.map((grupo) => (
        <section key={grupo.kanban_id || grupo.kanban_nome}>
          <h3
            className="mb-2 text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--moni-text-secondary)' }}
          >
            {grupo.kanban_nome}
          </h3>
          <ul className="space-y-2">
            {grupo.cards.map((row) => {
              const st = statusIndicadorCardProjeto(row);
              const originou = row.origem_card_id === cardIdAtual;
              const dataFmt = formatIsoDateOnlyPtBr(row.created_at) ?? row.created_at;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => router.push(hrefAbrirCardKanban(row.kanban_nome, row.id))}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-stone-50"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      background: 'var(--moni-surface-50)',
                    }}
                  >
                    <span className="min-w-0 flex-1 font-medium text-stone-800">{row.titulo}</span>
                    <span className="text-xs text-stone-600">{row.fase_nome}</span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${st.classe}`}
                    >
                      {st.rotulo}
                    </span>
                    <span className="shrink-0 text-xs text-stone-500">{dataFmt}</span>
                    {originou ? (
                      <span
                        className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-violet-700"
                        title="Originado por este card"
                      >
                        <GitBranch className="h-3.5 w-3.5" aria-hidden />
                        Originou
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
