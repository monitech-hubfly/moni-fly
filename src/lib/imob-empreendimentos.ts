/** Cadastro de empreendimentos IMOB (`imob_empreendimentos`). */

import type { createClient } from '@/lib/supabase/server';
import { isCadastroValorVazio } from '@/lib/cadastro-linha-em-branco';

export type ImobEmpreendimentoRow = {
  id: string;
  nome: string;
  slug: string | null;
  specs: string | null;
  ativo: boolean;
  imagem_url: string | null;
  share_token: string | null;
  card_id: string | null;
  condominio_id: string | null;
  created_at: string | null;
  // joined via supabase
  condominio_nome: string | null;
  condominio_cidade: string | null;
  condominio_estado: string | null;
  card_titulo: string | null;
  card_status: string | null;
  // computed counts (loaded separately or via rpc)
  corretores_count?: number;
  unidades_count?: number;
  // linked corretor ids (loaded on demand)
  corretor_ids?: string[];
};

export type ImobEmpreendimentoPatch = Partial<{
  nome: string;
  slug: string | null;
  specs: string | null;
  ativo: boolean;
  imagem_url: string | null;
  card_id: string | null;
  condominio_id: string | null;
}>;

export function isImobEmpreendimentoLinhaEmBranco(row: { nome?: string | null }): boolean {
  return isCadastroValorVazio(row.nome);
}

export function normalizarParaBuscaImob(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function imobEmpreendimentoRowMatchesBusca(
  row: ImobEmpreendimentoRow,
  busca: string,
): boolean {
  const q = normalizarParaBuscaImob(busca);
  if (!q) return true;
  const parts = [
    row.nome,
    row.slug,
    row.specs,
    row.condominio_nome,
    row.condominio_cidade,
    row.condominio_estado,
    row.card_titulo,
  ];
  return parts.some((p) => normalizarParaBuscaImob(String(p ?? '')).includes(q));
}

export function ordenarImobEmpreendimentosPorNome(
  rows: ImobEmpreendimentoRow[],
): ImobEmpreendimentoRow[] {
  return [...rows].sort((a, b) =>
    (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' }),
  );
}

/** Agrupa empreendimentos por condomínio. */
export function agruparPorCondominio(
  rows: ImobEmpreendimentoRow[],
): Array<{ condominio_id: string | null; condominio_nome: string; rows: ImobEmpreendimentoRow[] }> {
  const map = new Map<string, { condominio_id: string | null; condominio_nome: string; rows: ImobEmpreendimentoRow[] }>();
  for (const row of rows) {
    const key = row.condominio_id ?? '__sem_condominio__';
    if (!map.has(key)) {
      map.set(key, {
        condominio_id: row.condominio_id,
        condominio_nome: row.condominio_nome ?? 'Sem condomínio',
        rows: [],
      });
    }
    map.get(key)!.rows.push(row);
  }
  return [...map.values()].sort((a, b) =>
    a.condominio_nome.localeCompare(b.condominio_nome, 'pt-BR', { sensitivity: 'base' }),
  );
}

type RawImobEmp = Record<string, unknown> & {
  condominios?: { id?: string; nome?: string; cidade?: string; estado?: string } | null;
  kanban_cards?: { id?: string; titulo?: string; status?: string } | null;
};

function mapRow(r: RawImobEmp): ImobEmpreendimentoRow {
  const cond = r.condominios ?? null;
  const card = r.kanban_cards ?? null;
  return {
    id: String(r.id),
    nome: String(r.nome ?? '').trim(),
    slug: (r.slug as string | null) ?? null,
    specs: ((r.specs as string | null) ?? null)?.trim() || null,
    ativo: Boolean(r.ativo ?? true),
    imagem_url: (r.imagem_url as string | null) ?? null,
    share_token: (r.share_token as string | null) ?? null,
    card_id: (r.card_id as string | null) ?? null,
    condominio_id: (r.condominio_id as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null,
    condominio_nome: cond?.nome ?? null,
    condominio_cidade: cond?.cidade ?? null,
    condominio_estado: cond?.estado ?? null,
    card_titulo: card?.titulo ?? null,
    card_status: card?.status ?? null,
  };
}

export async function fetchImobEmpreendimentosRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ImobEmpreendimentoRow[] | null> {
  const { data, error } = await supabase
    .from('imob_empreendimentos')
    .select(
      `id, nome, slug, specs, ativo, imagem_url, share_token, card_id, condominio_id, created_at,
       condominios(id, nome, cidade, estado),
       kanban_cards(id, titulo, status)`,
    )
    .order('nome', { ascending: true });

  if (error) {
    console.error('[imob_empreendimentos] fetch:', error.message);
    return null;
  }

  const rows = (data ?? []).map((r) => mapRow(r as RawImobEmp));

  // Enrich with counts
  const { data: corretoresLinks } = await supabase
    .from('imob_corretor_empreendimentos')
    .select('empreendimento_id, corretor_id');

  if (corretoresLinks) {
    const countMap = new Map<string, Set<string>>();
    for (const link of corretoresLinks) {
      const empId = String((link as { empreendimento_id?: string }).empreendimento_id ?? '');
      const corrId = String((link as { corretor_id?: string }).corretor_id ?? '');
      if (!countMap.has(empId)) countMap.set(empId, new Set());
      countMap.get(empId)!.add(corrId);
    }
    for (const row of rows) {
      const set = countMap.get(row.id);
      row.corretores_count = set?.size ?? 0;
      row.corretor_ids = set ? [...set] : [];
    }
  }

  const { data: unidades } = await supabase
    .from('imob_card_empreendimentos')
    .select('card_id');

  if (unidades) {
    const unitMap = new Map<string, number>();
    for (const u of unidades) {
      const cardId = String((u as { card_id?: string }).card_id ?? '');
      unitMap.set(cardId, (unitMap.get(cardId) ?? 0) + 1);
    }
    for (const row of rows) {
      row.unidades_count = row.card_id ? (unitMap.get(row.card_id) ?? 0) : 0;
    }
  }

  return rows;
}
