/**
 * Calcula "Atrasado" / "Atenção" do card no painel de forma alinhada ao modal:
 * - Checklist em `processo_card_checklist` usa `processo_id` = base do histórico
 *   (`historico_base_id` do `processo_step_one` ou o próprio `id`).
 * - Itens são filtrados pela mesma `etapa_painel` do card (como `getChecklistCard`).
 */

export type ChecklistRowForAtraso = {
  processo_id?: string | null;
  etapa_painel?: string | null;
  prazo?: string | null;
  status?: string | null;
  concluido?: boolean | null;
};

export type CardRowForAtraso = {
  id: string;
  historico_base_id?: string | null;
  etapa_painel?: string | null;
};

export function parsePrazoBrOrIso(prazo: string | null | undefined): Date | null {
  if (!prazo) return null;
  const raw = String(prazo).trim();
  if (!raw) return null;

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    const d = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(`${raw}T12:00:00`);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function dayStartLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Mapa: id do card exibido no painel -> flags de prazo.
 */
export function buildChecklistAtrasoByCardId(
  cards: CardRowForAtraso[],
  checklistRows: ChecklistRowForAtraso[],
  options?: { defaultEtapaPainel?: string },
): Map<string, { hasAtrasado: boolean; hasAtencao: boolean }> {
  const defaultEtapa = options?.defaultEtapaPainel ?? 'step_1';
  const hoje = dayStartLocal(new Date());
  const amanha = dayStartLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1));
  const rows = checklistRows ?? [];
  const out = new Map<string, { hasAtrasado: boolean; hasAtencao: boolean }>();

  for (const card of cards) {
    const baseId = String(card.historico_base_id ?? card.id);
    const etapa = (String(card.etapa_painel ?? '').trim() || defaultEtapa).trim();

    let hasAtrasado = false;
    let hasAtencao = false;

    for (const row of rows) {
      if (String(row.processo_id ?? '') !== baseId) continue;

      const rowEtapa = String(row.etapa_painel ?? '').trim();
      if (!rowEtapa || rowEtapa !== etapa) continue;

      const status = String(row.status ?? '').trim().toLowerCase();
      const concluido = Boolean(row.concluido);
      if (concluido || status === 'concluido' || status === 'concluida') continue;

      const prazo = parsePrazoBrOrIso(row.prazo ?? null);
      if (!prazo) continue;
      const prazoDia = dayStartLocal(prazo);
      if (prazoDia.getTime() < hoje.getTime()) hasAtrasado = true;
      if (prazoDia.getTime() === amanha.getTime()) hasAtencao = true;
    }

    out.set(card.id, { hasAtrasado, hasAtencao });
  }

  return out;
}
