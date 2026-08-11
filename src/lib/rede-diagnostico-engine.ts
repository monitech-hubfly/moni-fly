/**
 * Motor de diagnóstico da rede de franqueados.
 *
 * Funções puras: recebem os campos diag_* de um RedeFranqueadoRowDb
 * e devolvem scores, prioridades, grupos e perfis calculados.
 *
 * NÃO fazem chamadas ao Supabase — podem ser usadas em client e server.
 */

import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';

// ─── Tipos auxiliares ───────────────────────────────────────────────────────

export type DiagDimValue = 0 | 2 | 3;
export type DiagTend = '↑' | '→' | '↓';

export type DiagPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'AD' | 'NC';
export type DiagGrupo = 'GA1' | 'GA2' | 'GA3' | 'GA4' | 'GA5' | 'GA6' | 'GA7';
export type DiagRelacao = 'saudavel' | 'atencao' | 'critica' | 'nao-aferida';
export type DiagIndStatus = 'ritmo' | 'proximo' | 'regular' | 'abaixo';
export type DiagEngColor = 'green' | 'lime' | 'amber' | 'red';

export const GA_NOME: Record<DiagGrupo, string> = {
  GA1: 'Estruturação Financeira',
  GA2: 'Ativação e Execução',
  GA3: 'Recuperação da Relação',
  GA4: 'Desenvolvimento e Capacitação',
  GA5: 'Conversão e Resultado',
  GA6: 'Aceleração',
  GA7: 'Gestão de Adormecidos',
};

// ─── Helpers de status ──────────────────────────────────────────────────────

const STATUS_NC = new Set(['em-transferencia', 'em transferência', 'encerrada', 'encerrado']);

export function isStatusNC(row: Pick<RedeFranqueadoRowDb, 'status_franquia'>): boolean {
  const s = String(row.status_franquia ?? '').toLowerCase().trim();
  return STATUS_NC.has(s);
}

export function isAdormecido(row: Pick<RedeFranqueadoRowDb, 'diag_adormecido'>): boolean {
  return row.diag_adormecido === true;
}

export function isExcluido(
  row: Pick<RedeFranqueadoRowDb, 'status_franquia' | 'diag_adormecido'>,
): boolean {
  return isStatusNC(row) || isAdormecido(row);
}

// ─── NPS ────────────────────────────────────────────────────────────────────

export type NpsCategoria = 'promotor' | 'neutro' | 'detrator';

export function npsCategoria(nps: number | null | undefined): NpsCategoria | null {
  if (nps === null || nps === undefined) return null;
  if (nps <= 6) return 'detrator';
  if (nps <= 8) return 'neutro';
  return 'promotor';
}

// ─── ENGAJAMENTO ─────────────────────────────────────────────────────────────

/** Pesos: D×40% + C×35% + K×25%, normalizado de 0–3 para 0–100%. */
export function calcEngajamento(
  row: Pick<RedeFranqueadoRowDb, 'status_franquia' | 'diag_adormecido' | 'diag_d' | 'diag_c' | 'diag_k'>,
): number | null {
  if (isExcluido(row)) return null;
  const { diag_d, diag_c, diag_k } = row;
  if (diag_d === null || diag_d === undefined) return null;
  if (diag_c === null || diag_c === undefined) return null;
  if (diag_k === null || diag_k === undefined) return null;
  const raw = (Number(diag_d) * 0.4 + Number(diag_c) * 0.35 + Number(diag_k) * 0.25) / 3;
  return Math.round(raw * 1000) / 10;
}

export function engajamentoColor(score: number): DiagEngColor {
  if (score >= 85) return 'green';
  if (score >= 70) return 'lime';
  if (score >= 50) return 'amber';
  return 'red';
}

export function engajamentoHex(score: number): string {
  const map: Record<DiagEngColor, string> = {
    green: '#16a34a',
    lime: '#65a30d',
    amber: '#d97706',
    red: '#dc2626',
  };
  return map[engajamentoColor(score)];
}

export function engajamentoLabel(score: number, internalView: boolean): string {
  if (score >= 85) return internalView ? 'Alta Prontidão' : 'Alta Capacidade';
  if (score >= 70) return internalView ? 'Prontidão c/ Atenção' : 'Em Desenvolvimento';
  if (score >= 50) return internalView ? 'Prontidão Parcial' : 'Em Evolução';
  return internalView ? 'Baixa Prontidão' : 'Em Estruturação';
}

// ─── SAÚDE DA RELAÇÃO ────────────────────────────────────────────────────────

export function calcRelacao(
  row: Pick<RedeFranqueadoRowDb, 'diag_nps' | 'diag_csat'>,
): DiagRelacao {
  const nc = npsCategoria(row.diag_nps !== undefined ? Number(row.diag_nps) : null);
  const cs = row.diag_csat !== null && row.diag_csat !== undefined ? Number(row.diag_csat) : null;
  if (nc === null && cs === null) return 'nao-aferida';
  if (nc === 'detrator' || (cs !== null && cs < 3)) return 'critica';
  if (nc === 'promotor' && (cs === null || cs >= 4)) return 'saudavel';
  return 'atencao';
}

// ─── INDICADOR ───────────────────────────────────────────────────────────────

export function calcIndicador(
  row: Pick<
    RedeFranqueadoRowDb,
    'status_franquia' | 'diag_adormecido' | 'diag_contratos_12m' | 'diag_ano_meta'
  >,
): DiagIndStatus | null {
  if (isExcluido(row)) return null;
  if (row.diag_contratos_12m === null || row.diag_contratos_12m === undefined) return null;
  const meta = Number(row.diag_ano_meta ?? 4);
  const pct = (Number(row.diag_contratos_12m) / meta) * 100;
  if (pct >= 100) return 'ritmo';
  if (pct >= 75) return 'proximo';
  if (pct >= 50) return 'regular';
  return 'abaixo';
}

// ─── PRIORIDADE ──────────────────────────────────────────────────────────────

export function calcPriority(
  row: Pick<
    RedeFranqueadoRowDb,
    | 'status_franquia'
    | 'diag_adormecido'
    | 'diag_d'
    | 'diag_c'
    | 'diag_k'
    | 'diag_nps'
    | 'diag_csat'
    | 'diag_contratos_12m'
    | 'diag_ano_meta'
  >,
): DiagPriority {
  if (isStatusNC(row)) return 'NC';
  if (isAdormecido(row)) return 'AD';
  const rel = calcRelacao(row);
  if (Number(row.diag_c) === 0 && rel === 'critica') return 'P1';
  if (Number(row.diag_d) === 0) return 'P2';
  if (Number(row.diag_c) === 0) return 'P3';
  if (rel === 'critica') return 'P4';
  if (Number(row.diag_k) === 0) return 'P5';
  const eng = calcEngajamento(row);
  const ind = calcIndicador(row);
  if (eng !== null && eng >= 85 && rel === 'saudavel' && ind === 'ritmo') return 'P7';
  return 'P6';
}

// ─── GRUPO DE AÇÃO ───────────────────────────────────────────────────────────

export function calcGrupo(
  row: Pick<
    RedeFranqueadoRowDb,
    | 'status_franquia'
    | 'diag_adormecido'
    | 'diag_d'
    | 'diag_c'
    | 'diag_k'
    | 'diag_nps'
    | 'diag_csat'
    | 'diag_contratos_12m'
    | 'diag_ano_meta'
  >,
): DiagGrupo | null {
  if (isAdormecido(row)) return 'GA7';
  if (isStatusNC(row)) return null;
  if (Number(row.diag_d) === 0) return 'GA1';
  if (Number(row.diag_c) === 0) return 'GA2';
  if (calcRelacao(row) === 'critica') return 'GA3';
  if (Number(row.diag_k) === 0) return 'GA4';
  if (calcIndicador(row) !== 'ritmo') return 'GA5';
  return 'GA6';
}

// ─── PERFIL ──────────────────────────────────────────────────────────────────

export function calcPerfil(
  row: Pick<
    RedeFranqueadoRowDb,
    | 'status_franquia'
    | 'diag_adormecido'
    | 'diag_d'
    | 'diag_c'
    | 'diag_k'
    | 'diag_nps'
    | 'diag_csat'
    | 'diag_contratos_12m'
    | 'diag_ano_meta'
  >,
  internalView: boolean,
): string {
  const p = calcPriority(row);
  const eng = calcEngajamento(row);
  const ind = calcIndicador(row);

  const INT: Record<string, string> = {
    NC: 'Não Contabilizado',
    AD: 'Adormecido',
    P1: 'Risco de Desengajamento',
    P2: 'Restrição Financeira',
    P2m: 'Baixa Viabilidade Atual',
    P3: 'Baixa Ativação',
    P4: 'Risco Relacional',
    P4p: 'Performance c/ Risco Relacional',
    P5: 'Gap de Capacitação',
    P6: 'Em Desenvolvimento',
    P6h: 'Potencial Não Convertido',
    P7: 'Alta Performance',
  };
  const EXT: Record<string, string> = {
    NC: '—',
    AD: 'Adormecido',
    P1: 'Reconexão e Retomada',
    P2: 'Estruturação Financeira',
    P2m: 'Reestruturação para Retomada',
    P3: 'Retomada de Execução',
    P4: 'Fortalecimento da Jornada',
    P4p: 'Sustentação de Performance',
    P5: 'Desenvolvimento Técnico',
    P6: 'Em Evolução',
    P6h: 'Desenvolvimento de Performance',
    P7: 'Nível de Aceleração',
  };

  let key: string = p;
  if (p === 'P2' && (Number(row.diag_c) === 0 || Number(row.diag_k) === 0)) key = 'P2m';
  if (p === 'P4' && ind === 'ritmo') key = 'P4p';
  if (p === 'P6' && eng !== null && eng >= 70) key = 'P6h';

  const map = internalView ? INT : EXT;
  return map[key] ?? map[p] ?? p;
}

// ─── Métricas de rede ────────────────────────────────────────────────────────

export type RedeMetricas = {
  totalAtiva: number;
  avgEng: number | null;
  engLabel: string;
  engColor: DiagEngColor | null;
  relStatus: 'Saudável' | 'Atenção' | 'Crítica' | 'Não aferida';
  relColor: string;
  avgNps: number | null;
  avgCsat: number | null;
  totalContratos: number;
  totalMeta: number;
  inadimplentes: number;
  emTransferencia: number;
  adormecidas: number;
  p1Count: number;
};

export function calcRedeMetricas(rows: RedeFranqueadoRowDb[]): RedeMetricas {
  const ativas = rows.filter((r) => !isStatusNC(r) && !isAdormecido(r));

  const engs = ativas.map(calcEngajamento).filter((e): e is number => e !== null);
  const avgEng = engs.length > 0 ? Math.round(engs.reduce((a, b) => a + b, 0) / engs.length) : null;

  const npsRows = ativas.filter((r) => r.diag_nps !== null && r.diag_nps !== undefined);
  const avgNps =
    npsRows.length > 0
      ? parseFloat((npsRows.reduce((a, r) => a + Number(r.diag_nps), 0) / npsRows.length).toFixed(1))
      : null;

  const csatRows = ativas.filter((r) => r.diag_csat !== null && r.diag_csat !== undefined);
  const avgCsat =
    csatRows.length > 0
      ? parseFloat((csatRows.reduce((a, r) => a + Number(r.diag_csat), 0) / csatRows.length).toFixed(1))
      : null;

  const relCounts = { saudavel: 0, atencao: 0, critica: 0 };
  ativas.forEach((r) => {
    const rel = calcRelacao(r);
    if (rel in relCounts) relCounts[rel as keyof typeof relCounts]++;
  });

  let relStatus: RedeMetricas['relStatus'] = 'Não aferida';
  let relColor = '#9CA3AF';
  if (relCounts.critica > 0 || relCounts.atencao > 0 || relCounts.saudavel > 0) {
    if (relCounts.critica > relCounts.saudavel) {
      relStatus = 'Crítica'; relColor = '#dc2626';
    } else if (relCounts.atencao >= relCounts.saudavel) {
      relStatus = 'Atenção'; relColor = '#d97706';
    } else {
      relStatus = 'Saudável'; relColor = '#16a34a';
    }
  }

  const ctRows = ativas.filter((r) => r.diag_contratos_12m !== null && r.diag_contratos_12m !== undefined);
  const totalContratos = ctRows.reduce((a, r) => a + Number(r.diag_contratos_12m), 0);
  const totalMeta = ctRows.length * 4;

  return {
    totalAtiva: ativas.length,
    avgEng,
    engLabel: avgEng !== null ? engajamentoLabel(avgEng, true) : '—',
    engColor: avgEng !== null ? engajamentoColor(avgEng) : null,
    relStatus,
    relColor,
    avgNps,
    avgCsat,
    totalContratos,
    totalMeta,
    inadimplentes: 0, // campo adimplente não é do diagnóstico
    emTransferencia: rows.filter((r) => isStatusNC(r)).length,
    adormecidas: rows.filter((r) => isAdormecido(r)).length,
    p1Count: rows.filter((r) => calcPriority(r) === 'P1').length,
  };
}
