import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import type {
  PainelCardDTO,
  PainelCreditoObraOperacoesIrmaoDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelPerformanceDataset,
  PainelRetrocessoDTO,
  PainelStepOnePortfolioFilhoDTO,
} from '@/lib/kanban/painel-performance-types';
import type { KanbanCardBrief, KanbanFase } from './types';
import { fetchPainelChamados } from '@/lib/kanban/fetch-painel-chamados';
import { enrichCardsComResponsavelFase } from '@/lib/kanban/responsavel-fase-checklist';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
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
    slug: f.slug ?? null,
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
    | {
        n_franquia?: string | null;
        nome_completo?: string | null;
        area_atuacao?: string | null;
        cidade_casa_frank?: string | null;
      }
    | Array<{
        n_franquia?: string | null;
        nome_completo?: string | null;
        area_atuacao?: string | null;
        cidade_casa_frank?: string | null;
      }>
    | null;
  responsavel_fase_id?: string | null;
  responsavel_fase_nome?: string | null;
  opcao_assinada?: boolean | null;
  opcao_assinada_em?: string | null;
  comite_aprovado?: boolean | null;
  comite_aprovado_em?: string | null;
  contrato_assinado?: boolean | null;
  contrato_assinado_em?: string | null;
  origem_kanban_id?: string | null;
  origem_kanban_nome?: string | null;
  nome_condominio?: string | null;
  quadra?: string | null;
  lote?: string | null;
  condominio_id?: string | null;
  rede_loteador_id?: string | null;
  projeto_id?: string | null;
  rede_loteadores?:
    | { nome?: string | null; interlocutor_nome?: string | null }
    | Array<{ nome?: string | null; interlocutor_nome?: string | null }>
    | null;
  projeto_negocio?:
    | {
        titulo?: string | null;
        franqueado_id?: string | null;
        rede_franqueados?:
          | {
              n_franquia?: string | null;
              nome_completo?: string | null;
              area_atuacao?: string | null;
              cidade_casa_frank?: string | null;
            }
          | Array<{
              n_franquia?: string | null;
              nome_completo?: string | null;
              area_atuacao?: string | null;
              cidade_casa_frank?: string | null;
            }>
          | null;
      }
    | Array<{
        titulo?: string | null;
        franqueado_id?: string | null;
        rede_franqueados?:
          | {
              n_franquia?: string | null;
              nome_completo?: string | null;
              area_atuacao?: string | null;
              cidade_casa_frank?: string | null;
            }
          | Array<{
              n_franquia?: string | null;
              nome_completo?: string | null;
              area_atuacao?: string | null;
              cidade_casa_frank?: string | null;
            }>
          | null;
      }>
    | null;
}): PainelCardDTO {
  const rede = relOne(c.rede_franqueados);
  const loteador = relOne(c.rede_loteadores);
  const projeto = relOne(c.projeto_negocio);
  const redeProjeto = relOne(projeto?.rede_franqueados);
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
    projeto_franqueado_id: projeto?.franqueado_id != null ? String(projeto.franqueado_id) : null,
    projeto_n_franquia: redeProjeto?.n_franquia != null ? String(redeProjeto.n_franquia) : null,
    projeto_franqueado_nome:
      redeProjeto?.nome_completo != null ? String(redeProjeto.nome_completo) : null,
    opcao_assinada: c.opcao_assinada ?? null,
    opcao_assinada_em: c.opcao_assinada_em ?? null,
    comite_aprovado: c.comite_aprovado ?? null,
    comite_aprovado_em: c.comite_aprovado_em ?? null,
    contrato_assinado: c.contrato_assinado ?? null,
    contrato_assinado_em: c.contrato_assinado_em ?? null,
    origem_kanban_id: c.origem_kanban_id != null ? String(c.origem_kanban_id) : null,
    origem_kanban_nome: c.origem_kanban_nome ?? null,
    nome_condominio: c.nome_condominio ?? null,
    quadra: c.quadra ?? null,
    lote: c.lote ?? null,
    condominio_id: c.condominio_id != null ? String(c.condominio_id) : null,
    projeto_titulo: projeto?.titulo != null ? String(projeto.titulo) : null,
    rede_area_atuacao: rede?.area_atuacao ?? null,
    rede_cidade_casa_frank: rede?.cidade_casa_frank ?? null,
    projeto_rede_area_atuacao: redeProjeto?.area_atuacao ?? null,
    projeto_rede_cidade_casa_frank: redeProjeto?.cidade_casa_frank ?? null,
    rede_loteador_id: c.rede_loteador_id != null ? String(c.rede_loteador_id) : null,
    loteador_nome: loteador?.nome != null ? String(loteador.nome) : null,
    projeto_id: c.projeto_id != null ? String(c.projeto_id) : null,
  };
}

const CARD_SELECT_NATIVO = `
  id,titulo,fase_id,created_at,updated_at,entered_fase_at,franqueado_id,arquivado,arquivado_em,concluido,concluido_em,status,motivo_arquivamento,rede_franqueado_id,
  rede_franqueados ( n_franquia, nome_completo )
`;

const CARD_SELECT_CAROMETRO = `
  id,titulo,fase_id,created_at,updated_at,entered_fase_at,franqueado_id,arquivado,arquivado_em,concluido,concluido_em,status,motivo_arquivamento,rede_franqueado_id,
  opcao_assinada,opcao_assinada_em,comite_aprovado,comite_aprovado_em,contrato_assinado,contrato_assinado_em,origem_kanban_id,origem_kanban_nome,
  rede_franqueados ( n_franquia, nome_completo ),
  projeto_negocio ( franqueado_id, rede_franqueados ( n_franquia, nome_completo ) )
`;

const CARD_SELECT_STEPONE = `
  id,titulo,fase_id,created_at,updated_at,entered_fase_at,franqueado_id,arquivado,arquivado_em,concluido,concluido_em,status,motivo_arquivamento,rede_franqueado_id,
  nome_condominio,quadra,lote,condominio_id,
  rede_franqueados ( n_franquia, nome_completo )
`;

const CARD_SELECT_OPERACOES = `
  id,titulo,fase_id,created_at,updated_at,entered_fase_at,franqueado_id,arquivado,arquivado_em,concluido,concluido_em,status,motivo_arquivamento,rede_franqueado_id,
  nome_condominio,condominio_id,projeto_id,
  rede_franqueados ( n_franquia, nome_completo, area_atuacao, cidade_casa_frank ),
  projeto_negocio ( titulo, franqueado_id, rede_franqueados ( n_franquia, nome_completo, area_atuacao, cidade_casa_frank ) )
`;

const CARD_SELECT_LOTEADORES = `
  id,titulo,fase_id,created_at,updated_at,entered_fase_at,franqueado_id,arquivado,arquivado_em,concluido,concluido_em,status,motivo_arquivamento,rede_franqueado_id,
  nome_condominio,rede_loteador_id,
  rede_franqueados ( n_franquia, nome_completo ),
  rede_loteadores ( nome, interlocutor_nome )
`;

const CARD_SELECT_CREDITO_OBRA = `
  id,titulo,fase_id,created_at,updated_at,entered_fase_at,franqueado_id,arquivado,arquivado_em,concluido,concluido_em,status,motivo_arquivamento,rede_franqueado_id,
  projeto_id,
  rede_franqueados ( n_franquia, nome_completo )
`;

async function fetchKanbanCardsPainel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kanbanId: string,
  privileged: boolean,
  uid: string | null,
  useCarometroSelect: boolean,
  useStepOneSelect: boolean,
  useOperacoesSelect: boolean,
  useLoteadoresSelect: boolean,
  useCreditoObraSelect: boolean,
  useContabilidadeSelect: boolean,
): Promise<Parameters<typeof mapCardRow>[0][]> {
  type Row = Parameters<typeof mapCardRow>[0];

  if (useCreditoObraSelect || useContabilidadeSelect) {
    return fetchPaged<Row>(async (from, to) => {
      let q = supabase.from('kanban_cards').select(CARD_SELECT_CREDITO_OBRA).eq('kanban_id', kanbanId);
      q = applyFranqueadoFilter(q, privileged, uid);
      const res = await q.range(from, to);
      return {
        data: (res.data ?? null) as Row[] | null,
        error: res.error,
      };
    });
  }

  if (useStepOneSelect) {
    return fetchPaged<Row>(async (from, to) => {
      let q = supabase.from('kanban_cards').select(CARD_SELECT_STEPONE).eq('kanban_id', kanbanId);
      q = applyFranqueadoFilter(q, privileged, uid);
      const res = await q.range(from, to);
      return {
        data: (res.data ?? null) as Row[] | null,
        error: res.error,
      };
    });
  }

  if (useOperacoesSelect) {
    return fetchPaged<Row>(async (from, to) => {
      let q = supabase.from('kanban_cards').select(CARD_SELECT_OPERACOES).eq('kanban_id', kanbanId);
      q = applyFranqueadoFilter(q, privileged, uid);
      const res = await q.range(from, to);
      return {
        data: (res.data ?? null) as Row[] | null,
        error: res.error,
      };
    });
  }

  if (useLoteadoresSelect) {
    return fetchPaged<Row>(async (from, to) => {
      let q = supabase.from('kanban_cards').select(CARD_SELECT_LOTEADORES).eq('kanban_id', kanbanId);
      q = applyFranqueadoFilter(q, privileged, uid);
      const res = await q.range(from, to);
      return {
        data: (res.data ?? null) as Row[] | null,
        error: res.error,
      };
    });
  }

  if (useCarometroSelect) {
    return fetchPaged<Row>(async (from, to) => {
      let q = supabase.from('kanban_cards').select(CARD_SELECT_CAROMETRO).eq('kanban_id', kanbanId);
      q = applyFranqueadoFilter(q, privileged, uid);
      const res = await q.range(from, to);
      return {
        data: (res.data ?? null) as Row[] | null,
        error: res.error,
      };
    });
  }

  return fetchPaged<Row>(async (from, to) => {
    let q = supabase.from('kanban_cards').select(CARD_SELECT_NATIVO).eq('kanban_id', kanbanId);
    q = applyFranqueadoFilter(q, privileged, uid);
    return q.range(from, to);
  });
}

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

async function fetchPortfolioFilhosPorOrigem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  origemCardIds: string[],
): Promise<{ rows: PainelStepOnePortfolioFilhoDTO[]; available: boolean }> {
  const out: PainelStepOnePortfolioFilhoDTO[] = [];
  if (origemCardIds.length === 0) return { rows: out, available: true };

  let hadError = false;
  for (const part of chunk(origemCardIds, 120)) {
    if (part.length === 0) continue;
    const { data, error } = await supabase
      .from('kanban_cards')
      .select('id, origem_card_id')
      .eq('kanban_id', KANBAN_IDS.PORTFOLIO)
      .in('origem_card_id', part);
    if (error) {
      hadError = true;
      continue;
    }
    for (const r of data ?? []) {
      const row = r as { id: string; origem_card_id: string | null };
      const origem = String(row.origem_card_id ?? '').trim();
      if (!origem) continue;
      out.push({ origem_card_id: origem, portfolio_card_id: String(row.id) });
    }
  }
  return { rows: out, available: !hadError };
}

async function fetchOperacoesIrmaosPorProjeto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projetoIds: string[],
): Promise<{ rows: PainelCreditoObraOperacoesIrmaoDTO[]; available: boolean }> {
  const out: PainelCreditoObraOperacoesIrmaoDTO[] = [];
  const uniq = [...new Set(projetoIds.map((id) => id.trim()).filter(Boolean))];
  if (uniq.length === 0) return { rows: out, available: true };

  let hadError = false;
  for (const part of chunk(uniq, 120)) {
    if (part.length === 0) continue;
    const { data, error } = await supabase
      .from('kanban_cards')
      .select('id, projeto_id, fase_id, entered_fase_at, created_at, arquivado, concluido')
      .eq('kanban_id', KANBAN_IDS.OPERACOES)
      .in('projeto_id', part);
    if (error) {
      hadError = true;
      continue;
    }
    for (const r of data ?? []) {
      const row = r as {
        id: string;
        projeto_id: string | null;
        fase_id: string;
        entered_fase_at: string | null;
        created_at: string;
        arquivado: boolean | null;
        concluido: boolean | null;
      };
      const pid = String(row.projeto_id ?? '').trim();
      if (!pid) continue;
      out.push({
        projeto_id: pid,
        card_id: String(row.id),
        fase_id: row.fase_id,
        entered_fase_at: row.entered_fase_at != null ? String(row.entered_fase_at) : null,
        created_at: row.created_at,
        arquivado: !!row.arquivado,
        concluido: !!row.concluido,
      });
    }
  }
  return { rows: out, available: !hadError };
}

async function fetchOperacoesFases(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PainelFaseDTO[]> {
  const { data, error } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias, fase_conversao, slug')
    .eq('kanban_id', KANBAN_IDS.OPERACOES)
    .order('ordem');
  if (error) return [];
  return (data ?? []).map((f) => {
    const row = f as {
      id: string;
      nome: string;
      ordem: number;
      sla_dias: number | null;
      fase_conversao: boolean | null;
      slug: string | null;
    };
    return {
      id: row.id,
      nome: row.nome,
      ordem: row.ordem,
      sla_dias: row.sla_dias,
      fase_conversao: Boolean(row.fase_conversao),
      slug: row.slug ?? null,
    };
  });
}

async function fetchCreditoObraIrmaosPorProjeto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projetoIds: string[],
): Promise<{ rows: PainelCreditoObraOperacoesIrmaoDTO[]; available: boolean }> {
  const out: PainelCreditoObraOperacoesIrmaoDTO[] = [];
  const uniq = [...new Set(projetoIds.map((id) => id.trim()).filter(Boolean))];
  if (uniq.length === 0) return { rows: out, available: true };

  let hadError = false;
  for (const part of chunk(uniq, 120)) {
    if (part.length === 0) continue;
    const { data, error } = await supabase
      .from('kanban_cards')
      .select('id, projeto_id, fase_id, entered_fase_at, created_at, arquivado, concluido')
      .eq('kanban_id', KANBAN_IDS.CREDITO_OBRA)
      .in('projeto_id', part);
    if (error) {
      hadError = true;
      continue;
    }
    for (const r of data ?? []) {
      const row = r as {
        id: string;
        projeto_id: string | null;
        fase_id: string;
        entered_fase_at: string | null;
        created_at: string;
        arquivado: boolean | null;
        concluido: boolean | null;
      };
      const pid = String(row.projeto_id ?? '').trim();
      if (!pid) continue;
      out.push({
        projeto_id: pid,
        card_id: String(row.id),
        fase_id: row.fase_id,
        entered_fase_at: row.entered_fase_at != null ? String(row.entered_fase_at) : null,
        created_at: row.created_at,
        arquivado: !!row.arquivado,
        concluido: !!row.concluido,
      });
    }
  }
  return { rows: out, available: !hadError };
}

async function fetchCreditoObraFases(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PainelFaseDTO[]> {
  const { data, error } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias, fase_conversao, slug')
    .eq('kanban_id', KANBAN_IDS.CREDITO_OBRA)
    .order('ordem');
  if (error) return [];
  return (data ?? []).map((f) => {
    const row = f as {
      id: string;
      nome: string;
      ordem: number;
      sla_dias: number | null;
      fase_conversao: boolean | null;
      slug: string | null;
    };
    return {
      id: row.id,
      nome: row.nome,
      ordem: row.ordem,
      sla_dias: row.sla_dias,
      fase_conversao: Boolean(row.fase_conversao),
      slug: row.slug ?? null,
    };
  });
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
  let carometroFieldsAvailable = false;
  let stepOneFieldsAvailable = false;
  let operacoesFieldsAvailable = false;
  let loteadoresFieldsAvailable = false;
  let creditoObraFieldsAvailable = false;
  let contabilidadeFieldsAvailable = false;
  let portfolioFilhosOrigem: PainelStepOnePortfolioFilhoDTO[] = [];
  let portfolioFilhosAvailable = true;
  let operacoesIrmaosPorProjeto: PainelCreditoObraOperacoesIrmaoDTO[] = [];
  let operacoesIrmaosAvailable = true;
  let operacoesFases: PainelFaseDTO[] = [];
  let creditoObraIrmaosPorProjeto: PainelCreditoObraOperacoesIrmaoDTO[] = [];
  let creditoObraIrmaosAvailable = true;
  let creditoObraFases: PainelFaseDTO[] = [];

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
    const isStepOne = kanbanId === KANBAN_IDS.STEP_ONE;
    const isOperacoes = kanbanId === KANBAN_IDS.OPERACOES;
    const isLoteadores = kanbanId === KANBAN_IDS.LOTEADORES;
    const isCreditoObra = kanbanId === KANBAN_IDS.CREDITO_OBRA;
    const isContabilidade = kanbanId === KANBAN_IDS.CONTABILIDADE;

    if (isStepOne) {
      const stepOneProbe = await supabase
        .from('kanban_cards')
        .select(CARD_SELECT_STEPONE)
        .eq('kanban_id', kanbanId)
        .limit(1);
      stepOneFieldsAvailable = !stepOneProbe.error;
    }

    if (isOperacoes) {
      const operacoesProbe = await supabase
        .from('kanban_cards')
        .select(CARD_SELECT_OPERACOES)
        .eq('kanban_id', kanbanId)
        .limit(1);
      operacoesFieldsAvailable = !operacoesProbe.error;
    }

    if (isLoteadores) {
      const loteadoresProbe = await supabase
        .from('kanban_cards')
        .select(CARD_SELECT_LOTEADORES)
        .eq('kanban_id', kanbanId)
        .limit(1);
      loteadoresFieldsAvailable = !loteadoresProbe.error;
    }

    if (isCreditoObra) {
      const creditoObraProbe = await supabase
        .from('kanban_cards')
        .select(CARD_SELECT_CREDITO_OBRA)
        .eq('kanban_id', kanbanId)
        .limit(1);
      creditoObraFieldsAvailable = !creditoObraProbe.error;
    }

    if (isContabilidade) {
      const contabilidadeProbe = await supabase
        .from('kanban_cards')
        .select(CARD_SELECT_CREDITO_OBRA)
        .eq('kanban_id', kanbanId)
        .limit(1);
      contabilidadeFieldsAvailable = !contabilidadeProbe.error;
    }

    const carometroProbe = await supabase
      .from('kanban_cards')
      .select(CARD_SELECT_CAROMETRO)
      .eq('kanban_id', kanbanId)
      .limit(1);
    carometroFieldsAvailable = !carometroProbe.error;

    const cardsRows = await fetchKanbanCardsPainel(
      supabase,
      kanbanId,
      privileged,
      uid,
      carometroFieldsAvailable &&
        !isStepOne &&
        !isOperacoes &&
        !isLoteadores &&
        !isCreditoObra &&
        !isContabilidade,
      isStepOne && stepOneFieldsAvailable,
      isOperacoes && operacoesFieldsAvailable,
      isLoteadores && loteadoresFieldsAvailable,
      isCreditoObra && creditoObraFieldsAvailable,
      isContabilidade && contabilidadeFieldsAvailable,
    );
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
  const projetoIdsCredito = cardsDto
    .map((c) => c.projeto_id?.trim())
    .filter((id): id is string => Boolean(id));

  const [chamados, retrocessoRows, historicoMovimentos, portfolioFilhosResult, operacoesIrmaosResult, operacoesFasesResult, creditoObraIrmaosResult, creditoObraFasesResult] =
    await Promise.all([
      fetchPainelChamados(supabase, idList, origem),
      fetchRetrocessos(supabase, idList),
      origem === 'nativo' ? fetchHistoricoMovimentos(supabase, idList) : Promise.resolve([]),
      origem === 'nativo' && kanbanId === KANBAN_IDS.STEP_ONE
        ? fetchPortfolioFilhosPorOrigem(supabase, idList)
        : Promise.resolve({ rows: [] as PainelStepOnePortfolioFilhoDTO[], available: true }),
      origem === 'nativo' && kanbanId === KANBAN_IDS.CREDITO_OBRA
        ? fetchOperacoesIrmaosPorProjeto(supabase, projetoIdsCredito)
        : Promise.resolve({ rows: [] as PainelCreditoObraOperacoesIrmaoDTO[], available: true }),
      origem === 'nativo' && kanbanId === KANBAN_IDS.CREDITO_OBRA
        ? fetchOperacoesFases(supabase)
        : Promise.resolve([] as PainelFaseDTO[]),
      origem === 'nativo' && kanbanId === KANBAN_IDS.CONTABILIDADE
        ? fetchCreditoObraIrmaosPorProjeto(supabase, projetoIdsCredito)
        : Promise.resolve({ rows: [] as PainelCreditoObraOperacoesIrmaoDTO[], available: true }),
      origem === 'nativo' && kanbanId === KANBAN_IDS.CONTABILIDADE
        ? fetchCreditoObraFases(supabase)
        : Promise.resolve([] as PainelFaseDTO[]),
    ]);
  portfolioFilhosOrigem = portfolioFilhosResult.rows;
  portfolioFilhosAvailable = portfolioFilhosResult.available;
  operacoesIrmaosPorProjeto = operacoesIrmaosResult.rows;
  operacoesIrmaosAvailable = operacoesIrmaosResult.available;
  operacoesFases = operacoesFasesResult;
  creditoObraIrmaosPorProjeto = creditoObraIrmaosResult.rows;
  creditoObraIrmaosAvailable = creditoObraIrmaosResult.available;
  creditoObraFases = creditoObraFasesResult;

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
    carometroFieldsAvailable: origemCards === 'legado' ? false : carometroFieldsAvailable,
    stepOneFieldsAvailable: origemCards === 'legado' ? false : stepOneFieldsAvailable,
    portfolioFilhosOrigem,
    portfolioFilhosAvailable,
    operacoesFieldsAvailable: origemCards === 'legado' ? false : operacoesFieldsAvailable,
    loteadoresFieldsAvailable: origemCards === 'legado' ? false : loteadoresFieldsAvailable,
    creditoObraFieldsAvailable: origemCards === 'legado' ? false : creditoObraFieldsAvailable,
    operacoesIrmaosPorProjeto,
    operacoesFases,
    operacoesIrmaosAvailable,
    contabilidadeFieldsAvailable: origemCards === 'legado' ? false : contabilidadeFieldsAvailable,
    creditoObraIrmaosPorProjeto,
    creditoObraFases,
    creditoObraIrmaosAvailable,
  };

  return <PainelPerformanceDashboard dataset={dataset} />;
}
