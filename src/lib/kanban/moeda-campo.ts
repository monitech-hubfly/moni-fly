import { parseMoneyText } from '@/lib/dashboard-novos-negocios/parseMoney';
import { formatMoedaDigitosPtBr } from '@/lib/kanban/ticket-medio-faixa';

/** Formata entrada do usuário como moeda pt-BR (ex.: 550000 → 5.500,00). */
export function sanitizeMoedaCampoDigitos(raw: string): string {
  return formatMoedaDigitosPtBr(raw);
}

/** Converte valor persistido (texto) para exibição no campo de edição. */
export function moedaCampoValorInicial(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const n = parseMoneyText(s);
  if (n == null) return s;
  const cents = Math.round(Math.abs(n) * 100);
  return formatMoedaDigitosPtBr(String(cents));
}
