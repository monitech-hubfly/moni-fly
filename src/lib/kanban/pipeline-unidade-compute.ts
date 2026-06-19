import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import type { PainelChamadoUnificadoDTO } from '@/lib/kanban/painel-performance-types';
import { calcularDiasNaFase } from '@/lib/kanban/pipeline-card-readonly';
import type {
  PipelineCardDisplay,
  PipelineCardsKpisUnidade,
  PipelineFunilGrupoUnidade,
  PipelineOQueFazerItem,
  PipelineUnidadeSaudeMes,
} from '@/lib/kanban/pipeline-cards-types';
import { slaCategoriaPipeline } from '@/lib/kanban/pipeline-cards-utils';
import { saudeMesUnidadePipeline } from '@/lib/kanban/pipeline-franqueadora-compute';

const INATIVIDADE_O_QUE_FAZER_DIAS = 15;
const MAX_O_QUE_FAZER = 10;

export function calcularKpisPipelineUnidadeExtended(
  cards: PipelineCardDisplay[],
  chamados: PainelChamadoUnificadoDTO[] = [],
): PipelineCardsKpisUnidade {
  const porFunil = new Map<string, { kanbanNome: string; total: number }>();
  const funis = new Set<string>();
  for (const card of cards) {
    funis.add(card.kanban_id);
    const cur = porFunil.get(card.kanban_id);
    if (cur) cur.total += 1;
    else porFunil.set(card.kanban_id, { kanbanNome: card.kanban_nome, total: 1 });
  }

  const cardIds = new Set(cards.map((c) => c.id));
  const chamadosComTrava = chamados.filter((c) => c.trava && c.aberto && cardIds.has(c.cardId)).length;

  return {
    cardsAtivos: cards.length,
    cardsAtrasados: cards.filter((c) => slaCategoriaPipeline(c) === 'atrasado').length,
    cardsSemMovimentacao: cards.filter((c) => c.inativo).length,
    proximosVencimentos: cards.filter((c) => {
      const cat = slaCategoriaPipeline(c);
      return cat === 'atencao_outros' || cat === 'vence_hoje';
    }).length,
    funisAtivos: funis.size,
    chamadosComTrava,
    cardsPorFunil: [...porFunil.entries()]
      .map(([kanbanId, meta]) => ({
        kanbanId,
        kanbanNome: meta.kanbanNome,
        total: meta.total,
      }))
      .sort((a, b) => a.kanbanNome.localeCompare(b.kanbanNome, 'pt-BR')),
  };
}

export function sortCardsFunilPrioridade(cards: PipelineCardDisplay[]): PipelineCardDisplay[] {
  return [...cards].sort((a, b) => {
    const aAtr = slaCategoriaPipeline(a) === 'atrasado' ? 1 : 0;
    const bAtr = slaCategoriaPipeline(b) === 'atrasado' ? 1 : 0;
    if (bAtr !== aAtr) return bAtr - aAtr;
    if (aAtr && bAtr) {
      const d = calcularDiasNaFase(b) - calcularDiasNaFase(a);
      if (d !== 0) return d;
    }
    const dKanban = a.kanban_nome.localeCompare(b.kanban_nome, 'pt-BR');
    if (dKanban !== 0) return dKanban;
    return (b.fase_ordem ?? 0) - (a.fase_ordem ?? 0);
  });
}

export function montarGruposFunilUnidade(cards: PipelineCardDisplay[]): PipelineFunilGrupoUnidade[] {
  const porFunil = new Map<string, PipelineCardDisplay[]>();
  const nomes = new Map<string, string>();

  for (const c of cards) {
    nomes.set(c.kanban_id, c.kanban_nome);
    const list = porFunil.get(c.kanban_id) ?? [];
    list.push(c);
    porFunil.set(c.kanban_id, list);
  }

  return [...porFunil.entries()]
    .map(([kanbanId, list]) => {
      const sorted = sortCardsFunilPrioridade(list);
      const temAtrasado = sorted.some((c) => slaCategoriaPipeline(c) === 'atrasado');
      return {
        kanbanId,
        kanbanNome: nomes.get(kanbanId) ?? kanbanId,
        cards: sorted,
        defaultExpanded: temAtrasado || sorted.some((c) => c.inativo),
      };
    })
    .sort((a, b) => a.kanbanNome.localeCompare(b.kanbanNome, 'pt-BR'));
}

function cardPorId(cards: PipelineCardDisplay[]): Map<string, PipelineCardDisplay> {
  return new Map(cards.map((c) => [c.id, c]));
}

export function montarOQueFazerHoje(
  cards: PipelineCardDisplay[],
  chamados: PainelChamadoUnificadoDTO[] = [],
): PipelineOQueFazerItem[] {
  const byId = cardPorId(cards);
  const cardIds = new Set(cards.map((c) => c.id));
  const items: PipelineOQueFazerItem[] = [];
  const seen = new Set<string>();

  const push = (item: PipelineOQueFazerItem, dedupeKey: string) => {
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    items.push(item);
  };

  for (const ch of chamados) {
    if (!cardIds.has(ch.cardId)) continue;
    const card = byId.get(ch.cardId);
    if (!card) continue;
    const href = hrefAbrirCardKanban(card.kanban_nome, card.id);
    if (ch.trava && ch.aberto) {
      push(
        {
          cardId: card.id,
          titulo: card.titulo,
          fase: card.fase_nome,
          kanbanNome: card.kanban_nome,
          acao: 'Resolver chamado com trava',
          prioridade: 1000,
          href,
        },
        `trava-${ch.dedupeKey}`,
      );
    }
  }

  for (const card of cards) {
    if (slaCategoriaPipeline(card) !== 'atrasado') continue;
    push(
      {
        cardId: card.id,
        titulo: card.titulo,
        fase: card.fase_nome,
        kanbanNome: card.kanban_nome,
        acao: `SLA atrasado há ${calcularDiasNaFase(card)} dias na fase`,
        prioridade: 800 + calcularDiasNaFase(card),
        href: hrefAbrirCardKanban(card.kanban_nome, card.id),
      },
      `atrasado-${card.id}`,
    );
  }

  for (const card of cards) {
    if (card.diasSemMovimento < INATIVIDADE_O_QUE_FAZER_DIAS) continue;
    push(
      {
        cardId: card.id,
        titulo: card.titulo,
        fase: card.fase_nome,
        kanbanNome: card.kanban_nome,
        acao: `Sem movimentação há ${card.diasSemMovimento} dias`,
        prioridade: 600 + card.diasSemMovimento,
        href: hrefAbrirCardKanban(card.kanban_nome, card.id),
      },
      `inativo-${card.id}`,
    );
  }

  for (const ch of chamados) {
    if (!ch.vencido || !ch.aberto || !cardIds.has(ch.cardId)) continue;
    const card = byId.get(ch.cardId);
    if (!card) continue;
    push(
      {
        cardId: card.id,
        titulo: card.titulo,
        fase: card.fase_nome,
        kanbanNome: card.kanban_nome,
        acao: 'Chamado vencido — atualizar ou concluir',
        prioridade: 700,
        href: hrefAbrirCardKanban(card.kanban_nome, card.id),
      },
      `vencido-${ch.dedupeKey}`,
    );
  }

  return items.sort((a, b) => b.prioridade - a.prioridade).slice(0, MAX_O_QUE_FAZER);
}

export { saudeMesUnidadePipeline };

export function metaAtingidaSaude(saude: PipelineUnidadeSaudeMes): {
  entradas: boolean;
  contratos: boolean;
} {
  return {
    entradas: saude.entradasMes >= saude.metaEntradas,
    contratos: saude.contratosMes >= saude.metaContratos,
  };
}
