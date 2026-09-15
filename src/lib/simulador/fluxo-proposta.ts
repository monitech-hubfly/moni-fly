import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const FASE_FLUXO_LABEL: Record<string, string> = {
  pre_contrato: 'Pré-contrato',
  mes0: 'Mês 0',
  fase1: 'Fase 1',
  parcela_unica: 'Parcela única',
  fase2: 'Fase 2',
  entrega: 'Entrega',
};

function n0(v: number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function dataEmissaoExtenso(d = new Date()): string {
  return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function dataGeracaoCurta(d = new Date()): string {
  return format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR });
}

export function refProposta(simulacaoId: string | null | undefined, emissao = new Date()): string {
  const yyyymmdd = format(emissao, 'yyyyMMdd');
  const id = String(simulacaoId ?? '').replace(/-/g, '');
  const sufixo = id.slice(-4).toUpperCase() || 'RASC';
  return `MON-${yyyymmdd}-${sufixo}`;
}

export function formatarMoedaProposta(v: number): string {
  return n0(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
