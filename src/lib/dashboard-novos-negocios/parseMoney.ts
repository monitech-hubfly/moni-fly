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

/** Interpreta "1.250,50", "1250.50" ou "1250". Vazio ou sem dígito vira null. */
export function parseNumeroPtBr(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim().replace(/\s/g, '');
  if (!s || !/\d/.test(s)) return null;
  const normalized = s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export const MSG_PERCENTUAL_NEGOCIO =
  'O percentual precisa ficar entre 0 e 100. Valor em reais (VGV, terreno, obra) entra no campo de moeda, não no percentual.';

export function percentualNegocioForaDaFaixa(n: number | null | undefined): boolean {
  return n != null && (n < 0 || n > 100);
}
