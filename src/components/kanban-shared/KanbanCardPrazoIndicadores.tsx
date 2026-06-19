'use client';

import type { ReactNode } from 'react';
import type { SlaKanbanResult } from '@/lib/kanban/kanban-card-sla';
import { indicadorBolinhaSlaKanban } from '@/lib/kanban/kanban-card-sla';
import type { IndicadorDataKanban } from '@/lib/kanban/kanban-card-datas';
import { indicadorDataKanban } from '@/lib/kanban/kanban-card-datas';

type BolinhaProps = {
  variante: 'atrasado' | 'atencao';
  numero: number;
  title: string;
  /** Sigla opcional abaixo da bolinha (ex.: Fase, FU, R). */
  sigla?: string;
};

export function KanbanPrazoBolinha({ variante, numero, title, sigla }: BolinhaProps) {
  const atrasado = variante === 'atrasado';
  const tooltipText = sigla ? `${sigla} — ${title}` : title;

  return (
    <span className="group/bol relative inline-flex shrink-0 items-center justify-center">
      <span
        className="inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-0.5 text-[8px] font-semibold tabular-nums leading-none"
        style={{
          background: atrasado ? 'var(--moni-status-overdue-bg)' : 'var(--moni-status-attention-bg)',
          color: atrasado ? 'var(--moni-status-overdue-text)' : 'var(--moni-status-attention-text)',
          border: atrasado
            ? '0.5px solid var(--moni-status-overdue-border)'
            : '0.5px solid var(--moni-status-attention-border)',
        }}
        title={tooltipText}
        aria-label={tooltipText}
      >
        {numero}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+5px)] left-1/2 z-30 w-max max-w-[220px] -translate-x-1/2 rounded-md px-2 py-1 text-center text-[10px] font-medium leading-snug opacity-0 transition-opacity duration-150 group-hover/bol:opacity-100"
        style={{
          background: 'var(--moni-navy-800)',
          color: 'var(--moni-surface-0)',
          border: '0.5px solid var(--moni-border-default)',
        }}
      >
        {tooltipText}
      </span>
    </span>
  );
}

function ChipDataOk({ ind }: { ind: IndicadorDataKanban }) {
  const sigla = ind.tipo === 'reuniao' ? 'R' : 'FU';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
      style={{
        color: 'var(--moni-text-secondary)',
        background: 'var(--moni-surface-100)',
        border: '0.5px solid var(--moni-border-subtle)',
      }}
      title={ind.title}
    >
      <span style={{ color: 'var(--moni-text-tertiary)' }}>{sigla}</span>
      {ind.rotuloCurto}
    </span>
  );
}

type IndicadoresProps = {
  sla: SlaKanbanResult;
  dataReuniao?: string | null;
  dataFollowup?: string | null;
  ocultarSla?: boolean;
  className?: string;
};

/** Linha compacta de SLA + reunião + follow-up para cards do kanban. */
export function KanbanCardPrazoIndicadores({
  sla,
  dataReuniao,
  dataFollowup,
  ocultarSla = false,
  className = '',
}: IndicadoresProps) {
  const itens: ReactNode[] = [];

  if (!ocultarSla) {
    const slaBol = indicadorBolinhaSlaKanban(sla);
    if (slaBol) {
      itens.push(
        <KanbanPrazoBolinha
          key="sla"
          {...slaBol}
          sigla="SLA"
        />,
      );
    }
  }

  const reuniao = dataReuniao ? indicadorDataKanban('reuniao', dataReuniao) : null;
  if (reuniao) {
    if (reuniao.variante === 'atrasado' || reuniao.variante === 'atencao') {
      itens.push(
        <KanbanPrazoBolinha
          key="reuniao"
          variante={reuniao.variante}
          numero={reuniao.numero}
          title={reuniao.title}
          sigla="R"
        />,
      );
    } else {
      itens.push(<ChipDataOk key="reuniao" ind={reuniao} />);
    }
  }

  const followup = dataFollowup ? indicadorDataKanban('followup', dataFollowup) : null;
  if (followup) {
    if (followup.variante === 'atrasado' || followup.variante === 'atencao') {
      itens.push(
        <KanbanPrazoBolinha
          key="followup"
          variante={followup.variante}
          numero={followup.numero}
          title={followup.title}
          sigla="FU"
        />,
      );
    } else {
      itens.push(<ChipDataOk key="followup" ind={followup} />);
    }
  }

  if (itens.length === 0) return null;

  return (
    <div className={`mt-1.5 flex flex-wrap items-center gap-1 ${className}`.trim()}>{itens}</div>
  );
}

function renderIndicadorData(tipo: IndicadorDataKanban['tipo'], dataIso: string) {
  const ind = indicadorDataKanban(tipo, dataIso);
  if (!ind) return null;
  const sigla = tipo === 'reuniao' ? 'R' : 'FU';
  if (ind.variante === 'atrasado' || ind.variante === 'atencao') {
    return (
      <KanbanPrazoBolinha
        variante={ind.variante}
        numero={ind.numero}
        title={ind.title}
        sigla={sigla}
      />
    );
  }
  return <ChipDataOk ind={ind} />;
}

/** Indicador inline de reunião ou follow-up (modal, campos editáveis). */
export function KanbanDataIndicador({
  tipo,
  dataIso,
}: {
  tipo: IndicadorDataKanban['tipo'];
  dataIso: string;
}) {
  return renderIndicadorData(tipo, dataIso);
}

/** SLA isolado — útil em cards legados (Painel Step One, etc.). */
export function KanbanCardSlaBolinha({
  sla,
  className = '',
}: {
  sla: Pick<SlaKanbanResult, 'status' | 'label' | 'diasAtraso' | 'diasRestantes'> & { pausado?: boolean };
  className?: string;
}) {
  const bol = indicadorBolinhaSlaKanban({ pausado: false, ...sla } as SlaKanbanResult);
  if (!bol) return null;
  return (
    <div className={`mt-1.5 flex items-center gap-1 ${className}`.trim()}>
      <KanbanPrazoBolinha {...bol} sigla="SLA" />
    </div>
  );
}
