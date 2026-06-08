import {
  parseLinhasProspectCondominio,
  serializarLinhasProspectCondominio,
  type LinhaProspectCondominio,
} from '@/lib/kanban/condominio-prospect-pesquisa';
import { parCidadeEstadoValidoNaArea } from '@/lib/rede-area-atuacao';

export type PracaCidade = { uf: string; cidade: string };

export const CHECKLIST_LABEL_CIDADE = 'Cidade de interesse';
export const CHECKLIST_LABEL_ESTADO = 'Estado';

export const CHECKLIST_ITENS_OCULTOS_MULTI_PRACA = new Set([
  CHECKLIST_LABEL_CIDADE,
  CHECKLIST_LABEL_ESTADO,
]);

export function chavePracaCidade(p: PracaCidade): string {
  return `${p.uf}::${p.cidade}`;
}

export function labelPracaCidade(p: PracaCidade): string {
  return `${p.cidade}, ${p.uf}`;
}

export function parseChavePracaCidade(chave: string): PracaCidade | null {
  const i = chave.indexOf('::');
  if (i < 0) return null;
  const uf = chave.slice(0, i).trim().toUpperCase();
  const cidade = chave.slice(i + 2).trim();
  return uf.length === 2 && cidade ? { uf, cidade } : null;
}

export function chavesPracaFromAreas(areas: PracaCidade[]): string[] {
  return areas.map(chavePracaCidade);
}

export function isMultiPracaStoreJson(raw: string | null | undefined): boolean {
  const t = String(raw ?? '').trim();
  if (!t.startsWith('{')) return false;
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    const keys = Object.keys(o);
    return keys.length > 0 && keys.every((k) => k.includes('::'));
  } catch {
    return false;
  }
}

export function inferirChaveLegadoPraca(
  areas: PracaCidade[],
  cidadeValor: string | null | undefined,
  estadoValor: string | null | undefined,
): string | null {
  const c = String(cidadeValor ?? '').trim();
  const u = String(estadoValor ?? '').trim().toUpperCase();
  if (c && u.length === 2 && parCidadeEstadoValidoNaArea(areas, c, u)) {
    return chavePracaCidade({ uf: u, cidade: c });
  }
  return areas[0] ? chavePracaCidade(areas[0]) : null;
}

function parseStore(raw: string | null | undefined): Record<string, string> | null {
  if (!isMultiPracaStoreJson(raw)) return null;
  try {
    return JSON.parse(String(raw).trim()) as Record<string, string>;
  } catch {
    return null;
  }
}

function migrateLegacyToStore(
  raw: string | null | undefined,
  chaveLegado: string | null,
): Record<string, string> {
  const store = parseStore(raw);
  if (store) return { ...store };
  const out: Record<string, string> = {};
  const plain = String(raw ?? '').trim();
  if (plain && chaveLegado) out[chaveLegado] = plain;
  return out;
}

export function resolverValorMultiPraca(
  raw: string | null | undefined,
  chave: string,
  chaveLegado: string | null,
): string {
  const store = parseStore(raw);
  if (store) return store[chave] ?? '';
  const plain = String(raw ?? '').trim();
  if (!plain) return '';
  if (chaveLegado && chave === chaveLegado) return plain;
  return '';
}

export function mergeValorMultiPraca(
  raw: string | null | undefined,
  chave: string,
  valor: string,
  chaveLegado: string | null,
): string {
  const store = migrateLegacyToStore(raw, chaveLegado);
  store[chave] = valor;
  return JSON.stringify(store);
}

export function resolverArquivoMultiPraca(
  raw: string | null | undefined,
  chave: string,
  chaveLegado: string | null,
): string | null {
  const v = resolverValorMultiPraca(raw, chave, chaveLegado);
  return v.trim() ? v : null;
}

export function mergeArquivoMultiPraca(
  raw: string | null | undefined,
  chave: string,
  arquivoPath: string | null,
  chaveLegado: string | null,
): string | null {
  const merged = mergeValorMultiPraca(raw, chave, arquivoPath ?? '', chaveLegado);
  const store = JSON.parse(merged) as Record<string, string>;
  const hasAny = Object.values(store).some((v) => String(v).trim());
  return hasAny ? merged : null;
}

export function parseLinhasTabelaPraca(
  valor: string | null | undefined,
  chave: string,
  chaveLegado: string | null,
): LinhaProspectCondominio[] {
  const scoped = resolverValorMultiPraca(valor, chave, chaveLegado);
  return parseLinhasProspectCondominio(scoped || null);
}

export function mergeLinhasTabelaPraca(
  valor: string | null | undefined,
  chave: string,
  linhas: LinhaProspectCondominio[],
  chaveLegado: string | null,
): string {
  return mergeValorMultiPraca(valor, chave, serializarLinhasProspectCondominio(linhas), chaveLegado);
}

export function parseLinhasTabelaTodasPracas(
  valor: string | null | undefined,
  chaveLegado: string | null,
): LinhaProspectCondominio[] {
  const store = parseStore(valor);
  if (store) {
    return Object.values(store).flatMap((v) => parseLinhasProspectCondominio(v));
  }
  return parseLinhasProspectCondominio(valor);
}

export function atualizarLinhaNaTabelaMultiPraca(
  valor: string | null | undefined,
  chaveLegado: string | null,
  rowId: string,
  updater: (linhas: LinhaProspectCondominio[]) => LinhaProspectCondominio[],
): string {
  const store = parseStore(valor);
  if (store) {
    for (const chave of Object.keys(store)) {
      const linhas = parseLinhasProspectCondominio(store[chave]);
      if (linhas.some((l) => l.row_id === rowId)) {
        store[chave] = serializarLinhasProspectCondominio(updater(linhas));
        return JSON.stringify(store);
      }
    }
    return valor ?? '';
  }
  const linhas = parseLinhasProspectCondominio(valor);
  return serializarLinhasProspectCondominio(updater(linhas));
}

export type PracaCidadeAreas = PracaCidade[];
