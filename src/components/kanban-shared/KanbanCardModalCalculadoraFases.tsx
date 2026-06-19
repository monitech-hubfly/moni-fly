'use client';

import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import {
  CALCULADORA_STATUS_LABEL,
  type CalculadoraFaseLinha,
  type FaseTimelineStatus,
} from '@/lib/kanban/calculadora-fases';

type Props = {
  linhas: CalculadoraFaseLinha[];
  faseAtualId: string | null;
};

function fmtData(iso: string | null): string {
  if (!iso) return '—';
  return formatIsoDateOnlyPtBr(iso) ?? iso;
}

function statusClass(status: FaseTimelineStatus): string {
  switch (status) {
    case 'futura':
      return 'moni-calculadora-status-futura';
    case 'atual':
      return 'moni-calculadora-status-atual';
    case 'atual_atrasada':
      return 'moni-tag-atencao';
    case 'concluida':
      return 'moni-tag-concluido';
    case 'concluida_atraso':
      return 'moni-tag-atrasado';
    default:
      return 'moni-calculadora-status-futura';
  }
}

export function KanbanCardModalCalculadoraFases({ linhas, faseAtualId }: Props) {
  if (linhas.length === 0) {
    return (
      <p className="text-[11px] text-[var(--moni-text-tertiary)]" style={{ fontFamily: 'var(--moni-font-sans)' }}>
        Nenhuma fase configurada para este kanban.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p
        className="text-[10px] leading-snug text-[var(--moni-text-tertiary)]"
        style={{ fontFamily: 'var(--moni-font-sans)' }}
      >
        SLA e previsões em dias úteis (seg–sex). Feriados não considerados nesta versão.
      </p>
      <div className="max-h-80 space-y-1.5 overflow-y-auto pr-0.5">
        {linhas.map((row) => {
          const isAtual = row.faseId === faseAtualId;
          return (
            <div
              key={row.faseId}
              className="rounded-[var(--moni-radius-md)] px-2 py-1.5"
              style={{
                border: isAtual
                  ? '0.5px solid var(--moni-navy-800)'
                  : '0.5px solid var(--moni-border-default)',
                background: isAtual ? 'var(--moni-surface-100, #fafaf9)' : 'var(--moni-surface-50)',
                boxShadow: isAtual ? 'var(--moni-shadow-sm)' : undefined,
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-1">
                <span
                  className="text-[11px] font-medium text-[var(--moni-text-primary)]"
                  style={{ fontFamily: 'var(--moni-font-sans)' }}
                >
                  {row.faseNome}
                </span>
                <span className={statusClass(row.status)}>{CALCULADORA_STATUS_LABEL[row.status]}</span>
              </div>
              <dl className="mt-1 grid grid-cols-1 gap-0.5 text-[10px] sm:grid-cols-2">
                <div>
                  <dt className="text-[var(--moni-text-tertiary)]">SLA</dt>
                  <dd className="text-[var(--moni-text-secondary)]">
                    {row.slaDias != null && row.slaDias > 0 ? `${row.slaDias} d. úteis` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--moni-text-tertiary)]">Início real</dt>
                  <dd className="text-[var(--moni-text-secondary)]">{fmtData(row.dataInicioReal)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--moni-text-tertiary)]">Fim estimado</dt>
                  <dd className="text-[var(--moni-text-secondary)]">{fmtData(row.dataFimEstimada)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--moni-text-tertiary)]">Fim real</dt>
                  <dd className="text-[var(--moni-text-secondary)]">{fmtData(row.dataFimReal)}</dd>
                </div>
                {row.atrasoDiasUteis != null && row.atrasoDiasUteis > 0 ? (
                  <div className="sm:col-span-2">
                    <dt className="text-[var(--moni-text-tertiary)]">Atraso</dt>
                    <dd className="font-medium text-[var(--moni-status-overdue-text)]">
                      {row.atrasoDiasUteis} dia{row.atrasoDiasUteis === 1 ? '' : 's'} úteis
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
