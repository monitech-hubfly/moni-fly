import type { ReactNode } from 'react';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import type { SubInteracaoTipoDb } from '@/types/kanban-subinteracao';

export type SubInteracaoTipoUi = SubInteracaoTipoDb;

export type SubInteracaoListaItem = {
  id: string | number;
  tipo: SubInteracaoTipoUi;
  descricao: string;
  /** Valores DB: nao_iniciado | em_andamento | concluido | aprovado */
  status: string;
  data_fim: string | null;
  trava?: boolean;
};

function normTipo(raw: string | null | undefined): SubInteracaoTipoUi {
  const t = String(raw ?? 'atividade').trim().toLowerCase();
  if (t === 'duvida' || t === 'dúvida') return 'duvida';
  if (t === 'chamado') return 'chamado';
  if (t === 'proposicoes' || t === 'proposições') return 'proposicoes';
  return 'atividade';
}

export function mapRawTopicoToListaItem(row: {
  id: number | string;
  tipo?: string | null;
  descricao?: string | null;
  status?: string | null;
  data_fim?: string | null;
  trava?: boolean | null;
}): SubInteracaoListaItem {
  return {
    id: row.id,
    tipo: normTipo(row.tipo),
    descricao: String(row.descricao ?? '').trim() || '—',
    status: String(row.status ?? 'nao_iniciado'),
    data_fim:
      row.data_fim != null && String(row.data_fim).trim() !== ''
        ? String(row.data_fim).slice(0, 10)
        : null,
    trava: Boolean(row.trava),
  };
}

export function rotuloStatusSubInteracaoPt(status: string): string {
  const s = String(status ?? 'nao_iniciado').toLowerCase();
  if (s === 'em_andamento') return 'Em andamento';
  if (s === 'concluido' || s === 'aprovado') return 'Concluído';
  return 'Pendente';
}

function badgeTipoLabel(tipo: SubInteracaoTipoUi): string {
  if (tipo === 'duvida') return 'DÚVIDA';
  if (tipo === 'chamado') return 'CHAMADO';
  if (tipo === 'proposicoes') return 'PROPOSIÇÕES';
  return 'ATIVIDADE';
}

type Props = {
  items: SubInteracaoListaItem[];
  /** `kanban`: fundo claro; `sirene`: painel Sirene (também claro, alinhado aos tokens Moní) */
  variant: 'kanban' | 'sirene';
  className?: string;
  /** Conteúdo extra à direita de cada linha (ex.: arquivar). */
  renderTrailing?: (item: SubInteracaoListaItem) => ReactNode;
};

export function SubInteracaoLista({ items, variant, className = '', renderTrailing }: Props) {
  if (items.length === 0) return null;

  const isSirene = variant === 'sirene';

  return (
    <ul className={`mt-1.5 space-y-1 ${className}`.trim()} aria-label="Subinterações">
      {items.map((it) => {
        const prazoFmt = it.data_fim ? formatIsoDateOnlyPtBr(it.data_fim) ?? it.data_fim : null;
        const tipoBadge = badgeTipoLabel(it.tipo);
        const statusPt = rotuloStatusSubInteracaoPt(it.status);

        const baseRow = isSirene
          ? 'rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] px-2 py-1'
          : 'rounded border border-stone-200 bg-stone-50/90 px-2 py-1';

        const tipoClass =
          it.tipo === 'duvida'
            ? isSirene
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
            : it.tipo === 'chamado'
              ? isSirene
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-red-200 bg-red-50 text-red-900'
              : isSirene
                ? 'border-sky-200 bg-sky-50 text-sky-900'
                : 'border-sky-200 bg-sky-50 text-sky-900';

        const statusClass = isSirene
          ? 'border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] text-[color:var(--moni-text-primary)]'
          : 'border-stone-300 bg-white text-stone-700';

        const muted = 'text-stone-500';
        const text = isSirene ? 'text-[color:var(--moni-text-primary)]' : 'text-stone-800';

        return (
          <li key={String(it.id)} className={`flex flex-wrap items-center gap-1.5 text-[10px] leading-snug ${baseRow}`}>
            <span className={`rounded px-1 py-0.5 font-bold uppercase tracking-wide ${tipoClass}`}>{tipoBadge}</span>
            {it.trava ? (
              <span
                className={
                  isSirene
                    ? 'rounded border border-red-200 bg-red-50 px-1 py-0.5 font-bold uppercase text-red-800'
                    : 'rounded border border-red-300 bg-red-50 px-1 py-0.5 font-bold uppercase text-red-800'
                }
              >
                Trava
              </span>
            ) : null}
            <span className={`rounded border px-1 py-0.5 font-semibold ${statusClass}`}>{statusPt}</span>
            <span className={`tabular-nums ${muted}`}>{prazoFmt ? `Prazo ${prazoFmt}` : 'Sem prazo'}</span>
            <span className={`min-w-0 flex-1 truncate font-medium ${text}`} title={it.descricao}>
              {it.descricao}
            </span>
            {renderTrailing ? <span className="shrink-0">{renderTrailing(it)}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
