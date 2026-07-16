/**
 * Área de atuação da rede: formato canônico `"UF - Cidade"` separados por `"; "`.
 * Também interpreta legado em prosa, ex.:
 * `"Belo Horizonte, Nova Lima e Brumadinho, estado de Minas Gerais"`.
 */

import { UFS_BRASIL } from '@/lib/uf';

export type AreaAtuacaoPar = { uf: string; cidade: string };

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

function nomeEstadoParaUf(nomeOuSigla: string): string | null {
  const raw = nomeOuSigla.trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const alvo = stripDiacritics(raw).toLowerCase();
  const hit = UFS_BRASIL.find((u) => stripDiacritics(u.nome).toLowerCase() === alvo);
  return hit?.sigla ?? null;
}

/** Quebra lista de cidades: "A, B e C" → ["A","B","C"]. */
function splitCidadesLista(raw: string): string[] {
  return raw
    .replace(/\s+e\s+/gi, ', ')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Formato canônico: trechos "UF - Cidade" (hífen/en/em dash) separados por ";". */
function parseAreaAtuacaoCanonico(s: string): AreaAtuacaoPar[] {
  return s
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^([A-Za-z]{2})\s*[-–—]\s*(.+)$/);
      if (!m) return null;
      const uf = m[1].toUpperCase();
      const cidade = m[2].trim();
      return cidade ? { uf, cidade } : null;
    })
    .filter((x): x is AreaAtuacaoPar => x != null);
}

/**
 * Legado em prosa, ex.:
 * - "Belo Horizonte, Nova Lima e Brumadinho, estado de Minas Gerais"
 * - "Curitiba e Colombo, estado do Paraná"
 * - "Campinas, SP" (cidade + UF no final)
 */
function parseAreaAtuacaoProsa(s: string): AreaAtuacaoPar[] {
  const trimmed = s.trim();
  if (!trimmed || trimmed.includes(';')) return [];

  const estadoDe = trimmed.match(/^(.*?),\s*estado\s+(?:de|do|da|dos|das)\s+(.+)$/i);
  if (estadoDe) {
    const uf = nomeEstadoParaUf(estadoDe[2]);
    if (!uf) return [];
    return splitCidadesLista(estadoDe[1]).map((cidade) => ({ uf, cidade }));
  }

  // "Cidade1, Cidade2, Minas Gerais" ou "Cidade1, MG"
  const ultimaVirgula = trimmed.lastIndexOf(',');
  if (ultimaVirgula > 0) {
    const talvezEstado = trimmed.slice(ultimaVirgula + 1).trim();
    const uf = nomeEstadoParaUf(talvezEstado);
    if (uf) {
      const cidades = splitCidadesLista(trimmed.slice(0, ultimaVirgula));
      if (cidades.length > 0) return cidades.map((cidade) => ({ uf, cidade }));
    }
  }

  // "Cidade - MG" / "Cidade – Minas Gerais" (um único par)
  const umPar = trimmed.match(/^(.+?)\s*[-–—]\s*([A-Za-z]{2}|.+)$/);
  if (umPar) {
    const esquerda = umPar[1].trim();
    const direita = umPar[2].trim();
    const ufDir = nomeEstadoParaUf(direita);
    const ufEsq = nomeEstadoParaUf(esquerda);
    if (ufDir && esquerda && !ufEsq) return [{ uf: ufDir, cidade: esquerda }];
    if (ufEsq && direita && ufEsq.length === 2 && direita.length > 2) {
      return [{ uf: ufEsq, cidade: direita }];
    }
  }

  return [];
}

export function parseAreaAtuacao(s: string | null | undefined): AreaAtuacaoPar[] {
  if (!s || typeof s !== 'string') return [];
  const trimmed = s.trim();
  if (!trimmed) return [];

  const canonico = parseAreaAtuacaoCanonico(trimmed);
  if (canonico.length > 0) return canonico;

  return parseAreaAtuacaoProsa(trimmed);
}

/** Serializa no formato canônico persistido no banco. */
export function serializeAreaAtuacao(areas: AreaAtuacaoPar[]): string {
  return areas.map((a) => `${a.uf} - ${a.cidade}`).join('; ');
}

/**
 * Texto para exibição em tabela: uma linha por par `UF - Cidade`.
 * Se não der para parsear, devolve o texto original.
 */
export function formatAreaAtuacaoLinhas(s: string | null | undefined): string {
  const areas = parseAreaAtuacao(s);
  if (areas.length === 0) return (s ?? '').trim();
  return areas.map((a) => `${a.uf} - ${a.cidade}`).join('\n');
}

export function uniqueUfsAreaAtuacao(areas: AreaAtuacaoPar[]): string[] {
  return [...new Set(areas.map((a) => a.uf))].sort();
}

export function cidadesAreaAtuacaoPorUf(
  areas: AreaAtuacaoPar[],
  uf: string | null | undefined,
): string[] {
  const u = String(uf ?? '').trim().toUpperCase();
  const list = u ? areas.filter((a) => a.uf === u) : areas;
  return [...new Set(list.map((a) => a.cidade))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function parCidadeEstadoValidoNaArea(
  areas: AreaAtuacaoPar[],
  cidade: string | null | undefined,
  uf: string | null | undefined,
): boolean {
  const c = String(cidade ?? '').trim();
  const u = String(uf ?? '').trim().toUpperCase();
  if (!c || u.length !== 2) return false;
  return areas.some((a) => a.cidade === c && a.uf === u);
}

/** UFs de 2 letras derivadas de área de atuação e/ou estado da casa Frank. */
export function ufsFromRedeFranqueado(r: {
  estado_casa_frank?: string | null;
  area_atuacao?: string | null;
}): Set<string> {
  const out = new Set<string>();
  for (const { uf } of parseAreaAtuacao(r.area_atuacao)) {
    const st = String(uf).toUpperCase().trim();
    if (st.length === 2) out.add(st);
  }
  const ec = String(r.estado_casa_frank ?? '').toUpperCase().trim();
  if (ec.length === 2) out.add(ec);
  return out;
}
