import type { CSSProperties } from 'react';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { createAdminClient } from '@/lib/supabase/admin';

export type RodadaColorToken = {
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
 * Cores das tags de rodada (1ª–6ª) — light + dark.
 * Distintas das de tranche: petróleo · esmeralda · violeta · ouro · teal · carmim
 */
export const RODADA_COLORS: Record<number, RodadaColorToken> = {
  1: {
    label: '1ª rodada',
    color: '#6BAFD0',
    bg: '#1a4a6b',
    colorDark: '#8ec4dc',
    bgDark: '#245f87',
  },
  2: {
    label: '2ª rodada',
    color: '#58C080',
    bg: '#1a5a3a',
    colorDark: '#7ad49a',
    bgDark: '#24704c',
  },
  3: {
    label: '3ª rodada',
    color: '#C078D8',
    bg: '#5a2a6b',
    colorDark: '#d49ae6',
    bgDark: '#703488',
  },
  4: {
    label: '4ª rodada',
    color: '#D8A840',
    bg: '#6b4a10',
    colorDark: '#e6c068',
    bgDark: '#8a6018',
  },
  5: {
    label: '5ª rodada',
    color: '#40C0C0',
    bg: '#1a5a5a',
    colorDark: '#68d4d4',
    bgDark: '#247070',
  },
  6: {
    label: '6ª rodada',
    color: '#D85878',
    bg: '#6b1a2a',
    colorDark: '#e68098',
    bgDark: '#882438',
  },
};

/** Tags preset de rodada no Funil Divify — derivado de RODADA_COLORS (cor DB = bg light). */
export const DIVIFY_RODADAS = ([1, 2, 3, 4, 5, 6] as const).map((numero) => ({
  numero,
  nome: RODADA_COLORS[numero].label,
  cor: RODADA_COLORS[numero].bg,
}));

export type DivifyRodadaNumero = (typeof DIVIFY_RODADAS)[number]['numero'];

type DbTagClient = Pick<ReturnType<typeof createAdminClient>, 'from'>;

const NOMES_RODADA = new Set<string>(DIVIFY_RODADAS.map((t) => t.nome));

export function nomeTagRodadaDivify(numero: DivifyRodadaNumero): string {
  return RODADA_COLORS[numero]?.label ?? `${numero}ª rodada`;
}

/** Cor de fundo (light) — usada em DB `kanban_tags.cor` e fallbacks. */
export function corTagRodadaDivify(numero: DivifyRodadaNumero): string {
  return RODADA_COLORS[numero]?.bg ?? RODADA_COLORS[1].bg;
}

export function rodadaNumeroFromIndex(index: number): DivifyRodadaNumero | null {
  if (index >= 1 && index <= 6) return index as DivifyRodadaNumero;
  return null;
}

export function rodadaNumeroFromLabel(nome: string | null | undefined): DivifyRodadaNumero | null {
  const raw = String(nome ?? '').trim();
  const m = /^(\d+)[ªº]\s*rodada$/i.exec(raw);
  if (m) {
    const num = Number(m[1]);
    if (num >= 1 && num <= 6) return num as DivifyRodadaNumero;
  }
  const n = raw.toLowerCase();
  for (const [num, token] of Object.entries(RODADA_COLORS)) {
    if (token.label.toLowerCase() === n) return Number(num) as DivifyRodadaNumero;
  }
  return null;
}

/** Estilo CSS light/dark via `light-dark()` (respeita color-scheme). */
export function estiloTagRodadaDivify(numero: DivifyRodadaNumero | number): CSSProperties {
  const t = RODADA_COLORS[numero] ?? RODADA_COLORS[1];
  return {
    background: `light-dark(${t.bg}, ${t.bgDark})`,
    color: `light-dark(${t.color}, ${t.colorDark})`,
  };
}

export function estiloTagRodadaPorLabel(nome: string | null | undefined): CSSProperties | null {
  const num = rodadaNumeroFromLabel(nome);
  if (!num) return null;
  return estiloTagRodadaDivify(num);
}

/** Garante as 6 tags de rodada no kanban Divify / Moní Capital (idempotente). */
export async function garantirTagsRodadaDivify(
  db: DbTagClient,
  kanbanId: string = KANBAN_IDS.MONI_CAPITAL,
): Promise<void> {
  const kid = String(kanbanId ?? '').trim();
  if (!kid) return;

  for (const rodada of DIVIFY_RODADAS) {
    const { data: existing } = await db
      .from('kanban_tags')
      .select('id, cor')
      .eq('kanban_id', kid)
      .eq('nome', rodada.nome)
      .maybeSingle();

    if (existing?.id) {
      if (String((existing as { cor?: string }).cor ?? '') !== rodada.cor) {
        await db
          .from('kanban_tags')
          .update({ cor: rodada.cor } as never)
          .eq('id', String(existing.id));
      }
      continue;
    }

    await db.from('kanban_tags').insert({
      kanban_id: kid,
      nome: rodada.nome,
      cor: rodada.cor,
    } as never);
  }
}

async function resolverTagIdRodada(
  db: DbTagClient,
  kanbanId: string,
  numero: DivifyRodadaNumero,
): Promise<string | null> {
  await garantirTagsRodadaDivify(db, kanbanId);
  const nome = nomeTagRodadaDivify(numero);
  const { data } = await db
    .from('kanban_tags')
    .select('id')
    .eq('kanban_id', kanbanId)
    .eq('nome', nome)
    .maybeSingle();
  const id = String((data as { id?: string } | null)?.id ?? '').trim();
  return id || null;
}

/**
 * Aplica tag de rodada exclusiva no card (remove outras tags de rodada do mesmo card).
 * Assinatura espelhada de aplicarTagTrancheCreditoObra; `db` = admin client.
 */
export async function aplicarTagRodadaDivify(
  db: DbTagClient,
  cardId: string,
  rodadaIndex: DivifyRodadaNumero,
  kanbanId: string = KANBAN_IDS.MONI_CAPITAL,
): Promise<void> {
  const cid = String(cardId ?? '').trim();
  const kid = String(kanbanId ?? '').trim();
  if (!cid || !kid) return;

  const tagId = await resolverTagIdRodada(db, kid, rodadaIndex);
  if (!tagId) return;

  const { data: tagsKanban } = await db.from('kanban_tags').select('id, nome').eq('kanban_id', kid);
  const rodadaTagIds = (tagsKanban ?? [])
    .filter((t) => NOMES_RODADA.has(String((t as { nome?: string }).nome ?? '')))
    .map((t) => String((t as { id: string }).id));

  if (rodadaTagIds.length > 0) {
    await db.from('kanban_card_tags').delete().eq('card_id', cid).in('tag_id', rodadaTagIds);
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
