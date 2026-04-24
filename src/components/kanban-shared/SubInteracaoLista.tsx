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
  return 'ATIVIDADE';
}

type Props = {
  items: SubInteracaoListaItem[];
  /** `kanban`: fundo claro; `sirene`: tema escuro do painel */
  variant: 'kanban' | 'sirene';
  className?: string;
};

export function SubInteracaoLista({ items, variant, className = '' }: Props) {
  if (items.length === 0) return null;

  const isSirene = variant === 'sirene';

  return (
    <ul className={`mt-1.5 space-y-1 ${className}`.trim()} aria-label="Subinterações">
      {items.map((it) => {
        const prazoFmt = it.data_fim ? formatIsoDateOnlyPtBr(it.data_fim) ?? it.data_fim : null;
        const tipoBadge = badgeTipoLabel(it.tipo);
        const statusPt = rotuloStatusSubInteracaoPt(it.status);

        const baseRow = isSirene
          ? 'rounded border border-stone-700/80 bg-stone-950/40 px-2 py-1'
          : 'rounded border border-stone-200 bg-stone-50/90 px-2 py-1';

        const tipoClass =
          it.tipo === 'duvida'
            ? isSirene
              ? 'border-amber-700/50 bg-amber-950/40 text-amber-100'
              : 'border-amber-200 bg-amber-50 text-amber-900'
            : it.tipo === 'chamado'
              ? isSirene
                ? 'border-red-800/50 bg-red-950/35 text-red-100'
                : 'border-red-200 bg-red-50 text-red-900'
              : isSirene
                ? 'border-sky-800/50 bg-sky-950/35 text-sky-100'
                : 'border-sky-200 bg-sky-50 text-sky-900';

        const statusClass = isSirene
          ? 'border-stone-600 bg-stone-800 text-stone-200'
          : 'border-stone-300 bg-white text-stone-700';

        const muted = isSirene ? 'text-stone-500' : 'text-stone-500';
        const text = isSirene ? 'text-stone-200' : 'text-stone-800';

        return (
          <li key={String(it.id)} className={`flex flex-wrap items-center gap-1.5 text-[10px] leading-snug ${baseRow}`}>
            <span className={`rounded px-1 py-0.5 font-bold uppercase tracking-wide ${tipoClass}`}>{tipoBadge}</span>
            {it.trava ? (
              <span
                className={
                  isSirene
                    ? 'rounded border border-red-800/60 bg-red-950/50 px-1 py-0.5 font-bold uppercase text-red-200'
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
          </li>
        );
      })}
    </ul>
  );
}
