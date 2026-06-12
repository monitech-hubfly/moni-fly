/** Fases de funil em que checklist pode alimentar cadastro SPE na Rede. */

export function isFaseAberturaSpeSlug(faseSlug: string | null | undefined): boolean {
  const s = (faseSlug ?? '').trim().toLowerCase();
  if (!s) return false;
  return (
    s === 'contabilidade_spe' ||
    s === 'capital_abertura_spe' ||
    s === 'abertura_spe_moni_inc' ||
    s.includes('abertura_spe')
  );
}
