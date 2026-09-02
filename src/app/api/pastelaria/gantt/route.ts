import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from '@/types/database.gen';
import { getPastelariaAuthUser, isAuthResponse } from '@/lib/pastelaria/auth';
import { totalHorasConvertidas } from '@/lib/pastelaria/converter';
import type { PastelariaGanttSemanaRow, PastelariaHorasRow } from '@/lib/pastelaria/types';
import { normalizeSemanaLabel } from '@/lib/pastelaria/week';

function parseSemanasParam(searchParams: URLSearchParams): string[] {
  const fromRepeated = searchParams.getAll('semanas').flatMap((v) => v.split(','));
  const fromBracket = searchParams.getAll('semanas[]').flatMap((v) => v.split(','));
  const single = searchParams.get('semanas');
  const values = [...fromRepeated, ...fromBracket];
  if (single) values.push(...single.split(','));
  return Array.from(new Set(values.map((s) => normalizeSemanaLabel(s)).filter(Boolean)));
}

type GanttCardJson = {
  id?: string;
  nome?: string;
  area_nome?: string | null;
  coluna?: string;
  completed_week?: string | null;
  responsavel_nome?: string | null;
  horas_por_semana?: Json;
  total_horas_semana?: number;
};

function responsavelNomeFromCard(card: {
  responsavel_nome?: string | null;
  area_pessoas?: { nome: string | null } | { nome: string | null }[] | null;
}): string | null {
  const pessoa = card.area_pessoas;
  const fromJoin = Array.isArray(pessoa) ? pessoa[0]?.nome : pessoa?.nome;
  if (fromJoin?.trim()) return fromJoin.trim();
  return card.responsavel_nome?.trim() || null;
}

function filterSemanasByArea(
  rows: PastelariaGanttSemanaRow[],
  cardIdsInArea: Set<string>,
): PastelariaGanttSemanaRow[] {
  return rows
    .map((row) => {
      const cardsRaw = row.cards;
      const cardsList = Array.isArray(cardsRaw) ? (cardsRaw as GanttCardJson[]) : [];
      const filtered = cardsList.filter((c) => c.id && cardIdsInArea.has(String(c.id)));
      const totalHoras = filtered.reduce((sum, c) => sum + Number(c.total_horas_semana ?? 0), 0);
      return {
        semana: row.semana,
        total_cards: filtered.length,
        total_horas: totalHoras,
        cards: filtered as Json,
      };
    })
    .filter((row) => row.total_cards > 0);
}

function filterBySemanaLabels(
  rows: PastelariaGanttSemanaRow[],
  semanaLabels: string[],
): PastelariaGanttSemanaRow[] {
  if (semanaLabels.length === 0) return rows;
  const wanted = new Set(semanaLabels);
  return rows.filter((row) => wanted.has(normalizeSemanaLabel(row.semana)));
}

function normalizeGanttRows(rows: PastelariaGanttSemanaRow[]): PastelariaGanttSemanaRow[] {
  const bySemana = new Map<string, PastelariaGanttSemanaRow>();

  for (const row of rows) {
    const semana = normalizeSemanaLabel(row.semana);
    const cardsList = Array.isArray(row.cards) ? (row.cards as GanttCardJson[]) : [];
    const existing = bySemana.get(semana);
    if (!existing) {
      bySemana.set(semana, {
        semana,
        total_cards: row.total_cards,
        total_horas: row.total_horas,
        cards: cardsList as Json,
      });
      continue;
    }
    const mergedCards = [
      ...(Array.isArray(existing.cards) ? (existing.cards as GanttCardJson[]) : []),
      ...cardsList,
    ];
    bySemana.set(semana, {
      semana,
      total_cards: Number(existing.total_cards) + Number(row.total_cards),
      total_horas: Number(existing.total_horas) + Number(row.total_horas),
      cards: mergedCards as Json,
    });
  }

  return Array.from(bySemana.values()).sort((a, b) =>
    a.semana.localeCompare(b.semana, 'pt-BR', { numeric: true }),
  );
}

function buildGanttEntry(
  card: {
    id: string;
    nome: string;
    coluna: string;
    completed_week: string | null;
    responsavel_nome?: string | null;
    areas: { nome: string } | { nome: string }[] | null;
    area_pessoas?: { nome: string | null } | { nome: string | null }[] | null;
  },
  semana: string,
  h: PastelariaHorasRow | null,
): GanttCardJson {
  const areaRel = card.areas;
  const areaNome = Array.isArray(areaRel) ? areaRel[0]?.nome ?? null : areaRel?.nome ?? null;
  const total = h ? totalHorasConvertidas(h) : 0;
  return {
    id: card.id,
    nome: card.nome,
    area_nome: areaNome,
    coluna: card.coluna,
    completed_week: card.completed_week,
    responsavel_nome: responsavelNomeFromCard(card),
    horas_por_semana: {
      seg: Number(h?.seg ?? 0),
      ter: Number(h?.ter ?? 0),
      qua: Number(h?.qua ?? 0),
      qui: Number(h?.qui ?? 0),
      sex: Number(h?.sex ?? 0),
    } as Json,
    total_horas_semana: total,
  };
}

async function enrichGanttSemanasWithResponsavel(
  supabase: SupabaseClient,
  rows: PastelariaGanttSemanaRow[],
): Promise<PastelariaGanttSemanaRow[]> {
  const ids = new Set<string>();
  for (const row of rows) {
    const list = Array.isArray(row.cards) ? (row.cards as GanttCardJson[]) : [];
    for (const c of list) {
      if (c.id) ids.add(String(c.id));
    }
  }
  if (ids.size === 0) return rows;

  const { data: meta } = await supabase
    .from('pastelaria_cards')
    .select('id, responsavel_id, responsavel_nome, area_pessoas!responsavel_id(nome)')
    .in('id', Array.from(ids));

  const nomeById = new Map<string, string | null>();
  for (const row of meta ?? []) {
    const r = row as {
      id: string;
      responsavel_nome?: string | null;
      area_pessoas?: { nome: string | null } | { nome: string | null }[] | null;
    };
    nomeById.set(String(r.id), responsavelNomeFromCard(r));
  }

  return rows.map((row) => {
    const list = Array.isArray(row.cards) ? (row.cards as GanttCardJson[]) : [];
    const enriched = list.map((c) => ({
      ...c,
      responsavel_nome: c.id ? (nomeById.get(String(c.id)) ?? c.responsavel_nome ?? null) : null,
    }));
    return { ...row, cards: enriched as Json };
  });
}

async function enrichGanttSemanasWithConvertedHoras(
  supabase: SupabaseClient,
  rows: PastelariaGanttSemanaRow[],
): Promise<PastelariaGanttSemanaRow[]> {
  const ids = new Set<string>();
  for (const row of rows) {
    const list = Array.isArray(row.cards) ? (row.cards as GanttCardJson[]) : [];
    for (const c of list) {
      if (c.id) ids.add(String(c.id));
    }
  }
  if (ids.size === 0) return rows;

  const { data: horasRows, error } = await supabase
    .from('pastelaria_horas')
    .select(
      'card_id, semana, seg, ter, qua, qui, sex, seg_unidade, ter_unidade, qua_unidade, qui_unidade, sex_unidade, unidade',
    )
    .in('card_id', Array.from(ids));

  if (error) {
    console.error('[pastelaria/gantt] horas conversão', error);
    return rows;
  }

  const horasKey = (cardId: string, semana: string) =>
    `${cardId}::${normalizeSemanaLabel(semana)}`;
  const horasByKey = new Map<string, PastelariaHorasRow>();
  for (const h of (horasRows ?? []) as PastelariaHorasRow[]) {
    horasByKey.set(horasKey(String(h.card_id), h.semana), h);
  }

  return rows.map((row) => {
    const semana = normalizeSemanaLabel(row.semana);
    const list = Array.isArray(row.cards) ? (row.cards as GanttCardJson[]) : [];
    const enriched = list.map((c) => {
      const h = c.id ? horasByKey.get(horasKey(String(c.id), semana)) : undefined;
      const total = h ? totalHorasConvertidas(h) : Number(c.total_horas_semana ?? 0);
      return { ...c, total_horas_semana: total };
    });
    const totalHoras = enriched.reduce((sum, c) => sum + Number(c.total_horas_semana ?? 0), 0);
    return {
      ...row,
      total_horas: totalHoras,
      cards: enriched as Json,
    };
  });
}

async function buildGanttFromTables(
  supabase: SupabaseClient,
  areaId: string | null,
): Promise<PastelariaGanttSemanaRow[]> {
  let cardsQuery = supabase
    .from('pastelaria_cards')
    .select(
      'id, nome, coluna, completed_week, semana_origem, area_id, responsavel_id, responsavel_nome, areas(nome), area_pessoas!responsavel_id(nome)',
    )
    .in('coluna', ['done', 'doing'])
    .or('reclassificado.is.null,reclassificado.eq.false');

  if (areaId) {
    cardsQuery = cardsQuery.eq('area_id', areaId);
  }

  const { data: cards, error: cardsError } = await cardsQuery;
  if (cardsError) throw new Error(cardsError.message);
  if (!cards?.length) return [];

  type CardRow = {
    id: string;
    nome: string;
    coluna: string;
    completed_week: string | null;
    semana_origem: string;
    responsavel_nome: string | null;
    areas: { nome: string } | { nome: string }[] | null;
    area_pessoas: { nome: string | null } | { nome: string | null }[] | null;
  };

  const cardList = cards as CardRow[];
  const cardIds = cardList.map((c) => String(c.id));
  const { data: horasRows, error: horasError } = await supabase
    .from('pastelaria_horas')
    .select(
      'card_id, semana, seg, ter, qua, qui, sex, seg_unidade, ter_unidade, qua_unidade, qui_unidade, sex_unidade, unidade',
    )
    .in('card_id', cardIds);

  if (horasError) throw new Error(horasError.message);

  const horasByCard = new Map<string, typeof horasRows>();
  for (const h of horasRows ?? []) {
    const cid = String((h as { card_id: string }).card_id);
    const list = horasByCard.get(cid) ?? [];
    list.push(h);
    horasByCard.set(cid, list);
  }

  const bySemana = new Map<string, GanttCardJson[]>();

  for (const card of cardList) {
    const cardHoras = horasByCard.get(String(card.id)) ?? [];
    if (cardHoras.length === 0) {
      const semana = normalizeSemanaLabel(card.semana_origem);
      const entry = buildGanttEntry(card, semana, null);
      const list = bySemana.get(semana) ?? [];
      list.push(entry);
      bySemana.set(semana, list);
      continue;
    }
    for (const h of cardHoras) {
      const semana = normalizeSemanaLabel((h as { semana: string }).semana);
      const entry = buildGanttEntry(card, semana, h as PastelariaHorasRow);
      const list = bySemana.get(semana) ?? [];
      list.push(entry);
      bySemana.set(semana, list);
    }
  }

  return Array.from(bySemana.entries())
    .map(([semana, cardsList]) => ({
      semana,
      total_cards: cardsList.length,
      total_horas: cardsList.reduce((s, c) => s + Number(c.total_horas_semana ?? 0), 0),
      cards: cardsList as Json,
    }))
    .sort((a, b) => a.semana.localeCompare(b.semana, 'pt-BR', { numeric: true }));
}

export async function GET(req: Request) {
  try {
    const auth = await getPastelariaAuthUser();
    if (isAuthResponse(auth)) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(req.url);
    const areaId = searchParams.get('area_id')?.trim() || null;
    const semanas = parseSemanasParam(searchParams);

    const { data, error } = await supabase
      .from('pastelaria_gantt_semanas')
      .select('*')
      .order('semana', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let semanasData = normalizeGanttRows((data ?? []) as PastelariaGanttSemanaRow[]);
    semanasData = await enrichGanttSemanasWithResponsavel(supabase, semanasData);
    semanasData = await enrichGanttSemanasWithConvertedHoras(supabase, semanasData);
    semanasData = filterBySemanaLabels(semanasData, semanas);

    if (areaId) {
      const { data: cardsInArea, error: cardsError } = await supabase
        .from('pastelaria_cards')
        .select('id')
        .eq('area_id', areaId)
        .in('coluna', ['done', 'doing'])
        .or('reclassificado.is.null,reclassificado.eq.false');

      if (cardsError) return NextResponse.json({ error: cardsError.message }, { status: 500 });

      const ids = new Set((cardsInArea ?? []).map((c) => String((c as { id: string }).id)));
      semanasData = filterSemanasByArea(semanasData, ids);
    }

    if (semanasData.length === 0) {
      try {
        let fallback = await buildGanttFromTables(supabase, areaId);
        fallback = filterBySemanaLabels(fallback, semanas);
        if (fallback.length > 0) {
          semanasData = await enrichGanttSemanasWithConvertedHoras(supabase, fallback);
        }
      } catch (fallbackError) {
        console.error('[pastelaria/gantt] fallback', fallbackError);
      }
    }

    return NextResponse.json({ semanas: semanasData });
  } catch (e) {
    console.error('[pastelaria/gantt] GET', e);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
