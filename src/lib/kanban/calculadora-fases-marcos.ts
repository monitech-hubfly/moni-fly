import type { KanbanFase } from '@/components/kanban-shared/types';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { formatLocalYmd, parseIsoDateOnlyLocal } from '@/lib/dias-uteis';
import type { CalculadoraFaseLinha } from '@/lib/kanban/calculadora-fases';
import type { FaseVisit } from '@/lib/kanban/kanban-card-timeline';
import {
  addBusinessDays,
  DIAS_ALVARA_APOS_PREFEITURA,
} from '@/lib/kanban/previsibilidade-operacoes';

export type CalculadoraMarcoId = 'M0' | 'M4' | 'M24';

export type CalculadoraMarco = {
  id: CalculadoraMarcoId;
  label: string;
  data: string | null;
  isPrevisto: boolean;
  funilLabel: string;
  /** Custo associado ao marco (ex.: M4 — instrumento garantidor). */
  custo?: string | null;
};

export type CalculadoraMarcosInput = {
  contrato_assinado_em?: string | null;
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
  custo?: string | null;
  anchor: 'after' | 'before';
  match: (slug: string | null | undefined, nome: string) => boolean;
}[] = [
  /** M0 — após Contrato (step_7), Funil Portfólio */
  {
    id: 'M0',
    label: 'Opção firmada',
    funilLabel: 'Funil Portfólio',
    anchor: 'after',
    match: (slug, nome) =>
      slug === FASE_SLUGS.STEP_7 || /^contrato$/i.test(nome.trim()),
  },
  /** M4 — após Aprovação na Prefeitura, Funil Operações */
  {
    id: 'M4',
    label: 'Emissão do alvará',
    funilLabel: 'Funil Pré Obra e Obra',
    custo:
      'Franqueado: instrumento que assegure o terrenista do recebimento do valor do terreno no final da operação',
    anchor: 'after',
    match: (slug, nome) =>
      slug === FASE_SLUGS.APROVACAO_PREFEITURA ||
      /aprova[cç][aã]o.*prefeitura/i.test(nome),
  },
  /** M24 — após Entregue (operacoes_entregue), Funil Operações */
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

function marcoDataAposFimFase(
  linha: CalculadoraFaseLinha | undefined,
  diasUteis: number,
): { data: string | null; isPrevisto: boolean } {
  const fim = dataFimRef(linha);
  if (!fim) return { data: null, isPrevisto: true };
  const base = parseIsoDateOnlyLocal(fim);
  if (!base) return { data: null, isPrevisto: true };
  return {
    data: formatLocalYmd(addBusinessDays(base, diasUteis)),
    isPrevisto: linha?.dataFimReal == null,
  };
}

function resolverDataMarco(
  id: CalculadoraMarcoId,
  input: CalculadoraMarcosInput,
  linhas: CalculadoraFaseLinha[],
  slugs: Map<string, string | null | undefined>,
): { data: string | null; isPrevisto: boolean } {
  const def = MARCO_DEFS.find((d) => d.id === id);
  if (!def) return { data: null, isPrevisto: true };

  const idx = findFaseIndex(linhas, slugs, def.match);

  if (id === 'M0') {
    const real = toYmd(input.contrato_assinado_em);
    if (real) return { data: real, isPrevisto: false };
    return { data: dataFimRef(linhas[idx]), isPrevisto: true };
  }

  if (id === 'M4') {
    return marcoDataAposFimFase(idx >= 0 ? linhas[idx] : undefined, DIAS_ALVARA_APOS_PREFEITURA);
  }

  const real =
    toYmd(input.obra_finalizada_em) ??
    toYmd(input.concluido_em);
  if (real) return { data: real, isPrevisto: false };
  return { data: dataFimRef(linhas[idx]), isPrevisto: true };
}

type InsercaoMarco = { index: number; marco: CalculadoraMarco };

/** Intercala marcos M0/M4/M24 na timeline de fases da esteira. */
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
    const { data, isPrevisto } = resolverDataMarco(def.id, marcosInput, linhas, slugs);

    insercoes.push({
      index: insertAt,
      marco: {
        id: def.id,
        label: def.label,
        data,
        isPrevisto,
        funilLabel: def.funilLabel,
        custo: def.custo ?? null,
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
