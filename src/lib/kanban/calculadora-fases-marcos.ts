import type { KanbanFase } from '@/components/kanban-shared/types';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import type { CalculadoraFaseLinha } from '@/lib/kanban/calculadora-fases';
import type { FaseVisit } from '@/lib/kanban/kanban-card-timeline';

export type CalculadoraMarcoId = 'M0' | 'M4' | 'M8' | 'M24';

export type CalculadoraMarco = {
  id: CalculadoraMarcoId;
  label: string;
  data: string | null;
  isPrevisto: boolean;
  funilLabel: string;
};

export type CalculadoraMarcosInput = {
  opcao_assinada_em?: string | null;
  obra_iniciada_em?: string | null;
  obra_finalizada_em?: string | null;
  concluido_em?: string | null;
  visits: FaseVisit[];
};

export type CalculadoraTimelineItem =
  | { kind: 'fase'; linha: CalculadoraFaseLinha }
  | { kind: 'marco'; marco: CalculadoraMarco };

const MARCO_DEFS: {
  id: CalculadoraMarcoId;
  label: string;
  funilLabel: string;
  anchor: 'after' | 'before';
  match: (slug: string | null | undefined, nome: string) => boolean;
}[] = [
  {
    id: 'M0',
    label: 'Opção firmada',
    funilLabel: 'Funil Step One',
    anchor: 'after',
    match: (slug, nome) =>
      slug === FASE_SLUGS.HIPOTESES ||
      slug === 'stepone_hipoteses' ||
      /hip[oó]tese/i.test(nome),
  },
  {
    id: 'M4',
    label: 'Passagem Wayser',
    funilLabel: 'Funil Portfólio',
    anchor: 'after',
    match: (slug, nome) =>
      slug === FASE_SLUGS.CAPTACAO_CAPITAL || /capta[cç][aã]o.*mon[ií].*capital/i.test(nome),
  },
  {
    id: 'M8',
    label: 'Início da obra',
    funilLabel: 'Funil Pré Obra e Obra',
    anchor: 'before',
    match: (slug, nome) => slug === FASE_SLUGS.EM_OBRA || /em obra/i.test(nome),
  },
  {
    id: 'M24',
    label: 'Liquidação final',
    funilLabel: 'Funil Pré Obra e Obra',
    anchor: 'after',
    match: (slug, nome) =>
      slug === FASE_SLUGS.OPERACOES_ENTREGUE || /^entregue$/i.test(nome.trim()),
  },
];

function toYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const head = String(iso).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

function slugPorFaseId(fases: KanbanFase[]): Map<string, string | null | undefined> {
  return new Map(fases.map((f) => [f.id, f.slug]));
}

function findFaseIndex(
  linhas: CalculadoraFaseLinha[],
  slugs: Map<string, string | null | undefined>,
  match: (slug: string | null | undefined, nome: string) => boolean,
): number {
  for (let i = 0; i < linhas.length; i++) {
    const row = linhas[i]!;
    const slug = slugs.get(row.faseId);
    if (match(slug, row.faseNome)) return i;
  }
  return -1;
}

function dataFimRef(linha: CalculadoraFaseLinha | undefined): string | null {
  if (!linha) return null;
  return linha.dataFimReal ?? linha.dataFimEstimada ?? linha.dataInicioReal;
}

function dataInicioRef(linha: CalculadoraFaseLinha | undefined): string | null {
  if (!linha) return null;
  return linha.dataInicioReal ?? linha.dataFimEstimada;
}

function visitEntradaEmFase(visits: FaseVisit[], faseId: string | undefined): string | null {
  if (!faseId) return null;
  const visit = visits.find((v) => v.faseId === faseId);
  return visit ? toYmd(visit.entrou) : null;
}

function resolverDataMarco(
  id: CalculadoraMarcoId,
  input: CalculadoraMarcosInput,
  linhas: CalculadoraFaseLinha[],
  slugs: Map<string, string | null | undefined>,
  fases: KanbanFase[],
): { data: string | null; isPrevisto: boolean } {
  const idxHipoteses = findFaseIndex(linhas, slugs, MARCO_DEFS[0]!.match);
  const idxCaptacao = findFaseIndex(linhas, slugs, MARCO_DEFS[1]!.match);
  const idxEmObra = findFaseIndex(linhas, slugs, MARCO_DEFS[2]!.match);
  const idxEntregue = findFaseIndex(linhas, slugs, MARCO_DEFS[3]!.match);

  if (id === 'M0') {
    const real = toYmd(input.opcao_assinada_em);
    if (real) return { data: real, isPrevisto: false };
    return { data: dataFimRef(linhas[idxHipoteses]), isPrevisto: true };
  }

  if (id === 'M4') {
    const passagemFase = fases.find(
      (f) =>
        f.slug === FASE_SLUGS.PASSAGEM_WAYSER ||
        /passagem.*wayser/i.test(f.nome),
    );
    const visitDate = visitEntradaEmFase(input.visits, passagemFase?.id);
    if (visitDate) return { data: visitDate, isPrevisto: false };
    const prevPassagem = idxCaptacao >= 0 ? linhas[idxCaptacao + 1] : undefined;
    const prev =
      dataInicioRef(prevPassagem) ??
      dataFimRef(linhas[idxCaptacao]) ??
      dataFimRef(prevPassagem);
    return { data: prev, isPrevisto: true };
  }

  if (id === 'M8') {
    const real = toYmd(input.obra_iniciada_em);
    if (real) return { data: real, isPrevisto: false };
    const prev = idxEmObra > 0 ? linhas[idxEmObra - 1] : undefined;
    return {
      data: dataInicioRef(linhas[idxEmObra]) ?? dataFimRef(prev),
      isPrevisto: true,
    };
  }

  const real =
    toYmd(input.obra_finalizada_em) ??
    toYmd(input.concluido_em);
  if (real) return { data: real, isPrevisto: false };
  return { data: dataFimRef(linhas[idxEntregue]), isPrevisto: true };
}

type InsercaoMarco = { index: number; marco: CalculadoraMarco };

/** Intercala marcos M0/M4/M8/M24 na timeline de fases da esteira. */
export function montarTimelineCalculadoraComMarcos(
  linhas: CalculadoraFaseLinha[],
  fases: KanbanFase[],
  marcosInput: CalculadoraMarcosInput,
): CalculadoraTimelineItem[] {
  if (linhas.length === 0) return [];

  const slugs = slugPorFaseId(fases);
  const insercoes: InsercaoMarco[] = [];

  for (const def of MARCO_DEFS) {
    const idx = findFaseIndex(linhas, slugs, def.match);
    if (idx < 0) continue;

    const insertAt = def.anchor === 'after' ? idx + 1 : idx;
    const { data, isPrevisto } = resolverDataMarco(def.id, marcosInput, linhas, slugs, fases);

    insercoes.push({
      index: insertAt,
      marco: {
        id: def.id,
        label: def.label,
        data,
        isPrevisto,
        funilLabel: def.funilLabel,
      },
    });
  }

  insercoes.sort((a, b) => b.index - a.index);

  const items: CalculadoraTimelineItem[] = linhas.map((linha) => ({ kind: 'fase', linha }));
  for (const { index, marco } of insercoes) {
    items.splice(index, 0, { kind: 'marco', marco });
  }

  return items;
}

/** Agrupa itens da timeline (fases + marcos) por funil. */
export function agruparTimelinePorFunil(
  items: CalculadoraTimelineItem[],
): { label: string; items: CalculadoraTimelineItem[] }[] {
  const grupos: { label: string; items: CalculadoraTimelineItem[] }[] = [];

  for (const item of items) {
    const label =
      item.kind === 'fase'
        ? item.linha.funilLabel ?? 'Fases'
        : item.marco.funilLabel;

    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.label === label) ultimo.items.push(item);
    else grupos.push({ label, items: [item] });
  }

  return grupos;
}
