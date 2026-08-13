export type ParsedLO = { num: number; width: number } | null;

export function parseLOValue(value: string | null | undefined): ParsedLO {
  const s = (value ?? '').toString().trim().toUpperCase();
  if (!s) return null;
  const m = s.match(/^LO(\d+)$/i);
  if (!m) return null;
  const digits = m[1] ?? '';
  const num = Number.parseInt(digits, 10);
  if (!Number.isFinite(num)) return null;
  return { num, width: digits.length };
}

export function formatLOValue(num: number, width: number): string {
  const w = Number.isFinite(width) && width > 0 ? width : 4;
  return `LO${String(num).padStart(w, '0')}`;
}

/**
 * Calcula o próximo "LOxxxx" lendo o último `n_loteador` da tabela `rede_loteadores`.
 * - Incrementa o número
 * - Mantém o mesmo "padding" (zeros à esquerda) que o último valor.
 * - Se não existir valor válido, começa em LO0000.
 */
export async function getNextLOFromRedeLoteadores(supabase: {
  from: (table: string) => {
    select: (cols: string) => any;
    order: (col: string, opts: { ascending: boolean }) => any;
    limit: (n: number) => any;
    maybeSingle: () => Promise<{ data: any; error: any }>;
  };
}): Promise<string> {
  const { data: lastRow, error } = await supabase
    .from('rede_loteadores')
    .select('n_loteador')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return formatLOValue(0, 4);
  }

  const parsed = parseLOValue(lastRow?.n_loteador);
  const width = parsed?.width ?? 4;
  const lastNum = parsed?.num ?? -1;
  const nextNum = lastNum + 1;
  return formatLOValue(nextNum, width);
}
