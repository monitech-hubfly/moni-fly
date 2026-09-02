/** Prefixo usado na lista Sirene para IDs sintéticos de `pastelaria_cards`. */
export const PASTELARIA_SYNTHETIC_ID_PREFIX = 'pastelaria-';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPastelariaSyntheticId(id: string | null | undefined): boolean {
  return String(id ?? '')
    .trim()
    .startsWith(PASTELARIA_SYNTHETIC_ID_PREFIX);
}

export function isUuid(id: string | null | undefined): boolean {
  return UUID_RE.test(String(id ?? '').trim());
}

/** Remove o prefixo `pastelaria-` e devolve o UUID puro, ou null se não for sintético. */
export function stripPastelariaSyntheticId(id: string | null | undefined): string | null {
  const s = String(id ?? '').trim();
  if (!s.startsWith(PASTELARIA_SYNTHETIC_ID_PREFIX)) return null;
  const uuid = s.slice(PASTELARIA_SYNTHETIC_ID_PREFIX.length).trim();
  return uuid && isUuid(uuid) ? uuid : null;
}

/** IDs seguros para colunas UUID (`kanban_atividades.id`, `sirene_topicos.interacao_id`). */
export function filterKanbanAtividadeIds(ids: string[]): string[] {
  return ids
    .map((id) => String(id ?? '').trim())
    .filter((id) => id.length > 0 && !isPastelariaSyntheticId(id) && isUuid(id));
}

/** IDs numéricos seguros para `sirene_chamados.id` (bigint) — exclui null/NaN. */
export function filterSireneChamadoIds(ids: Array<number | string | null | undefined>): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const raw of ids) {
    if (raw == null || raw === '' || raw === 'null' || raw === 'undefined') continue;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}
