/** UF → macro-região (dashboard) */
export function regionalPorUF(uf: string | null | undefined): string {
  const u = String(uf ?? '')
    .trim()
    .toUpperCase();
  if (!u) return '—';
  const map: Record<string, string> = {
    AC: 'Norte',
    AP: 'Norte',
    AM: 'Norte',
    PA: 'Norte',
    RO: 'Norte',
    RR: 'Norte',
    TO: 'Norte',
    AL: 'Nordeste',
    BA: 'Nordeste',
    CE: 'Nordeste',
    MA: 'Nordeste',
    PB: 'Nordeste',
    PE: 'Nordeste',
    PI: 'Nordeste',
    RN: 'Nordeste',
    SE: 'Nordeste',
    DF: 'C-Oeste',
    GO: 'C-Oeste',
    MT: 'C-Oeste',
    MS: 'C-Oeste',
    ES: 'Sudeste',
    MG: 'Sudeste',
    RJ: 'Sudeste',
    SP: 'Sudeste',
    PR: 'Sul',
    RS: 'Sul',
    SC: 'Sul',
  };
  return map[u] ?? '—';
}
