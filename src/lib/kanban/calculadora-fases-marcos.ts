import type { KanbanFase } from '@/components/kanban-shared/types';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import {
  adicionarMesesCalendarioYmd,
  formatLocalYmd,
  parseIsoDateOnlyLocal,
} from '@/lib/dias-uteis';
import type { CalculadoraFaseLinha, FaseTimelineStatus } from '@/lib/kanban/calculadora-fases';
import type { NegociacaoLinha } from '@/lib/kanban/negociacao-linhas';
import type { FaseVisit } from '@/lib/kanban/kanban-card-timeline';
import {
  negocioPrazoInstrumentoValoresPadrao,
  negocioPrazoOpcaoValoresPadrao,
  negocioPrazoValoresFromProcessoRow,
  resolverDataPrazoNegocioYmd,
  type NegocioPrazoValores,
} from '@/lib/kanban/dados-negocio-prazo';

export type CalculadoraMarcoId =
  | 'M0'
  | 'M4'
  | 'M24'
  | 'MO'
  | 'MIG'
  | 'fim_planta'
  | 'fim_target'
  | 'fim_liquidacao';

/** Meses após o fim do contrato (M0) para o limite regulatório do marco M4. */
export const M4_MESES_APOS_FIM_CONTRATO = 4;

/** Meses após o fim do contrato (M0) para a data limite do marco M24 Fim da Operação. */
export const M24_MESES_APOS_FIM_CONTRATO = 24;

/** Meses após `obra_iniciada_em` para o fim do cenário planta (BCA). */
export const FIM_PLANTA_MESES_APOS_OBRA = 3;

/** Meses após `obra_iniciada_em` para o fim do cenário target (BCA). */
export const FIM_TARGET_MESES_APOS_OBRA = 8;

/** Meses após `obra_iniciada_em` para o fim do cenário liquidação (BCA). */
export const FIM_LIQUIDACAO_MESES_APOS_OBRA = 12;

export type CalculadoraMarco = {
  id: CalculadoraMarcoId;
  label: string;
  /** Fim do marco (alias de dataFim). */
  data: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  isPrevisto: boolean;
  funilLabel: string;
  /** Custo associado ao marco (ex.: M4 — transferência do terreno). */
  custo?: string | null;
  /** Exibe título + badge Marco; sem início, status nem custo (data limite opcional). */
  somenteRotulo?: boolean;
  /** Status da fase substituída (ex.: M0 ← Contrato). */
  status?: FaseTimelineStatus | null;
  dataInicioReal?: string | null;
  dataFimReal?: string | null;
  dataFimEstimada?: string | null;
  /** Data limite derivada do fim do contrato (ex.: M4 = +4 meses, M24 = +24 meses). */
  dataLimiteContrato?: string | null;
  /** Limite calculado a partir de `contrato_assinado_em` (não estimativa da fase Contrato). */
  limiteContratoReal?: boolean;
};

export type CalculadoraMarcosInput = {
  contrato_assinado_em?: string | null;
  obra_iniciada_em?: string | null;
  obra_finalizada_em?: string | null;
  concluido_em?: string | null;
  opcao_assinada_em?: string | null;
  prazo_opcao?: NegocioPrazoValores | null;
  prazo_instrumento_garantidor?: NegocioPrazoValores | null;
  visits: FaseVisit[];
};

export type CalculadoraTimelineItem =
  | { kind: 'fase'; linha: CalculadoraFaseLinha }
  | { kind: 'marco'; marco: CalculadoraMarco }
  | {
      kind: 'negociacao';
      negociacao: NegociacaoLinha & {
        dataPagamentoResolvida: string | null;
        dataPagamentoPrevista: boolean;
        vinculoLabel: string | null;
        status: FaseTimelineStatus;
      };
      index: number;
      funilLabel: string;
    };

const CUSTO_TRANSFERENCIA_TERRENO =
  'Franqueado: ITBI, impostos, taxas para transferência e custas do terreno';
type MarcoDatas = {
  dataInicio: string | null;
  dataFim: string | null;
  isPrevisto: boolean;
};

const MARCO_DEFS: {
  id: Extract<CalculadoraMarcoId, 'M0' | 'M4'>;
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
    custo: CUSTO_TRANSFERENCIA_TERRENO,
    anchor: 'replace',
    match: (slug, nome) =>
      slug === FASE_SLUGS.PROCESSOS_CARTORARIOS ||
      /transfer[eê]ncia.*terreno/i.test(nome.trim()),
  },
];

const MARCOS_PRAZO_NEGOCIO: {
  id: Extract<CalculadoraMarcoId, 'MO' | 'MIG' | 'M24'>;
  label: string;
  custo?: string | null;
  somenteRotulo?: boolean;
  resolver: (
    input: CalculadoraMarcosInput,
    linhas: CalculadoraFaseLinha[],
    slugs: Map<string, string | null | undefined>,
  ) => MarcoDatas;
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
    somenteRotulo: true,
    resolver: (input, linhas) =>
      resolverDatasPrazoNegocio(input.prazo_instrumento_garantidor, linhas),
  },
  {
    id: 'M24',
    label: 'Fim da Operação',
    somenteRotulo: true,
    resolver: (input, linhas, slugs) => {
      const fimContratoReal = toYmd(input.contrato_assinado_em);
      const fimContrato = resolverDataFimContrato(input, linhas, slugs);
      if (!fimContrato) return { dataInicio: null, dataFim: null, isPrevisto: true };
      const dataLimite = adicionarMesesCalendarioYmd(
        fimContrato,
        M24_MESES_APOS_FIM_CONTRATO,
      );
      return { dataInicio: null, dataFim: dataLimite, isPrevisto: !fimContratoReal };
    },
  },
];

const MARCOS_BCA: {
  id: Extract<CalculadoraMarcoId, 'fim_planta' | 'fim_target' | 'fim_liquidacao'>;
  label: string;
  mesesAposObra: number;
  anchorSlug: string;
  posicao: 'within_em_obra' | 'after_em_obra' | 'after_operacoes_entregue';
  somenteRotulo: true;
}[] = [
  {
    id: 'fim_planta',
    label: 'Fim cenário planta',
    mesesAposObra: FIM_PLANTA_MESES_APOS_OBRA,
    anchorSlug: FASE_SLUGS.EM_OBRA,
    posicao: 'within_em_obra',
    somenteRotulo: true,
  },
  {
    id: 'fim_target',
    label: 'Fim cenário target',
    mesesAposObra: FIM_TARGET_MESES_APOS_OBRA,
    anchorSlug: FASE_SLUGS.EM_OBRA,
    posicao: 'after_em_obra',
    somenteRotulo: true,
  },
  {
    id: 'fim_liquidacao',
    label: 'Fim cenário liquidação',
    mesesAposObra: FIM_LIQUIDACAO_MESES_APOS_OBRA,
    anchorSlug: FASE_SLUGS.OPERACOES_ENTREGUE,
    posicao: 'after_operacoes_entregue',
    somenteRotulo: true,
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

/** Data fim do contrato (M0): assinatura real ou estimativa da fase Contrato. */
function resolverDataFimContrato(
  input: CalculadoraMarcosInput,
  linhas: CalculadoraFaseLinha[],
  slugs: Map<string, string | null | undefined>,
): string | null {
  const realFim = toYmd(input.contrato_assinado_em);
  if (realFim) return realFim;

  const idx = findFaseIndex(
    linhas,
    slugs,
    (slug, nome) => slug === FASE_SLUGS.STEP_7 || /^contrato$/i.test(nome.trim()),
  );
  const linha = idx >= 0 ? linhas[idx] : undefined;
  return linha?.dataFimReal ?? linha?.dataFimEstimada ?? dataFimRef(linha);
}

/** Sinaliza atraso quando a referência ultrapassa o limite em meses após o fim do contrato. */
function aplicarLimiteMesesAposContrato(
  marco: CalculadoraMarco,
  mesesLimite: number,
  dataFimContrato: string | null,
  refYmd: string,
): CalculadoraMarco {
  if (marco.id !== 'M4' || !dataFimContrato) return marco;

  const limite = adicionarMesesCalendarioYmd(dataFimContrato, mesesLimite);
  if (!limite) return marco;

  const marcoComLimite: CalculadoraMarco = { ...marco, dataLimiteContrato: limite };
  if (refYmd <= limite) return marcoComLimite;

  const fimReal = marco.dataFimReal;
  if (fimReal) {
    if (fimReal > limite) {
      return { ...marcoComLimite, status: 'concluida_atraso' };
    }
    return marcoComLimite;
  }

  return { ...marcoComLimite, status: 'atual_atrasada' };
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

function contratoTemFimReal(input: CalculadoraMarcosInput): boolean {
  return Boolean(toYmd(input.contrato_assinado_em));
}

function obraTemInicioReal(input: CalculadoraMarcosInput): boolean {
  return Boolean(toYmd(input.obra_iniciada_em));
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
    dataFimReal: !datas.isPrevisto ? datas.dataFim : null,
    dataFimEstimada: datas.isPrevisto ? datas.dataFim : null,
  };
}

/** Copia status e datas reais/estimadas da fase substituída pelo marco. */
function enriquecerMarcoComLinhaAnchora(
  marco: CalculadoraMarco,
  linhaAnchora: CalculadoraFaseLinha | undefined,
): CalculadoraMarco {
  if (!linhaAnchora) return marco;

  const dataFim =
    linhaAnchora.dataFimReal ?? linhaAnchora.dataFimEstimada ?? marco.dataFim;
  const dataInicio = linhaAnchora.dataInicioReal ?? marco.dataInicio;

  return {
    ...marco,
    status: linhaAnchora.status,
    dataInicioReal: linhaAnchora.dataInicioReal,
    dataFimReal: linhaAnchora.dataFimReal,
    dataFimEstimada: linhaAnchora.dataFimEstimada,
    dataInicio,
    dataFim,
    data: dataFim,
    isPrevisto: !linhaAnchora.dataFimReal,
  };
}

function resolverDatasMarco(
  id: Extract<CalculadoraMarcoId, 'M0' | 'M4'>,
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

  return { dataInicio: null, dataFim: null, isPrevisto: true };
}

type InsercaoMarco = { index: number; marco: CalculadoraMarco; replace: boolean };

function dataReferenciaItem(item: CalculadoraTimelineItem): string | null {
  if (item.kind === 'marco') return item.marco.dataFim ?? item.marco.data;
  if (item.kind === 'negociacao') return item.negociacao.dataPagamentoResolvida;
  const l = item.linha;
  return l.dataFimReal ?? l.dataFimEstimada ?? l.dataInicioReal ?? null;
}

export function funilLabelNoIndice(items: CalculadoraTimelineItem[], index: number): string {
  for (let i = index - 1; i >= 0; i--) {
    const it = items[i]!;
    if (it.kind === 'fase' && it.linha.funilLabel) return it.linha.funilLabel;
    if (it.kind === 'marco' && it.marco.funilLabel) return it.marco.funilLabel;
    if (it.kind === 'negociacao' && it.funilLabel) return it.funilLabel;
  }
  return 'Dados do Negócio';
}

export function insertIndexPorData(items: CalculadoraTimelineItem[], dataYmd: string): number {
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

function findPhaseItemIndexBySlug(
  items: CalculadoraTimelineItem[],
  slugs: Map<string, string | null | undefined>,
  slug: string,
): number {
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (it.kind !== 'fase') continue;
    if (slugs.get(it.linha.faseId) === slug) return i;
  }
  return -1;
}

function findMarcoItemIndex(items: CalculadoraTimelineItem[], id: CalculadoraMarcoId): number {
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (it.kind === 'marco' && it.marco.id === id) return i;
  }
  return -1;
}

/** Data início da obra: `obra_iniciada_em` real ou estimativa da fase Em Obra na timeline. */
function resolverDataInicioObra(
  input: CalculadoraMarcosInput,
  linhas: CalculadoraFaseLinha[],
  slugs: Map<string, string | null | undefined>,
): string | null {
  const realInicio = toYmd(input.obra_iniciada_em);
  if (realInicio) return realInicio;

  const idx = findFaseIndex(
    linhas,
    slugs,
    (slug, nome) => slug === FASE_SLUGS.EM_OBRA || /^em\s*obra$/i.test(nome.trim()),
  );
  const linha = idx >= 0 ? linhas[idx] : undefined;
  if (linha?.dataInicioReal) return linha.dataInicioReal;

  if (idx >= 0) {
    const inicioEstimado = inicioAposFaseAnterior(linhas, idx, slugs);
    if (inicioEstimado) return inicioEstimado;
  }

  return null;
}

/** Datas derivadas do início da obra (+ meses calendário). Sem âncora → previsto sem data. */
function resolverDatasMarcoBca(
  input: CalculadoraMarcosInput,
  linhas: CalculadoraFaseLinha[],
  slugs: Map<string, string | null | undefined>,
  mesesAposObra: number,
): MarcoDatas {
  const inicioObra = resolverDataInicioObra(input, linhas, slugs);
  if (!inicioObra) return { dataInicio: null, dataFim: null, isPrevisto: true };
  const dataFim = adicionarMesesCalendarioYmd(inicioObra, mesesAposObra);
  return { dataInicio: null, dataFim, isPrevisto: !obraTemInicioReal(input) };
}

function insertIndexMarcoBca(
  items: CalculadoraTimelineItem[],
  slugs: Map<string, string | null | undefined>,
  def: (typeof MARCOS_BCA)[number],
  dataYmd: string | null,
): number {
  const idxEmObra = findPhaseItemIndexBySlug(items, slugs, FASE_SLUGS.EM_OBRA);
  const idxEntregue = findPhaseItemIndexBySlug(items, slugs, FASE_SLUGS.OPERACOES_ENTREGUE);

  if (def.posicao === 'within_em_obra') {
    let insertAt = idxEmObra >= 0 ? idxEmObra + 1 : items.length;
    if (dataYmd) insertAt = Math.max(insertAt, insertIndexPorData(items, dataYmd));
    return insertAt;
  }

  if (def.posicao === 'after_em_obra') {
    let insertAt = idxEmObra >= 0 ? idxEmObra + 1 : items.length;
    const idxPlanta = findMarcoItemIndex(items, 'fim_planta');
    if (idxPlanta >= 0) insertAt = Math.max(insertAt, idxPlanta + 1);
    if (dataYmd) insertAt = Math.max(insertAt, insertIndexPorData(items, dataYmd));
    return insertAt;
  }

  let insertAt = idxEntregue >= 0 ? idxEntregue + 1 : items.length;
  if (dataYmd) insertAt = Math.max(insertAt, insertIndexPorData(items, dataYmd));
  return insertAt;
}

function inserirMarcosBca(
  items: CalculadoraTimelineItem[],
  marcosInput: CalculadoraMarcosInput,
  linhas: CalculadoraFaseLinha[],
  slugs: Map<string, string | null | undefined>,
): CalculadoraTimelineItem[] {
  const out = [...items];

  for (const def of MARCOS_BCA) {
    const datas = resolverDatasMarcoBca(marcosInput, linhas, slugs, def.mesesAposObra);
    const marco = marcoFromDatas(datas, {
      id: def.id,
      label: def.label,
      funilLabel: 'Dados do Negócio',
      custo: null,
      somenteRotulo: def.somenteRotulo,
    });
    const refData = marco.dataFim ?? marco.dataInicio;
    const idx = insertIndexMarcoBca(out, slugs, def, refData);
    out.splice(idx, 0, {
      kind: 'marco',
      marco: { ...marco, funilLabel: funilLabelNoIndice(out, idx) },
    });
  }

  return out;
}

function inserirMarcosPrazoNegocio(
  items: CalculadoraTimelineItem[],
  marcosInput: CalculadoraMarcosInput,
  linhas: CalculadoraFaseLinha[],
  slugs: Map<string, string | null | undefined>,
): CalculadoraTimelineItem[] {
  const candidatos: CalculadoraMarco[] = [];

  for (const def of MARCOS_PRAZO_NEGOCIO) {
    const datas = def.resolver(marcosInput, linhas, slugs);
    if (!datas.dataFim && !datas.dataInicio) continue;
    const dataLimiteContrato =
      def.id === 'M24' && datas.dataFim ? datas.dataFim : null;
    const marcoBase = marcoFromDatas(datas, {
      id: def.id,
      label: def.label,
      funilLabel: 'Dados do Negócio',
      custo: def.custo ?? null,
      somenteRotulo: def.somenteRotulo ?? false,
      dataLimiteContrato,
    });
    candidatos.push(
      def.id === 'M24' && contratoTemFimReal(marcosInput)
        ? { ...marcoBase, limiteContratoReal: true }
        : marcoBase,
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
    let idx = insertIndexPorData(out, refData);
    if (marco.id === 'M24') {
      const idxLiq = findMarcoItemIndex(out, 'fim_liquidacao');
      if (idxLiq >= 0) idx = Math.max(idx, idxLiq + 1);
      else {
        const idxEnt = findPhaseItemIndexBySlug(out, slugs, FASE_SLUGS.OPERACOES_ENTREGUE);
        if (idxEnt >= 0) idx = Math.max(idx, idxEnt + 1);
      }
    }
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
  const dataFimContrato = resolverDataFimContrato(marcosInput, linhas, slugs);
  const refYmd = formatLocalYmd(new Date());
  const insercoes: InsercaoMarco[] = [];

  for (const def of MARCO_DEFS) {
    const idx = findFaseIndex(linhas, slugs, def.match);
    if (idx < 0) continue;

    const insertAt = def.anchor === 'after' ? idx + 1 : def.anchor === 'replace' ? idx : idx;
    const datas = resolverDatasMarco(def.id, marcosInput, linhas, slugs);
    const linhaAnchora = def.anchor === 'replace' ? linhas[idx] : undefined;

    let marco = enriquecerMarcoComLinhaAnchora(
      marcoFromDatas(datas, {
        id: def.id,
        label: def.label,
        funilLabel: def.funilLabel,
        custo: def.custo ?? linhaAnchora?.custo ?? null,
      }),
      linhaAnchora,
    );
    if (def.id === 'M4') {
      marco = aplicarLimiteMesesAposContrato(
        marco,
        M4_MESES_APOS_FIM_CONTRATO,
        dataFimContrato,
        refYmd,
      );
      if (contratoTemFimReal(marcosInput) && marco.dataLimiteContrato) {
        marco = { ...marco, limiteContratoReal: true };
      }
    }

    insercoes.push({
      index: insertAt,
      replace: def.anchor === 'replace',
      marco,
    });
  }

  insercoes.sort((a, b) => b.index - a.index);

  let items: CalculadoraTimelineItem[] = linhas.map((linha) => ({ kind: 'fase', linha }));
  for (const { index, marco, replace } of insercoes) {
    if (replace) items.splice(index, 1, { kind: 'marco', marco });
    else items.splice(index, 0, { kind: 'marco', marco });
  }

  items = inserirMarcosBca(items, marcosInput, linhas, slugs);
  items = inserirMarcosPrazoNegocio(items, marcosInput, linhas, slugs);
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
        : item.kind === 'marco'
          ? item.marco.funilLabel
          : item.funilLabel;

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
