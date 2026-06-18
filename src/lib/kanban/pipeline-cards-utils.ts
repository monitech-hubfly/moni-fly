import { compareRedePorNFranquia } from '@/lib/rede-franqueados';
import { excluirFranquiaDosGraficosVisaoGeral } from '@/lib/rede-visibilidade-franqueado';
import { slaKanbanCardFromPipelineRow } from '@/lib/kanban/pipeline-card-readonly';
import {
  normalizeBuscaKanbanTexto,
  textoMatchBuscaKanbanPalavras,
} from '@/components/kanban-shared/kanbanBoardFiltros';
import type {
  PipelineCardDisplay,
  PipelineCardRow,
  PipelineCardsFiltros,
  PipelineCardsGrupo,
  PipelineCardsKpis,
  PipelineCardsKpisUnidade,
  PipelineFranqueadoUnidade,
  PipelineGroupBy,
} from '@/lib/kanban/pipeline-cards-types';

/** Dias sem atualização no card para sinalizar inatividade (alinhado a alertas 7d do README). */
export const PIPELINE_INATIVIDADE_DIAS = 7;

export function enriquecerPipelineCard(row: PipelineCardRow): PipelineCardDisplay {
  const sla = slaKanbanCardFromPipelineRow(row);

  const updated = new Date(row.updated_at);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  updated.setHours(0, 0, 0, 0);
  const diasSemMovimento = Number.isFinite(updated.getTime())
    ? Math.max(0, Math.floor((hoje.getTime() - updated.getTime()) / 86400000))
    : 0;

  return {
    ...row,
    sla,
    diasSemMovimento,
    inativo: diasSemMovimento >= PIPELINE_INATIVIDADE_DIAS,
  };
}

export function slaCategoriaPipeline(
  card: PipelineCardDisplay,
): 'atrasado' | 'vence_hoje' | 'atencao_outros' | 'ok' | 'pausado' {
  if (card.sla.pausado) return 'pausado';
  if (card.sla.status === 'atrasado') return 'atrasado';
  if (card.sla.label === 'Vence hoje') return 'vence_hoje';
  if (card.sla.status === 'atencao') return 'atencao_outros';
  return 'ok';
}

function textoBuscaPipelineCard(card: PipelineCardDisplay): string {
  return [
    card.titulo,
    card.kanban_nome,
    card.fase_nome,
    card.fase_slug,
    card.n_franquia,
    card.franqueado_nome,
    card.sla.label,
    card.responsavel_fase_nome ?? '',
    card.inativo ? 'inativo sem movimento' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function filtrarPipelineCards(
  cards: PipelineCardDisplay[],
  filtros: PipelineCardsFiltros,
): PipelineCardDisplay[] {
  const q = normalizeBuscaKanbanTexto(filtros.busca);
  return cards.filter((card) => {
    if (q && !textoMatchBuscaKanbanPalavras(textoBuscaPipelineCard(card), q)) return false;
    if (filtros.unidade !== 'todas' && String(card.rede_franqueado_id ?? '') !== filtros.unidade) return false;
    if (filtros.kanban !== 'todos' && card.kanban_id !== filtros.kanban) return false;
    if (filtros.fase !== 'todas' && card.fase_id !== filtros.fase) return false;
    if (filtros.responsavel !== 'todos') {
      if (filtros.responsavel === '__sem__') {
        if (String(card.responsavel_fase_id ?? card.responsavel_fase_nome ?? '').trim()) return false;
      } else if (filtros.responsavel.startsWith('nome:')) {
        const nomeFiltro = filtros.responsavel.slice(5);
        if (String(card.responsavel_fase_nome ?? '').trim() !== nomeFiltro) return false;
      } else if (String(card.responsavel_fase_id ?? '') !== filtros.responsavel) {
        return false;
      }
    }
    if (filtros.status !== 'todos') {
      const cat = slaCategoriaPipeline(card);
      if (filtros.status === 'atrasados' && cat !== 'atrasado') return false;
      if (filtros.status === 'vence_hoje' && cat !== 'vence_hoje') return false;
      if (filtros.status === 'vencendo_breve' && cat !== 'atencao_outros' && cat !== 'vence_hoje') return false;
      if (filtros.status === 'sem_movimentacao' && !card.inativo) return false;
      if (
        filtros.status === 'dentro_prazo' &&
        (cat === 'atrasado' || cat === 'vence_hoje' || cat === 'atencao_outros' || card.inativo)
      ) {
        return false;
      }
    }
    return true;
  });
}

/** KPIs consolidados — FK0000 (Casa Moní) não entra nos totais (regra da Visão geral). */
export function calcularKpisPipelineFranqueadora(cards: PipelineCardDisplay[]): PipelineCardsKpis {
  const elegiveis = cards.filter((c) => !excluirFranquiaDosGraficosVisaoGeral(c.n_franquia));
  const unidades = new Set(
    elegiveis.map((c) => String(c.rede_franqueado_id ?? '').trim()).filter(Boolean),
  );

  return {
    unidadesComCardsAtivos: unidades.size,
    cardsAtivos: elegiveis.length,
    cardsAtrasados: elegiveis.filter((c) => slaCategoriaPipeline(c) === 'atrasado').length,
    cardsSemMovimentacao: elegiveis.filter((c) => c.inativo).length,
    cardsVencendoEmBreve: elegiveis.filter((c) => {
      const cat = slaCategoriaPipeline(c);
      return cat === 'atencao_outros' || cat === 'vence_hoje';
    }).length,
  };
}

/** KPIs de uma única unidade — mesma lógica de SLA/inatividade da visão franqueadora. */
export function calcularKpisPipelineUnidade(cards: PipelineCardDisplay[]): PipelineCardsKpisUnidade {
  const porFunil = new Map<string, { kanbanNome: string; total: number }>();
  for (const card of cards) {
    const cur = porFunil.get(card.kanban_id);
    if (cur) {
      cur.total += 1;
    } else {
      porFunil.set(card.kanban_id, { kanbanNome: card.kanban_nome, total: 1 });
    }
  }

  return {
    cardsAtivos: cards.length,
    cardsAtrasados: cards.filter((c) => slaCategoriaPipeline(c) === 'atrasado').length,
    cardsSemMovimentacao: cards.filter((c) => c.inativo).length,
    proximosVencimentos: cards.filter((c) => {
      const cat = slaCategoriaPipeline(c);
      return cat === 'atencao_outros' || cat === 'vence_hoje';
    }).length,
    cardsPorFunil: [...porFunil.entries()]
      .map(([kanbanId, meta]) => ({
        kanbanId,
        kanbanNome: meta.kanbanNome,
        total: meta.total,
      }))
      .sort((a, b) => a.kanbanNome.localeCompare(b.kanbanNome, 'pt-BR')),
  };
}

export function montarGruposPipelinePorFranquia(
  franqueados: PipelineFranqueadoUnidade[],
  cards: PipelineCardDisplay[],
  incluirUnidadesVazias: boolean,
): PipelineCardsGrupo[] {
  const porRede = new Map<string, PipelineCardDisplay[]>();
  const semRede: PipelineCardDisplay[] = [];

  for (const card of cards) {
    const rid = String(card.rede_franqueado_id ?? '').trim();
    if (!rid) {
      semRede.push(card);
      continue;
    }
    const list = porRede.get(rid) ?? [];
    list.push(card);
    porRede.set(rid, list);
  }

  const sortCards = (list: PipelineCardDisplay[]) =>
    [...list].sort((a, b) => {
      const dKanban = a.kanban_nome.localeCompare(b.kanban_nome, 'pt-BR');
      if (dKanban !== 0) return dKanban;
      const dFase = (b.fase_ordem ?? 0) - (a.fase_ordem ?? 0);
      if (dFase !== 0) return dFase;
      return a.titulo.localeCompare(b.titulo, 'pt-BR');
    });

  const base = incluirUnidadesVazias
    ? [...franqueados].sort((a, b) =>
        compareRedePorNFranquia(
          { n_franquia: a.n_franquia, ordem: a.ordem, id: a.rede_franqueado_id },
          { n_franquia: b.n_franquia, ordem: b.ordem, id: b.rede_franqueado_id },
        ),
      )
    : franqueados.filter((f) => (porRede.get(f.rede_franqueado_id)?.length ?? 0) > 0);

  const grupos: PipelineCardsGrupo[] = base.map((f) => ({
    id: f.rede_franqueado_id,
    label: labelFranqueadoPipeline(f),
    cards: sortCards(porRede.get(f.rede_franqueado_id) ?? []),
  }));

  if (semRede.length > 0) {
    grupos.push({
      id: '__sem_franqueado__',
      label: 'Sem unidade vinculada',
      cards: sortCards(semRede),
    });
  }

  return grupos;
}

export function agruparPipelineCards(
  cards: PipelineCardDisplay[],
  groupBy: PipelineGroupBy,
  franqueados: PipelineFranqueadoUnidade[],
  incluirUnidadesVazias: boolean,
): PipelineCardsGrupo[] {
  if (groupBy === 'franquia') {
    return montarGruposPipelinePorFranquia(franqueados, cards, incluirUnidadesVazias);
  }

  const map = new Map<string, PipelineCardDisplay[]>();
  const push = (key: string, card: PipelineCardDisplay) => {
    const list = map.get(key) ?? [];
    list.push(card);
    map.set(key, list);
  };

  for (const card of cards) {
    if (groupBy === 'funil') {
      push(card.kanban_id, card);
    } else if (groupBy === 'fase') {
      push(card.fase_id, card);
    } else {
      push(slaCategoriaPipeline(card), card);
    }
  }

  const grupos: PipelineCardsGrupo[] = [];

  if (groupBy === 'funil') {
    const kanbanLabels = new Map(cards.map((c) => [c.kanban_id, c.kanban_nome]));
    for (const [kid, list] of map) {
      grupos.push({
        id: kid,
        label: kanbanLabels.get(kid) ?? kid,
        cards: [...list].sort((a, b) => (b.fase_ordem ?? 0) - (a.fase_ordem ?? 0)),
      });
    }
    grupos.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return grupos;
  }

  if (groupBy === 'fase') {
    const faseMeta = new Map(cards.map((c) => [c.fase_id, { nome: c.fase_nome, ordem: c.fase_ordem }]));
    for (const [fid, list] of map) {
      const meta = faseMeta.get(fid);
      grupos.push({
        id: fid,
        label: meta?.nome ?? fid,
        cards: [...list].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR')),
      });
    }
    grupos.sort((a, b) => {
      const oa = faseMeta.get(a.id)?.ordem ?? 0;
      const ob = faseMeta.get(b.id)?.ordem ?? 0;
      return ob - oa;
    });
    return grupos;
  }

  const statusLabels: Record<string, string> = {
    atrasado: 'SLA atrasado',
    vence_hoje: 'Vence hoje',
    atencao_outros: 'Atenção SLA',
    ok: 'Dentro do prazo',
    pausado: 'SLA pausado',
  };
  const ordemStatus = ['atrasado', 'vence_hoje', 'atencao_outros', 'pausado', 'ok'];
  for (const key of ordemStatus) {
    const list = map.get(key);
    if (!list?.length) continue;
    grupos.push({
      id: key,
      label: statusLabels[key] ?? key,
      cards: [...list].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR')),
    });
  }
  return grupos;
}

export function labelFranqueadoPipeline(f: PipelineFranqueadoUnidade): string {
  const fk = String(f.n_franquia ?? '').trim();
  const nome = String(f.franqueado_nome ?? '').trim();
  if (fk && nome) return `${fk} — ${nome}`;
  return fk || nome || '—';
}
