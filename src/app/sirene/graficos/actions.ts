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

// Feriados móveis (Carnaval, Sexta-feira Santa, Corpus Christi) por ano
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
  const moveis = FERIADOS_MOVEIS[year] ?? [];
  return moveis.includes(iso);
}

function isDiaUtil(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !isFeriado(d);
}

/** Horas úteis entre duas datas (exclui fins de semana e feriados nacionais). */
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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Tipos exportados ────────────────────────────────────────────────────────

export type ChamadoSemAceiteRow = {
  id: number;
  numero: number;
  titulo: string | null;
  criado_em: string;
  dias_uteis: number;
  aberto_por_nome: string | null;
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
  dentro: number;   // aceitos em ≤ 24h úteis
  fora: number;     // aceitos em > 24h úteis ou ainda pendentes
  pct: number;      // % dentro (0–100)
};

export type SlaResponsavelRow = {
  responsavel_id: string;
  nome: string;
  total: number;
  dentro: number;
  fora: number;
  pendente: number;
  media_horas: number | null; // média de horas úteis dos aceitos
};

export type GraficosData = {
  semAceite: ChamadoSemAceiteRow[];
  porDia: GraficoDiaRow[];
  slaPorDia: SlaTopicoDiaRow[];
  slaResponsaveis: SlaResponsavelRow[];
  totalAberto: number;
  abriosHoje: number;
  concluidosHoje: number;
  // meses disponíveis para filtro (YYYY-MM)
  mesesDisponiveis: string[];
};

// ─── Action principal ─────────────────────────────────────────────────────────

export async function buscarDadosGraficos(mes?: string): Promise<
  { ok: true; data: GraficosData } | { ok: false; error: string }
> {
  try {
    const admin = createAdminClient();
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);

    // Mês selecionado (default = mês atual)
    const mesAtual = mes ?? hoje.toISOString().slice(0, 7);
    const [anoStr, mesStr] = mesAtual.split('-');
    const ano = Number(anoStr);
    const mesNum = Number(mesStr) - 1;
    const inicioMes = new Date(ano, mesNum, 1, 0, 0, 0, 0);
    const fimMes = new Date(ano, mesNum + 1, 0, 23, 59, 59, 999);
    const fimMesEfetivo = fimMes < hoje ? fimMes : hoje;

    // ── 1. Chamados sem aceite (nao_iniciado) ────────────────────────────────
    const { data: semAceiteRows, error: e1 } = await admin
      .from('sirene_chamados')
      .select('id, numero, incendio, tema, created_at, aberto_por, arquivado')
      .eq('status', 'nao_iniciado')
      .order('created_at', { ascending: true });
    if (e1) return { ok: false, error: e1.message };

    const now = new Date();

    // resolve nomes dos abridores
    const abrIds = [...new Set(
      (semAceiteRows ?? [])
        .map((r) => (r as { aberto_por?: string | null }).aberto_por)
        .filter((x): x is string => x != null),
    )];
    const nomeById = new Map<string, string>();
    if (abrIds.length > 0) {
      const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', abrIds);
      for (const p of profs ?? []) {
        const pr = p as { id: string; full_name?: string | null };
        if (pr.full_name) nomeById.set(pr.id, pr.full_name);
      }
    }

    // dias úteis de espera para cada chamado sem aceite
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

    const semAceite: ChamadoSemAceiteRow[] = (semAceiteRows ?? []).map((r) => {
      const cr = r as { id: number; numero: number; incendio?: string | null; tema?: string | null; created_at: string; aberto_por?: string | null; arquivado?: boolean | null };
      return {
        id: cr.id,
        numero: cr.numero,
        titulo: cr.incendio?.trim() || cr.tema?.trim() || null,
        criado_em: cr.created_at,
        dias_uteis: diasUteisDe(new Date(cr.created_at), now),
        aberto_por_nome: cr.aberto_por ? (nomeById.get(cr.aberto_por) ?? null) : null,
        arquivado: Boolean(cr.arquivado),
      };
    });

    // ── 2. Chamados abertos/concluídos no mês selecionado ────────────────────
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

    // acumulado antes do inicio do mês
    const { count: acumuladoBase } = await admin
      .from('sirene_chamados')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'concluido')
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

    // ── 3. SLA de aceite de tópicos (sirene_topicos) no mês ─────────────────
    const { data: topicosRows, error: e4 } = await admin
      .from('sirene_topicos')
      .select('id, created_at, atribuicao_aceito_em, atribuicao_status, responsavel_id, arquivado')
      .gte('created_at', inicioMes.toISOString())
      .lte('created_at', fimMesEfetivo.toISOString())
      .eq('arquivado', false);
    if (e4) return { ok: false, error: e4.message };

    // Mapa dia → { dentro, fora }
    const slaDia = new Map<string, { dentro: number; fora: number }>();
    for (const r of topicosRows ?? []) {
      const tr = r as { id: number; created_at: string; atribuicao_aceito_em?: string | null; atribuicao_status?: string | null; responsavel_id?: string | null };
      const ds = isoDate(new Date(tr.created_at));
      const slot = slaDia.get(ds) ?? { dentro: 0, fora: 0 };
      if (tr.atribuicao_aceito_em) {
        const h = horasUteis(new Date(tr.created_at), new Date(tr.atribuicao_aceito_em));
        if (h <= 24) slot.dentro++;
        else slot.fora++;
      } else if (tr.atribuicao_status === 'pendente_aceite') {
        // ainda sem aceite — conta como fora se já passou 24h úteis
        const hEspera = horasUteis(new Date(tr.created_at), now);
        if (hEspera > 24) slot.fora++;
        // se < 24h ainda dentro do prazo: não conta (pendente legítimo)
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

    // ── 4. SLA por responsável (todos os tópicos não arquivados) ─────────────
    const { data: todosTopicos, error: e5 } = await admin
      .from('sirene_topicos')
      .select('id, created_at, atribuicao_aceito_em, atribuicao_status, responsavel_id')
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
        const h = horasUteis(new Date(tr.created_at), new Date(tr.atribuicao_aceito_em));
        slot.horasAceitos.push(h);
        if (h <= 24) slot.dentro++;
        else slot.fora++;
      } else if (tr.atribuicao_status === 'pendente_aceite') {
        const hEspera = horasUteis(new Date(tr.created_at), now);
        if (hEspera > 24) slot.fora++;
        else slot.pendente++;
      } else {
        slot.pendente++;
      }
      respMap.set(rid, slot);
    }

    // resolve nomes dos responsáveis
    const respIds = [...respMap.keys()];
    const respNomeById = new Map<string, string>();
    if (respIds.length > 0) {
      const { data: profs2 } = await admin.from('profiles').select('id, full_name').in('id', respIds);
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

    // ── 5. KPIs de hoje ──────────────────────────────────────────────────────
    const hojeStr = isoDate(new Date());
    const totalAberto = (await admin
      .from('sirene_chamados')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'concluido')
      .eq('arquivado', false)).count ?? 0;

    const abriosHoje = abertosPorDia.get(hojeStr) ?? 0;
    const concluidosHoje = concluidosPorDia.get(hojeStr) ?? 0;

    // ── 6. Meses disponíveis ─────────────────────────────────────────────────
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

    return {
      ok: true,
      data: {
        semAceite,
        porDia,
        slaPorDia,
        slaResponsaveis,
        totalAberto,
        abriosHoje,
        concluidosHoje,
        mesesDisponiveis,
      },
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
