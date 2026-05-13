import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import type {
  PainelAtividadeDTO,
  PainelCardDTO,
  PainelFaseDTO,
  PainelPerformanceDataset,
  PainelRetrocessoDTO,
} from '@/lib/kanban/painel-performance-types';
import type { KanbanCardBrief, KanbanFase } from './types';
import { PainelPerformanceDashboard } from './PainelPerformanceDashboard';

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

function mapFases(fases: KanbanFase[]): PainelFaseDTO[] {
  return fases.map((f) => ({
    id: f.id,
    nome: f.nome,
    ordem: f.ordem,
    sla_dias: f.sla_dias,
  }));
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
        <div className="h-8 w-48 rounded bg-stone-200" />
        <div className="h-10 w-full max-w-md rounded-full bg-stone-100" />
      </div>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 min-w-[140px] flex-1"
            style={{ borderRadius: 12, background: 'var(--color-background-secondary, #f2ede8)' }}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-80 bg-white"
            style={{ borderRadius: 12, border: '0.5px solid #E8E2DA' }}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-64 bg-white"
            style={{ borderRadius: 12, border: '0.5px solid #E8E2DA' }}
          />
        ))}
      </div>
      <div className="h-48 bg-white" style={{ borderRadius: 12, border: '0.5px solid #E8E2DA' }} />
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

  if (origemCards === 'legado') {
    const cardsDto: PainelCardDTO[] = cards.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      fase_id: c.fase_id,
      created_at: c.created_at,
      franqueado_id: c.franqueado_id,
      arquivado: !!c.arquivado,
      concluido: !!c.concluido,
      concluido_em: c.concluido_em ?? null,
      status: c.status,
      motivo_arquivamento: c.motivo_arquivamento ?? null,
    }));

    const cardIds = cardsDto.map((c) => c.id).filter(Boolean);
    const atividades: PainelAtividadeDTO[] = [];
    for (const part of chunk(cardIds, 100)) {
      if (part.length === 0) continue;
      const { data: rows } = await supabase
        .from('kanban_atividades')
        .select('id,card_id,status,trava,tipo,responsavel_id,responsaveis_ids,created_at,data_vencimento')
        .in('card_id', part)
        .eq('origem', origem);
      for (const r of rows ?? []) {
        const row = r as Record<string, unknown>;
        atividades.push({
          id: String(row.id),
          card_id: String(row.card_id),
          status: String(row.status ?? ''),
          trava: row.trava === true,
          tipo: row.tipo != null ? String(row.tipo) : null,
          responsavel_id: row.responsavel_id != null ? String(row.responsavel_id) : null,
          responsaveis_ids: Array.isArray(row.responsaveis_ids)
            ? (row.responsaveis_ids as string[]).filter(Boolean)
            : null,
          created_at: String(row.created_at ?? new Date().toISOString()),
          data_vencimento: row.data_vencimento != null ? String(row.data_vencimento) : null,
        });
      }
    }

    const retrocessoRows: PainelRetrocessoDTO[] = [];
    for (const part of chunk(cardIds, 100)) {
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

    const profileIds = new Set<string>();
    for (const c of cardsDto) profileIds.add(c.franqueado_id);
    for (const a of atividades) {
      if (a.responsavel_id) profileIds.add(a.responsavel_id);
      for (const x of a.responsaveis_ids ?? []) profileIds.add(x);
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
      mode: 'legado',
      kanbanNome,
      kanbanId,
      fases: fasesDto,
      cards: cardsDto,
      atividades,
      retrocessoRows,
      profiles,
    };

    return <PainelPerformanceDashboard dataset={dataset} />;
  }

  const cardsRows = await fetchPaged<{
    id: string;
    titulo: string;
    fase_id: string;
    created_at: string;
    franqueado_id: string;
    arquivado: boolean | null;
    concluido: boolean | null;
    concluido_em: string | null;
    status: string;
    motivo_arquivamento: string | null;
  }>(async (from, to) => {
    let q = supabase
      .from('kanban_cards')
      .select(
        'id,titulo,fase_id,created_at,franqueado_id,arquivado,concluido,concluido_em,status,motivo_arquivamento',
      )
      .eq('kanban_id', kanbanId);
    q = applyFranqueadoFilter(q, privileged, uid);
    return q.range(from, to);
  });

  const cardsDto: PainelCardDTO[] = cardsRows.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    fase_id: c.fase_id,
    created_at: c.created_at,
    franqueado_id: c.franqueado_id,
    arquivado: !!c.arquivado,
    concluido: !!c.concluido,
    concluido_em: c.concluido_em ?? null,
    status: c.status ?? 'ativo',
    motivo_arquivamento: c.motivo_arquivamento ?? null,
  }));

  const idList = cardsDto.map((c) => c.id);
  const atividades: PainelAtividadeDTO[] = [];
  for (const part of chunk(idList, 100)) {
    if (part.length === 0) continue;
    const { data: rows } = await supabase
      .from('kanban_atividades')
      .select('id,card_id,status,trava,tipo,responsavel_id,responsaveis_ids,created_at,data_vencimento')
      .in('card_id', part)
      .eq('origem', origem);
    for (const r of rows ?? []) {
      const row = r as Record<string, unknown>;
      atividades.push({
        id: String(row.id),
        card_id: String(row.card_id),
        status: String(row.status ?? ''),
        trava: row.trava === true,
        tipo: row.tipo != null ? String(row.tipo) : null,
        responsavel_id: row.responsavel_id != null ? String(row.responsavel_id) : null,
        responsaveis_ids: Array.isArray(row.responsaveis_ids)
          ? (row.responsaveis_ids as string[]).filter(Boolean)
          : null,
        created_at: String(row.created_at ?? new Date().toISOString()),
        data_vencimento: row.data_vencimento != null ? String(row.data_vencimento) : null,
      });
    }
  }

  const retrocessoRows: PainelRetrocessoDTO[] = [];
  for (const part of chunk(idList, 120)) {
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

  const profileIds = new Set<string>();
  for (const c of cardsDto) profileIds.add(c.franqueado_id);
  for (const a of atividades) {
    if (a.responsavel_id) profileIds.add(a.responsavel_id);
    for (const x of a.responsaveis_ids ?? []) profileIds.add(x);
  }
  const profiles = await buildProfilesMap(supabase, profileIds);

  const dataset: PainelPerformanceDataset = {
    mode: 'nativo',
    kanbanNome,
    kanbanId,
    fases: fasesDto,
    cards: cardsDto,
    atividades,
    retrocessoRows,
    profiles,
  };

  return <PainelPerformanceDashboard dataset={dataset} />;
}
