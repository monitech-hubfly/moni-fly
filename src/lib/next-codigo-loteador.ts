/** Geração do código sequencial do loteador (padrão LTxxxx). */

export type ParsedCodigoLoteador = { num: number; width: number } | null;

export function parseCodigoLoteador(value: string | null | undefined): ParsedCodigoLoteador {
  const s = (value ?? '').toString().trim().toUpperCase();
  const m = s.match(/^LT(\d+)$/);
  if (!m) return null;
  const digits = m[1] ?? '';
  const num = Number.parseInt(digits, 10);
  if (!Number.isFinite(num)) return null;
  return { num, width: digits.length };
}

export function formatCodigoLoteador(num: number, width = 4): string {
  const w = Number.isFinite(width) && width > 0 ? width : 4;
  return `LT${String(num).padStart(w, '0')}`;
}

type CodigoLoteadorDb = {
  from: (table: string) => {
    select: (cols: string) => any;
  };
};

/**
 * Calcula o próximo código "LTxxxx" lendo os códigos já existentes em `rede_loteadores`.
 * Mantém o padding do maior código encontrado. Se não houver nenhum, começa em LT0001.
 */
export async function getNextCodigoLoteador(db: CodigoLoteadorDb): Promise<string> {
  const { data } = await db.from('rede_loteadores').select('codigo');
  let maxNum = 0;
  let width = 4;
  for (const row of (data as { codigo?: string | null }[] | null) ?? []) {
    const parsed = parseCodigoLoteador(row?.codigo);
    if (parsed && parsed.num >= maxNum) {
      maxNum = parsed.num;
      width = parsed.width;
    }
  }
  return formatCodigoLoteador(maxNum + 1, width);
}
