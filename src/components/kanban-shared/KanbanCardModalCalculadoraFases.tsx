'use client';

import { useMemo } from 'react';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import {
  CALCULADORA_STATUS_LABEL,
  calcularResumoExecutivoCalculadoraFases,
  type CalculadoraFaseLinha,
  type CalculadoraStatusGeral,
  type FaseTimelineStatus,
} from '@/lib/kanban/calculadora-fases';
import type { FaseVisit } from '@/lib/kanban/kanban-card-timeline';

type Props = {
  linhas: CalculadoraFaseLinha[];
  faseAtualId: string | null;
  cardConcluido?: boolean;
  visits?: FaseVisit[];
};

function fmtData(iso: string | null): string {
  if (!iso) return '—';
  return formatIsoDateOnlyPtBr(iso) ?? iso;
}

function fmtSla(dias: number | null, tipo: 'uteis' | 'corridos'): string {
  if (dias == null || dias <= 0) return '—';
  return tipo === 'corridos' ? `${dias} d.c.` : `${dias} d.u.`;
}

function fmtAtrasoAcumulado(uteis: number, corridos: number): string {
  if (uteis <= 0 && corridos <= 0) return 'Nenhum';
  const parts: string[] = [];
  if (uteis > 0) parts.push(`${uteis} d.u.`);
  if (corridos > 0) parts.push(`${corridos} d.c.`);
  return parts.join(' + ');
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

function statusGeralClass(status: CalculadoraStatusGeral): string {
  switch (status) {
    case 'ok':
      return 'moni-tag-concluido';
    case 'atencao':
      return 'moni-tag-atencao';
    case 'atrasado':
      return 'moni-tag-atrasado';
    case 'concluido':
      return 'moni-tag-concluido';
    default:
      return 'moni-calculadora-status-futura';
  }
}

function fmtGargalo(
  g: NonNullable<ReturnType<typeof calcularResumoExecutivoCalculadoraFases>['maiorGargalo']>,
): string {
  const un = g.unidade === 'corridos' ? 'd.c.' : 'd.u.';
  if (g.motivo === 'atraso') return `${g.faseNome} — ${g.dias} ${un} de atraso`;
  return `${g.faseNome} — ${g.dias} d.c. de permanência`;
}

function CalculadoraResumoExecutivo({
  resumo,
}: {
  resumo: ReturnType<typeof calcularResumoExecutivoCalculadoraFases>;
}) {
  const unidadeNaFase = resumo.diasNaFaseTipo === 'corridos' ? 'd.c.' : 'd.u.';

  return (
    <div
      className="moni-calculadora-resumo space-y-3 rounded-[var(--moni-radius-lg)] p-3"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        background: 'var(--moni-surface-50)',
      }}
    >
      {resumo.dadosParciais ? (
        <p
          className="moni-tag-atencao w-fit text-[10px]"
          style={{ fontFamily: 'var(--moni-font-sans)' }}
        >
          Dados parciais — histórico incompleto
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p
            className="text-[10px] uppercase tracking-wide text-[var(--moni-text-tertiary)]"
            style={{ fontFamily: 'var(--moni-font-sans)' }}
          >
            Resumo do projeto
          </p>
          <p
            className="mt-0.5 text-[13px] font-medium text-[var(--moni-text-primary)]"
            style={{ fontFamily: 'var(--moni-font-display)' }}
          >
            {resumo.faseAtualNome ?? '—'}
          </p>
          {resumo.diasNaFase != null ? (
            <p
              className="text-[11px] text-[var(--moni-text-secondary)]"
              style={{ fontFamily: 'var(--moni-font-sans)' }}
            >
              {resumo.diasNaFase} {unidadeNaFase} na fase atual
            </p>
          ) : null}
        </div>
        <span className={statusGeralClass(resumo.statusGeral)}>{resumo.statusGeralLabel}</span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span
            className="text-[10px] text-[var(--moni-text-tertiary)]"
            style={{ fontFamily: 'var(--moni-font-sans)' }}
          >
            Progresso no funil
          </span>
          <span
            className="text-[10px] font-medium text-[var(--moni-text-secondary)]"
            style={{ fontFamily: 'var(--moni-font-sans)' }}
          >
            {resumo.percentualConcluido}% · {resumo.fasesConcluidas}/{resumo.fasesTotal} fases ativas
          </span>
        </div>
        <div className="moni-calculadora-progress-track">
          <div
            className="moni-calculadora-progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, resumo.percentualConcluido))}%` }}
          />
        </div>
      </div>

      <dl className="moni-calculadora-resumo-grid grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] text-[var(--moni-text-tertiary)]">Atraso acumulado</dt>
          <dd className="text-[11px] font-medium text-[var(--moni-text-primary)]">
            {fmtAtrasoAcumulado(resumo.atrasoAcumuladoUteis, resumo.atrasoAcumuladoCorridos)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-[var(--moni-text-tertiary)]">Previsão de conclusão</dt>
          <dd className="text-[11px] font-medium text-[var(--moni-text-primary)]">
            {fmtData(resumo.previsaoConclusao)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[10px] text-[var(--moni-text-tertiary)]">Maior gargalo</dt>
          <dd className="text-[11px] text-[var(--moni-text-secondary)]">
            {resumo.maiorGargalo ? fmtGargalo(resumo.maiorGargalo) : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function KanbanCardModalCalculadoraFases({
  linhas,
  faseAtualId,
  cardConcluido,
  visits = [],
}: Props) {
  const resumo = useMemo(
    () => calcularResumoExecutivoCalculadoraFases(linhas, { cardConcluido, visits }),
    [linhas, cardConcluido, visits],
  );

  if (linhas.length === 0) {
    return (
      <p className="text-[11px] text-[var(--moni-text-tertiary)]" style={{ fontFamily: 'var(--moni-font-sans)' }}>
        Nenhuma fase configurada para este kanban.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <CalculadoraResumoExecutivo resumo={resumo} />

      <div>
        <p
          className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--moni-text-tertiary)]"
          style={{ fontFamily: 'var(--moni-font-sans)' }}
        >
          Detalhe por fase
        </p>
        <p
          className="mb-2 text-[10px] leading-snug text-[var(--moni-text-tertiary)]"
          style={{ fontFamily: 'var(--moni-font-sans)' }}
        >
          SLA em d.u. (dias úteis) ou d.c. (dias corridos), conforme a fase.
        </p>
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
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
                    <dd className="text-[var(--moni-text-secondary)]">{fmtSla(row.slaDias, row.slaTipo)}</dd>
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
                  {row.atrasoDias != null && row.atrasoDias > 0 ? (
                    <div className="sm:col-span-2">
                      <dt className="text-[var(--moni-text-tertiary)]">Atraso</dt>
                      <dd className="font-medium text-[var(--moni-status-overdue-text)]">
                        {row.atrasoDias} {row.slaTipo === 'corridos' ? 'd.c.' : 'd.u.'}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
