'use server';

import { createAdminClient } from '@/lib/supabase/admin';

// ─── Feriados nacionais brasileiros (recorrentes por MM-DD) ──────────────────
const FERIADOS_NACIONAIS_MMDD = new Set([
  '01-01', // Ano Novo
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // N. Sra. Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Consciência Negra
  '12-25', // Natal
]);

const FERIADOS_MOVEIS: Record<number, string[]> = {
  2025: ['2025-03-04', '2025-03-05', '2025-04-18', '2025-06-19'],
  2026: ['2026-02-17', '2026-02-18', '2026-04-03', '2026-06-04'],
  2027: ['2027-02-09', '2027-02-10', '2027-03-26', '2027-05-27'],
};

function isFeriado(d: Date): boolean {
  const mmdd = d.toISOString().slice(5, 10);
  if (FERIADOS_NACIONAIS_MMDD.has(mmdd)) return true;
  const iso = d.toISOString().slice(0, 10);
  const year = d.getFullYear();
  return (FERIADOS_MOVEIS[year] ?? []).includes(iso);
}

function isDiaUtil(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !isFeriado(d);
}

/** Horas úteis entre duas datas */
function horasUteis(inicio: Date, fim: Date): number {
  if (fim <= inicio) return 0;
  let horas = 0;
  const cur = new Date(inicio);
  while (cur < fim) {
    if (isDiaUtil(cur)) horas++;
    cur.setHours(cur.getHours() + 1);
  }
  return horas;
}

function diasUteisDe(inicio: Date, fim: Date): number {
  let count = 0;
  const d = new Date(inicio);
  d.setHours(0, 0, 0, 0);
  const end = new Date(fim);
  end.setHours(0, 0, 0, 0);
  while (d < end) {
    if (isDiaUtil(d)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Tipos exportados ────────────────────────────────────────────────────────

export type ChamadoSemAceiteRow = {
  topico_id: number;
  chamado_id: number;
  numero: number;
  titulo: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  topico_criado_em: string;
  dias_aguardando: number;
  arquivado: boolean;
};

export type GraficoDiaRow = {
  data: string;
  abertos: number;
  concluidos: number;
  acumulado: number;
};

export type SlaTopicoDiaRow = {
  data: string;
  dentro: number;
  fora: number;
  pct: number;
};

export type SlaResponsavelRow = {
  responsavel_id: string;
  nome: string;
  total: number;
  dentro: number;
  fora: number;
  pendente: number;
  media_horas: number | null;
};

export type AreaRow = {
  time: string;
  total: number;
  dentro: number;
  fora: number;
  pendente: number;
  media_horas: number | null;
  sla_pct: number | null;
};

export type FunilRow = {
  funil_id: string;
  funil_nome: string;
  total: number;
  abertos: number;
  concluidos: number;
};

export type EtapaRow = {
  etapa_nome: string;
  funil_nome: string;
  total: number;
  abertos: number;
};

export type GraficosData = {
  semAceite: ChamadoSemAceiteRow[];
  porDia: GraficoDiaRow[];
  slaPorDia: SlaTopicoDiaRow[];
  slaResponsaveis: SlaResponsavelRow[];
  porArea: AreaRow[];
  porFunil: FunilRow[];
  topEtapas: EtapaRow[];
  totalAberto: number;
  abriosHoje: number;
  concluidosHoje: number;
  mediaAceiteHoras: number | null;
  mesesDisponiveis: string[];
  melhorMesInicial: string;
};

// ─── Tipos de drill-down ──────────────────────────────────────────────────────

export type DrilldownFiltro =
  | { tipo: 'total_aberto' }
  | { tipo: 'sem_aceite' }
  | { tipo: 'abertos_dia'; data: string }
  | { tipo: 'concluidos_dia'; data: string }
  | { tipo: 'responsavel'; responsavel_id: string; nome: string }
  | { tipo: 'funil'; funil_id: string; funil_nome: string }
  | { tipo: 'area'; time: string };

export type DetalheChamadoRow = {
  id: number;
  numero: number;
  titulo: string | null;
  status: string;
  criado_em: string;
  aberto_por_nome: string | null;
  responsavel_nome: string | null;
  dias_uteis: number;
  data_conclusao: string | null;
};

export type DetalheTopicoRow = {
  topico_id: number;
  chamado_id: number;
  chamado_numero: number;
  chamado_titulo: string | null;
  atribuicao_status: string | null;
  responsavel_nome: string | null;
  criado_em: string;
  dias_espera_uteis: number;
};

export type DrilldownData =
  | { tipo: 'chamados'; titulo: string; rows: DetalheChamadoRow[] }
  | { tipo: 'topicos'; titulo: string; rows: DetalheTopicoRow[] };

// ─── Action de drill-down ─────────────────────────────────────────────────────

export async function buscarDetalheChamados(
  filtro: DrilldownFiltro,
): Promise<{ ok: true; data: DrilldownData } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const now = new Date();

    // ── Helpers internos ──────────────────────────────────────────────────────
    async function resolveNomesChamados(
      ids: number[],
    ): Promise<Map<number, { aberto_por_nome: string | null; responsavel_nome: string | null }>> {
      const map = new Map<number, { aberto_por_nome: string | null; responsavel_nome: string | null }>();
      if (ids.length === 0) return map;

      const { data: chamados } = await admin
        .from('sirene_chamados')
        .select('id, aberto_por')
        .in('id', ids);

      const abrirIds = [...new Set((chamados ?? []).map((c) => (c as { aberto_por?: string | null }).aberto_por).filter((x): x is string => x != null))];
      const nomeById = new Map<string, string>();
      if (abrirIds.length > 0) {
        const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', abrirIds);
        for (const p of profs ?? []) {
          const pr = p as { id: string; full_name?: string | null };
          if (pr.full_name) nomeById.set(pr.id, pr.full_name);
        }
      }
      for (const c of chamados ?? []) {
        const cr = c as { id: number; aberto_por?: string | null };
        map.set(cr.id, {
          aberto_por_nome: cr.aberto_por ? (nomeById.get(cr.aberto_por) ?? null) : null,
          responsavel_nome: null,
        });
      }
      return map;
    }

    function chamadoParaRow(
      c: { id: number; numero: number; incendio?: string | null; tema?: string | null; status: string; created_at: string; data_conclusao?: string | null },
      extras: { aberto_por_nome: string | null; responsavel_nome: string | null },
    ): DetalheChamadoRow {
      return {
        id: c.id,
        numero: c.numero,
        titulo: c.incendio?.trim() || c.tema?.trim() || null,
        status: c.status,
        criado_em: c.created_at,
        aberto_por_nome: extras.aberto_por_nome,
        responsavel_nome: extras.responsavel_nome,
        dias_uteis: diasUteisDe(new Date(c.created_at), now),
        data_conclusao: c.data_conclusao ?? null,
      };
    }

    // ── Filtros ───────────────────────────────────────────────────────────────

    if (filtro.tipo === 'total_aberto') {
      const { data: rows, error } = await admin
        .from('sirene_chamados')
        .select('id, numero, incendio, tema, status, created_at, data_conclusao, aberto_por')
        .neq('status', 'concluido')
        .eq('arquivado', false)
        .not('aberto_por', 'is', null)  // exclui legados
        .order('created_at', { ascending: false });
      if (error) return { ok: false, error: error.message };

      const chamados = rows ?? [];
      const ids = chamados.map((c) => (c as { id: number }).id);
      const extras = await resolveNomesChamados(ids);

      return {
        ok: true,
        data: {
          tipo: 'chamados',
          titulo: `${chamados.length} chamados em aberto`,
          rows: chamados.map((c) => chamadoParaRow(c as Parameters<typeof chamadoParaRow>[0], extras.get((c as { id: number }).id) ?? { aberto_por_nome: null, responsavel_nome: null })),
        },
      };
    }

    if (filtro.tipo === 'sem_aceite') {
      // Tópicos com atribuicao_status = pendente_aceite (chamados não arquivados e não concluídos)
      const { data: topicos, error } = await admin
        .from('sirene_topicos')
        .select('id, chamado_id, atribuicao_status, responsavel_nome, responsavel_id, created_at')
        .eq('atribuicao_status', 'pendente_aceite')
        .eq('arquivado', false)
        .order('created_at', { ascending: true });
      if (error) return { ok: false, error: error.message };

      const chamadoIds = [...new Set((topicos ?? []).map((t) => (t as { chamado_id: number }).chamado_id))];
      const chamadoInfoById2 = new Map<number, { numero: number; titulo: string | null }>();
      if (chamadoIds.length > 0) {
        const { data: chams } = await admin
          .from('sirene_chamados')
          .select('id, numero, incendio, tema, arquivado, status')
          .in('id', chamadoIds)
          .eq('arquivado', false)
          .neq('status', 'concluido');
        for (const c of chams ?? []) {
          const cr = c as { id: number; numero: number; incendio?: string | null; tema?: string | null };
          chamadoInfoById2.set(cr.id, { numero: cr.numero, titulo: cr.incendio?.trim() || cr.tema?.trim() || null });
        }
      }

      // Resolve nomes dos responsáveis
      const drRespIds = [...new Set((topicos ?? []).map((t) => (t as { responsavel_id?: string | null }).responsavel_id).filter((x): x is string => x != null))];
      const drRespNomes = new Map<string, string>();
      if (drRespIds.length > 0) {
        const { data: profs } = await admin.from('profiles').select('id, nome_completo').in('id', drRespIds);
        for (const p of profs ?? []) {
          const pr = p as { id: string; nome_completo?: string | null };
          if (pr.nome_completo) drRespNomes.set(pr.id, pr.nome_completo);
        }
      }

      const rows: DetalheTopicoRow[] = (topicos ?? [])
        .filter((t) => chamadoInfoById2.has((t as { chamado_id: number }).chamado_id))
        .map((t) => {
          const tr = t as { id: number; chamado_id: number; atribuicao_status: string; responsavel_nome?: string | null; responsavel_id?: string | null; created_at: string };
          const chamInfo = chamadoInfoById2.get(tr.chamado_id);
          return {
            topico_id: tr.id,
            chamado_id: tr.chamado_id,
            chamado_numero: chamInfo?.numero ?? 0,
            chamado_titulo: chamInfo?.titulo ?? null,
            atribuicao_status: tr.atribuicao_status,
            responsavel_nome: tr.responsavel_id
              ? (drRespNomes.get(tr.responsavel_id) ?? tr.responsavel_nome ?? null)
              : (tr.responsavel_nome ?? null),
            criado_em: tr.created_at,
            dias_espera_uteis: diasUteisDe(new Date(tr.created_at), now),
          };
        });

      return {
        ok: true,
        data: {
          tipo: 'topicos',
          titulo: `${rows.length} tópico${rows.length !== 1 ? 's' : ''} aguardando aceite`,
          rows,
        },
      };
    }

    if (filtro.tipo === 'abertos_dia') {
      const { data: rows, error } = await admin
        .from('sirene_chamados')
        .select('id, numero, incendio, tema, status, created_at, data_conclusao, aberto_por')
        .gte('created_at', `${filtro.data}T00:00:00.000Z`)
        .lte('created_at', `${filtro.data}T23:59:59.999Z`)
        .order('created_at', { ascending: true });
      if (error) return { ok: false, error: error.message };

      const chamados = rows ?? [];
      const ids = chamados.map((c) => (c as { id: number }).id);
      const extras = await resolveNomesChamados(ids);
      const [, m, d] = filtro.data.split('-');

      return {
        ok: true,
        data: {
          tipo: 'chamados',
          titulo: `${chamados.length} chamados abertos em ${d}/${m}`,
          rows: chamados.map((c) => chamadoParaRow(c as Parameters<typeof chamadoParaRow>[0], extras.get((c as { id: number }).id) ?? { aberto_por_nome: null, responsavel_nome: null })),
        },
      };
    }

    if (filtro.tipo === 'concluidos_dia') {
      const { data: rows, error } = await admin
        .from('sirene_chamados')
        .select('id, numero, incendio, tema, status, created_at, data_conclusao, aberto_por')
        .eq('status', 'concluido')
        .gte('data_conclusao', `${filtro.data}T00:00:00.000Z`)
        .lte('data_conclusao', `${filtro.data}T23:59:59.999Z`)
        .order('created_at', { ascending: true });
      if (error) return { ok: false, error: error.message };

      const chamados = rows ?? [];
      const ids = chamados.map((c) => (c as { id: number }).id);
      const extras = await resolveNomesChamados(ids);
      const [, m, d] = filtro.data.split('-');

      return {
        ok: true,
        data: {
          tipo: 'chamados',
          titulo: `${chamados.length} chamados concluídos em ${d}/${m}`,
          rows: chamados.map((c) => chamadoParaRow(c as Parameters<typeof chamadoParaRow>[0], extras.get((c as { id: number }).id) ?? { aberto_por_nome: null, responsavel_nome: null })),
        },
      };
    }

    if (filtro.tipo === 'responsavel') {
      // Busca tópicos do responsável com o chamado vinculado
      const { data: topicos, error } = await admin
        .from('sirene_topicos')
        .select('id, chamado_id, atribuicao_status, responsavel_nome, created_at')
        .eq('responsavel_id', filtro.responsavel_id)
        .eq('arquivado', false)
        .order('created_at', { ascending: false });
      if (error) return { ok: false, error: error.message };

      const chamadoIds = [...new Set((topicos ?? []).map((t) => (t as { chamado_id: number }).chamado_id).filter(Boolean))];
      const chamadoInfoById = new Map<number, { numero: number; titulo: string | null }>();
      if (chamadoIds.length > 0) {
        const { data: chams } = await admin
          .from('sirene_chamados')
          .select('id, numero, incendio, tema')
          .in('id', chamadoIds);
        for (const c of chams ?? []) {
          const cr = c as { id: number; numero: number; incendio?: string | null; tema?: string | null };
          chamadoInfoById.set(cr.id, { numero: cr.numero, titulo: cr.incendio?.trim() || cr.tema?.trim() || null });
        }
      }

      const rows: DetalheTopicoRow[] = (topicos ?? []).map((t) => {
        const tr = t as { id: number; chamado_id: number; atribuicao_status?: string | null; responsavel_nome?: string | null; created_at: string };
        const chamInfo = chamadoInfoById.get(tr.chamado_id);
        return {
          topico_id: tr.id,
          chamado_id: tr.chamado_id,
          chamado_numero: chamInfo?.numero ?? 0,
          chamado_titulo: chamInfo?.titulo ?? null,
          atribuicao_status: tr.atribuicao_status ?? null,
          responsavel_nome: tr.responsavel_nome ?? null,
          criado_em: tr.created_at,
          dias_espera_uteis: diasUteisDe(new Date(tr.created_at), now),
        };
      });

      return {
        ok: true,
        data: {
          tipo: 'topicos',
          titulo: `Tópicos de ${filtro.nome} (${rows.length})`,
          rows,
        },
      };
    }

    if (filtro.tipo === 'funil') {
      // Busca chamados vinculados ao funil via kanban_atividades
      const { data: atividades, error: e1 } = await admin
        .from('kanban_atividades')
        .select('sirene_chamado_id, card_id')
        .not('sirene_chamado_id', 'is', null)
        .not('card_id', 'is', null);
      if (e1) return { ok: false, error: e1.message };

      // Filtra cards do funil desejado
      const cardIds = [...new Set((atividades ?? []).map((a) => (a as { card_id: string }).card_id))];
      if (cardIds.length === 0) {
        return { ok: true, data: { tipo: 'chamados', titulo: 'Nenhum chamado vinculado', rows: [] } };
      }

      const { data: cards } = await admin
        .from('kanban_cards')
        .select('id, kanban_id')
        .in('id', cardIds)
        .eq('kanban_id', filtro.funil_id);

      const cardsDoFunil = new Set((cards ?? []).map((c) => (c as { id: string }).id));
      const chamadoIds = [...new Set(
        (atividades ?? [])
          .filter((a) => cardsDoFunil.has((a as { card_id: string }).card_id))
          .map((a) => (a as { sirene_chamado_id: number }).sirene_chamado_id),
      )];

      if (chamadoIds.length === 0) {
        return { ok: true, data: { tipo: 'chamados', titulo: 'Nenhum chamado vinculado', rows: [] } };
      }

      const BATCH = 400;
      const allChamados: Parameters<typeof chamadoParaRow>[0][] = [];
      for (let i = 0; i < chamadoIds.length; i += BATCH) {
        const { data: batch } = await admin
          .from('sirene_chamados')
          .select('id, numero, incendio, tema, status, created_at, data_conclusao, aberto_por')
          .in('id', chamadoIds.slice(i, i + BATCH));
        for (const c of batch ?? []) allChamados.push(c as Parameters<typeof chamadoParaRow>[0]);
      }

      const ids = allChamados.map((c) => c.id);
      const extras = await resolveNomesChamados(ids);

      return {
        ok: true,
        data: {
          tipo: 'chamados',
          titulo: `${allChamados.length} chamados — ${filtro.funil_nome}`,
          rows: allChamados
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((c) => chamadoParaRow(c, extras.get(c.id) ?? { aberto_por_nome: null, responsavel_nome: null })),
        },
      };
    }

    if (filtro.tipo === 'area') {
      // Busca tópicos da área via time_responsavel (campo texto no tópico)
      const { data: topicos, error } = await admin
        .from('sirene_topicos')
        .select('id, chamado_id, atribuicao_status, responsavel_nome, created_at')
        .eq('time_responsavel', filtro.time)
        .eq('arquivado', false)
        .order('created_at', { ascending: false });
      if (error) return { ok: false, error: error.message };

      const chamadoIds = [...new Set((topicos ?? []).map((t) => (t as { chamado_id: number }).chamado_id).filter(Boolean))];
      const chamadoInfoById = new Map<number, { numero: number; titulo: string | null }>();
      if (chamadoIds.length > 0) {
        const { data: chams } = await admin
          .from('sirene_chamados')
          .select('id, numero, incendio, tema')
          .in('id', chamadoIds);
        for (const c of chams ?? []) {
          const cr = c as { id: number; numero: number; incendio?: string | null; tema?: string | null };
          chamadoInfoById.set(cr.id, { numero: cr.numero, titulo: cr.incendio?.trim() || cr.tema?.trim() || null });
        }
      }

      const rows: DetalheTopicoRow[] = (topicos ?? []).map((t) => {
        const tr = t as { id: number; chamado_id: number; atribuicao_status?: string | null; responsavel_nome?: string | null; created_at: string };
        const chamInfo = chamadoInfoById.get(tr.chamado_id);
        return {
          topico_id: tr.id,
          chamado_id: tr.chamado_id,
          chamado_numero: chamInfo?.numero ?? 0,
          chamado_titulo: chamInfo?.titulo ?? null,
          atribuicao_status: tr.atribuicao_status ?? null,
          responsavel_nome: tr.responsavel_nome ?? null,
          criado_em: tr.created_at,
          dias_espera_uteis: diasUteisDe(new Date(tr.created_at), now),
        };
      });

      return {
        ok: true,
        data: {
          tipo: 'topicos',
          titulo: `Tópicos da área: ${filtro.time} (${rows.length})`,
          rows,
        },
      };
    }

    return { ok: false, error: 'Filtro desconhecido' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Action principal ─────────────────────────────────────────────────────────

export async function buscarDadosGraficos(mes?: string): Promise<
  { ok: true; data: GraficosData } | { ok: false; error: string }
> {
  try {
    const admin = createAdminClient();
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);

    // ── 8. Meses disponíveis (calcular antes para determinar melhor mês inicial)
    const { data: primeiroRow } = await admin
      .from('sirene_chamados')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    const mesesDisponiveis: string[] = [];
    if (primeiroRow) {
      const primeiro = new Date((primeiroRow as { created_at: string }).created_at);
      const cur = new Date(primeiro.getFullYear(), primeiro.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      while (cur <= fim) {
        mesesDisponiveis.push(cur.toISOString().slice(0, 7));
        cur.setMonth(cur.getMonth() + 1);
      }
    }

    // Determina o melhor mês inicial: o último mês que tem pelo menos 1 chamado aberto
    // (evita mostrar o mês atual vazio quando nenhum chamado foi aberto ainda)
    let melhorMesInicial = mesesDisponiveis.at(-1) ?? hoje.toISOString().slice(0, 7);
    if (mesesDisponiveis.length > 1) {
      const mesAtualStr = hoje.toISOString().slice(0, 7);
      // Conta chamados abertos no mês atual
      const inicioMesAtual = new Date(`${mesAtualStr}-01T00:00:00.000Z`);
      const { count: abertosNoMesAtual } = await admin
        .from('sirene_chamados')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', inicioMesAtual.toISOString())
        .lte('created_at', hoje.toISOString());
      if ((abertosNoMesAtual ?? 0) === 0 && mesesDisponiveis.length >= 2) {
        melhorMesInicial = mesesDisponiveis[mesesDisponiveis.length - 2];
      }
    }

    const mesAtual = mes ?? melhorMesInicial;
    const [anoStr, mesStr] = mesAtual.split('-');
    const ano = Number(anoStr);
    const mesNum = Number(mesStr) - 1;
    const inicioMes = new Date(ano, mesNum, 1, 0, 0, 0, 0);
    const fimMes = new Date(ano, mesNum + 1, 0, 23, 59, 59, 999);
    const fimMesEfetivo = fimMes < hoje ? fimMes : hoje;

    // ── 1. Tópicos aguardando aceite (atribuicao_status = pendente_aceite) ──────
    const { data: pendentesRows, error: e1 } = await admin
      .from('sirene_topicos')
      .select('id, created_at, arquivado, responsavel_id, responsavel_nome, chamado_id')
      .eq('atribuicao_status', 'pendente_aceite')
      .order('created_at', { ascending: true });
    if (e1) return { ok: false, error: e1.message };

    const now = new Date();

    // Buscar info dos chamados vinculados (para filtrar arquivados/concluídos)
    const pendChamadoIds = [...new Set((pendentesRows ?? []).map((r) => (r as { chamado_id: number }).chamado_id))];
    const pendChamadoInfo = new Map<number, { numero: number; titulo: string | null; arquivado: boolean; status: string }>();
    if (pendChamadoIds.length > 0) {
      const { data: pendChams } = await admin
        .from('sirene_chamados')
        .select('id, numero, incendio, tema, arquivado, status')
        .in('id', pendChamadoIds);
      for (const c of pendChams ?? []) {
        const cr = c as { id: number; numero: number; incendio?: string | null; tema?: string | null; arquivado?: boolean | null; status: string };
        pendChamadoInfo.set(cr.id, {
          numero: cr.numero,
          titulo: cr.incendio?.trim() || cr.tema?.trim() || null,
          arquivado: Boolean(cr.arquivado),
          status: cr.status,
        });
      }
    }

    // Buscar nomes dos responsáveis via profiles
    const pendRespIds = [...new Set((pendentesRows ?? []).map((r) => (r as { responsavel_id?: string | null }).responsavel_id).filter((x): x is string => x != null))];
    const pendNomeById = new Map<string, string>();
    if (pendRespIds.length > 0) {
      const { data: pendProfs } = await admin.from('profiles').select('id, nome_completo').in('id', pendRespIds);
      for (const p of pendProfs ?? []) {
        const pr = p as { id: string; nome_completo?: string | null };
        if (pr.nome_completo) pendNomeById.set(pr.id, pr.nome_completo);
      }
    }

    const semAceite: ChamadoSemAceiteRow[] = (pendentesRows ?? [])
      .filter((r) => {
        const chamInfo = pendChamadoInfo.get((r as { chamado_id: number }).chamado_id);
        // Exclui chamados arquivados ou já concluídos
        return chamInfo && !chamInfo.arquivado && chamInfo.status !== 'concluido';
      })
      .map((r) => {
        const tr = r as { id: number; created_at: string; arquivado?: boolean | null; responsavel_id?: string | null; responsavel_nome?: string | null; chamado_id: number };
        const chamInfo = pendChamadoInfo.get(tr.chamado_id)!;
        return {
          topico_id: tr.id,
          chamado_id: tr.chamado_id,
          numero: chamInfo.numero,
          titulo: chamInfo.titulo,
          responsavel_id: tr.responsavel_id ?? null,
          responsavel_nome: tr.responsavel_id
            ? (pendNomeById.get(tr.responsavel_id) ?? tr.responsavel_nome ?? null)
            : (tr.responsavel_nome ?? null),
          topico_criado_em: tr.created_at,
          dias_aguardando: diasUteisDe(new Date(tr.created_at), now),
          arquivado: Boolean(tr.arquivado),
        };
      });

    // ── 2. Chamados abertos/concluídos no mês ────────────────────────────────
    const { data: abertosRows, error: e2 } = await admin
      .from('sirene_chamados')
      .select('id, created_at, status, data_conclusao')
      .gte('created_at', inicioMes.toISOString())
      .lte('created_at', fimMesEfetivo.toISOString())
      .order('created_at', { ascending: true });
    if (e2) return { ok: false, error: e2.message };

    const { data: conclRows, error: e3 } = await admin
      .from('sirene_chamados')
      .select('id, data_conclusao')
      .eq('status', 'concluido')
      .gte('data_conclusao', inicioMes.toISOString())
      .lte('data_conclusao', fimMesEfetivo.toISOString());
    if (e3) return { ok: false, error: e3.message };

    const abertosPorDia = new Map<string, number>();
    const concluidosPorDia = new Map<string, number>();
    for (const r of abertosRows ?? []) {
      const d = isoDate(new Date((r as { created_at: string }).created_at));
      abertosPorDia.set(d, (abertosPorDia.get(d) ?? 0) + 1);
    }
    for (const r of conclRows ?? []) {
      const cr = r as { data_conclusao: string | null };
      if (!cr.data_conclusao) continue;
      const d = isoDate(new Date(cr.data_conclusao));
      concluidosPorDia.set(d, (concluidosPorDia.get(d) ?? 0) + 1);
    }

    const { count: acumuladoBase } = await admin
      .from('sirene_chamados')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'concluido')
      .eq('arquivado', false)
      .not('aberto_por', 'is', null)
      .lt('created_at', inicioMes.toISOString());

    let acumulado = acumuladoBase ?? 0;
    const porDia: GraficoDiaRow[] = [];
    for (let d = new Date(inicioMes); d <= fimMesEfetivo; d.setDate(d.getDate() + 1)) {
      const ds = isoDate(d);
      const abertos = abertosPorDia.get(ds) ?? 0;
      const concluidos = concluidosPorDia.get(ds) ?? 0;
      acumulado += abertos - concluidos;
      porDia.push({ data: ds, abertos, concluidos, acumulado: Math.max(0, acumulado) });
    }

    // ── 3. SLA de tópicos no mês ─────────────────────────────────────────────
    const { data: topicosRows, error: e4 } = await admin
      .from('sirene_topicos')
      .select('id, created_at, atribuicao_aceito_em, atribuicao_status, responsavel_id, arquivado')
      .gte('created_at', inicioMes.toISOString())
      .lte('created_at', fimMesEfetivo.toISOString())
      .eq('arquivado', false);
    if (e4) return { ok: false, error: e4.message };

    const slaDia = new Map<string, { dentro: number; fora: number }>();
    for (const r of topicosRows ?? []) {
      const tr = r as { id: number; created_at: string; atribuicao_aceito_em?: string | null; atribuicao_status?: string | null; responsavel_id?: string | null };
      const ds = isoDate(new Date(tr.created_at));
      const slot = slaDia.get(ds) ?? { dentro: 0, fora: 0 };
      if (tr.atribuicao_aceito_em) {
        // Tópico aceito com timestamp: calcula horas reais
        const h = horasUteis(new Date(tr.created_at), new Date(tr.atribuicao_aceito_em));
        if (h <= 24) slot.dentro++;
        else slot.fora++;
      } else if (tr.atribuicao_status === 'aceito') {
        // Aceito mas sem timestamp — conta como dentro do prazo
        slot.dentro++;
      } else if (tr.atribuicao_status === 'pendente_aceite') {
        const hEspera = horasUteis(new Date(tr.created_at), now);
        if (hEspera > 24) slot.fora++;
        // se < 24h: ainda dentro do prazo, não conta nem dentro nem fora (pendente legítimo)
      }
      slaDia.set(ds, slot);
    }

    const slaPorDia: SlaTopicoDiaRow[] = porDia.map((d) => {
      const s = slaDia.get(d.data) ?? { dentro: 0, fora: 0 };
      const total = s.dentro + s.fora;
      return {
        data: d.data,
        dentro: s.dentro,
        fora: s.fora,
        pct: total > 0 ? Math.round((s.dentro / total) * 100) : 100,
      };
    });

    // ── 4. SLA por responsável + área (todos os tópicos não arquivados) ───────
    const { data: todosTopicos, error: e5 } = await admin
      .from('sirene_topicos')
      .select('id, created_at, atribuicao_aceito_em, atribuicao_status, responsavel_id, time_responsavel')
      .eq('arquivado', false)
      .not('responsavel_id', 'is', null);
    if (e5) return { ok: false, error: e5.message };

    const respMap = new Map<string, { total: number; dentro: number; fora: number; pendente: number; horasAceitos: number[] }>();
    for (const r of todosTopicos ?? []) {
      const tr = r as { created_at: string; atribuicao_aceito_em?: string | null; atribuicao_status?: string | null; responsavel_id: string };
      const rid = tr.responsavel_id;
      const slot = respMap.get(rid) ?? { total: 0, dentro: 0, fora: 0, pendente: 0, horasAceitos: [] };
      slot.total++;
      if (tr.atribuicao_aceito_em) {
        // Aceite com timestamp — mede horas reais
        const h = horasUteis(new Date(tr.created_at), new Date(tr.atribuicao_aceito_em));
        slot.horasAceitos.push(h);
        if (h <= 24) slot.dentro++;
        else slot.fora++;
      } else if (tr.atribuicao_status === 'aceito') {
        // Aceito sem timestamp — conta como dentro do prazo (sem dado de hora)
        slot.dentro++;
      } else if (tr.atribuicao_status === 'pendente_aceite') {
        const hEspera = horasUteis(new Date(tr.created_at), now);
        if (hEspera > 24) slot.fora++;
        else slot.pendente++;
      } else {
        slot.pendente++;
      }
      respMap.set(rid, slot);
    }

    // Resolve nomes dos responsáveis
    const respIds = [...respMap.keys()];
    const respNomeById = new Map<string, string>();
    if (respIds.length > 0) {
      const { data: profs2 } = await admin
        .from('profiles')
        .select('id, full_name')
        .in('id', respIds);
      for (const p of profs2 ?? []) {
        const pr = p as { id: string; full_name?: string | null };
        respNomeById.set(pr.id, pr.full_name ?? pr.id.slice(0, 8));
      }
    }

    const slaResponsaveis: SlaResponsavelRow[] = [...respMap.entries()]
      .map(([rid, s]) => ({
        responsavel_id: rid,
        nome: respNomeById.get(rid) ?? rid.slice(0, 8),
        total: s.total,
        dentro: s.dentro,
        fora: s.fora,
        pendente: s.pendente,
        media_horas: s.horasAceitos.length > 0
          ? Math.round(s.horasAceitos.reduce((a, b) => a + b, 0) / s.horasAceitos.length)
          : null,
      }))
      .filter((r) => r.total >= 1)
      .sort((a, b) => b.total - a.total);

    // Média global de aceite (só de tópicos com timestamp real)
    const todasHoras = [...respMap.values()].flatMap((s) => s.horasAceitos);
    const mediaAceiteHoras = todasHoras.length > 0
      ? Math.round((todasHoras.reduce((a, b) => a + b, 0) / todasHoras.length) * 10) / 10
      : null;

    // ── 5. Por área — usa time_responsavel direto do tópico ───────────────────
    // Este campo já tem os dados reais (ex: "Caneta Verde", "Jurídico", "Produto")
    const areaMap = new Map<string, { total: number; dentro: number; fora: number; pendente: number; horasAceitos: number[] }>();
    for (const r of todosTopicos ?? []) {
      const tr = r as { created_at: string; atribuicao_aceito_em?: string | null; atribuicao_status?: string | null; responsavel_id: string; time_responsavel?: string | null };
      const time = tr.time_responsavel?.trim() || 'Sem área';
      const slot = areaMap.get(time) ?? { total: 0, dentro: 0, fora: 0, pendente: 0, horasAceitos: [] };
      slot.total++;
      if (tr.atribuicao_aceito_em) {
        const h = horasUteis(new Date(tr.created_at), new Date(tr.atribuicao_aceito_em));
        slot.horasAceitos.push(h);
        if (h <= 24) slot.dentro++;
        else slot.fora++;
      } else if (tr.atribuicao_status === 'aceito') {
        slot.dentro++;
      } else if (tr.atribuicao_status === 'pendente_aceite') {
        const hEspera = horasUteis(new Date(tr.created_at), now);
        if (hEspera > 24) slot.fora++;
        else slot.pendente++;
      } else {
        slot.pendente++;
      }
      areaMap.set(time, slot);
    }

    const porArea: AreaRow[] = [...areaMap.entries()]
      .map(([time, s]) => {
        const aceitos = s.dentro + s.fora;
        return {
          time,
          total: s.total,
          dentro: s.dentro,
          fora: s.fora,
          pendente: s.pendente,
          media_horas: s.horasAceitos.length > 0
            ? Math.round(s.horasAceitos.reduce((a, b) => a + b, 0) / s.horasAceitos.length)
            : null,
          sla_pct: aceitos > 0 ? Math.round((s.dentro / aceitos) * 100) : null,
        };
      })
      .filter((r) => r.total >= 1 && r.time !== 'Sem área')
      .sort((a, b) => b.total - a.total);

    // ── 6. Por funil e etapa (via kanban_atividades) ──────────────────────────
    const { data: atividadesChamados, error: e6 } = await admin
      .from('kanban_atividades')
      .select('sirene_chamado_id, card_id')
      .not('sirene_chamado_id', 'is', null)
      .not('card_id', 'is', null);
    if (e6) return { ok: false, error: e6.message };

    const porFunil: FunilRow[] = [];
    const topEtapas: EtapaRow[] = [];

    if ((atividadesChamados ?? []).length > 0) {
      const chamadoCardMap = new Map<number, Set<string>>();
      for (const r of atividadesChamados ?? []) {
        const ar = r as { sirene_chamado_id: number; card_id: string };
        if (!chamadoCardMap.has(ar.sirene_chamado_id)) {
          chamadoCardMap.set(ar.sirene_chamado_id, new Set());
        }
        chamadoCardMap.get(ar.sirene_chamado_id)!.add(ar.card_id);
      }

      const uniqueCardIds = [...new Set((atividadesChamados ?? []).map((r) => (r as { card_id: string }).card_id))];
      const BATCH = 400;
      const cardRows: { id: string; kanban_id: string; fase_id: string | null }[] = [];
      for (let i = 0; i < uniqueCardIds.length; i += BATCH) {
        const { data: batch } = await admin
          .from('kanban_cards')
          .select('id, kanban_id, fase_id')
          .in('id', uniqueCardIds.slice(i, i + BATCH));
        for (const c of batch ?? []) {
          cardRows.push(c as { id: string; kanban_id: string; fase_id: string | null });
        }
      }

      const cardInfoById = new Map(cardRows.map((c) => [c.id, c]));

      const kanbanIds = [...new Set(cardRows.map((c) => c.kanban_id).filter(Boolean))];
      const kanbanNomeById = new Map<string, string>();
      if (kanbanIds.length > 0) {
        const { data: kanbansData } = await admin
          .from('kanbans')
          .select('id, nome')
          .in('id', kanbanIds);
        for (const k of kanbansData ?? []) {
          const kr = k as { id: string; nome: string };
          kanbanNomeById.set(kr.id, kr.nome);
        }
      }

      const faseIds = [...new Set(cardRows.map((c) => c.fase_id).filter((f): f is string => f != null))];
      const faseNomeById = new Map<string, string>();
      if (faseIds.length > 0) {
        const { data: fasesData } = await admin
          .from('kanban_fases')
          .select('id, nome, kanban_id')
          .in('id', faseIds);
        for (const f of fasesData ?? []) {
          const fr = f as { id: string; nome: string; kanban_id: string };
          faseNomeById.set(fr.id, fr.nome);
        }
      }

      const allChamadoIds = [...chamadoCardMap.keys()];
      const chamadoStatusMap = new Map<number, string>();
      for (let i = 0; i < allChamadoIds.length; i += BATCH) {
        const { data: statusBatch } = await admin
          .from('sirene_chamados')
          .select('id, status')
          .in('id', allChamadoIds.slice(i, i + BATCH));
        for (const s of statusBatch ?? []) {
          const sr = s as { id: number; status: string };
          chamadoStatusMap.set(sr.id, sr.status);
        }
      }

      const funilMap = new Map<string, { nome: string; total: Set<number>; abertos: Set<number>; concluidos: Set<number> }>();
      const etapaMap = new Map<string, { etapa_nome: string; funil_nome: string; total: Set<number>; abertos: Set<number> }>();

      for (const [chamadoId, cardIds] of chamadoCardMap.entries()) {
        const status = chamadoStatusMap.get(chamadoId) ?? 'nao_iniciado';
        const isConcluido = status === 'concluido';

        for (const cardId of cardIds) {
          const card = cardInfoById.get(cardId);
          if (!card) continue;

          const kanbanId = card.kanban_id;
          const faseId = card.fase_id;
          const funilNome = kanbanNomeById.get(kanbanId) ?? 'Sem funil';

          if (!funilMap.has(kanbanId)) {
            funilMap.set(kanbanId, { nome: funilNome, total: new Set(), abertos: new Set(), concluidos: new Set() });
          }
          const fSlot = funilMap.get(kanbanId)!;
          fSlot.total.add(chamadoId);
          if (isConcluido) fSlot.concluidos.add(chamadoId);
          else fSlot.abertos.add(chamadoId);

          if (faseId) {
            const etapaNome = faseNomeById.get(faseId) ?? 'Fase desconhecida';
            const etapaKey = `${kanbanId}::${faseId}`;
            if (!etapaMap.has(etapaKey)) {
              etapaMap.set(etapaKey, { etapa_nome: etapaNome, funil_nome: funilNome, total: new Set(), abertos: new Set() });
            }
            const eSlot = etapaMap.get(etapaKey)!;
            eSlot.total.add(chamadoId);
            if (!isConcluido) eSlot.abertos.add(chamadoId);
          }
        }
      }

      porFunil.push(
        ...([...funilMap.entries()]
          .map(([id, s]) => ({
            funil_id: id,
            funil_nome: s.nome,
            total: s.total.size,
            abertos: s.abertos.size,
            concluidos: s.concluidos.size,
          }))
          .sort((a, b) => b.total - a.total))
      );

      topEtapas.push(
        ...([...etapaMap.values()]
          .map((s) => ({
            etapa_nome: s.etapa_nome,
            funil_nome: s.funil_nome,
            total: s.total.size,
            abertos: s.abertos.size,
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 12))
      );
    }

    // ── 7. KPIs de hoje ──────────────────────────────────────────────────────
    const hojeStr = isoDate(new Date());
    // Exclui legados (aberto_por IS NULL) do total em aberto
    const totalAberto = (await admin
      .from('sirene_chamados')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'concluido')
      .eq('arquivado', false)
      .not('aberto_por', 'is', null)).count ?? 0;

    const abriosHoje = abertosPorDia.get(hojeStr) ?? 0;
    const concluidosHoje = concluidosPorDia.get(hojeStr) ?? 0;

    return {
      ok: true,
      data: {
        semAceite,
        porDia,
        slaPorDia,
        slaResponsaveis,
        porArea,
        porFunil,
        topEtapas,
        totalAberto,
        abriosHoje,
        concluidosHoje,
        mediaAceiteHoras,
        mesesDisponiveis,
        melhorMesInicial,
      },
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
