'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { isKanbanIdInterno } from '@/lib/kanban/filtrar-kanbans-internos';
import {
  fetchCardsProjetoEsteiras,
  type CardProjetoEsteiraRow,
} from '@/lib/kanban/fetch-cards-projeto-esteiras';
import {
  agruparItensVinculoPorKanban,
  itemVinculoFromProjetoEsteira,
} from '@/lib/kanban/kanban-vinculos-display';
import { KanbanCardVinculosSection } from './KanbanCardVinculosSection';

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
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rows, setRows] = useState<CardProjetoEsteiraRow[]>([]);

  const pid = projetoId != null && String(projetoId).trim() !== '' ? String(projetoId).trim() : null;
  const sidebar = variant === 'sidebar';

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

  const rowsVisiveis = useMemo(
    () =>
      ocultarKanbansInternos ? rows.filter((row) => !isKanbanIdInterno(row.kanban_id)) : rows,
    [ocultarKanbansInternos, rows],
  );

  const grupos = useMemo(() => {
    const itens = rowsVisiveis.map((row) =>
      itemVinculoFromProjetoEsteira(row, hrefAbrirCardKanban(row.kanban_nome, row.id)),
    );
    return agruparItensVinculoPorKanban(itens);
  }, [rowsVisiveis]);

  if (!pid) {
    return (
      <p
        className={sidebar ? 'text-xs' : 'text-sm'}
        style={{ color: 'var(--moni-text-tertiary)' }}
      >
        Este card ainda não tem projeto vinculado.
      </p>
    );
  }

  if (erro) {
    return (
      <p className={sidebar ? 'text-xs' : 'text-sm'} style={{ color: 'var(--moni-status-overdue-text)' }}>
        {erro}
      </p>
    );
  }

  return (
    <KanbanCardVinculosSection
      grupos={grupos}
      loading={loading}
      emptyMessage="Nenhuma outra esteira ativa para este projeto."
      variant={variant}
    />
  );
}
