import type { KanbanFase } from '@/components/kanban-shared/types';
import type { CalculadoraFaseLinha } from '@/lib/kanban/calculadora-fases';
import type { CalculadoraTimelineItem } from '@/lib/kanban/calculadora-fases-marcos';
import {
  type NegociacaoLinha,
  negociacaoLinhaTemConteudo,
  parseVinculoCalculadoraNegociacao,
  type VinculoCalculadoraNegociacao,
} from '@/lib/kanban/negociacao-linhas';

export type OpcaoVinculoCalculadora = { value: string; label: string };

export type NegociacaoLinhaCalculadora = NegociacaoLinha & {
  dataPagamentoResolvida: string | null;
  dataPagamentoPrevista: boolean;
  vinculoLabel: string | null;
};

const MARCOS_VINCULO: { id: string; label: string }[] = [
  { id: 'M0', label: 'M0: Contrato' },
  { id: 'M4', label: 'M4: Transferência do Terreno' },
  { id: 'M24', label: 'M24: Fim da Operação' },
  { id: 'fim_planta', label: 'Fim cenário planta' },
  { id: 'fim_target', label: 'Fim cenário target' },
  { id: 'fim_liquidacao', label: 'Fim cenário liquidação' },
];

export function buildOpcoesVinculoCalculadora(fases: KanbanFase[]): OpcaoVinculoCalculadora[] {
  const out: OpcaoVinculoCalculadora[] = [{ value: '', label: 'Data manual' }];
  const sorted = [...fases].sort((a, b) => a.ordem - b.ordem);
  for (const f of sorted) {
    const slug = String(f.slug ?? '').trim();
    if (!slug) continue;
    out.push({ value: `fase:${slug}`, label: f.nome.trim() || slug });
  }
  for (const m of MARCOS_VINCULO) {
    out.push({ value: `marco:${m.id}`, label: m.label });
  }
  return out;
}

function dataFimLinhaFase(linha: CalculadoraFaseLinha): { data: string | null; prevista: boolean } {
  if (linha.dataFimReal) return { data: linha.dataFimReal, prevista: false };
  if (linha.dataFimEstimada) return { data: linha.dataFimEstimada, prevista: true };
  if (linha.dataInicioReal) return { data: linha.dataInicioReal, prevista: false };
  return { data: null, prevista: true };
}

function dataFimMarco(item: Extract<CalculadoraTimelineItem, { kind: 'marco' }>): {
  data: string | null;
  prevista: boolean;
} {
  const m = item.marco;
  if (m.dataFimReal) return { data: m.dataFimReal, prevista: false };
  if (m.dataFimEstimada) return { data: m.dataFimEstimada, prevista: true };
  if (m.dataLimiteContrato && m.limiteContratoReal) {
    return { data: m.dataLimiteContrato, prevista: false };
  }
  if (m.dataLimiteContrato) return { data: m.dataLimiteContrato, prevista: true };
  const fim = m.dataFim ?? m.data;
  if (fim) return { data: fim, prevista: m.isPrevisto !== false };
  return { data: null, prevista: true };
}

export function resolverDataPagamentoNegociacao(
  vinculo: VinculoCalculadoraNegociacao | null,
  linhas: CalculadoraFaseLinha[],
  timelineItems: CalculadoraTimelineItem[],
): { data: string | null; prevista: boolean; label: string | null } {
  if (!vinculo) return { data: null, prevista: true, label: null };

  if (vinculo.tipo === 'fase') {
    const linha =
      linhas.find((l) => String(l.faseSlug ?? '').trim() === vinculo.slug) ??
      linhas.find((l) => l.faseId === vinculo.slug);
    if (!linha) return { data: null, prevista: true, label: vinculo.slug };
    const { data, prevista } = dataFimLinhaFase(linha);
    return { data, prevista, label: linha.faseNome };
  }

  const marcoItem = timelineItems.find(
    (i) => i.kind === 'marco' && i.marco.id === vinculo.marcoId,
  );
  if (!marcoItem || marcoItem.kind !== 'marco') {
    return { data: null, prevista: true, label: vinculo.marcoId };
  }
  const { data, prevista } = dataFimMarco(marcoItem);
  const label =
    MARCOS_VINCULO.find((m) => m.id === vinculo.marcoId)?.label ?? vinculo.marcoId;
  return { data, prevista, label };
}

export function resolverNegociacaoLinhasCalculadora(
  linhasNegociacao: NegociacaoLinha[],
  linhasCalculadora: CalculadoraFaseLinha[],
  timelineItems: CalculadoraTimelineItem[],
): NegociacaoLinhaCalculadora[] {
  return linhasNegociacao
    .filter(negociacaoLinhaTemConteudo)
    .map((linha) => {
      const vinculo = parseVinculoCalculadoraNegociacao(linha.vinculoCalculadora);
      const resolvido = resolverDataPagamentoNegociacao(vinculo, linhasCalculadora, timelineItems);
      const manual = linha.dataPagamento.trim().slice(0, 10);
      const temManual = /^\d{4}-\d{2}-\d{2}$/.test(manual);

      let dataPagamentoResolvida: string | null = null;
      let dataPagamentoPrevista = true;

      if (vinculo) {
        dataPagamentoResolvida = resolvido.data;
        dataPagamentoPrevista = resolvido.prevista;
      } else if (temManual) {
        dataPagamentoResolvida = manual;
        dataPagamentoPrevista = false;
      }

      return {
        ...linha,
        dataPagamentoResolvida,
        dataPagamentoPrevista,
        vinculoLabel: vinculo ? resolvido.label : null,
      };
    });
}

export function labelVinculoCalculadora(
  vinculoRaw: string | null | undefined,
  opcoes: OpcaoVinculoCalculadora[],
): string | null {
  const v = String(vinculoRaw ?? '').trim();
  if (!v) return null;
  return opcoes.find((o) => o.value === v)?.label ?? v;
}
