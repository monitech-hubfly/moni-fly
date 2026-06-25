import type { KanbanFase } from '@/components/kanban-shared/types';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { parseIsoDateOnlyLocal } from '@/lib/dias-uteis';
import type { CalculadoraFaseLinha } from '@/lib/kanban/calculadora-fases';
import type { FaseVisit } from '@/lib/kanban/kanban-card-timeline';
import {
  negocioPrazoInstrumentoValoresPadrao,
  negocioPrazoOpcaoValoresPadrao,
  negocioPrazoValoresFromProcessoRow,
  resolverDataPrazoNegocioYmd,
  type NegocioPrazoValores,
} from '@/lib/kanban/dados-negocio-prazo';

export type CalculadoraMarcoId = 'M0' | 'M4' | 'M24' | 'MO' | 'MIG';

export type CalculadoraMarco = {
  id: CalculadoraMarcoId;
  label: string;
  /** Fim do marco (alias de dataFim). */
  data: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  isPrevisto: boolean;
  funilLabel: string;
  /** Custo associado ao marco (ex.: M4 — instrumento garantidor). */
  custo?: string | null;
};

export type CalculadoraMarcosInput = {
  contrato_assinado_em?: string | null;
  obra_finalizada_em?: string | null;
  concluido_em?: string | null;
  opcao_assinada_em?: string | null;
  prazo_opcao?: NegocioPrazoValores | null;
  prazo_instrumento_garantidor?: NegocioPrazoValores | null;
  visits: FaseVisit[];
};

export type CalculadoraTimelineItem =
  | { kind: 'fase'; linha: CalculadoraFaseLinha }
  | { kind: 'marco'; marco: CalculadoraMarco };

const CUSTO_INSTRUMENTO_GARANTIDOR =
  'Franqueado: instrumento que assegure o terrenista do recebimento do valor do terreno no final da operação';

type MarcoDatas = {
  dataInicio: string | null;
  dataFim: string | null;
  isPrevisto: boolean;
};

const MARCO_DEFS: {
  id: Extract<CalculadoraMarcoId, 'M0' | 'M4' | 'M24'>;
  label: string;
  funilLabel: string;
  custo?: string | null;
  anchor: 'after' | 'before' | 'replace';
  match: (slug: string | null | undefined, nome: string) => boolean;
}[] = [
  {
    id: 'M0',
    label: 'Contrato',
    funilLabel: 'Funil Portfólio',
    anchor: 'replace',
    match: (slug, nome) =>
      slug === FASE_SLUGS.STEP_7 || /^contrato$/i.test(nome.trim()),
  },
  {
    id: 'M4',
    label: 'Transferência do Terreno',
    funilLabel: 'Funil Pré Obra e Obra',
    custo: CUSTO_INSTRUMENTO_GARANTIDOR,
    anchor: 'replace',
    match: (slug, nome) =>
      slug === FASE_SLUGS.PROCESSOS_CARTORARIOS ||
      /transfer[eê]ncia.*terreno/i.test(nome.trim()),
  },
  {
    id: 'M24',
    label: 'Liquidação',
    funilLabel: 'Funil Pré Obra e Obra',
    anchor: 'after',
    match: (slug, nome) =>
      slug === FASE_SLUGS.OPERACOES_ENTREGUE || /^entregue$/i.test(nome.trim()),
  },
];

const MARCOS_PRAZO_NEGOCIO: {
  id: Extract<CalculadoraMarcoId, 'MO' | 'MIG'>;
  label: string;
  custo?: string | null;
  resolver: (input: CalculadoraMarcosInput, linhas: CalculadoraFaseLinha[]) => MarcoDatas;
}[] = [
  {
    id: 'MO',
    label: 'Fim Opção',
    resolver: (input, linhas) => {
      const real = toYmd(input.opcao_assinada_em);
      if (real) return { dataInicio: real, dataFim: real, isPrevisto: false };
      return resolverDatasPrazoNegocio(input.prazo_opcao, linhas);
    },
  },
  {
    id: 'MIG',
    label: 'Limite Contratação Instrumento Garantidor',
    custo: CUSTO_INSTRUMENTO_GARANTIDOR,
    resolver: (input, linhas) =>
      resolverDatasPrazoNegocio(input.prazo_instrumento_garantidor, linhas),
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

function inicioAposFaseAnterior(
  linhas: CalculadoraFaseLinha[],
  idx: number,
  slugs: Map<string, string | null | undefined>,
): string | null {
  if (idx > 0) {
    const ant = linhas[idx - 1]!;
    const fim = ant.dataFimReal ?? ant.dataFimEstimada ?? ant.dataInicioReal;
    if (fim) return fim;
  }
  return null;
}

function dataFimRef(linha: CalculadoraFaseLinha | undefined): string | null {
  if (!linha) return null;
  return linha.dataFimReal ?? linha.dataFimEstimada ?? linha.dataInicioReal;
}

function resolverDatasPrazoNegocio(
  valores: NegocioPrazoValores | null | undefined,
  linhas: CalculadoraFaseLinha[],
): MarcoDatas {
  if (!valores?.modo) return { dataInicio: null, dataFim: null, isPrevisto: true };

  if (valores.modo === 'data') {
    const d = valores.data?.trim().slice(0, 10) ?? '';
    const dataFim = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
    return { dataInicio: null, dataFim, isPrevisto: true };
  }

  const linha = linhas.find((l) => l.faseId === valores.faseId);
  const anchor = linha
    ? linha.dataFimReal ?? linha.dataFimEstimada ?? linha.dataInicioReal
    : null;
  const { data: dataFim, isPrevisto } = resolverDataPrazoNegocioYmd(valores, linhas);
  return { dataInicio: anchor, dataFim, isPrevisto };
}

function marcoFromDatas(
  datas: MarcoDatas,
  partial: Omit<CalculadoraMarco, 'data' | 'dataInicio' | 'dataFim' | 'isPrevisto'>,
): CalculadoraMarco {
  return {
    ...partial,
    dataInicio: datas.dataInicio,
    dataFim: datas.dataFim,
    data: datas.dataFim,
    isPrevisto: datas.isPrevisto,
  };
}

function resolverDatasMarco(
  id: Extract<CalculadoraMarcoId, 'M0' | 'M4' | 'M24'>,
  input: CalculadoraMarcosInput,
  linhas: CalculadoraFaseLinha[],
  slugs: Map<string, string | null | undefined>,
): MarcoDatas {
  const def = MARCO_DEFS.find((d) => d.id === id);
  if (!def) return { dataInicio: null, dataFim: null, isPrevisto: true };

  const idx = findFaseIndex(linhas, slugs, def.match);
  const linha = idx >= 0 ? linhas[idx] : undefined;

  if (id === 'M0') {
    const realFim = toYmd(input.contrato_assinado_em);
    const dataInicio =
      linha?.dataInicioReal ??
      (() => {
        const idxDil = findFaseIndex(
          linhas,
          slugs,
          (slug, nome) => slug === 'step_6' || /dilig[eê]ncia/i.test(nome.trim()),
        );
        if (idxDil >= 0) {
          const dil = linhas[idxDil]!;
          return dil.dataFimReal ?? dil.dataFimEstimada ?? null;
        }
        return inicioAposFaseAnterior(linhas, idx, slugs);
      })();
    const dataFim =
      realFim ?? linha?.dataFimReal ?? linha?.dataFimEstimada ?? dataFimRef(linha);
    return {
      dataInicio,
      dataFim,
      isPrevisto: !realFim && linha?.dataFimReal == null,
    };
  }

  if (id === 'M4') {
    const dataFim = dataFimRef(linha);
    return {
      dataInicio: inicioAposFaseAnterior(linhas, idx, slugs),
      dataFim,
      isPrevisto: linha?.dataFimReal == null,
    };
  }

  const real = toYmd(input.obra_finalizada_em) ?? toYmd(input.concluido_em);
  if (real) return { dataInicio: inicioAposFaseAnterior(linhas, idx, slugs), dataFim: real, isPrevisto: false };
  return {
    dataInicio: inicioAposFaseAnterior(linhas, idx, slugs),
    dataFim: dataFimRef(linha),
    isPrevisto: true,
  };
}

type InsercaoMarco = { index: number; marco: CalculadoraMarco; replace: boolean };

function dataReferenciaItem(item: CalculadoraTimelineItem): string | null {
  if (item.kind === 'marco') return item.marco.dataFim ?? item.marco.data;
  const l = item.linha;
  return l.dataFimReal ?? l.dataFimEstimada ?? l.dataInicioReal ?? null;
}

function funilLabelNoIndice(items: CalculadoraTimelineItem[], index: number): string {
  for (let i = index - 1; i >= 0; i--) {
    const it = items[i]!;
    if (it.kind === 'fase' && it.linha.funilLabel) return it.linha.funilLabel;
    if (it.kind === 'marco' && it.marco.funilLabel) return it.marco.funilLabel;
  }
  return 'Dados do Negócio';
}

function insertIndexPorData(items: CalculadoraTimelineItem[], dataYmd: string): number {
  const target = parseIsoDateOnlyLocal(dataYmd);
  if (!target) return items.length;

  for (let i = 0; i < items.length; i++) {
    const ref = dataReferenciaItem(items[i]!);
    if (!ref) continue;
    const d = parseIsoDateOnlyLocal(ref);
    if (d && d > target) return i;
  }
  return items.length;
}

function inserirMarcosPrazoNegocio(
  items: CalculadoraTimelineItem[],
  marcosInput: CalculadoraMarcosInput,
  linhas: CalculadoraFaseLinha[],
): CalculadoraTimelineItem[] {
  const candidatos: CalculadoraMarco[] = [];

  for (const def of MARCOS_PRAZO_NEGOCIO) {
    const datas = def.resolver(marcosInput, linhas);
    if (!datas.dataFim && !datas.dataInicio) continue;
    candidatos.push(
      marcoFromDatas(datas, {
        id: def.id,
        label: def.label,
        funilLabel: 'Dados do Negócio',
        custo: def.custo ?? null,
      }),
    );
  }

  candidatos.sort((a, b) => {
    const da = a.dataFim ?? a.dataInicio ?? '';
    const db = b.dataFim ?? b.dataInicio ?? '';
    return da < db ? -1 : da > db ? 1 : 0;
  });

  const out = [...items];
  for (const marco of candidatos) {
    const refData = marco.dataFim ?? marco.dataInicio;
    if (!refData) continue;
    const idx = insertIndexPorData(out, refData);
    out.splice(idx, 0, {
      kind: 'marco',
      marco: { ...marco, funilLabel: funilLabelNoIndice(out, idx) },
    });
  }
  return out;
}

/** Intercala marcos na timeline de fases da esteira (âncora por fase + prazos do negócio por data). */
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

    const insertAt = def.anchor === 'after' ? idx + 1 : def.anchor === 'replace' ? idx : idx;
    const datas = resolverDatasMarco(def.id, marcosInput, linhas, slugs);
    const linhaAnchora = def.anchor === 'replace' ? linhas[idx] : undefined;

    insercoes.push({
      index: insertAt,
      replace: def.anchor === 'replace',
      marco: marcoFromDatas(datas, {
        id: def.id,
        label: def.label,
        funilLabel: def.funilLabel,
        custo: def.custo ?? linhaAnchora?.custo ?? null,
      }),
    });
  }

  insercoes.sort((a, b) => b.index - a.index);

  let items: CalculadoraTimelineItem[] = linhas.map((linha) => ({ kind: 'fase', linha }));
  for (const { index, marco, replace } of insercoes) {
    if (replace) items.splice(index, 1, { kind: 'marco', marco });
    else items.splice(index, 0, { kind: 'marco', marco });
  }

  items = inserirMarcosPrazoNegocio(items, marcosInput, linhas);
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

/** Monta input de marcos a partir de linha `processo_step_one`. */
export function calculadoraMarcosInputFromProcessoRow(
  row: Record<string, unknown> | null | undefined,
  base: Omit<CalculadoraMarcosInput, 'prazo_opcao' | 'prazo_instrumento_garantidor'>,
): CalculadoraMarcosInput {
  const prazoOpcao = negocioPrazoValoresFromProcessoRow(row, 'prazo_opcao');
  const prazoInstrumento = negocioPrazoValoresFromProcessoRow(row, 'prazo_instrumento_garantidor');
  return {
    ...base,
    prazo_opcao: prazoOpcao.modo ? prazoOpcao : negocioPrazoOpcaoValoresPadrao(),
    prazo_instrumento_garantidor: prazoInstrumento.modo
      ? prazoInstrumento
      : negocioPrazoInstrumentoValoresPadrao(),
  };
}
