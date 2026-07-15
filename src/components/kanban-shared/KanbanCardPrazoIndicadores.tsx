'use client';

import type { ReactNode } from 'react';
import { Clock } from 'lucide-react';
import type { SlaKanbanResult } from '@/lib/kanban/kanban-card-sla';
import { tagSlaKanbanParaExibicao } from '@/lib/kanban/kanban-card-sla';
import type { IndicadorDataKanban } from '@/lib/kanban/kanban-card-datas';
import { formatDataPtBr, indicadorDataKanban } from '@/lib/kanban/kanban-card-datas';

const TITULO_POR_TIPO: Record<IndicadorDataKanban['tipo'], string> = {
  reuniao: 'Reunião',
  followup: 'Follow-up',
};

function classeTagSlaKanban(variante: 'ok' | 'atencao' | 'atrasado'): string {
  if (variante === 'atrasado') return 'moni-kanban-card-sla moni-kanban-card-sla--atrasado';
  if (variante === 'atencao') return 'moni-kanban-card-sla moni-kanban-card-sla--atencao';
  return 'moni-kanban-card-sla moni-kanban-card-sla--ok';
}

/** Tag textual de SLA — padrão em todos os funis/kanbans. */
export function KanbanSlaTag({
  sla,
  className = '',
}: {
  sla: SlaKanbanResult;
  className?: string;
}) {
  const tag = tagSlaKanbanParaExibicao(sla);
  if (!tag) return null;
  return (
    <span className={`${classeTagSlaKanban(tag.variante)} ${className}`.trim()} title={tag.texto}>
      <Clock className="moni-kanban-card-sla-icon" aria-hidden />
      {tag.texto}
    </span>
  );
}

function estiloTextoDataVariante(variante: IndicadorDataKanban['variante']): string {
  if (variante === 'atrasado') return 'moni-kanban-card-sla moni-kanban-card-sla--atrasado';
  if (variante === 'atencao') return 'moni-kanban-card-sla moni-kanban-card-sla--atencao';
  return 'moni-kanban-card-sla moni-kanban-card-sla--ok';
}

/** Tag textual de data (reunião / follow-up) — mesmo tamanho das tags de SLA. */
function TextoDataCard({
  tipo,
  dataIso,
  varianteVisual = 'chip',
}: {
  tipo: IndicadorDataKanban['tipo'];
  dataIso: string;
  /** `chip` — pill colorido; `texto` — linha do rodapé (bolinhas · reunião). */
  varianteVisual?: 'chip' | 'texto';
}) {
  const ind = indicadorDataKanban(tipo, dataIso);
  if (!ind) return null;
  const dataFmt = formatDataPtBr(dataIso);
  const texto = `${TITULO_POR_TIPO[tipo]}: ${dataFmt}`;

  if (varianteVisual === 'texto') {
    return (
      <span
        className={`moni-kanban-card-reuniao moni-kanban-card-reuniao--${ind.variante}`}
        title={ind.title}
      >
        {texto}
      </span>
    );
  }

  return (
    <span className={estiloTextoDataVariante(ind.variante)} title={ind.title}>
      <span className="moni-kanban-card-sla-dot" aria-hidden />
      {texto}
    </span>
  );
}

/** Reunião sempre em texto — nunca bolinha compacta (todos os funis/kanbans). */
export function TextoReuniaoCard({
  dataIso,
  varianteVisual = 'chip',
}: {
  dataIso: string;
  varianteVisual?: 'chip' | 'texto';
}) {
  return <TextoDataCard tipo="reuniao" dataIso={dataIso} varianteVisual={varianteVisual} />;
}

type IndicadoresProps = {
  sla: SlaKanbanResult;
  dataReuniao?: string | null;
  ocultarSla?: boolean;
  ocultarReuniao?: boolean;
  className?: string;
};

/** Linha compacta de SLA + reunião para cards do kanban. */
export function KanbanCardPrazoIndicadores({
  sla,
  dataReuniao,
  ocultarSla = false,
  ocultarReuniao = false,
  className = '',
}: IndicadoresProps) {
  const itens: ReactNode[] = [];

  if (!ocultarSla) {
    const slaTag = tagSlaKanbanParaExibicao(sla);
    if (slaTag) {
      itens.push(<KanbanSlaTag key="sla" sla={sla} />);
    }
  }

  if (!ocultarReuniao && dataReuniao && indicadorDataKanban('reuniao', dataReuniao)) {
    itens.push(<TextoReuniaoCard key="reuniao" dataIso={dataReuniao} />);
  }

  if (itens.length === 0) return null;

  return (
    <div className={`moni-kanban-card-indicators ${className}`.trim()}>{itens}</div>
  );
}

function renderIndicadorData(tipo: IndicadorDataKanban['tipo'], dataIso: string) {
  return <TextoDataCard tipo={tipo} dataIso={dataIso} />;
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

/** SLA isolado — útil em cards legados (Painel Step One, modal, etc.). */
export function KanbanCardSlaBolinha({
  sla,
  className = '',
}: {
  sla: Pick<SlaKanbanResult, 'status' | 'label'> &
    Partial<Pick<SlaKanbanResult, 'diasAtraso' | 'diasRestantes' | 'pausado' | 'slaTipo' | 'classe'>>;
  className?: string;
}) {
  const full: SlaKanbanResult = { pausado: false, classe: '', ...sla };
  if (full.pausado) return null;
  return (
    <div className={`moni-kanban-card-indicators ${className}`.trim()}>
      <KanbanSlaTag sla={full} />
    </div>
  );
}
