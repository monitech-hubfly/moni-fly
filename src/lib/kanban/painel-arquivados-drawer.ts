import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import {
  buildConversaoContext,
  classificarConversaoCard,
  labelMomentoArquivamento,
  momentoArquivamentoDrawer,
} from '@/lib/kanban/painel-conversao-classify';
import {
  buildMotivoHistoricoPorCard,
  resolveMotivoArquivamento,
} from '@/lib/kanban/painel-motivo-arquivamento';
import { cardInAnalysisPeriod, periodSinceMs } from '@/lib/kanban/painel-performance-compute';
import type {
  PainelArquivadoDrawerRow,
  PainelCardDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelPeriodKey,
} from '@/lib/kanban/painel-performance-types';

function buildHistoricoPorCard(rows: PainelHistoricoMovimentoDTO[]): Map<string, PainelHistoricoMovimentoDTO[]> {
  const m = new Map<string, PainelHistoricoMovimentoDTO[]>();
  for (const r of rows) {
    const list = m.get(r.card_id) ?? [];
    list.push(r);
    m.set(r.card_id, list);
  }
  return m;
}

function formatArquivadoEm(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const fmt = formatIsoDateOnlyPtBr(iso);
  if (fmt) return fmt;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('pt-BR') : null;
}

/** Lista de cards arquivados para auditoria no drawer (somente leitura). */
export function buildPainelArquivadosDrawerRows(input: {
  kanbanNome: string;
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  historico: PainelHistoricoMovimentoDTO[];
  profiles: Record<string, string>;
  period: PainelPeriodKey;
  openCardHref: (cardId: string) => string;
}): PainelArquivadoDrawerRow[] {
  const sinceMs = periodSinceMs(input.period);
  const conversaoCtx = buildConversaoContext(input.fases);
  const faseById = conversaoCtx.faseById;
  const historicoPorCard = buildHistoricoPorCard(input.historico);
  const motivoHistorico = buildMotivoHistoricoPorCard(input.historico);

  const candidatos = input.cards.filter(
    (c) => c.arquivado && cardInAnalysisPeriod(c, sinceMs, historicoPorCard),
  );

  candidatos.sort((a, b) => {
    const ta = new Date(a.arquivado_em ?? a.updated_at ?? a.created_at).getTime();
    const tb = new Date(b.arquivado_em ?? b.updated_at ?? b.created_at).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });

  const rows: PainelArquivadoDrawerRow[] = [];

  for (const c of candidatos) {
    const fase = faseById.get(c.fase_id);
    const cl = classificarConversaoCard(c, conversaoCtx);
    const momentoConversao = momentoArquivamentoDrawer(cl);
    const momentoConversaoLabel = labelMomentoArquivamento(
      cl.momentoArquivamento,
      conversaoCtx.conversaoConfigurada,
    );

    const rid = c.responsavel_fase_id?.trim();
    const responsavelNome =
      c.responsavel_fase_nome?.trim() ||
      (rid ? input.profiles[rid] : null) ||
      'Sem responsável';

    const nFranq = c.n_franquia?.trim();
    const nomeRede = c.franqueado_rede_nome?.trim();
    const unidadeLabel = [nFranq, nomeRede].filter(Boolean).join(' · ') || null;

    rows.push({
      cardId: c.id,
      titulo: c.titulo?.trim() || 'Sem título',
      funilNome: input.kanbanNome,
      faseArquivamentoNome: fase?.nome ?? '—',
      arquivadoEm: formatArquivadoEm(c.arquivado_em ?? c.updated_at),
      momentoConversao,
      momentoConversaoLabel,
      classificacaoRotulo: cl.rotulo,
      motivo: resolveMotivoArquivamento(c, motivoHistorico),
      responsavelNome,
      unidadeLabel,
      openHref: input.openCardHref(c.id),
    });
  }

  return rows;
}
