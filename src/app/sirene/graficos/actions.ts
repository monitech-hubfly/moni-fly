'use server';

import { createAdminClient } from '@/lib/supabase/admin';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Dias úteis (seg–sex) entre duas datas, excludindo fim (open interval). */
function diasUteisDe(inicio: Date, fim: Date): number {
  let count = 0;
  const d = new Date(inicio);
  d.setHours(0, 0, 0, 0);
  const end = new Date(fim);
  end.setHours(0, 0, 0, 0);
  while (d < end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diasAtras(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── tipos ──────────────────────────────────────────────────────────────────

export type ChamadoSemAceiteRow = {
  id: number;
  numero: number;
  titulo: string | null;
  criado_em: string;
  dias_uteis: number;
  aberto_por_nome: string | null;
};

export type GraficoDiaRow = {
  data: string; // YYYY-MM-DD
  abertos: number;
  concluidos: number;
  acumulado: number;
};

export type GraficosData = {
  semAceite: ChamadoSemAceiteRow[];
  porDia: GraficoDiaRow[];
  totalAberto: number;
  abriosHoje: number;
  concluidosHoje: number;
};

// ─── action principal ────────────────────────────────────────────────────────

export async function buscarDadosGraficos(): Promise<{ ok: true; data: GraficosData } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicioJanela = diasAtras(30);

    // 1. Chamados sem aceite (status = nao_iniciado) que não estão arquivados
    const { data: semAceiteRows, error: e1 } = await admin
      .from('sirene_chamados')
      .select('id, numero, incendio, tema, criado_em: created_at, aberto_por')
      .eq('status', 'nao_iniciado')
      .eq('arquivado', false)
      .order('created_at', { ascending: true });

    if (e1) return { ok: false, error: e1.message };

    const now = new Date();
    const semAceiteComDias = (semAceiteRows ?? [])
      .map((r) => {
        const cr = r as { id: number; numero: number; incendio?: string | null; tema?: string | null; criado_em: string; aberto_por?: string | null };
        const criado = new Date(cr.criado_em);
        const du = diasUteisDe(criado, now);
        return {
          id: cr.id,
          numero: cr.numero,
          titulo: cr.incendio?.trim() || cr.tema?.trim() || null,
          criado_em: cr.criado_em,
          dias_uteis: du,
          aberto_por: cr.aberto_por ?? null,
        };
      })
      .filter((r) => r.dias_uteis >= 1); // > 1 dia útil (ou seja, >= 1 completo)

    // 2. Resolve nomes dos abridor para semAceite
    const abrIds = [...new Set(semAceiteComDias.map((r) => r.aberto_por).filter((x): x is string => x != null))];
    const nomeById = new Map<string, string>();
    if (abrIds.length > 0) {
      const { data: profs } = await admin
        .from('profiles')
        .select('id, full_name')
        .in('id', abrIds);
      for (const p of profs ?? []) {
        const pr = p as { id: string; full_name?: string | null };
        if (pr.full_name) nomeById.set(pr.id, pr.full_name);
      }
    }

    const semAceite: ChamadoSemAceiteRow[] = semAceiteComDias.map((r) => ({
      id: r.id,
      numero: r.numero,
      titulo: r.titulo,
      criado_em: r.criado_em,
      dias_uteis: r.dias_uteis,
      aberto_por_nome: r.aberto_por ? (nomeById.get(r.aberto_por) ?? null) : null,
    }));

    // 3. Chamados abertos nos últimos 30 dias
    const { data: abertosRows, error: e2 } = await admin
      .from('sirene_chamados')
      .select('id, created_at, status, data_conclusao')
      .gte('created_at', inicioJanela.toISOString())
      .order('created_at', { ascending: true });

    if (e2) return { ok: false, error: e2.message };

    // Constrói mapa dia → contagens
    const abertosPorDia = new Map<string, number>();
    const concluidosPorDia = new Map<string, number>();

    for (const r of abertosRows ?? []) {
      const cr = r as { id: number; created_at: string; status: string; data_conclusao?: string | null };
      const dAberto = isoDate(new Date(cr.created_at));
      abertosPorDia.set(dAberto, (abertosPorDia.get(dAberto) ?? 0) + 1);
    }

    // 4. Chamados concluídos nos últimos 30 dias (por data_conclusao)
    const { data: conclRows, error: e3 } = await admin
      .from('sirene_chamados')
      .select('id, data_conclusao')
      .eq('status', 'concluido')
      .gte('data_conclusao', inicioJanela.toISOString())
      .order('data_conclusao', { ascending: true });

    if (e3) return { ok: false, error: e3.message };

    for (const r of conclRows ?? []) {
      const cr = r as { id: number; data_conclusao: string | null };
      if (!cr.data_conclusao) continue;
      const dConc = isoDate(new Date(cr.data_conclusao));
      concluidosPorDia.set(dConc, (concluidosPorDia.get(dConc) ?? 0) + 1);
    }

    // 5. Monta série de 30 dias com acumulado
    const porDia: GraficoDiaRow[] = [];
    // acumulado inicial = chamados em aberto antes de inicioJanela
    const { count: acumuladoBase } = await admin
      .from('sirene_chamados')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'concluido')
      .lt('created_at', inicioJanela.toISOString());

    let acumulado = acumuladoBase ?? 0;

    for (let i = 0; i <= 30; i++) {
      const d = new Date(inicioJanela);
      d.setDate(d.getDate() + i);
      if (d > now) break;
      const ds = isoDate(d);
      const abertos = abertosPorDia.get(ds) ?? 0;
      const concluidos = concluidosPorDia.get(ds) ?? 0;
      acumulado += abertos - concluidos;
      porDia.push({ data: ds, abertos, concluidos, acumulado: Math.max(0, acumulado) });
    }

    const hojeStr = isoDate(now);
    const totalAberto = semAceiteRows
      ? (await admin.from('sirene_chamados').select('id', { count: 'exact', head: true }).neq('status', 'concluido').eq('arquivado', false)).count ?? 0
      : 0;
    const abriosHoje = abertosPorDia.get(hojeStr) ?? 0;
    const concluidosHoje = concluidosPorDia.get(hojeStr) ?? 0;

    return {
      ok: true,
      data: {
        semAceite,
        porDia,
        totalAberto,
        abriosHoje,
        concluidosHoje,
      },
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
