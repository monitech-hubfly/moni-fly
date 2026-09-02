export type ParsedMC = { num: number; width: number } | null;

export const MC_RESERVADO = 'MC0000';

export function parseMCValue(value: string | null | undefined): ParsedMC {
  const s = (value ?? '').toString().trim().toUpperCase();
  if (!s) return null;
  const m = s.match(/^MC(\d+)$/i);
  if (!m) return null;
  const digits = m[1] ?? '';
  const num = Number.parseInt(digits, 10);
  if (!Number.isFinite(num)) return null;
  return { num, width: digits.length };
}

export function formatMCValue(num: number, width: number): string {
  const w = Number.isFinite(width) && width > 0 ? width : 4;
  return `MC${String(num).padStart(w, '0')}`;
}

/**
 * Próximo n_cadastro sequencial (MC0001 em diante; MC0000 reservado).
 * Lê o maior `ordem` em `moni_capital_cadastros`.
 */
export async function getNextMCFromCadastros(supabase: {
  from: (table: string) => {
    select: (cols: string) => any;
  };
}): Promise<{ n_cadastro: string; ordem: number }> {
  const { data: lastRow, error } = await supabase
    .from('moni_capital_cadastros')
    .select('n_cadastro, ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !lastRow) {
    return { n_cadastro: 'MC0001', ordem: 1 };
  }

  const parsed = parseMCValue(lastRow.n_cadastro);
  const width = parsed?.width ?? 4;
  const lastNum = parsed?.num ?? 0;
  const nextNum = Math.max(lastNum + 1, 1);
  const lastOrdem = Number(lastRow.ordem ?? 0);
  return {
    n_cadastro: formatMCValue(nextNum, width),
    ordem: (Number.isFinite(lastOrdem) ? lastOrdem : 0) + 1,
  };
}
