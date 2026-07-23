import { formatDataPtBr, indicadorDataKanban } from '@/lib/kanban/kanban-card-datas';
import {
  calcularSlaKanbanCard,
  creditoObraAguardandoDocumentacao,
  TAG_AGUARDANDO_DOCUMENTACAO,
  tagSlaKanbanParaExibicao,
} from '@/lib/kanban/kanban-card-sla';
import {
  flagsParalelasFromCard,
  montarChipsParalelas,
} from '@/lib/kanban/kanban-paralelas-chips';
import { isKanbanTagEspecialNome } from '@/lib/kanban/kanban-tag-especial';
import type { KanbanCardBrief, KanbanFase } from './types';

export type KanbanCardBuscaBoardContext = {
  kanbanId: string;
  fase?: KanbanFase | null;
  hipotesesOrdemMin?: number | null;
};

export type KanbanBoardFiltrosStatus = 'ativos' | 'arquivados' | 'concluidos';
export type KanbanBoardFiltrosSla = 'todos' | 'atrasados' | 'vence_hoje' | 'dentro_prazo';

export type KanbanBoardFiltros = {
  /** `todas` ou id da fase */
  fase: 'todas' | string;
  responsavel: 'todos' | 'eu' | string;
  sla: KanbanBoardFiltrosSla;
  status: KanbanBoardFiltrosStatus;
};

export const KANBAN_BOARD_FILTROS_DEFAULT: KanbanBoardFiltros = {
  fase: 'todas',
  responsavel: 'todos',
  sla: 'todos',
  status: 'ativos',
};

export function countKanbanBoardFiltrosAtivos(f: KanbanBoardFiltros): number {
  const d = KANBAN_BOARD_FILTROS_DEFAULT;
  let n = 0;
  if (f.fase !== d.fase) n++;
  if (f.responsavel !== d.responsavel) n++;
  if (f.sla !== d.sla) n++;
  if (f.status !== d.status) n++;
  return n;
}

function isCardArquivado(c: KanbanCardBrief): boolean {
  return c.origem !== 'legado' && Boolean(c.arquivado);
}

function isCardConcluido(c: KanbanCardBrief): boolean {
  return c.origem !== 'legado' && Boolean(c.concluido);
}

/** Pool visível conforme STATUS (antes dos filtros de busca / fase / responsável / SLA). */
export function poolCardsPorStatus(
  status: KanbanBoardFiltrosStatus,
  cards: KanbanCardBrief[],
  cardsConcluidos: KanbanCardBrief[],
): KanbanCardBrief[] {
  if (status === 'arquivados') return cards.filter((c) => isCardArquivado(c));
  if (status === 'concluidos') return cardsConcluidos;
  return cards.filter((c) => {
    if (c.origem === 'legado') return true;
    return !c.arquivado && !c.concluido;
  });
}

function slaCategoria(
  card: KanbanCardBrief,
  faseMap: Map<string, KanbanFase>,
): 'atrasado' | 'vence_hoje' | 'atencao_outros' | 'ok' {
  const fase = faseMap.get(card.fase_id);
  const sla = calcularSlaKanbanCard({
    created_at: card.created_at,
    entered_fase_at: card.entered_fase_at,
    sla_iniciado_em: card.sla_iniciado_em,
    faseSlug: fase?.slug,
    alvara_url: card.alvara_url,
    docs_terreno_url: card.docs_terreno_url,
    sla_dias: fase?.sla_dias,
    sla_tipo: fase?.sla_tipo,
  });
  if (sla.status === 'atrasado') return 'atrasado';
  if (sla.label === 'Vence hoje') return 'vence_hoje';
  if (sla.status === 'atencao') return 'atencao_outros';
  return 'ok';
}

export function normalizeBuscaKanbanTexto(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/** Qualquer token da busca que apareça no texto (sem acento, case-insensitive). */
export function textoMatchBuscaKanbanPalavras(texto: string, query: string): boolean {
  const q = normalizeBuscaKanbanTexto(query);
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const textoNorm = normalizeBuscaKanbanTexto(texto ?? '');
  const palavras = textoNorm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return tokens.some(
    (token) => textoNorm.includes(token) || palavras.some((palavra) => palavra.includes(token)),
  );
}

function labelDataCardKanbanBusca(dataIso: string): string {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(`${dataIso}T00:00:00`);
  const diffDias = Math.floor((data.getTime() - hoje.getTime()) / 86400000);
  if (diffDias < 0) return `Atrasado ${Math.abs(diffDias)}d`;
  if (diffDias === 0) return 'Hoje';
  if (diffDias === 1) return 'Amanhã';
  return `Em ${diffDias}d`;
}

function separarCodigoTituloCardBusca(titulo: string): { codigo: string | null; tituloLimpo: string } {
  const t = String(titulo ?? '').trim();
  const m = t.match(/^(FK\d+)\s*[-–—]\s*(.+)$/i);
  if (m?.[1] && m?.[2]) {
    return { codigo: m[1].toUpperCase(), tituloLimpo: m[2].trim() };
  }
  return { codigo: null, tituloLimpo: t };
}

function labelPrazoProximaAtividadeBusca(prazo: string | null | undefined): string {
  const p = String(prazo ?? '').trim();
  if (!p) return '';
  const hoje = new Date().toISOString().slice(0, 10);
  if (p < hoje) return 'Atrasada';
  if (p === hoje) return 'Vence hoje';
  const [y, m, d] = p.split('-');
  return `${d}/${m}/${y}`;
}

function resolveKanbanCardBuscaBoardContext(
  card: KanbanCardBrief,
  ctx: KanbanCardBuscaBoardContext | KanbanFase | null | undefined,
): KanbanCardBuscaBoardContext {
  if (ctx && typeof ctx === 'object' && 'kanbanId' in ctx) return ctx;
  return {
    kanbanId: String(card.kanban_id ?? '').trim(),
    fase: (ctx as KanbanFase | null | undefined) ?? null,
  };
}

/** Texto agregado com tudo que o card fechado exibe no board (para busca). */
export function textoVisivelCardKanbanFechado(
  card: KanbanCardBrief,
  ctx: KanbanCardBuscaBoardContext | KanbanFase | null | undefined = null,
): string {
  const context = resolveKanbanCardBuscaBoardContext(card, ctx);
  const fase = context.fase ?? null;
  const faseSlug = fase?.slug?.trim() ?? '';
  const arquivado = card.origem !== 'legado' && Boolean(card.arquivado);
  const concluido = card.origem !== 'legado' && Boolean(card.concluido);
  const { codigo, tituloLimpo } = separarCodigoTituloCardBusca(card.titulo);
  const franqueadoNome = card.profiles?.full_name?.trim() ?? '';
  const responsavelNome = card.responsavel_fase_nome?.trim() ?? '';
  const subtitulo = card.subtitulo?.trim() ?? '';

  const partes: string[] = [
    card.titulo,
    codigo ?? '',
    tituloLimpo,
    franqueadoNome,
    responsavelNome,
    subtitulo,
    card.motivo_arquivamento ?? '',
  ];

  if (card.funding_tipo) partes.push(card.funding_tipo);

  if (arquivado) partes.push('ARQUIVADO');
  if (concluido) partes.push('CONCLUÍDO');

  for (const t of card.tagsCard ?? []) {
    partes.push(t.nome);
    if (isKanbanTagEspecialNome(t.nome)) partes.push('Especial');
  }

  const aguardandoDoc =
    card.origem !== 'legado' &&
    !arquivado &&
    !concluido &&
    creditoObraAguardandoDocumentacao({
      faseSlug,
      alvara_url: card.alvara_url,
      docs_terreno_url: card.docs_terreno_url,
    });
  if (aguardandoDoc) partes.push(TAG_AGUARDANDO_DOCUMENTACAO);

  const sla = calcularSlaKanbanCard({
    created_at: card.created_at,
    entered_fase_at: card.entered_fase_at,
    sla_iniciado_em: card.sla_iniciado_em,
    faseSlug,
    alvara_url: card.alvara_url,
    docs_terreno_url: card.docs_terreno_url,
    sla_dias: fase?.sla_dias,
    sla_tipo: fase?.sla_tipo,
  });

  if (!arquivado && !concluido && !aguardandoDoc) {
    const slaChip = tagSlaKanbanParaExibicao(sla);
    if (slaChip?.texto) partes.push(slaChip.texto);
    if (sla.label) partes.push(sla.label);
  }

  if (!arquivado && !concluido && card.data_reuniao) {
    const reuniaoIso = String(card.data_reuniao);
    const ind = indicadorDataKanban('reuniao', reuniaoIso);
    partes.push('Reunião', formatDataPtBr(reuniaoIso), reuniaoIso, labelDataCardKanbanBusca(reuniaoIso));
    if (ind) {
      partes.push(ind.rotuloCurto, ind.title);
    }
  }

  const proxima = String(card.proxima_atividade ?? '').trim();
  if (!arquivado && !concluido) {
    if (proxima) {
      partes.push(proxima, 'Próxima atividade');
    } else {
      partes.push('Próxima atividade não definida');
    }
    const prazoLabel = labelPrazoProximaAtividadeBusca(card.prazo_atividade);
    if (prazoLabel) {
      partes.push(prazoLabel, String(card.prazo_atividade ?? '').trim());
    }
  }

  const chipsParalelas = montarChipsParalelas(
    {
      kanbanId: context.kanbanId,
      faseSlug,
      faseNome: fase?.nome,
      faseOrdem: fase?.ordem,
      hipotesesOrdemMin: context.hipotesesOrdemMin ?? null,
      origem: card.origem,
      flags: flagsParalelasFromCard(card),
      portfolioVinculoRotulo: card.portfolio_vinculo_rotulo,
      temFilhoJuridico: card.tem_filho_juridico,
      temFilhoAcoplamento: card.tem_filho_acoplamento,
      filhoAcoplamentoArquivado: card.filho_acoplamento_arquivado,
      temFilhoOperacoes: card.tem_filho_operacoes,
      filhoOperacoesArquivado: card.filho_operacoes_arquivado,
      operacoesFilhoConcluido: card.operacoes_filho_concluido,
      operacoesFilhoFaseRotulo: card.operacoes_filho_fase_rotulo,
      juridicoFilhoFaseRotulo: card.juridico_filho_fase_nome,
      temFilhoProjetoLegal: card.tem_filho_projeto_legal,
      filhoProjetoLegalArquivado: card.filho_projeto_legal_arquivado,
      projetoLegalFilhoConcluido: card.projeto_legal_filho_concluido,
      projetoLegalFilhoFase: card.projeto_legal_filho_fase,
      temFilhoCreditoObra: card.tem_filho_credito_obra,
      filhoCreditoObraArquivado: card.filho_credito_obra_arquivado,
      creditoObraFilhoFase: card.credito_obra_filho_fase,
      temFilhoProjetosLocais: card.tem_filho_projetos_locais,
      filhoProjetosLocaisArquivado: card.filho_projetos_locais_arquivado,
      projetosLocaisFilhoFase: card.projetos_locais_filho_fase,
    },
    { labelsCompletos: false },
  );
  for (const chip of chipsParalelas) {
    partes.push(chip.label);
    if (chip.funilNome) partes.push(chip.funilNome);
    if (chip.faseNome) partes.push(chip.faseNome);
  }

  return partes.filter(Boolean).join(' ');
}

/** Busca em qualquer informação visível no card fechado do Kanban. */
export function cardKanbanMatchBuscaVisivel(
  card: KanbanCardBrief,
  query: string,
  faseMap: Map<string, KanbanFase>,
  kanbanId: string,
  hipotesesOrdemMin?: number | null,
): boolean {
  const fase = faseMap.get(card.fase_id) ?? null;
  return textoMatchBuscaKanbanPalavras(
    textoVisivelCardKanbanFechado(card, { kanbanId, fase, hipotesesOrdemMin }),
    query,
  );
}

export function cardPassaFiltrosBoard(
  card: KanbanCardBrief,
  f: KanbanBoardFiltros,
  faseMap: Map<string, KanbanFase>,
  currentUserId: string | null | undefined,
): boolean {
  if (f.fase !== 'todas' && card.fase_id !== f.fase) return false;

  if (f.responsavel === 'eu') {
    if (!currentUserId || card.franqueado_id !== currentUserId) return false;
  } else if (f.responsavel !== 'todos') {
    if (card.franqueado_id !== f.responsavel) return false;
  }

  if (f.sla !== 'todos') {
    const cat = slaCategoria(card, faseMap);
    if (f.sla === 'atrasados' && cat !== 'atrasado') return false;
    if (f.sla === 'vence_hoje' && cat !== 'vence_hoje') return false;
    if (f.sla === 'dentro_prazo' && (cat === 'atrasado' || cat === 'vence_hoje')) return false;
  }

  return true;
}
