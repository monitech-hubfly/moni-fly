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
      const uf = p.slice(0, i).trim();
      const cidade = p.slice(i + 3).trim();
      return uf && cidade ? { uf, cidade } : null;
    })
    .filter((x): x is { uf: string; cidade: string } => x != null);
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
