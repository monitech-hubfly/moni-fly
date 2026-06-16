import { formatCondominioMoeda, parseDecimalInput } from '@/lib/condominios';

/** Texto padrão editável — o usuário preenche os valores entre os R$. */
export const TICKET_MEDIO_FAIXA_PADRAO = 'entre R$ e R$';

export const PLACEHOLDER_TICKET_MEDIO_FAIXA = TICKET_MEDIO_FAIXA_PADRAO;

const FAIXA_REGEX = /entre\s+R\$\s*([\d.,\s]+?)\s+e\s+R\$\s*([\d.,\s]+)/i;

function formatMoedaSemPrefixoFromNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function valorMoedaSemPrefixo(valor: number): string {
  const fmt = formatCondominioMoeda(valor);
  if (fmt === '—') return '';
  return fmt.replace(/^R\$\s*/i, '').trim();
}

/** Apenas dígitos (centavos acumulados conforme o usuário digita). */
export function extrairDigitosMoeda(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/** Formata dígitos como moeda pt-BR — vírgula e ponto surgem automaticamente. */
export function formatMoedaDigitosPtBr(digits: string): string {
  const d = extrairDigitosMoeda(digits);
  if (!d) return '';
  const n = Number(d) / 100;
  if (!Number.isFinite(n)) return '';
  return formatMoedaSemPrefixoFromNumber(n);
}

export function parseTicketMedioFaixaPartes(raw: string): { min: string; max: string } {
  const [minVal, maxVal] = parseTicketMedioFaixaNumeros(raw);
  return {
    min: minVal != null ? formatMoedaSemPrefixoFromNumber(minVal) : '',
    max: maxVal != null ? formatMoedaSemPrefixoFromNumber(maxVal) : '',
  };
}

export function montarTicketMedioFaixa(minFmt: string, maxFmt: string): string {
  const min = minFmt.trim();
  const max = maxFmt.trim();
  if (!min && !max) return TICKET_MEDIO_FAIXA_PADRAO;
  return `entre R$ ${min} e R$ ${max}`;
}

export function isTicketMedioFaixaVazio(raw: string): boolean {
  const t = String(raw ?? '').trim();
  if (!t) return true;
  return t.toLowerCase() === TICKET_MEDIO_FAIXA_PADRAO.toLowerCase();
}

export function parseTicketMedioFaixaNumeros(raw: string): [number | null, number | null] {
  const t = String(raw ?? '').trim();
  if (!t || isTicketMedioFaixaVazio(t)) return [null, null];

  const m = t.match(FAIXA_REGEX);
  if (m) {
    return [parseDecimalInput(m[1]), parseDecimalInput(m[2])];
  }

  const single = parseDecimalInput(t);
  return single != null ? [single, single] : [null, null];
}

/** Média da faixa para persistência numérica no cadastro. */
export function parseTicketMedioFaixaParaCadastro(raw: string): number | null {
  const [min, max] = parseTicketMedioFaixaNumeros(raw);
  if (min == null && max == null) return null;
  if (min != null && max != null) return (min + max) / 2;
  return min ?? max;
}

export function ticketMedioFaixaPreenchido(raw: string): boolean {
  const [min, max] = parseTicketMedioFaixaNumeros(raw);
  return min != null && max != null && min > 0 && max > 0;
}

export function formatTicketMedioFaixaFromValor(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor) || valor <= 0) return TICKET_MEDIO_FAIXA_PADRAO;
  const v = valorMoedaSemPrefixo(valor);
  if (!v) return TICKET_MEDIO_FAIXA_PADRAO;
  return `entre R$ ${v} e R$ ${v}`;
}

export function normalizarTicketMedioFaixaInput(raw: string): string {
  const t = String(raw ?? '').trim();
  if (!t || isTicketMedioFaixaVazio(t)) return TICKET_MEDIO_FAIXA_PADRAO;
  if (ticketMedioFaixaPreenchido(t)) return t;
  return t;
}
