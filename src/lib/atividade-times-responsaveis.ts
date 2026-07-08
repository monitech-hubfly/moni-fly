/** Normaliza listas de times / responsáveis das atividades do card (checklist). */

export function normalizeNomeList(input: (string | null | undefined)[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input ?? []) {
    const s = String(raw ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Supabase devolve `text[]` como `string[]` ou, em alguns casos, string PostgreSQL — normaliza para `string[]`. */
export function parseTextArrayColumn(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return normalizeNomeList(value as string[]);
  }
  const s = String(value).trim();
  if (!s || s === '{}') return [];
  const inner = s.startsWith('{') && s.endsWith('}') ? s.slice(1, -1) : s;
  if (!inner.trim()) return [];
  const parts = inner.split(',').map((p) => p.replace(/^"(.*)"$/, '$1').trim());
  return normalizeNomeList(parts);
}

export function mergeArraysWithLegacy(arr: string[], legacy: string | null | undefined): string[] {
  const base = normalizeNomeList(arr);
  const leg = String(legacy ?? '').trim();
  if (!leg) return base;
  if (base.length > 0) return base;
  const parts = leg
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? normalizeNomeList(parts) : [];
}

/** Exibição em uma linha (painel / cartões). */
export function formatNomesLista(arr: string[]): string | null {
  const n = normalizeNomeList(arr);
  if (n.length === 0) return null;
  return n.join(', ');
}

/** Mantém colunas legadas alinhadas ao primeiro valor de cada lista. */
export function legacySinglesFromLists(
  times: string[],
  responsaveis: string[],
): { time_nome: string | null; responsavel_nome: string | null } {
  const tn = normalizeNomeList(times);
  const rn = normalizeNomeList(responsaveis);
  return {
    time_nome: tn[0] ?? null,
    responsavel_nome: rn[0] ?? null,
  };
}

export function itemMatchesTimeFilter(
  timesNomes: string[] | null | undefined,
  timeNomeLegacy: string | null | undefined,
  filtro: string,
): boolean {
  if (filtro === 'todos') return true;
  const list = mergeArraysWithLegacy(timesNomes ?? [], timeNomeLegacy);
  return list.some((t) => t === filtro);
}

export function itemMatchesResponsavelFilter(
  responsaveisNomes: string[] | null | undefined,
  responsavelLegacy: string | null | undefined,
  filtro: string,
): boolean {
  if (filtro === 'todos') return true;
  const list = mergeArraysWithLegacy(responsaveisNomes ?? [], responsavelLegacy);
  return list.some((r) => r === filtro);
}
