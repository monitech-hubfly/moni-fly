export type CondominioChecklistSnapshot = {
  condominio_id: string;
  quadra: string;
  lote: string;
};

export function snapshotCondominioChecklist(
  condominioId: string,
  quadra: string,
  lote: string,
): string {
  const payload: CondominioChecklistSnapshot = {
    condominio_id: String(condominioId ?? '').trim(),
    quadra: String(quadra ?? '').trim(),
    lote: String(lote ?? '').trim(),
  };
  return JSON.stringify(payload);
}

export function parseCondominioChecklistSnapshot(valor: string | null | undefined): CondominioChecklistSnapshot | null {
  const raw = String(valor ?? '').trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<CondominioChecklistSnapshot>;
    const condominio_id = String(j.condominio_id ?? '').trim();
    if (!condominio_id) return null;
    return {
      condominio_id,
      quadra: String(j.quadra ?? '').trim(),
      lote: String(j.lote ?? '').trim(),
    };
  } catch {
    if (/^[0-9a-f-]{36}$/i.test(raw)) {
      return { condominio_id: raw, quadra: '', lote: '' };
    }
    return null;
  }
}

export function condominioChecklistValorCompleto(valor: string | null | undefined): boolean {
  const snap = parseCondominioChecklistSnapshot(valor);
  return Boolean(snap?.condominio_id && snap.quadra && snap.lote);
}
