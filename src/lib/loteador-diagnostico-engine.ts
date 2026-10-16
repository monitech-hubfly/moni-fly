/**
 * Motor de diagnóstico simplificado para loteadores.
 *
 * Diferente do diagnóstico de franqueados:
 * - Só D (Dinheiro / capital para operar), escala 0–2
 * - Saúde da relação via NPS + CSAT (igual ao engine de franqueados)
 * - SEM Conhecimento, Comportamento, Score de engajamento
 * - SEM Indicador / contratos
 * - Prioridades: NC → AD → P1–P7
 * - Grupos: GA1–GA5
 */

import { npsCategoria, type DiagRelacao } from '@/lib/rede-diagnostico-engine';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type LoteadorDiagPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'AD' | 'NC';
export type LoteadorDiagGrupo = 'GA1' | 'GA2' | 'GA3' | 'GA4' | 'GA5';

export const LOTEADOR_GA_NOME: Record<LoteadorDiagGrupo, string> = {
  GA1: 'Estruturação Financeira',
  GA2: 'Recuperação da Relação',
  GA3: 'Desenvolvimento e Capital',
  GA4: 'Manutenção e Resultado',
  GA5: 'Gestão de Adormecidos',
};

export type LoteadorDiagSource = {
  status: string;
  diag_d: number | null | undefined;
  diag_nps: number | null | undefined;
  diag_csat: number | null | undefined;
  diag_adormecido: boolean | null | undefined;
  diag_tend_rel?: string | null;
  diag_grupo_sec?: string | null;
  diag_proxima_acao?: string | null;
  diag_ultimo_contato?: string | null;
  diag_ultima_aval?: string | null;
  diag_avaliado_por?: string | null;
};

// ─── Status helpers ──────────────────────────────────────────────────────────

export function isLoteadorNC(row: Pick<LoteadorDiagSource, 'status'>): boolean {
  return String(row.status ?? '').trim() === 'inativo';
}

export function isLoteadorAdormecido(row: Pick<LoteadorDiagSource, 'diag_adormecido'>): boolean {
  return row.diag_adormecido === true;
}

// ─── Saúde da Relação (reutiliza lógica idêntica) ────────────────────────────

export function calcLoteadorRelacao(
  row: Pick<LoteadorDiagSource, 'diag_nps' | 'diag_csat'>,
): DiagRelacao {
  const nc = npsCategoria(row.diag_nps !== undefined ? Number(row.diag_nps) : null);
  const cs = row.diag_csat !== null && row.diag_csat !== undefined ? Number(row.diag_csat) : null;
  if (nc === null && cs === null) return 'nao-aferida';
  if (nc === 'detrator' || (cs !== null && cs < 3)) return 'critica';
  if (nc === 'promotor' && (cs === null || cs >= 4)) return 'saudavel';
  return 'atencao';
}

// ─── Prioridade ──────────────────────────────────────────────────────────────

/**
 * NC  → inativo (não contabilizado)
 * AD  → adormecido
 * P1  → D=0 + relação crítica (pior caso)
 * P2  → D=0
 * P3  → relação crítica
 * P4  → relação de atenção
 * P5  → D=1 (moderado)
 * P6  → D=2 mas relação não saudável
 * P7  → D=2 + relação saudável (melhor caso)
 */
export function calcLoteadorPriority(row: LoteadorDiagSource): LoteadorDiagPriority {
  if (isLoteadorNC(row)) return 'NC';
  if (isLoteadorAdormecido(row)) return 'AD';
  const d = row.diag_d !== null && row.diag_d !== undefined ? Number(row.diag_d) : null;
  const rel = calcLoteadorRelacao(row);
  if (d === 0 && rel === 'critica') return 'P1';
  if (d === 0) return 'P2';
  if (rel === 'critica') return 'P3';
  if (rel === 'atencao') return 'P4';
  if (d === 1) return 'P5';
  if (d === 2 && rel !== 'saudavel') return 'P6';
  return 'P7';
}

// ─── Grupo de Ação ───────────────────────────────────────────────────────────

/**
 * GA1 → D=0 (sem capital — estruturação financeira)
 * GA2 → relação crítica (recuperação)
 * GA3 → D=1 (capital moderado — desenvolvimento)
 * GA4 → D=2 + ok (manutenção e resultado)
 * GA5 → adormecido
 */
export function calcLoteadorGrupo(row: LoteadorDiagSource): LoteadorDiagGrupo | null {
  if (isLoteadorAdormecido(row)) return 'GA5';
  if (isLoteadorNC(row)) return null;
  const d = row.diag_d !== null && row.diag_d !== undefined ? Number(row.diag_d) : null;
  const rel = calcLoteadorRelacao(row);
  if (d === 0) return 'GA1';
  if (rel === 'critica') return 'GA2';
  if (d === 1) return 'GA3';
  return 'GA4';
}
