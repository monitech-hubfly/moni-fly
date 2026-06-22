'use client';

import { useMemo, useState } from 'react';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import {
  CALCULADORA_STATUS_LABEL,
  calcularResumoExecutivoCalculadoraFases,
  type CalculadoraFaseLinha,
  type CalculadoraStatusGeral,
  type FaseTimelineStatus,
} from '@/lib/kanban/calculadora-fases';
import {
  agruparTimelinePorFunil,
  montarTimelineCalculadoraComMarcos,
  type CalculadoraMarco,
  type CalculadoraMarcoId,
  type CalculadoraMarcosInput,
  type CalculadoraTimelineItem,
} from '@/lib/kanban/calculadora-fases-marcos';
import type { FaseVisit } from '@/lib/kanban/kanban-card-timeline';
import type { KanbanFase } from '@/components/kanban-shared/types';

type Props = {
  linhas: CalculadoraFaseLinha[];
  faseAtualId: string | null;
  cardConcluido?: boolean;
  visits?: FaseVisit[];
  fases?: KanbanFase[];
  marcos?: CalculadoraMarcosInput;
  fasesMeta?: Map<string, KanbanFase>;
  /** painel = centro do drawer (altura livre); compact = legado sidebar */
  variant?: 'painel' | 'compact';
};

function fmtData(iso: string | null): string {
  if (!iso) return '—';
  return formatIsoDateOnlyPtBr(iso) ?? iso;
}

function fmtSla(dias: number | null, tipo: 'uteis' | 'corridos'): string {
  if (dias == null || dias <= 0) return 'SLA variável';
  return tipo === 'corridos' ? `SLA ${dias} d.c.` : `SLA ${dias} d.u.`;
}

function fmtAtrasoAcumulado(uteis: number, corridos: number): string {
  if (uteis <= 0 && corridos <= 0) return 'Nenhum';
  const parts: string[] = [];
  if (uteis > 0) parts.push(`${uteis} d.u.`);
  if (corridos > 0) parts.push(`${corridos} d.c.`);
  return parts.join(' + ');
}

function fmtGargaloResumo(
  g: NonNullable<ReturnType<typeof calcularResumoExecutivoCalculadoraFases>['maiorGargalo']>,
): string {
  const un = g.unidade === 'corridos' ? 'd.c.' : 'd.u.';
  return `${g.faseNome} +${g.dias} ${un}`;
}

function statusResumoLabel(status: CalculadoraStatusGeral): string {
  if (status === 'atrasado') return 'Atrasada';
  if (status === 'concluido') return 'Concluído';
  return 'No prazo';
}

function statusResumoClass(status: CalculadoraStatusGeral): string {
  if (status === 'atrasado') return 'moni-calculadora-badge-atrasada';
  return 'moni-calculadora-badge-prazo';
}

function statusRowClass(status: FaseTimelineStatus): string {
  return `moni-calculadora-fase-row--${status}`;
}

function statusBadgeClass(status: FaseTimelineStatus): string {
  return `moni-calculadora-fase-status moni-calculadora-fase-status--${status}`;
}

function funilDotClass(label: string): string {
  if (/step one/i.test(label)) return 'moni-calculadora-funil-dot--stepone';
  if (/portf[oó]lio/i.test(label)) return 'moni-calculadora-funil-dot--portfolio';
  return 'moni-calculadora-funil-dot--operacoes';
}

function parseFaseSteps(fase: KanbanFase | undefined): string[] {
  if (!fase) return [];
  if (fase.materiais && fase.materiais.length > 0) {
    return fase.materiais.map((m) => m.titulo.trim()).filter(Boolean);
  }
  if (fase.instrucoes?.trim()) {
    return fase.instrucoes
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function CalculadoraResumoExecutivo({
  resumo,
  linhaAtual,
}: {
  resumo: ReturnType<typeof calcularResumoExecutivoCalculadoraFases>;
  linhaAtual: CalculadoraFaseLinha | undefined;
}) {
  const atrasada = resumo.statusGeral === 'atrasado';
  const funilLabel = linhaAtual?.funilLabel ?? '—';
  const slaLabel = linhaAtual ? fmtSla(linhaAtual.slaDias, linhaAtual.slaTipo) : 'SLA variável';

  return (
    <div
      className="moni-calculadora-resumo space-y-1.5 rounded-[var(--moni-radius-md)] px-2.5 py-2"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        background: 'var(--moni-surface-50)',
      }}
    >
      <div className="moni-calculadora-resumo-badges">
        {resumo.dadosParciais ? (
          <span className="moni-calculadora-badge-parcial">⚠ Dados parciais — histórico incompleto</span>
        ) : (
          <span />
        )}
        <span className={statusResumoClass(resumo.statusGeral)}>
          {statusResumoLabel(resumo.statusGeral)}
        </span>
      </div>

      <div className="min-w-0">
        <p className="moni-calculadora-resumo-fase truncate" title={resumo.faseAtualNome ?? undefined}>
          {resumo.faseAtualNome ?? '—'}
        </p>
        <p className="moni-calculadora-resumo-meta truncate">
          Fase atual · {funilLabel} · {slaLabel}
        </p>
      </div>

      <div className="moni-calculadora-resumo-progress-row">
        <div className="moni-calculadora-progress-track moni-calculadora-progress-track--compact min-w-0 flex-1">
          <div
            className={`moni-calculadora-progress-fill${atrasada ? ' moni-calculadora-progress-fill--atraso' : ''}`}
            style={{ width: `${Math.min(100, Math.max(0, resumo.percentualConcluido))}%` }}
          />
        </div>
        <span className="moni-calculadora-resumo-progress-label">
          {resumo.percentualConcluido}% · {resumo.fasesConcluidas}/{resumo.fasesTotal}
        </span>
      </div>

      <dl className="moni-calculadora-resumo-stats">
        <div className="moni-calculadora-resumo-stat">
          <dt>Atraso acumulado</dt>
          <dd>{fmtAtrasoAcumulado(resumo.atrasoAcumuladoUteis, resumo.atrasoAcumuladoCorridos)}</dd>
        </div>
        <div className="moni-calculadora-resumo-stat">
          <dt>Previsão conclusão</dt>
          <dd>{fmtData(resumo.previsaoConclusao)}</dd>
        </div>
        <div className="moni-calculadora-resumo-stat">
          <dt>Maior gargalo</dt>
          <dd
            className="truncate"
            title={resumo.maiorGargalo ? fmtGargaloResumo(resumo.maiorGargalo) : undefined}
          >
            {resumo.maiorGargalo ? fmtGargaloResumo(resumo.maiorGargalo) : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function CalculadoraMarcoRow({ marco }: { marco: CalculadoraMarco }) {
  const id = marco.id as CalculadoraMarcoId;

  return (
    <div className="moni-calculadora-marco-row" role="listitem">
      <span className={`moni-calculadora-marco-dot moni-calculadora-marco-dot--${id}`} aria-hidden />
      <span className="moni-calculadora-marco-label min-w-0 truncate">
        <span className="moni-calculadora-marco-id">{id}</span>
        {marco.label}
      </span>
      <span className="moni-calculadora-marco-data">
        {marco.data ? fmtData(marco.data) : '—'}
        {marco.isPrevisto && marco.data ? (
          <span className="text-[var(--moni-text-tertiary)]"> prev.</span>
        ) : null}
        {!marco.data ? ' previsto' : null}
      </span>
      <span className={`moni-calculadora-marco-badge moni-calculadora-marco-badge--${id}`}>Marco</span>
    </div>
  );
}

function CalculadoraFaseRow({
  row,
  faseMeta,
  expanded,
  onToggle,
}: {
  row: CalculadoraFaseLinha;
  faseMeta: KanbanFase | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isGargalo = row.atrasoDias != null && row.atrasoDias > 0;
  const fimData = row.dataFimReal ?? row.dataFimEstimada;
  const fimLabel = row.dataFimReal ? 'real' : 'est.';
  const steps = parseFaseSteps(faseMeta);
  const unidadeAtraso = row.slaTipo === 'corridos' ? 'd.c.' : 'd.u.';

  return (
    <div
      className={`moni-calculadora-fase-row ${statusRowClass(row.status)}${expanded ? ' open' : ''}${row.status === 'futura' ? ' moni-calculadora-fase-row--futura' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="min-w-0">
        <div className="moni-calculadora-fase-nome-wrap">
          <span className="moni-calculadora-fase-nome" title={row.faseNome}>
            {row.faseNome}
          </span>
          {steps.length > 0 ? (
            <span className="moni-calculadora-fase-chevron" aria-hidden>
              ›
            </span>
          ) : null}
          {isGargalo ? (
            <span className="moni-calculadora-gargalo-badge">
              gargalo · +{row.atrasoDias} {unidadeAtraso}
            </span>
          ) : null}
        </div>
        <div className="moni-calculadora-fase-sla">{fmtSla(row.slaDias, row.slaTipo)}</div>
      </div>

      <div>
        <span className="moni-calculadora-fase-responsavel" title={row.responsavelDaFase ?? undefined}>
          {row.responsavelDaFase ?? '—'}
        </span>
      </div>

      <div>
        <span className="moni-calculadora-fase-data">{fmtData(row.dataInicioReal)}</span>
        <span className="moni-calculadora-fase-data-label">início</span>
      </div>

      <div>
        <span className="moni-calculadora-fase-data">{fmtData(fimData)}</span>
        <span className="moni-calculadora-fase-data-label">{fimLabel}</span>
      </div>

      <div>
        <span className={statusBadgeClass(row.status)}>
          {CALCULADORA_STATUS_LABEL[row.status]}
        </span>
      </div>

      {steps.length > 0 ? (
        <ul className="moni-calculadora-fase-steps">
          {steps.map((step) => (
            <li key={step} className="moni-calculadora-fase-step">
              {step}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CalculadoraFunilGroup({
  label,
  items,
  fasesMeta,
  collapsed,
  onToggle,
  expandedFases,
  onToggleFase,
}: {
  label: string;
  items: CalculadoraTimelineItem[];
  fasesMeta: Map<string, KanbanFase>;
  collapsed: boolean;
  onToggle: () => void;
  expandedFases: Set<string>;
  onToggleFase: (faseId: string) => void;
}) {
  const faseItems = items.filter((i) => i.kind === 'fase');
  const concluidas = faseItems.filter(
    (i) =>
      i.kind === 'fase' &&
      (i.linha.status === 'concluida' || i.linha.status === 'concluida_atraso'),
  ).length;

  return (
    <section className={`moni-calculadora-funil-group${collapsed ? ' collapsed' : ''}`}>
      <button type="button" className="moni-calculadora-funil-header w-full text-left" onClick={onToggle}>
        <span className={`moni-calculadora-funil-dot ${funilDotClass(label)}`} aria-hidden />
        <span className="moni-calculadora-funil-title">{label.replace(/^Funil /i, '')}</span>
        <span className="moni-calculadora-funil-count">
          {faseItems.length} fases · {concluidas} concluídas
        </span>
        <span className="moni-calculadora-funil-chev" aria-hidden>
          ▾
        </span>
      </button>

      <div className="moni-calculadora-funil-body">
        <div className="moni-calculadora-table-header">
          <span>Fase</span>
          <span>Resp. fase</span>
          <span>Início</span>
          <span>Fim</span>
          <span>Status</span>
        </div>
        {items.map((item) =>
          item.kind === 'marco' ? (
            <CalculadoraMarcoRow key={`marco-${item.marco.id}`} marco={item.marco} />
          ) : (
            <CalculadoraFaseRow
              key={item.linha.faseId}
              row={item.linha}
              faseMeta={fasesMeta.get(item.linha.faseId)}
              expanded={expandedFases.has(item.linha.faseId)}
              onToggle={() => onToggleFase(item.linha.faseId)}
            />
          ),
        )}
      </div>
    </section>
  );
}

export function KanbanCardModalCalculadoraFases({
  linhas,
  faseAtualId,
  cardConcluido,
  visits = [],
  fases = [],
  marcos,
  fasesMeta,
  variant = 'compact',
}: Props) {
  const [collapsedFunis, setCollapsedFunis] = useState<Set<string>>(new Set());
  const [expandedFases, setExpandedFases] = useState<Set<string>>(new Set());

  const metaMap = useMemo(() => {
    if (fasesMeta && fasesMeta.size > 0) return fasesMeta;
    return new Map(fases.map((f) => [f.id, f]));
  }, [fasesMeta, fases]);

  const resumo = useMemo(
    () => calcularResumoExecutivoCalculadoraFases(linhas, { cardConcluido, visits }),
    [linhas, cardConcluido, visits],
  );

  const linhaAtual = useMemo(
    () => linhas.find((l) => l.faseId === faseAtualId || l.status === 'atual' || l.status === 'atual_atrasada'),
    [linhas, faseAtualId],
  );

  const timelineItems = useMemo(
    () => montarTimelineCalculadoraComMarcos(linhas, fases, marcos ?? { visits }),
    [linhas, fases, marcos, visits],
  );

  const gruposFunil = useMemo(() => agruparTimelinePorFunil(timelineItems), [timelineItems]);

  const toggleFunil = (label: string) => {
    setCollapsedFunis((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const toggleFase = (faseId: string) => {
    setExpandedFases((prev) => {
      const next = new Set(prev);
      if (next.has(faseId)) next.delete(faseId);
      else next.add(faseId);
      return next;
    });
  };

  if (linhas.length === 0) {
    return (
      <p className="text-[11px] text-[var(--moni-text-tertiary)]" style={{ fontFamily: 'var(--moni-font-sans)' }}>
        Nenhuma fase configurada para a esteira principal.
      </p>
    );
  }

  return (
    <div className={variant === 'painel' ? 'flex h-full min-h-0 flex-col gap-2' : 'space-y-2'}>
      <CalculadoraResumoExecutivo resumo={resumo} linhaAtual={linhaAtual} />

      <div className={variant === 'painel' ? 'flex min-h-0 flex-1 flex-col' : undefined}>
        <div
          className={
            variant === 'painel'
              ? 'min-h-0 flex-1 overflow-y-auto pr-0.5'
              : 'max-h-72 overflow-y-auto pr-0.5'
          }
        >
          {gruposFunil.map((grupo, idx) => (
            <div key={grupo.label}>
              {idx > 0 ? <hr className="moni-calculadora-funil-separator" /> : null}
              <CalculadoraFunilGroup
                label={grupo.label}
                items={grupo.items}
                fasesMeta={metaMap}
                collapsed={collapsedFunis.has(grupo.label)}
                onToggle={() => toggleFunil(grupo.label)}
                expandedFases={expandedFases}
                onToggleFase={toggleFase}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
