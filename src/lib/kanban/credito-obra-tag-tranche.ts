import type { CSSProperties } from 'react';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { createAdminClient } from '@/lib/supabase/admin';

export type TrancheColorToken = {
  /** Texto no tema light */
  color: string;
  /** Fundo no tema light */
  bg: string;
  /** Texto no tema dark */
  colorDark: string;
  /** Fundo no tema dark */
  bgDark: string;
  /** Rótulo da tag */
  label: string;
};

/**
 * Cores das tags de tranche (1ª–6ª) — light + dark.
 * 1 azul-aço · 2 verde-musgo · 3 marrom-café · 4 âmbar · 5 azul · 6 lilás
 */
export const TRANCHE_COLORS: Record<number, TrancheColorToken> = {
  1: {
    label: '1ª tranche',
    color: '#ffffff',
    bg: '#3e7490',
    colorDark: '#e8eef1',
    bgDark: '#2a5570',
  },
  2: {
    label: '2ª tranche',
    color: '#ffffff',
    bg: '#2f4a3a',
    colorDark: '#eaeff0',
    bgDark: '#3d5f4c',
  },
  3: {
    label: '3ª tranche',
    color: '#ffffff',
    bg: '#4a3929',
    colorDark: '#f0ebe7',
    bgDark: '#6b5340',
  },
  4: {
    label: '4ª tranche',
    color: '#0c2633',
    bg: '#d4ad68',
    colorDark: '#faf4e8',
    bgDark: '#b08a3e',
  },
  5: {
    label: '5ª tranche',
    color: '#ffffff',
    bg: '#2e6b8a',
    colorDark: '#e8eef1',
    bgDark: '#4a8aa6',
  },
  6: {
    label: '6ª tranche',
    color: '#ffffff',
    bg: '#6b5b95',
    colorDark: '#f3f0f8',
    bgDark: '#8b7ab8',
  },
};

/** Tags preset de tranche no Funil Crédito Obra — derivado de TRANCHE_COLORS (cor DB = bg light). */
export const CREDITO_OBRA_TRANCHES = (
  [1, 2, 3, 4, 5, 6] as const
).map((numero) => ({
  numero,
  nome: TRANCHE_COLORS[numero].label,
  cor: TRANCHE_COLORS[numero].bg,
}));

export type CreditoObraTrancheNumero = (typeof CREDITO_OBRA_TRANCHES)[number]['numero'];

type DbTagClient = Pick<ReturnType<typeof createAdminClient>, 'from'>;

const NOMES_TRANCHE = new Set<string>(CREDITO_OBRA_TRANCHES.map((t) => t.nome));

export function nomeTagTrancheCreditoObra(numero: CreditoObraTrancheNumero): string {
  return TRANCHE_COLORS[numero]?.label ?? `${numero}ª tranche`;
}

/** Cor de fundo (light) — usada em DB `kanban_tags.cor` e fallbacks. */
export function corTagTrancheCreditoObra(numero: CreditoObraTrancheNumero): string {
  return TRANCHE_COLORS[numero]?.bg ?? TRANCHE_COLORS[1].bg;
}

export function trancheNumeroFromIndex(index: number): CreditoObraTrancheNumero | null {
  if (index >= 1 && index <= 6) return index as CreditoObraTrancheNumero;
  return null;
}

export function trancheNumeroFromLabel(nome: string | null | undefined): CreditoObraTrancheNumero | null {
  const n = String(nome ?? '').trim().toLowerCase();
  for (const [num, token] of Object.entries(TRANCHE_COLORS)) {
    if (token.label.toLowerCase() === n) return Number(num) as CreditoObraTrancheNumero;
  }
  return null;
}

/** Estilo CSS light/dark via `light-dark()` (respeita color-scheme). */
export function estiloTagTrancheCreditoObra(
  numero: CreditoObraTrancheNumero | number,
): CSSProperties {
  const t = TRANCHE_COLORS[numero] ?? TRANCHE_COLORS[1];
  return {
    background: `light-dark(${t.bg}, ${t.bgDark})`,
    color: `light-dark(${t.color}, ${t.colorDark})`,
  };
}

export function estiloTagTranchePorLabel(nome: string | null | undefined): CSSProperties | null {
  const num = trancheNumeroFromLabel(nome);
  if (!num) return null;
  return estiloTagTrancheCreditoObra(num);
}

/** Garante as 6 tags de tranche no kanban Crédito Obra (idempotente). */
export async function garantirTagsTrancheCreditoObra(
  db: DbTagClient,
  kanbanId: string = KANBAN_IDS.CREDITO_OBRA,
): Promise<void> {
  const kid = String(kanbanId ?? '').trim();
  if (!kid) return;

  for (const tranche of CREDITO_OBRA_TRANCHES) {
    const { data: existing } = await db
      .from('kanban_tags')
      .select('id, cor')
      .eq('kanban_id', kid)
      .eq('nome', tranche.nome)
      .maybeSingle();

    if (existing?.id) {
      if (String((existing as { cor?: string }).cor ?? '') !== tranche.cor) {
        await db
          .from('kanban_tags')
          .update({ cor: tranche.cor } as never)
          .eq('id', String(existing.id));
      }
      continue;
    }

    await db.from('kanban_tags').insert({
      kanban_id: kid,
      nome: tranche.nome,
      cor: tranche.cor,
    } as never);
  }
}

async function resolverTagIdTranche(
  db: DbTagClient,
  kanbanId: string,
  numero: CreditoObraTrancheNumero,
): Promise<string | null> {
  await garantirTagsTrancheCreditoObra(db, kanbanId);
  const nome = nomeTagTrancheCreditoObra(numero);
  const { data } = await db
    .from('kanban_tags')
    .select('id')
    .eq('kanban_id', kanbanId)
    .eq('nome', nome)
    .maybeSingle();
  const id = String((data as { id?: string } | null)?.id ?? '').trim();
  return id || null;
}

/** Aplica tag de tranche exclusiva no card (remove outras tags de tranche do mesmo card). */
export async function aplicarTagTrancheCreditoObra(
  db: DbTagClient,
  cardId: string,
  numero: CreditoObraTrancheNumero,
  kanbanId: string = KANBAN_IDS.CREDITO_OBRA,
): Promise<void> {
  const cid = String(cardId ?? '').trim();
  const kid = String(kanbanId ?? '').trim();
  if (!cid || !kid) return;

  const tagId = await resolverTagIdTranche(db, kid, numero);
  if (!tagId) return;

  const { data: tagsKanban } = await db.from('kanban_tags').select('id, nome').eq('kanban_id', kid);
  const trancheTagIds = (tagsKanban ?? [])
    .filter((t) => NOMES_TRANCHE.has(String((t as { nome?: string }).nome ?? '')))
    .map((t) => String((t as { id: string }).id));

  if (trancheTagIds.length > 0) {
    await db
      .from('kanban_card_tags')
      .delete()
      .eq('card_id', cid)
      .in('tag_id', trancheTagIds);
  }

  const { data: existing } = await db
    .from('kanban_card_tags')
    .select('id')
    .eq('card_id', cid)
    .eq('tag_id', tagId)
    .maybeSingle();

  if (!existing?.id) {
    await db.from('kanban_card_tags').insert({ card_id: cid, tag_id: tagId } as never);
  }
}

/** Primeiro card filho ativo no Crédito Obra — recebe 1ª tranche se ainda não tiver tag de tranche. */
export async function aplicarTagPrimeiraTrancheSeAusente(
  db: DbTagClient,
  cardId: string,
  kanbanId: string = KANBAN_IDS.CREDITO_OBRA,
): Promise<void> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return;

  const kid = String(kanbanId ?? '').trim() || KANBAN_IDS.CREDITO_OBRA;
  await garantirTagsTrancheCreditoObra(db, kid);

  const { data: tagsCard } = await db
    .from('kanban_card_tags')
    .select('tag_id, kanban_tags(nome)')
    .eq('card_id', cid);

  const temTranche = (tagsCard ?? []).some((row) => {
    const tag = Array.isArray(row.kanban_tags) ? row.kanban_tags[0] : row.kanban_tags;
    return NOMES_TRANCHE.has(String((tag as { nome?: string } | null)?.nome ?? ''));
  });

  if (!temTranche) {
    await aplicarTagTrancheCreditoObra(db, cid, 1, kid);
  }
}
