/**
 * Área de atuação da rede: string com trechos "UF - Cidade" separados por ";".
 * (Mesmo formato usado em TabelaRedeFranqueadosEditável / mapa.)
 */

export function parseAreaAtuacao(s: string | null | undefined): { uf: string; cidade: string }[] {
  if (!s || typeof s !== 'string') return [];
  return s
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf(' - ');
      if (i < 0) return null;
      const uf = p.slice(0, i).trim().toUpperCase();
      const cidade = p.slice(i + 3).trim();
      return uf.length === 2 && cidade ? { uf, cidade } : null;
    })
    .filter((x): x is { uf: string; cidade: string } => x != null);
}

export function uniqueUfsAreaAtuacao(areas: { uf: string; cidade: string }[]): string[] {
  return [...new Set(areas.map((a) => a.uf))].sort();
}

export function cidadesAreaAtuacaoPorUf(
  areas: { uf: string; cidade: string }[],
  uf: string | null | undefined,
): string[] {
  const u = String(uf ?? '').trim().toUpperCase();
  const list = u ? areas.filter((a) => a.uf === u) : areas;
  return [...new Set(list.map((a) => a.cidade))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function parCidadeEstadoValidoNaArea(
  areas: { uf: string; cidade: string }[],
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
