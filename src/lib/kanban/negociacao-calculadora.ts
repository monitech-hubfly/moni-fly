import { parseMoneyText } from '@/lib/dashboard-novos-negocios/parseMoney';
import {
  labelSufixoDataCalculadoraFase,
  type CalculadoraFaseLinha,
} from '@/lib/kanban/calculadora-fases';
import { formatMoedaDigitosPtBr } from '@/lib/kanban/ticket-medio-faixa';
import type { NegociacaoLinha } from '@/lib/kanban/negociacao-linhas';

export type NegociacaoCalculadoraLinha = NegociacaoLinha & {
  dataResolvida: string | null;
  dataLabel: 'est.' | 'real';
  valorExibicao: string;
  faseNome: string | null;
};

/** Formata valor de negociação para exibição (R$). */
export function formatNegociacaoValorExibicao(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  const n = parseMoneyText(s);
  if (n == null) return s.startsWith('R$') ? s : `R$ ${s}`;
  const cents = Math.round(Math.abs(n) * 100);
  return `R$ ${formatMoedaDigitosPtBr(String(cents))}`;
}

/** Resolve data de pagamento: fase da calculadora ou data fixa. */
export function resolverDataPagamentoNegociacao(
  linha: Pick<NegociacaoLinha, 'faseId' | 'dataPagamento'>,
  calculadoraLinhas: CalculadoraFaseLinha[],
): { data: string | null; label: 'est.' | 'real' } {
  const faseId = String(linha.faseId ?? '').trim();
  if (faseId) {
    const row = calculadoraLinhas.find((l) => l.faseId === faseId);
    if (!row) return { data: null, label: 'est.' };
    const data = row.dataFimReal ?? row.dataFimEstimada ?? row.dataInicioReal;
    const label = labelSufixoDataCalculadoraFase(row.status, 'fim', Boolean(row.dataFimReal));
    return { data, label };
  }

  const manual = linha.dataPagamento.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(manual)) {
    return { data: manual, label: 'real' };
  }
  return { data: null, label: 'est.' };
}

export function montarNegociacaoCalculadoraLinhas(
  linhas: NegociacaoLinha[],
  calculadoraLinhas: CalculadoraFaseLinha[],
  faseNomePorId: Map<string, string>,
): NegociacaoCalculadoraLinha[] {
  const out: NegociacaoCalculadoraLinha[] = [];
  for (const linha of linhas) {
    const condicao = linha.condicao.trim();
    const valor = linha.valor.trim();
    const faseId = String(linha.faseId ?? '').trim();
    const dataManual = linha.dataPagamento.trim();
    if (!condicao && !valor && !faseId && !dataManual) continue;

    const { data, label } = resolverDataPagamentoNegociacao(linha, calculadoraLinhas);
    out.push({
      ...linha,
      dataResolvida: data,
      dataLabel: label,
      valorExibicao: formatNegociacaoValorExibicao(valor),
      faseNome: faseId ? faseNomePorId.get(faseId) ?? null : null,
    });
  }
  return out;
}
