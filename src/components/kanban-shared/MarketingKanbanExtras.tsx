'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { MARKETING_FRENTES, type MarketingFrente } from '@/lib/kanban/funis-marketing';
import {
  criarCicloSemanalMarketing,
  exportMarketingFunilJson,
} from '@/lib/actions/marketing-kanban';

export type MarketingStatusFiltro = 'todos' | 'em_aberto' | 'em_andamento' | 'concluido';

type Props = {
  kanbanId: string;
  totalCards: number;
  cardsConcluidos: number;
  statusFiltro: MarketingStatusFiltro;
  onStatusFiltro: (v: MarketingStatusFiltro) => void;
  frente: 'todas' | MarketingFrente;
  onFrente: (v: 'todas' | MarketingFrente) => void;
};

const STATUS_OPTS: { id: MarketingStatusFiltro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'em_aberto', label: 'Em aberto' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'concluido', label: 'Concluído' },
];

export function MarketingKanbanExtras({
  kanbanId,
  totalCards,
  cardsConcluidos,
  statusFiltro,
  onStatusFiltro,
  frente,
  onFrente,
}: Props) {
  const router = useRouter();
  const isProgramacao = kanbanId === KANBAN_IDS.MARKETING_PROGRAMACAO;
  const pct = totalCards > 0 ? Math.round((cardsConcluidos / totalCards) * 100) : 0;
  const [cicloLoading, setCicloLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleNovoCiclo() {
    setCicloLoading(true);
    setMsg(null);
    try {
      const res = await criarCicloSemanalMarketing();
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao criar ciclo.');
    } finally {
      setCicloLoading(false);
    }
  }

  async function handleExportJson() {
    setExportLoading(true);
    setMsg(null);
    try {
      const res = await exportMarketingFunilJson({ kanbanId });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      const blob = new Blob([JSON.stringify(res.payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `funil-marketing-${kanbanId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao exportar.');
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <span
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
          >
            Progresso do funil
          </span>
          <span
            className="text-xs"
            style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
          >
            {cardsConcluidos} de {totalCards} cards concluídos ({pct}%)
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden"
          style={{
            borderRadius: 'var(--moni-radius-md)',
            background: 'var(--moni-kanban-marketing-light)',
          }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full transition-[width]"
            style={{
              width: `${pct}%`,
              background: 'var(--moni-kanban-marketing)',
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_OPTS.map((opt) => {
          const active = statusFiltro === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onStatusFiltro(opt.id)}
              className="moni-kanban-fpill"
              style={
                active
                  ? {
                      background: 'var(--moni-navy-800)',
                      color: 'var(--moni-surface-0)',
                      borderColor: 'var(--moni-navy-800)',
                    }
                  : undefined
              }
            >
              {opt.label}
            </button>
          );
        })}

        {isProgramacao ? (
          <>
            <select
              value={frente}
              onChange={(e) => onFrente(e.target.value as 'todas' | MarketingFrente)}
              className="moni-kanban-fpill"
              aria-label="Filtrar por frente"
              style={{ fontFamily: 'var(--moni-font-sans)' }}
            >
              <option value="todas">Todas as frentes</option>
              {MARKETING_FRENTES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleNovoCiclo()}
              disabled={cicloLoading}
              className="moni-kanban-fpill"
              style={{
                background: 'var(--moni-navy-800)',
                color: 'var(--moni-surface-0)',
                borderColor: 'var(--moni-navy-800)',
                minHeight: 44,
              }}
            >
              {cicloLoading ? 'Criando…' : 'Novo ciclo semanal'}
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => void handleExportJson()}
          disabled={exportLoading}
          className="moni-kanban-fpill"
          title="Exportar funil em JSON"
        >
          {exportLoading ? 'Exportando…' : 'Exportar funil'}
        </button>
      </div>

      {msg ? (
        <p className="text-xs" style={{ color: 'var(--moni-text-secondary)' }} role="alert">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
