import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import type {
  PainelCardDTO,
  PainelHistoricoMovimentoDTO,
  PainelPerformanceDataset,
  PainelRetrocessoDTO,
} from '@/lib/kanban/painel-performance-types';
import type { KanbanCardBrief, KanbanFase } from './types';
import { fetchPainelChamados } from '@/lib/kanban/fetch-painel-chamados';
import { enrichCardsComResponsavelFase } from '@/lib/kanban/responsavel-fase-checklist';
import { PainelPerformanceDashboard } from './PainelPerformanceDashboard';

function relOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isPrivilegedRole(role: string | null | undefined): boolean {
  const r = String(role ?? '').toLowerCase();
  return r === 'admin' || r === 'consultor';
}

async function fetchPaged<T>(
  run: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await run(from, to);
    if (error) break;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

function applyFranqueadoFilter<Q>(q: Q, privileged: boolean, uid: string | null): Q {
  if (!privileged && uid) {
    return (q as unknown as { eq: (c: string, v: string) => Q }).eq('franqueado_id', uid);
  }
  return q;
}

function mapFases(fases: KanbanFase[]) {
  return fases.map((f) => ({
    id: f.id,
    nome: f.nome,
    ordem: f.ordem,
    sla_dias: f.sla_dias,
    fase_conversao: Boolean(f.fase_conversao),
  }));
}

function mapCardRow(c: {
  id: string;
  titulo: string;
  fase_id: string;
  created_at: string;
  updated_at?: string | null;
  entered_fase_at?: string | null;
  franqueado_id: string;
  arquivado?: boolean | null;
  arquivado_em?: string | null;
  concluido?: boolean | null;
  concluido_em?: string | null;
  status?: string | null;
  motivo_arquivamento?: string | null;
  rede_franqueado_id?: string | null;
  rede_franqueados?:
    | { n_franquia?: string | null; nome_completo?: string | null }
    | Array<{ n_franquia?: string | null; nome_completo?: string | null }>
    | null;
  responsavel_fase_id?: string | null;
  responsavel_fase_nome?: string | null;
}): PainelCardDTO {
  const rede = relOne(c.rede_franqueados);
  return {
    id: c.id,
    titulo: c.titulo,
    fase_id: c.fase_id,
    created_at: c.created_at,
    updated_at: String(c.updated_at ?? c.created_at),
    entered_fase_at: c.entered_fase_at != null ? String(c.entered_fase_at) : null,
    franqueado_id: c.franqueado_id,
    arquivado: !!c.arquivado,
    arquivado_em: c.arquivado_em ?? null,
    concluido: !!c.concluido,
    concluido_em: c.concluido_em ?? null,
    status: c.status ?? 'ativo',
    motivo_arquivamento: c.motivo_arquivamento ?? null,
    rede_franqueado_id: c.rede_franqueado_id != null ? String(c.rede_franqueado_id) : null,
    n_franquia: rede?.n_franquia != null ? String(rede.n_franquia) : null,
    franqueado_rede_nome: rede?.nome_completo != null ? String(rede.nome_completo) : null,
    responsavel_fase_id: c.responsavel_fase_id ?? null,
    responsavel_fase_nome: c.responsavel_fase_nome ?? null,
  };
}

const CARD_SELECT_NATIVO = `
  id,titulo,fase_id,created_at,updated_at,entered_fase_at,franqueado_id,arquivado,arquivado_em,concluido,concluido_em,status,motivo_arquivamento,rede_franqueado_id,
  rede_franqueados ( n_franquia, nome_completo )
`;

async function fetchRetrocessos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardIds: string[],
): Promise<PainelRetrocessoDTO[]> {
  const retrocessoRows: PainelRetrocessoDTO[] = [];
  for (const part of chunk(cardIds, 120)) {
    if (part.length === 0) continue;
    const { data: hrows } = await supabase
      .from('kanban_historico')
      .select('card_id,detalhe')
      .in('card_id', part)
      .eq('is_retrocesso', true);
    for (const h of hrows ?? []) {
      const row = h as { card_id: string; detalhe: PainelRetrocessoDTO['detalhe'] };
      retrocessoRows.push({ card_id: row.card_id, detalhe: row.detalhe ?? null });
    }
  }
  return retrocessoRows;
}

async function fetchHistoricoMovimentos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardIds: string[],
): Promise<PainelHistoricoMovimentoDTO[]> {
  const out: PainelHistoricoMovimentoDTO[] = [];
  for (const part of chunk(cardIds, 80)) {
    if (part.length === 0) continue;
    const { data: rows } = await supabase
      .from('kanban_historico')
      .select('card_id,acao,detalhe,criado_em')
      .in('card_id', part)
      .in('acao', ['card_criado', 'fase_avancada', 'fase_retrocedida', 'card_arquivado']);
    for (const r of rows ?? []) {
      const row = r as {
        card_id: string;
        acao: string;
        detalhe: Record<string, unknown> | null;
        criado_em: string;
      };
      out.push({
        card_id: row.card_id,
        acao: row.acao,
        detalhe: row.detalhe ?? null,
        criado_em: String(row.criado_em ?? new Date().toISOString()),
      });
    }
  }
  return out;
}

export type PainelPerformanceProps = {
  kanbanNome: string;
  kanbanId: string;
  fases: KanbanFase[];
  cards: KanbanCardBrief[];
  origemCards?: 'nativo' | 'legado';
};

export function PainelPerformanceLoading() {
  return (
    <div className="animate-pulse space-y-10 pb-10">
      <div className="flex flex-col gap-4 border-b pb-6" style={{ borderColor: 'var(--moni-border-subtle)' }}>
        <div className="h-8 w-64 rounded bg-stone-200" />
        <div className="h-10 w-full max-w-md rounded-full bg-stone-100" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-48 bg-white"
          style={{ borderRadius: 12, border: '0.5px solid var(--moni-border-default)' }}
        />
      ))}
    </div>
  );
}

export function PainelPerformance(props: PainelPerformanceProps) {
  return (
    <Suspense fallback={<PainelPerformanceLoading />}>
      <PainelPerformanceContent {...props} />
    </Suspense>
  );
}

async function buildProfilesMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: Iterable<string>,
): Promise<Record<string, string>> {
  const uniq = [...new Set(ids)].filter(Boolean);
  const out: Record<string, string> = {};
  for (const part of chunk(uniq, 120)) {
    if (part.length === 0) continue;
    const { data: profs } = await supabase.from('profiles').select('id,full_name').in('id', part);
    for (const p of profs ?? []) {
      const row = p as { id: string; full_name: string | null };
      out[row.id] = String(row.full_name ?? '—');
    }
  }
  return out;
}

async function PainelPerformanceContent({
  kanbanNome,
  kanbanId,
  fases,
  cards,
  origemCards = 'nativo',
}: PainelPerformanceProps) {
  const supabase = await createClient();
  const origem = origemCards === 'legado' ? 'legado' : 'nativo';

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? null;

  const { data: profile } = uid
    ? await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
    : { data: null as { role: string | null } | null };
  const privileged = isPrivilegedRole(profile?.role);

  const fasesDto = mapFases(fases);

  let cardsDto: PainelCardDTO[];

  if (origemCards === 'legado') {
    cardsDto = cards.map((c) =>
      mapCardRow({
        id: c.id,
        titulo: c.titulo,
        fase_id: c.fase_id,
        created_at: c.created_at,
        updated_at: c.created_at,
        entered_fase_at: c.entered_fase_at ?? null,
        franqueado_id: c.franqueado_id,
        arquivado: c.arquivado,
        concluido: c.concluido,
        concluido_em: c.concluido_em,
        status: c.status,
        motivo_arquivamento: c.motivo_arquivamento,
      }),
    );
  } else {
    const cardsRows = await fetchPaged<{
      id: string;
      titulo: string;
      fase_id: string;
      created_at: string;
      updated_at: string;
      entered_fase_at: string | null;
      franqueado_id: string;
      arquivado: boolean | null;
      arquivado_em: string | null;
      concluido: boolean | null;
      concluido_em: string | null;
      status: string;
      motivo_arquivamento: string | null;
      rede_franqueado_id: string | null;
      rede_franqueados:
        | { n_franquia?: string | null; nome_completo?: string | null }
        | Array<{ n_franquia?: string | null; nome_completo?: string | null }>
        | null;
    }>(async (from, to) => {
      let q = supabase.from('kanban_cards').select(CARD_SELECT_NATIVO).eq('kanban_id', kanbanId);
      q = applyFranqueadoFilter(q, privileged, uid);
      return q.range(from, to);
    });
    cardsDto = cardsRows.map((c) => mapCardRow(c));

    const briefs: KanbanCardBrief[] = cardsDto.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      status: c.status,
      created_at: c.created_at,
      fase_id: c.fase_id,
      franqueado_id: c.franqueado_id,
      kanban_id: kanbanId,
      entered_fase_at: c.entered_fase_at,
      arquivado: c.arquivado,
      concluido: c.concluido,
      origem: 'nativo',
    }));
    const enriched = await enrichCardsComResponsavelFase(supabase, briefs);
    const respPorId = new Map(enriched.map((c) => [c.id, c]));
    cardsDto = cardsDto.map((c) => {
      const extra = respPorId.get(c.id);
      if (!extra) return c;
      return {
        ...c,
        responsavel_fase_id: extra.responsavel_fase_id ?? null,
        responsavel_fase_nome: extra.responsavel_fase_nome ?? null,
      };
    });
  }

  const idList = cardsDto.map((c) => c.id);
  const [chamados, retrocessoRows, historicoMovimentos] = await Promise.all([
    fetchPainelChamados(supabase, idList, origem),
    fetchRetrocessos(supabase, idList),
    origem === 'nativo' ? fetchHistoricoMovimentos(supabase, idList) : Promise.resolve([]),
  ]);

  const profileIds = new Set<string>();
  for (const c of cardsDto) {
    if (c.franqueado_id) profileIds.add(c.franqueado_id);
    if (c.responsavel_fase_id) profileIds.add(c.responsavel_fase_id);
  }
  for (const ch of chamados) {
    if (ch.responsavelId) profileIds.add(ch.responsavelId);
  }
  for (const c of cards) {
    if (c.franqueado_id) profileIds.add(c.franqueado_id);
  }
  const profiles = await buildProfilesMap(supabase, profileIds);
  for (const c of cards) {
    const fn = c.profiles?.full_name;
    if (fn && c.franqueado_id) profiles[c.franqueado_id] = fn;
  }

  const dataset: PainelPerformanceDataset = {
    mode: origemCards === 'legado' ? 'legado' : 'nativo',
    kanbanNome,
    kanbanId,
    fases: fasesDto,
    cards: cardsDto,
    chamados,
    retrocessoRows,
    historicoMovimentos,
    profiles,
  };

  return <PainelPerformanceDashboard dataset={dataset} />;
}
