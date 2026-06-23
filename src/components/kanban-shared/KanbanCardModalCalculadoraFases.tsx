'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
import { useCalculadoraShareLink } from '@/hooks/useCalculadoraShareLink';

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
  /** ID do card — habilita botão Compartilhar (omitir em modo público). */
  cardId?: string;
  /** Leitura pública via token — oculta ações internas. */
  modoPublico?: boolean;
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
  const base = 'moni-calculadora-fase-row';
  if (status === 'concluida' || status === 'concluida_atraso') {
    return `${base} moni-calc-row-pass moni-calculadora-fase-row--${status}`;
  }
  if (status === 'atual') return `${base} moni-calc-row-atu moni-calculadora-fase-row--atual`;
  if (status === 'atual_atrasada') {
    return `${base} moni-calc-row-atu-at moni-calculadora-fase-row--atual_atrasada`;
  }
  return `${base} moni-calc-row-fut moni-calculadora-fase-row--futura`;
}

function responsavelCellClass(val: string | null | undefined, status: FaseTimelineStatus): string {
  const v = String(val ?? '').trim();
  if (!v || v === '—') return 'moni-calculadora-fase-responsavel resp moni-calculadora-fase-responsavel--empty';
  if (status === 'futura') return 'moni-calculadora-fase-responsavel resp moni-calculadora-fase-responsavel--futura';
  if (/^mon[ií]/i.test(v)) return 'moni-calculadora-fase-responsavel resp moni-calculadora-fase-responsavel--moni';
  if (/franqueado/i.test(v)) return 'moni-calculadora-fase-responsavel resp moni-calculadora-fase-responsavel--franqueado';
  return 'moni-calculadora-fase-responsavel resp';
}

function statusBadgeClass(status: FaseTimelineStatus): string {
  const base = 'moni-calculadora-fase-status';
  if (status === 'concluida' || status === 'concluida_atraso') {
    return `${base} moni-calc-badge-pass`;
  }
  if (status === 'atual') return `${base} moni-calc-badge-atu`;
  if (status === 'atual_atrasada') return `${base} moni-calc-badge-atu-at`;
  return `${base} moni-calc-badge-fut`;
}

function prazoPillClass(atrasada: boolean): string {
  return `moni-calc-prazo-pill${atrasada ? ' at' : ' undef'}`;
}

function funilEsteiraKind(label: string): 'stepone' | 'portfolio' | 'operacoes' {
  if (/step\s*one|stepone/i.test(label)) return 'stepone';
  if (/portf[oó]lio/i.test(label)) return 'portfolio';
  return 'operacoes';
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
    <div className="moni-calculadora-resumo">
      <div className="moni-calculadora-resumo-top">
        <p className="moni-calculadora-resumo-fase truncate" title={resumo.faseAtualNome ?? undefined}>
          {resumo.faseAtualNome ?? '—'}
        </p>
        <div className="moni-calculadora-resumo-badges">
          {resumo.dadosParciais ? (
            <span className="moni-calculadora-badge-parcial">⚠ Dados parciais</span>
          ) : null}
          {linhaAtual?.slaPrazoNaoDefinido ? (
            <span className={prazoPillClass(atrasada)}>Prazo não definido</span>
          ) : null}
          <span className={statusResumoClass(resumo.statusGeral)}>
            {statusResumoLabel(resumo.statusGeral)}
          </span>
        </div>
      </div>
      <p className="moni-calculadora-resumo-meta truncate">
        {funilLabel} · {slaLabel}
      </p>

      <div className="moni-calculadora-resumo-progress-row">
        <div className="moni-calc-prog-track min-w-0 flex-1">
          <div
            className={`moni-calc-prog-fill${atrasada ? ' at' : ''}`}
            style={{ width: `${Math.min(100, Math.max(0, resumo.percentualConcluido))}%` }}
          />
        </div>
        <span className="moni-calculadora-resumo-progress-label">
          {resumo.percentualConcluido}% · {resumo.fasesConcluidas}/{resumo.fasesTotal}
        </span>
      </div>

      <dl className="moni-calculadora-resumo-stats">
        <div className="moni-calculadora-resumo-stat">
          <dt className="moni-calculadora-resumo-stat-lbl">Atraso acumulado</dt>
          <dd
            className={`moni-calculadora-resumo-stat-val${
              resumo.atrasoAcumuladoUteis > 0 || resumo.atrasoAcumuladoCorridos > 0
                ? ' moni-calculadora-resumo-stat-val--atraso'
                : ''
            }`}
          >
            {fmtAtrasoAcumulado(resumo.atrasoAcumuladoUteis, resumo.atrasoAcumuladoCorridos)}
          </dd>
        </div>
        <div className="moni-calculadora-resumo-stat">
          <dt className="moni-calculadora-resumo-stat-lbl">Previsão conclusão</dt>
          <dd className="moni-calculadora-resumo-stat-val">{fmtData(resumo.previsaoConclusao)}</dd>
        </div>
        <div className="moni-calculadora-resumo-stat">
          <dt className="moni-calculadora-resumo-stat-lbl">Maior gargalo</dt>
          <dd
            className={`moni-calculadora-resumo-stat-val truncate${resumo.maiorGargalo ? ' moni-calculadora-resumo-stat-val--gargalo' : ''}`}
            title={resumo.maiorGargalo ? fmtGargaloResumo(resumo.maiorGargalo) : undefined}
          >
            {resumo.maiorGargalo ? fmtGargaloResumo(resumo.maiorGargalo) : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function CalculadoraMarcoSep({ marco }: { marco: CalculadoraMarco }) {
  const id = marco.id as CalculadoraMarcoId;
  const dataFmt = marco.data ? fmtData(marco.data) : null;

  return (
    <div className={`moni-calc-marco-sep moni-calc-marco-sep--${id}`} role="separator">
      <div className="moni-calc-marco-line" aria-hidden />
      <div className={`moni-calc-marco-pill moni-calc-marco-pill--${id}`}>
        <span className={`moni-calc-marco-dot moni-calc-marco-dot--${id}`} aria-hidden />
        <span>{marco.label}</span>
        {dataFmt ? <span className="moni-calc-marco-data">{dataFmt}</span> : null}
        <span className={`moni-calculadora-marco-badge moni-calculadora-marco-badge--${id}`}>Marco</span>
      </div>
      <div className="moni-calc-marco-line" aria-hidden />
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
  const steps = parseFaseSteps(faseMeta);
  const custo = String(row.custo ?? '').trim();
  const temCusto = custo.length > 0 && custo !== '—';
  const hasExpand = steps.length > 0;
  const isGargalo = row.atrasoDias !== null && row.atrasoDias > 0;
  const fimData = row.dataFimReal ?? row.dataFimEstimada;
  const fimLabel = row.dataFimReal ? 'real' : 'est.';
  const inicioLabel = row.status === 'futura' ? 'prev.' : 'início';
  const unidadeAtraso = row.slaTipo === 'corridos' ? 'd.c.' : 'd.u.';

  const fimAtraso =
    row.status === 'atual_atrasada' ||
    (row.status === 'concluida_atraso' && row.atrasoDias !== null && row.atrasoDias > 0);

  return (
    <div
      className={`${statusRowClass(row.status)}${expanded ? ' open' : ''}${hasExpand ? '' : ' moni-calculadora-fase-row--no-expand'}`}
      role={hasExpand ? 'button' : undefined}
      tabIndex={hasExpand ? 0 : undefined}
      onClick={hasExpand ? onToggle : undefined}
      onKeyDown={
        hasExpand
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
    >
      <div className="min-w-0">
        <div className="moni-calculadora-fase-nome-wrap">
          <span className="moni-calculadora-fase-nome fn" title={row.faseNome}>
            {row.faseNome}
          </span>
          {hasExpand ? (
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
        <div className="moni-calculadora-fase-sla-wrap">
          <div className="moni-calculadora-fase-sla fsla">{fmtSla(row.slaDias, row.slaTipo)}</div>
          {temCusto ? (
            <div className="moni-calc-fcusto" title={custo}>
              Custo: {custo}
            </div>
          ) : null}
          {row.slaPrazoNaoDefinido ? (
            <span className={prazoPillClass(row.status === 'atual_atrasada')}>Prazo não definido</span>
          ) : null}
        </div>
      </div>

      <div>
        <span className={responsavelCellClass(row.responsavelDaFase, row.status)} title={row.responsavelDaFase ?? undefined}>
          {row.responsavelDaFase ?? '—'}
        </span>
      </div>

      <div>
        <span className="moni-calculadora-fase-data fd-val">{fmtData(row.dataInicioReal)}</span>
        <span className="moni-calculadora-fase-data-label">{inicioLabel}</span>
      </div>

      <div>
        <span
          className={`moni-calculadora-fase-data fd-val${fimAtraso ? ' fd-val--atraso' : ''}`}
        >
          {fmtData(fimData)}
        </span>
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

  const esteira = funilEsteiraKind(label);

  return (
    <section
      className={`moni-calculadora-funil-group moni-calculadora-funil-group--${esteira}${collapsed ? ' moni-calculadora-funil-collapsed collapsed' : ''}`}
    >
      <button
        type="button"
        className={`moni-calculadora-funil-header moni-calculadora-funil-header--${esteira} w-full text-left`}
        onClick={onToggle}
      >
        <span className={`moni-calculadora-funil-dot moni-calculadora-funil-dot--${esteira}`} aria-hidden />
        <span className="moni-calculadora-funil-title">{label.replace(/^Funil /i, '')}</span>
        <span className="moni-calculadora-funil-count">
          {faseItems.length} fases · {concluidas} concluídas
        </span>
        <span className="moni-calculadora-funil-chev" aria-hidden>
          <ChevronDown size={14} strokeWidth={2} />
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
            <CalculadoraMarcoSep key={`marco-${item.marco.id}`} marco={item.marco} />
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
  cardId,
  modoPublico = false,
}: Props) {
  const [collapsedFunis, setCollapsedFunis] = useState<Set<string>>(new Set());
  const [expandedFases, setExpandedFases] = useState<Set<string>>(new Set());
  const { loading: shareLoading, copied: shareCopied, gerarECopiar } = useCalculadoraShareLink(
    cardId ?? '',
  );

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
      {!modoPublico && cardId ? (
        <div className="moni-calculadora-section-header">
          <span className="moni-calculadora-section-title">Calculadora de fases</span>
          <button
            type="button"
            onClick={() => void gerarECopiar()}
            disabled={shareLoading}
            className="moni-calculadora-share-btn"
            aria-label="Copiar link público da calculadora"
          >
            {shareLoading ? '...' : shareCopied ? '✓ Copiado' : '⤴ Compartilhar'}
          </button>
        </div>
      ) : null}

      <CalculadoraResumoExecutivo resumo={resumo} linhaAtual={linhaAtual} />

      <p className="moni-calculadora-footnote">
        SLA em d.u. (dias úteis) e d.c. (dias corridos). Clique no funil para recolher.
      </p>

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
