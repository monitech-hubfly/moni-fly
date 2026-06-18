import { MOTIVO_ARQUIVAMENTO_SEM_INFORMADO } from '@/lib/kanban/painel-motivo-arquivamento';
import type {
  PainelArquivamentoMotivosAnalise,
  PainelMotivoArquivamentoRow,
  PainelQualidadeMotivoArquivamento,
} from '@/lib/kanban/painel-performance-types';

/** Acima deste percentual, o alerta usa destaque de atenção. */
export const LIMIAR_QUALIDADE_MOTIVO_ATENCAO_PCT = 20;

const TOP_RANK = 5;

function totalSemMotivo(motivos: PainelMotivoArquivamentoRow[]): number {
  return motivos.find((m) => m.motivo === MOTIVO_ARQUIVAMENTO_SEM_INFORMADO)?.total ?? 0;
}

/** Monta indicadores de qualidade quando há arquivamentos sem motivo informado. */
export function buildQualidadeMotivoArquivamento(
  motivos: PainelArquivamentoMotivosAnalise,
  totalArquivados: number,
): PainelQualidadeMotivoArquivamento | null {
  if (totalArquivados <= 0 || motivos.semMotivoInformado <= 0) return null;

  const pctSemMotivo =
    motivos.pctSemMotivo ?? (motivos.semMotivoInformado / totalArquivados) * 100;

  const fasesMaiorSemMotivo = motivos.porFase
    .map((f) => ({
      faseId: f.faseId,
      faseNome: f.faseNome,
      total: totalSemMotivo(f.motivos),
    }))
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_RANK);

  const responsaveisMaiorSemMotivo = motivos.porResponsavel
    .map((r) => ({
      responsavelId: r.responsavelId,
      responsavelNome: r.responsavelNome,
      total: totalSemMotivo(r.motivos),
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_RANK);

  const n = motivos.semMotivoInformado;
  const mensagem =
    n === 1
      ? 'Há 1 card arquivado sem motivo informado. Isso reduz a qualidade da análise de perda do funil.'
      : `Há ${n} cards arquivados sem motivo informado. Isso reduz a qualidade da análise de perda do funil.`;

  return {
    semMotivoInformado: n,
    pctSemMotivo,
    totalArquivados,
    alertaAtencao: pctSemMotivo > LIMIAR_QUALIDADE_MOTIVO_ATENCAO_PCT,
    mensagem,
    fasesMaiorSemMotivo,
    responsaveisMaiorSemMotivo,
  };
}
