'use client';

import type { ReactNode } from 'react';
import type { SlaKanbanResult } from '@/lib/kanban/kanban-card-sla';
import { indicadorBolinhaSlaKanban } from '@/lib/kanban/kanban-card-sla';
import type { IndicadorDataKanban } from '@/lib/kanban/kanban-card-datas';
import { formatDataPtBr, indicadorDataKanban } from '@/lib/kanban/kanban-card-datas';

type BolinhaProps = {
  variante: 'atrasado' | 'atencao';
  numero: number;
  title: string;
  /** Sigla opcional abaixo da bolinha (ex.: Fase, FU, R). */
  sigla?: string;
};

export function KanbanPrazoBolinha({ variante, numero, title, sigla }: BolinhaProps) {
  const tooltipText = sigla ? `${sigla} — ${title}` : title;
  const classeVariante =
    variante === 'atrasado' ? 'moni-kanban-card-sla--atrasado' : 'moni-kanban-card-sla--atencao';

  return (
    <span className="group/bol relative inline-flex shrink-0 items-center justify-center">
      <span
        className={`moni-kanban-card-sla ${classeVariante}`}
        title={tooltipText}
        aria-label={tooltipText}
      >
        <span className="moni-kanban-card-sla-dot" aria-hidden />
        {numero}d
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+5px)] left-1/2 z-30 w-max max-w-[220px] -translate-x-1/2 rounded-md px-2 py-1 text-center text-[10px] font-medium leading-snug opacity-0 transition-opacity duration-150 group-hover/bol:opacity-100"
        style={{
          background: 'var(--moni-kanban-col-hd)',
          color: 'var(--moni-surface-0)',
          border: 'var(--moni-border-width) solid var(--moni-kanban-bd)',
        }}
      >
        {tooltipText}
      </span>
    </span>
  );
}

function estiloTextoDataVariante(variante: IndicadorDataKanban['variante']): string {
  if (variante === 'atrasado') return 'moni-kanban-card-sla moni-kanban-card-sla--atrasado';
  if (variante === 'atencao') return 'moni-kanban-card-sla moni-kanban-card-sla--atencao';
  return 'moni-kanban-card-sla moni-kanban-card-sla--ok';
}

/** Reunião sempre em texto — nunca bolinha (todos os funis/kanbans). */
export function TextoReuniaoCard({ dataIso }: { dataIso: string }) {
  const ind = indicadorDataKanban('reuniao', dataIso);
  if (!ind) return null;
  const dataFmt = formatDataPtBr(dataIso);
  const texto = `Reunião: ${dataFmt}`;

  return (
    <span className={estiloTextoDataVariante(ind.variante)} title={ind.title}>
      <span className="moni-kanban-card-sla-dot" aria-hidden />
      {texto}
    </span>
  );
}

function ChipDataOk({ ind }: { ind: IndicadorDataKanban }) {
  return (
    <span className="moni-kanban-card-sla moni-kanban-card-sla--ok" title={ind.title}>
      <span className="moni-kanban-card-sla-dot" aria-hidden />
      <span style={{ color: 'var(--moni-kanban-tm)' }}>FU</span>
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

  if (dataReuniao && indicadorDataKanban('reuniao', dataReuniao)) {
    itens.push(<TextoReuniaoCard key="reuniao" dataIso={dataReuniao} />);
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
    <div className={`moni-kanban-card-indicators ${className}`.trim()}>{itens}</div>
  );
}

function renderIndicadorData(tipo: IndicadorDataKanban['tipo'], dataIso: string) {
  if (tipo === 'reuniao') {
    return <TextoReuniaoCard dataIso={dataIso} />;
  }
  const ind = indicadorDataKanban(tipo, dataIso);
  if (!ind) return null;
  if (ind.variante === 'atrasado' || ind.variante === 'atencao') {
    return (
      <KanbanPrazoBolinha
        variante={ind.variante}
        numero={ind.numero}
        title={ind.title}
        sigla="FU"
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
    <div className={`moni-kanban-card-indicators ${className}`.trim()}>
      <KanbanPrazoBolinha {...bol} sigla="SLA" />
    </div>
  );
}
