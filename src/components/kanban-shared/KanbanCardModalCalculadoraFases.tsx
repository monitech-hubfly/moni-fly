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
  /** painel = centro do drawer (altura livre); compact = legado sidebar */
  variant?: 'painel' | 'compact';
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
      className="moni-calculadora-resumo space-y-1.5 rounded-[var(--moni-radius-md)] px-2.5 py-2"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        background: 'var(--moni-surface-50)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        {resumo.dadosParciais ? (
          <p
            className="moni-tag-atencao text-[9px] leading-tight"
            style={{ fontFamily: 'var(--moni-font-sans)' }}
          >
            Dados parciais — histórico incompleto
          </p>
        ) : null}
        <span
          className={`${statusGeralClass(resumo.statusGeral)} text-[9px] leading-tight${resumo.dadosParciais ? '' : ' ml-auto'}`}
        >
          {resumo.statusGeralLabel}
        </span>
      </div>

      <div className="min-w-0">
        <p
          className="text-[9px] uppercase tracking-wide text-[var(--moni-text-tertiary)]"
          style={{ fontFamily: 'var(--moni-font-sans)' }}
        >
          Resumo do projeto
        </p>
        <p
          className="truncate text-[12px] font-medium leading-snug text-[var(--moni-text-primary)]"
          style={{ fontFamily: 'var(--moni-font-sans)' }}
          title={resumo.faseAtualNome ?? undefined}
        >
          {resumo.faseAtualNome ?? '—'}
          {resumo.diasNaFase != null ? (
            <span className="font-normal text-[var(--moni-text-tertiary)]">
              {' '}
              · {resumo.diasNaFase} {unidadeNaFase}
            </span>
          ) : null}
        </p>
      </div>

      <div>
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span
            className="text-[9px] text-[var(--moni-text-tertiary)]"
            style={{ fontFamily: 'var(--moni-font-sans)' }}
          >
            Progresso na esteira
          </span>
          <span
            className="shrink-0 text-[9px] font-medium text-[var(--moni-text-secondary)]"
            style={{ fontFamily: 'var(--moni-font-sans)' }}
          >
            {resumo.percentualConcluido}% · {resumo.fasesConcluidas}/{resumo.fasesTotal}
          </span>
        </div>
        <div className="moni-calculadora-progress-track moni-calculadora-progress-track--compact">
          <div
            className="moni-calculadora-progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, resumo.percentualConcluido))}%` }}
          />
        </div>
      </div>

      <dl className="moni-calculadora-resumo-grid grid grid-cols-1 gap-x-3 gap-y-1 text-[10px] sm:grid-cols-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 sm:block">
          <dt className="text-[var(--moni-text-tertiary)]">Atraso acumulado</dt>
          <dd className="font-medium text-[var(--moni-text-primary)]">
            {fmtAtrasoAcumulado(resumo.atrasoAcumuladoUteis, resumo.atrasoAcumuladoCorridos)}
          </dd>
        </div>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 sm:block">
          <dt className="text-[var(--moni-text-tertiary)]">Previsão de conclusão</dt>
          <dd className="font-medium text-[var(--moni-text-primary)]">
            {fmtData(resumo.previsaoConclusao)}
          </dd>
        </div>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 sm:col-span-2 sm:block">
          <dt className="shrink-0 text-[var(--moni-text-tertiary)]">Maior gargalo</dt>
          <dd className="truncate text-[var(--moni-text-secondary)]" title={resumo.maiorGargalo ? fmtGargalo(resumo.maiorGargalo) : undefined}>
            {resumo.maiorGargalo ? fmtGargalo(resumo.maiorGargalo) : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function agruparLinhasPorFunil(linhas: CalculadoraFaseLinha[]): { label: string; linhas: CalculadoraFaseLinha[] }[] {
  const grupos: { label: string; linhas: CalculadoraFaseLinha[] }[] = [];
  for (const row of linhas) {
    const label = row.funilLabel ?? 'Fases';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.label === label) ultimo.linhas.push(row);
    else grupos.push({ label, linhas: [row] });
  }
  return grupos;
}

function CalculadoraFaseCard({
  row,
  faseAtualId,
}: {
  row: CalculadoraFaseLinha;
  faseAtualId: string | null;
}) {
  const isAtual = row.faseId === faseAtualId;

  const metaItems: { label: string; value: string }[] = [
    { label: 'SLA', value: fmtSla(row.slaDias, row.slaTipo) },
    { label: 'Início', value: fmtData(row.dataInicioReal) },
    { label: 'Fim est.', value: fmtData(row.dataFimEstimada) },
    { label: 'Fim real', value: fmtData(row.dataFimReal) },
  ];
  if (row.atrasoDias != null && row.atrasoDias > 0) {
    metaItems.push({
      label: 'Atraso',
      value: `${row.atrasoDias} ${row.slaTipo === 'corridos' ? 'd.c.' : 'd.u.'}`,
    });
  }

  return (
    <div
      className="rounded-[var(--moni-radius-md)] px-2 py-1"
      style={{
        border: isAtual
          ? '0.5px solid var(--moni-navy-800)'
          : '0.5px solid var(--moni-border-default)',
        background: isAtual ? 'var(--moni-surface-100, #fafaf9)' : 'var(--moni-surface-50)',
        boxShadow: isAtual ? 'var(--moni-shadow-sm)' : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span
          className="min-w-0 truncate text-[11px] font-medium leading-tight text-[var(--moni-text-primary)]"
          style={{ fontFamily: 'var(--moni-font-sans)' }}
          title={row.faseNome}
        >
          {row.faseNome}
        </span>
        <span className={`${statusClass(row.status)} shrink-0 text-[9px] leading-tight`}>
          {CALCULADORA_STATUS_LABEL[row.status]}
        </span>
      </div>
      <dl className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] leading-tight">
        {metaItems.map(({ label, value }) => (
          <div key={label} className="inline-flex min-w-0 items-baseline gap-0.5">
            <dt className="shrink-0 text-[var(--moni-text-tertiary)]">{label}</dt>
            <dd
              className={
                label === 'Atraso'
                  ? 'font-medium text-[var(--moni-status-overdue-text)]'
                  : 'text-[var(--moni-text-secondary)]'
              }
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function KanbanCardModalCalculadoraFases({
  linhas,
  faseAtualId,
  cardConcluido,
  visits = [],
  variant = 'compact',
}: Props) {
  const resumo = useMemo(
    () => calcularResumoExecutivoCalculadoraFases(linhas, { cardConcluido, visits }),
    [linhas, cardConcluido, visits],
  );

  const gruposFunil = useMemo(() => agruparLinhasPorFunil(linhas), [linhas]);

  if (linhas.length === 0) {
    return (
      <p className="text-[11px] text-[var(--moni-text-tertiary)]" style={{ fontFamily: 'var(--moni-font-sans)' }}>
        Nenhuma fase configurada para a esteira principal.
      </p>
    );
  }

  return (
    <div className={variant === 'painel' ? 'flex h-full min-h-0 flex-col gap-2' : 'space-y-2'}>
      <CalculadoraResumoExecutivo resumo={resumo} />

      <div className={variant === 'painel' ? 'flex min-h-0 flex-1 flex-col' : undefined}>
        <p
          className="mb-0.5 text-[9px] uppercase tracking-wide text-[var(--moni-text-tertiary)]"
          style={{ fontFamily: 'var(--moni-font-sans)' }}
        >
          Detalhe por fase
        </p>
        <p
          className="mb-1.5 text-[9px] leading-snug text-[var(--moni-text-tertiary)]"
          style={{ fontFamily: 'var(--moni-font-sans)' }}
        >
          SLA em d.u. (dias úteis) ou d.c. (dias corridos), conforme a fase.
        </p>
        <div
          className={
            variant === 'painel'
              ? 'min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5'
              : 'max-h-72 space-y-2 overflow-y-auto pr-0.5'
          }
        >
          {gruposFunil.map((grupo) => (
            <section
              key={grupo.label}
              className="moni-calculadora-funil-bloco space-y-1 rounded-[var(--moni-radius-md)] px-2 py-1.5"
              style={{
                border: '0.5px solid var(--moni-border-default)',
                background: 'var(--moni-surface-0)',
              }}
            >
              <h5
                className="text-[9px] font-semibold uppercase tracking-wide text-[var(--moni-text-secondary)]"
                style={{ fontFamily: 'var(--moni-font-sans)' }}
              >
                {grupo.label}
              </h5>
              {grupo.linhas.map((row) => (
                <CalculadoraFaseCard key={row.faseId} row={row} faseAtualId={faseAtualId} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
