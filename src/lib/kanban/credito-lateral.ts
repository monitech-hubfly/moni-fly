import { parseMoneyText } from '@/lib/dashboard-novos-negocios/parseMoney';

export type CreditoTranche = {
  numero: number;
  valor: string;
  data: string;
};

export type CreditoLateral = {
  terreno_tranches: CreditoTranche[];
  obra_tranches: CreditoTranche[];
  alavancagem_valor: string;
  alavancagem_tranches: CreditoTranche[];
};

function trancheUm(): CreditoTranche {
  return { numero: 1, valor: '', data: '' };
}

export function creditoLateralVazio(): CreditoLateral {
  return {
    terreno_tranches: [trancheUm()],
    obra_tranches: [trancheUm()],
    alavancagem_valor: '',
    alavancagem_tranches: [trancheUm()],
  };
}

function numeroTranche(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function dataTranche(raw: unknown): string {
  const head = String(raw ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : '';
}

function parseTranches(raw: unknown): CreditoTranche[] {
  if (!Array.isArray(raw)) return [trancheUm()];
  const vistos = new Set<number>();
  const lista: CreditoTranche[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { numero?: unknown; valor?: unknown; data?: unknown };
    const numero = numeroTranche(row.numero);
    if (numero == null || vistos.has(numero)) continue;
    vistos.add(numero);
    lista.push({
      numero,
      valor: String(row.valor ?? '').trim(),
      data: dataTranche(row.data),
    });
  }
  if (!vistos.has(1)) lista.push(trancheUm());
  return lista.sort((a, b) => a.numero - b.numero);
}

export function creditoLateralFromRaw(raw: unknown): CreditoLateral {
  const vazio = creditoLateralVazio();
  if (!raw || typeof raw !== 'object') return vazio;
  const row = raw as Partial<CreditoLateral>;
  return {
    terreno_tranches: parseTranches(row.terreno_tranches),
    obra_tranches: parseTranches(row.obra_tranches),
    alavancagem_valor: String(row.alavancagem_valor ?? '').trim(),
    alavancagem_tranches: parseTranches(row.alavancagem_tranches),
  };
}

export function somaTranches(tranches: readonly CreditoTranche[]): number {
  return tranches.reduce((acc, tranche) => acc + (parseMoneyText(tranche.valor) ?? 0), 0);
}

/** Base menos a soma das tranches. Sem base e sem tranche preenchida, não há valor. */
export function restanteCredito(
  base: string | null | undefined,
  tranches: readonly CreditoTranche[],
): number | null {
  const origem = parseMoneyText(base);
  const preenchidas = tranches.some((tranche) => parseMoneyText(tranche.valor) != null);
  if (origem == null && !preenchidas) return null;
  return (origem ?? 0) - somaTranches(tranches);
}

export function formatCreditoMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

export function adicionarTranche(
  tranches: readonly CreditoTranche[],
  numero: number,
): { ok: true; tranches: CreditoTranche[] } | { ok: false; error: string } {
  if (!Number.isInteger(numero) || numero < 1) {
    return { ok: false, error: 'Informe o número da tranche.' };
  }
  if (tranches.some((tranche) => tranche.numero === numero)) {
    return { ok: false, error: `A tranche ${numero} já existe.` };
  }
  return {
    ok: true,
    tranches: [...tranches, { numero, valor: '', data: '' }].sort((a, b) => a.numero - b.numero),
  };
}
