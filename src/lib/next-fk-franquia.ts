export type ParsedFK = { num: number; width: number } | null;

export function parseFKValue(value: string | null | undefined): ParsedFK {
  const s = (value ?? '').toString().trim().toUpperCase();
  if (!s) return null;
  const m = s.match(/^FK(\d+)$/i);
  if (!m) return null;
  const digits = m[1] ?? '';
  const num = Number.parseInt(digits, 10);
  if (!Number.isFinite(num)) return null;
  return { num, width: digits.length };
}

export function formatFKValue(num: number, width: number): string {
  const w = Number.isFinite(width) && width > 0 ? width : 4;
  return `FK${String(num).padStart(w, '0')}`;
}

/**
 * Calcula o próximo "FKxxxx" lendo o último `n_franquia` da tabela `rede_franqueados`.
 * - Incrementa o número
 * - Mantém o mesmo "padding" (zeros à esquerda) que o último valor.
 * - Se não existir valor válido, começa em FK0000.
 */
export async function getNextFKFromRedeFranqueados(supabase: {
  from: (table: string) => {
    select: (cols: string) => any;
    order: (col: string, opts: { ascending: boolean }) => any;
    limit: (n: number) => any;
    maybeSingle: () => Promise<{ data: any; error: any }>;
  };
}): Promise<string> {
  const { data: lastRow, error } = await supabase
    .from('rede_franqueados')
    .select('n_franquia')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Falha silenciosa: cai para o padrão.
    return formatFKValue(0, 4);
  }

  const parsed = parseFKValue(lastRow?.n_franquia);
  const width = parsed?.width ?? 4;
  const lastNum = parsed?.num ?? -1; // para iniciar em FK0000
  const nextNum = lastNum + 1;
  return formatFKValue(nextNum, width);
}

