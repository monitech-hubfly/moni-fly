export type ProximaAtividadeTier = 'atrasada' | 'hoje' | 'futura' | 'sem_atividade';

export type KanbanCardProximaAtividadeSort = {
  id: string;
  proxima_atividade?: string | null;
  prazo_atividade?: string | null;
  ordem_coluna?: number | null;
  created_at?: string | null;
};

const TIER_ORDER: Record<ProximaAtividadeTier, number> = {
  atrasada: 0,
  hoje: 1,
  futura: 2,
  sem_atividade: 3,
};

/** Data local YYYY-MM-DD (mesma regra do ProximaAtividadeDot). */
export function hojeIsoLocal(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizePrazoAtividadeIso(prazo: string | null | undefined): string | null {
  const s = String(prazo ?? '').trim();
  if (!s) return null;
  return s.slice(0, 10);
}

/** Classifica card para ordenação: vermelho → verde → cinza → sem atividade. */
export function classificarProximaAtividadeTier(
  proximaAtividade: string | null | undefined,
  prazoAtividade: string | null | undefined,
  hoje: string = hojeIsoLocal(),
): ProximaAtividadeTier {
  const atividade = String(proximaAtividade ?? '').trim();
  if (!atividade) return 'sem_atividade';

  const prazo = normalizePrazoAtividadeIso(prazoAtividade);
  if (!prazo) return 'futura';
  if (prazo < hoje) return 'atrasada';
  if (prazo === hoje) return 'hoje';
  return 'futura';
}

function comparePrazoDentroTier(
  tier: ProximaAtividadeTier,
  pa: string | null,
  pb: string | null,
): number {
  if (!pa && !pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;

  if (tier === 'atrasada') {
    // Mais atrasado primeiro (data mais antiga).
    return pa.localeCompare(pb);
  }
  if (tier === 'hoje') return 0;
  // Futura / sem prazo: prazo mais distante primeiro; nulls já tratados acima.
  return pb.localeCompare(pa);
}

/**
 * Ordena cards da coluna: atrasada → hoje → futura/sem prazo → sem atividade.
 * Desempate: prazo, depois ordem_coluna (DnD manual), created_at, id.
 */
export function sortKanbanCardsPorProximaAtividade<T extends KanbanCardProximaAtividadeSort>(
  list: T[],
  hoje: string = hojeIsoLocal(),
): T[] {
  return [...list].sort((a, b) => {
    const tierA = classificarProximaAtividadeTier(a.proxima_atividade, a.prazo_atividade, hoje);
    const tierB = classificarProximaAtividadeTier(b.proxima_atividade, b.prazo_atividade, hoje);
    const tierDiff = TIER_ORDER[tierA] - TIER_ORDER[tierB];
    if (tierDiff !== 0) return tierDiff;

    const prazoDiff = comparePrazoDentroTier(
      tierA,
      normalizePrazoAtividadeIso(a.prazo_atividade),
      normalizePrazoAtividadeIso(b.prazo_atividade),
    );
    if (prazoDiff !== 0) return prazoDiff;

    const oa = a.ordem_coluna ?? 0;
    const ob = b.ordem_coluna ?? 0;
    if (oa !== ob) return oa - ob;

    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (tb !== ta) return tb - ta;

    return String(a.id).localeCompare(String(b.id));
  });
}
