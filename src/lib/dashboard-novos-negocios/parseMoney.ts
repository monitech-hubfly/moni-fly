/** Interpreta texto tipo "1.500.000", "1500000", "R$ 2,5 mi" como número (BRL). */
export function parseMoneyText(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  let mult = 1;
  if (/\bmi[lh][ãa]o|\bmm\b/i.test(lower)) mult = 1e6;
  else if (/\bmil\b|\bk\b/i.test(lower)) mult = 1e3;

  const normalized = s
    .replace(/r\$\s*/gi, '')
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const n = parseFloat(normalized.replace(/[^\d.-]/g, '') || '0');
  if (!Number.isFinite(n)) return null;
  return n * mult;
}
