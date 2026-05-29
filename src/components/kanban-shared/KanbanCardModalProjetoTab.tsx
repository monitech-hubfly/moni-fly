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
  /** Sidebar do modal: tipografia compacta. */
  variant?: 'default' | 'sidebar';
};

export function KanbanCardModalProjetoTab({
  projetoId,
  cardIdAtual,
  ocultarKanbansInternos = false,
  variant = 'default',
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

  const sidebar = variant === 'sidebar';

  if (!pid) {
    return (
      <p className={sidebar ? 'text-xs text-stone-500' : 'text-sm text-stone-500'}>
        Este card ainda não tem projeto vinculado.
      </p>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${sidebar ? 'py-2 text-xs' : 'py-8 text-sm'} text-stone-500`}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando esteiras do projeto…
      </div>
    );
  }

  if (erro) {
    return <p className={sidebar ? 'text-xs text-red-600' : 'text-sm text-red-600'}>{erro}</p>;
  }

  const rowsVisiveis = ocultarKanbansInternos
    ? rows.filter((row) => !isKanbanIdInterno(row.kanban_id))
    : rows;

  if (rowsVisiveis.length === 0) {
    return (
      <p className={sidebar ? 'text-xs text-stone-500' : 'text-sm text-stone-500'}>
        Nenhuma outra esteira ativa para este projeto.
      </p>
    );
  }

  const grupos = agruparCardsProjetoPorKanban(rowsVisiveis);

  return (
    <div className={sidebar ? 'space-y-3' : 'space-y-6'}>
      {grupos.map((grupo) => (
        <section key={grupo.kanban_id || grupo.kanban_nome}>
          <h3
            className={
              sidebar
                ? 'mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500'
                : 'mb-2 text-xs font-semibold uppercase tracking-wide'
            }
            style={sidebar ? undefined : { color: 'var(--moni-text-secondary)' }}
          >
            {grupo.kanban_nome}
          </h3>
          <ul className={sidebar ? 'space-y-1.5' : 'space-y-2'}>
            {grupo.cards.map((row) => {
              const st = statusIndicadorCardProjeto(row);
              const originou = row.origem_card_id === cardIdAtual;
              const dataFmt = formatIsoDateOnlyPtBr(row.created_at) ?? row.created_at;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => router.push(hrefAbrirCardKanban(row.kanban_nome, row.id))}
                    className={
                      sidebar
                        ? 'flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-[11px] transition hover:bg-stone-50'
                        : 'flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-stone-50 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1'
                    }
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      background: 'var(--moni-surface-50)',
                    }}
                  >
                    <span
                      className={
                        sidebar
                          ? 'min-w-0 font-medium leading-snug text-stone-800'
                          : 'min-w-0 flex-1 font-medium text-stone-800 sm:order-first sm:basis-full'
                      }
                    >
                      {row.titulo}
                    </span>
                    <span className={sidebar ? 'text-[10px] text-stone-600' : 'text-xs text-stone-600'}>
                      {row.fase_nome}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase ${st.classe}`}
                      >
                        {st.rotulo}
                      </span>
                      <span className={`shrink-0 text-stone-500 ${sidebar ? 'text-[10px]' : 'text-xs'}`}>
                        {dataFmt}
                      </span>
                      {originou ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-violet-700"
                          title="Originado por este card"
                        >
                          <GitBranch className="h-3 w-3" aria-hidden />
                          Originou
                        </span>
                      ) : null}
                    </div>
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
