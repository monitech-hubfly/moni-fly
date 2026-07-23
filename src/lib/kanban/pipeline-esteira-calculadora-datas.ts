import { parseIsoDateOnlyLocal } from '@/lib/dias-uteis';
import type { CalculadoraFaseLinha } from '@/lib/kanban/calculadora-fases';
import {
  ESTEIRA_CALCULADORA_COLUNAS,
  ESTEIRA_CTO_CONTRATO_SLUGS,
  ESTEIRA_CTO_CP_SLUGS,
  type EsteiraCalculadoraColuna,
} from '@/lib/kanban/pipeline-esteira-calculadora-colunas';

export type CelulaEsteiraCalculadora = {
  tipo: 'real' | 'est' | 'at' | null;
  /** ISO date-only YYYY-MM-DD */
  date: string | null;
  isCurrent: boolean;
};

export type CelulaEsteiraCtoDuplo = {
  cp: CelulaEsteiraCalculadora;
  contrato: CelulaEsteiraCalculadora;
};

export type DatasEsteiraCalculadora = Record<
  string,
  CelulaEsteiraCalculadora | CelulaEsteiraCtoDuplo
>;

function normSlug(slug: string | null | undefined): string {
  return String(slug ?? '').trim().toLowerCase();
}

function linhaCorrespondeSlug(linha: CalculadoraFaseLinha, slug: string): boolean {
  const s = normSlug(slug);
  if (!s) return false;
  if (normSlug(linha.faseSlug) === s) return true;
  if (s === 'contrato' && /contrato/i.test(String(linha.faseNome ?? '').trim())) return true;
  if (s === 'step_7' && normSlug(linha.faseSlug) === 'step_7') return true;
  return false;
}

/** Localiza linha da calculadora pelo primeiro slug que bater. */
export function resolverLinhaCalculadoraPorSlugs(
  linhas: CalculadoraFaseLinha[],
  slugs: readonly string[],
): CalculadoraFaseLinha | null {
  for (const slug of slugs) {
    const found = linhas.find((l) => linhaCorrespondeSlug(l, slug));
    if (found) return found;
  }
  return null;
}

/**
 * Data fim efetiva da fase — mesma regra da UI da Calculadora:
 * `dataFimReal` (inclui override já aplicado nas linhas) → `dataFimEstimada`.
 */
export function dataFimEfetivaLinhaCalculadora(linha: CalculadoraFaseLinha | null | undefined): string | null {
  if (!linha) return null;
  const real = String(linha.dataFimReal ?? '').trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(real)) return real;
  const est = String(linha.dataFimEstimada ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(est) ? est : null;
}

/** Extrai célula com tipo visual (real / est / atraso) a partir da linha da calculadora. */
export function extrairCelulaCalculadora(linha: CalculadoraFaseLinha | null): CelulaEsteiraCalculadora {
  if (!linha) return { tipo: null, date: null, isCurrent: false };

  const date = dataFimEfetivaLinhaCalculadora(linha);
  const isCurrent = linha.status === 'atual' || linha.status === 'atual_atrasada';

  if (!date) {
    return { tipo: null, date: null, isCurrent };
  }

  if (linha.dataFimReal) {
    return { tipo: 'real', date, isCurrent };
  }
  if (isCurrent && linha.status === 'atual_atrasada') {
    return { tipo: 'at', date, isCurrent: true };
  }
  return { tipo: 'est', date, isCurrent };
}

function extrairCtoDuplo(linhas: CalculadoraFaseLinha[]): CelulaEsteiraCtoDuplo {
  return {
    cp: extrairCelulaCalculadora(resolverLinhaCalculadoraPorSlugs(linhas, ESTEIRA_CTO_CP_SLUGS)),
    contrato: extrairCelulaCalculadora(
      resolverLinhaCalculadoraPorSlugs(linhas, ESTEIRA_CTO_CONTRATO_SLUGS),
    ),
  };
}

/** Monta mapa slug-coluna → célula(s) a partir das linhas completas da calculadora. */
export function computarDatasEsteiraCalculadora(linhas: CalculadoraFaseLinha[]): DatasEsteiraCalculadora {
  const result: DatasEsteiraCalculadora = {};

  for (const col of ESTEIRA_CALCULADORA_COLUNAS) {
    if (col.ctoDuplo) {
      result[col.slug] = extrairCtoDuplo(linhas);
      continue;
    }
    const linha = resolverLinhaCalculadoraPorSlugs(linhas, col.faseSlugs);
    result[col.slug] = extrairCelulaCalculadora(linha);
  }

  return result;
}

/** Fase atual na calculadora (primeira linha em andamento). */
export function resolverFaseAtualCalculadora(
  linhas: CalculadoraFaseLinha[],
): CalculadoraFaseLinha | null {
  return (
    linhas.find((l) => l.status === 'atual' || l.status === 'atual_atrasada') ??
    linhas.find((l) => l.status === 'futura') ??
    null
  );
}

export function labelFaseAtualCalculadora(linha: CalculadoraFaseLinha | null): string {
  if (!linha) return '—';
  return String(linha.faseNome ?? linha.faseSlug ?? '').trim() || '—';
}

export function segmentoBadgeFaseCalculadora(linha: CalculadoraFaseLinha | null): 'port' | 'op' {
  const slug = normSlug(linha?.faseSlug);
  const opSlugs = new Set(
    ESTEIRA_CALCULADORA_COLUNAS.filter((c) => c.segmento === 'op').flatMap((c) => [...c.faseSlugs]),
  );
  if (opSlugs.has(slug)) return 'op';
  return 'port';
}

export function parseDataCelulaEsteira(iso: string | null): Date | null {
  if (!iso) return null;
  const p = parseIsoDateOnlyLocal(iso.slice(0, 10));
  if (!p) return null;
  return new Date(p.getFullYear(), p.getMonth(), p.getDate());
}

export function formatDataCelulaEsteira(iso: string | null): string {
  const d = parseDataCelulaEsteira(iso);
  if (!d) return '—';
  return d
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace(/\./g, '');
}

export function isCelulaCtoDuplo(
  val: CelulaEsteiraCalculadora | CelulaEsteiraCtoDuplo,
): val is CelulaEsteiraCtoDuplo {
  return 'cp' in val && 'contrato' in val;
}

export function ordemGlobalFaseCalculadora(
  linhas: CalculadoraFaseLinha[],
  linha: CalculadoraFaseLinha | null,
): number {
  if (!linha) return 0;
  const idx = linhas.findIndex((l) => l.faseId === linha.faseId);
  return idx >= 0 ? idx : linha.ordem ?? 0;
}

export function colunaPorSlug(slug: string): EsteiraCalculadoraColuna | undefined {
  return ESTEIRA_CALCULADORA_COLUNAS.find((c) => c.slug === slug);
}
