'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, MessageCircle, Paperclip } from 'lucide-react';
import {
  useRef,
  useState,
  useTransition,
  useEffect,
  useCallback,
  useMemo,
  type CSSProperties,
  type DragEvent,
} from 'react';
import {
  desvincularTagCard,
} from '@/lib/actions/card-actions';
import {
  calcularSlaKanbanCard,
  creditoObraAguardandoDocumentacao,
  CLASSE_TAG_AGUARDANDO_DOCUMENTACAO,
  TAG_AGUARDANDO_DOCUMENTACAO,
  tagSlaKanbanParaExibicao,
} from '@/lib/kanban/kanban-card-sla';
import {
  moverCardKanbanDrag,
  reordenarCardKanbanDrag,
  type KanbanDnDCardOrigem,
} from '@/lib/actions/kanban-board-dnd';
import {
  flagsParalelasFromCard,
  montarChipsParalelas,
} from '@/lib/kanban/kanban-paralelas-chips';
import { KanbanParalelasChips } from './KanbanParalelasChips';
import { KanbanCardMenu } from './KanbanCardMenu';
import { KanbanSlaTag, TextoReuniaoCard } from './KanbanCardPrazoIndicadores';
import { KanbanCardBoardTags } from './KanbanCardBoardTags';
import { ResponsavelFaseAvatar } from './ResponsavelFaseAvatar';
import { indicadorDataKanban } from '@/lib/kanban/kanban-card-datas';
import { isKanbanTagEspecialNome } from '@/lib/kanban/kanban-tag-especial';
import { rotuloUnidadeSla } from '@/lib/dias-uteis';
import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  deveExibirModalJustificativaSla,
  justificativaSlaObrigatoria,
} from '@/lib/kanban/kanban-sla-justificativa';
import { obterJustificativaSlaFase } from '@/lib/actions/kanban-sla-justificativa';
import { KanbanSlaJustificativaModal } from './KanbanSlaJustificativaModal';
import { fundingTipoBadgeClass } from '@/lib/kanban/funding-card-fields';
import { ProximaAtividadeDot } from './ProximaAtividadeDot';
import type { KanbanCardBrief, KanbanFase } from './types';

export type KanbanColumnProps = {
  fase: KanbanFase;
  cards: KanbanCardBrief[];
  /** Coluna tinha cards no pool atual, mas nenhum passou nos filtros do board. */
  listaVaziaPorFiltro?: boolean;
  /** Ex.: `/funil-stepone` — abre o modal com `?card=` */
  basePath: string;
  /** Query param do card (padrão `card`). */
  cardQueryParam?: string;
  userRole: string;
  /** Cor da faixa superior da coluna (CSS). */
  columnAccent?: string;
  kanbanId: string;
  kanbanNome?: string;
  /** Ordem mínima da fase Hipóteses (Step One). */
  hipotesesOrdemMin?: number | null;
  /** Habilita arrastar cards entre fases e reordenar na coluna. */
  dragEnabled?: boolean;
  /** Fases ativas do funil ordenadas por `ordem` — usado para o menu «Avançar fase». */
  fasesFunil?: KanbanFase[];
  /** Contagem de comentários por card_id — quando fornecido, exibe balão no card. */
  comentariosCountPorCard?: Record<string, number>;
  /** Contagem de anexos Sirene por card_id — quando fornecido, exibe badge no card. */
  anexosCountPorCard?: Record<string, number>;
  /** Última fase ativa do funil (header com tom distinto). */
  isUltimaFaseAtiva?: boolean;
  /** Botão «Adicionar card» no rodapé da coluna (primeira fase). */
  exibirAdicionarCard?: boolean;
  /** Href do modal de novo card (`?novo=true`). */
  novoCardHref?: string;
};

type DragPayload = {
  cardId: string;
  fromFaseId: string;
  fromFaseSlug: string;
  fromFaseNome?: string;
  fromFaseOrdem?: number;
  origem: KanbanDnDCardOrigem;
  kanbanId?: string;
  created_at?: string;
  entered_fase_at?: string | null;
  sla_iniciado_em?: string | null;
  alvara_url?: string | null;
  docs_terreno_url?: string | null;
  fromFaseSlaDias?: number | null;
  fromFaseSlaTipo?: 'uteis' | 'corridos' | null;
};

type SlaModalPendente = {
  payload: DragPayload;
  beforeCardId: string | null;
  faseOrigemNome: string;
  faseDestinoNome: string;
  justificativaExistente: string | null;
  obrigatoria: boolean;
};

function hrefAbrirCard(
  basePath: string,
  cardId: string,
  param: string,
  origem?: KanbanCardBrief['origem'],
) {
  const [path, qs] = basePath.split('?');
  const sp = new URLSearchParams(qs ?? '');
  sp.delete('tab');
  sp.set(param, cardId);
  if (origem === 'legado') {
    sp.set('origem', 'legado');
  } else {
    sp.delete('origem');
  }
  const tail = sp.toString();
  return tail ? `${path}?${tail}` : `${path}?${param}=${encodeURIComponent(cardId)}`;
}

function cardArquivadoVisual(card: KanbanCardBrief): boolean {
  return card.origem !== 'legado' && Boolean(card.arquivado);
}

function cardConcluidoVisual(card: KanbanCardBrief): boolean {
  return card.origem !== 'legado' && Boolean(card.concluido);
}

/**
 * Separa o código FK#### (quando presente) do restante do título do card.
 * Só divide quando o título começa com `FK<dígitos>` seguido de traço — títulos
 * sem esse padrão são mantidos íntegros.
 */
function separarCodigoTitulo(titulo: string): { codigo: string | null; tituloLimpo: string } {
  const t = String(titulo ?? '').trim();
  const m = t.match(/^(FK\d+)\s*[-–—]\s*(.+)$/i);
  if (m && m[1] && m[2]) {
    return { codigo: m[1].toUpperCase(), tituloLimpo: m[2].trim() };
  }
  return { codigo: null, tituloLimpo: t };
}

function parseDragPayload(raw: string): DragPayload | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<DragPayload>;
    const cardId = String(data.cardId ?? '').trim();
    const fromFaseId = String(data.fromFaseId ?? '').trim();
    if (!cardId || !fromFaseId) return null;
    return {
      cardId,
      fromFaseId,
      fromFaseSlug: String(data.fromFaseSlug ?? '').trim(),
      fromFaseNome: data.fromFaseNome != null ? String(data.fromFaseNome) : undefined,
      fromFaseOrdem: data.fromFaseOrdem != null ? Number(data.fromFaseOrdem) : undefined,
      origem: data.origem === 'legado' ? 'legado' : 'nativo',
      kanbanId: data.kanbanId != null ? String(data.kanbanId) : undefined,
      created_at: data.created_at != null ? String(data.created_at) : undefined,
      entered_fase_at: data.entered_fase_at ?? null,
      sla_iniciado_em: data.sla_iniciado_em ?? null,
      alvara_url: data.alvara_url ?? null,
      docs_terreno_url: data.docs_terreno_url ?? null,
      fromFaseSlaDias: data.fromFaseSlaDias ?? null,
      fromFaseSlaTipo: data.fromFaseSlaTipo ?? null,
    };
  } catch {
    return null;
  }
}

export function KanbanColumn({
  fase,
  cards,
  listaVaziaPorFiltro = false,
  basePath,
  cardQueryParam = 'card',
  userRole: _userRole,
  columnAccent = 'var(--moni-kanban-stepone)',
  kanbanId,
  kanbanNome,
  hipotesesOrdemMin = null,
  dragEnabled = false,
  fasesFunil = [],
  isUltimaFaseAtiva = false,
  exibirAdicionarCard = false,
  novoCardHref = '',
  comentariosCountPorCard,
  anexosCountPorCard,
}: KanbanColumnProps) {
  const faseSlug = fase.slug?.trim() ?? '';
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const suppressClickRef = useRef(false);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragInsertBefore, setDragInsertBefore] = useState(true);
  const [columnDragOver, setColumnDragOver] = useState(false);
  const [tagsRemovidas, setTagsRemovidas] = useState<Set<string>>(() => new Set());
  const [slaModalPendente, setSlaModalPendente] = useState<SlaModalPendente | null>(null);
  const [slaJustificativaDraft, setSlaJustificativaDraft] = useState('');

  useEffect(() => {
    setTagsRemovidas(new Set());
  }, [cards]);

  const removerTagDoCard = useCallback(
    (cardTagId: string) => {
      const id = cardTagId.trim();
      if (!id) return;
      setTagsRemovidas((prev) => new Set(prev).add(id));
      startTransition(async () => {
        const res = await desvincularTagCard(id, basePath);
        if (!res.ok) {
          setTagsRemovidas((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          window.alert(`Não foi possível remover a tag: ${res.error}`);
          return;
        }
        router.refresh();
      });
    },
    [basePath, router],
  );

  const tagsVisiveisCard = useCallback(
    (card: KanbanCardBrief) =>
      (card.tagsCard ?? []).filter((t) => t.id && !tagsRemovidas.has(t.id)),
    [tagsRemovidas],
  );

  const dndAtivo = dragEnabled && !pending;
  const isDivify = kanbanId === KANBAN_IDS.MONI_CAPITAL;

  const proximaFaseFunil = useMemo(() => {
    const candidatas = (fasesFunil ?? [])
      .filter((f) => f.ativo !== false && f.ordem > fase.ordem)
      .sort((a, b) => a.ordem - b.ordem);
    const prox = candidatas[0];
    return prox ? { id: prox.id, nome: prox.nome } : null;
  }, [fasesFunil, fase.ordem]);
  const isFunding = kanbanId === KANBAN_IDS.FUNDING || isDivify;

  const abrirCard = (card: KanbanCardBrief) => {
    if (suppressClickRef.current) return;
    router.push(hrefAbrirCard(basePath, card.id, cardQueryParam, card.origem));
  };

  const handleDragOverColumn = (e: DragEvent<HTMLDivElement>) => {
    if (!dndAtivo) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setColumnDragOver(true);
  };

  const handleDragLeaveColumn = (e: DragEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setColumnDragOver(false);
    setDragOverCardId(null);
  };

  const handleCardDragOver = (e: DragEvent<HTMLElement>, cardId: string) => {
    if (!dndAtivo) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOverCardId(cardId);
    setDragInsertBefore(e.clientY < rect.top + rect.height / 2);
    setColumnDragOver(true);
  };

  const executarMovimentoEntreFases = (
    payload: DragPayload,
    beforeCardId: string | null,
    justificativaSla?: string,
  ) => {
    startTransition(() => {
      void (async () => {
        const origem = payload.origem;
        let motivoParalisado: string | undefined;
        const destSlug = (faseSlug || '').trim();
        if (destSlug === FASE_SLUGS.ACOPLAMENTO_REPROVADO && basePath.includes('funil-acoplamento')) {
          const motivo = window.prompt(
            'Informe o motivo da paralisação antes de mover o card para Paralisados:',
          );
          if (motivo == null) return;
          const m = motivo.trim();
          if (!m) {
            alert('Informe o motivo da paralisação.');
            return;
          }
          motivoParalisado = m;
        }
        const resMove = await moverCardKanbanDrag({
          cardId: payload.cardId,
          toFaseId: fase.id,
          toFaseSlug: faseSlug || null,
          fromFaseSlug: payload.fromFaseSlug || null,
          origem,
          basePath,
          kanbanNome: typeof kanbanNome === 'string' ? kanbanNome : undefined,
          motivoReprovacaoAcoplamento: motivoParalisado,
          justificativaSlaQuebra: justificativaSla,
        });
        if (!resMove.ok) {
          alert(resMove.error ?? 'Não foi possível mover o card.');
          return;
        }
        if (beforeCardId && beforeCardId !== payload.cardId) {
          const resOrd = await reordenarCardKanbanDrag({
            cardId: payload.cardId,
            faseId: fase.id,
            faseSlug: faseSlug || null,
            beforeCardId,
            origem,
            basePath,
          });
          if (!resOrd.ok) {
            alert(resOrd.error ?? 'Card movido, mas não foi possível definir a posição.');
            router.refresh();
            return;
          }
        }
        router.refresh();
      })();
    });
  };

  const executarDrop = (payload: DragPayload, beforeCardId: string | null) => {
    const origem = payload.origem;
    const mesmaFase = payload.fromFaseId === fase.id;

    if (mesmaFase) {
      startTransition(() => {
        void (async () => {
          if (beforeCardId === payload.cardId) return;
          const res = await reordenarCardKanbanDrag({
            cardId: payload.cardId,
            faseId: fase.id,
            faseSlug: faseSlug || null,
            beforeCardId,
            origem,
            basePath,
          });
          if (!res.ok) {
            alert(res.error ?? 'Não foi possível reordenar o card.');
            return;
          }
          router.refresh();
        })();
      });
      return;
    }

    const fromOrdem = payload.fromFaseOrdem ?? 0;
    const movimentoPosterior = fase.ordem > fromOrdem;
    const fromSlug = (payload.fromFaseSlug || '').trim();

    if (origem === 'nativo' && movimentoPosterior && payload.created_at) {
      const slaOrigem = calcularSlaKanbanCard({
        created_at: payload.created_at,
        entered_fase_at: payload.entered_fase_at,
        sla_iniciado_em: payload.sla_iniciado_em,
        faseSlug: fromSlug,
        alvara_url: payload.alvara_url,
        docs_terreno_url: payload.docs_terreno_url,
        sla_dias: payload.fromFaseSlaDias ?? null,
        sla_tipo: payload.fromFaseSlaTipo ?? null,
      });
      if (
        deveExibirModalJustificativaSla({
          slaStatus: slaOrigem.status,
          sla_dias: payload.fromFaseSlaDias ?? null,
          movimentoPosterior,
        })
      ) {
        void (async () => {
          const res = await obterJustificativaSlaFase(payload.cardId, payload.fromFaseId);
          const justificativaExistente = res.ok ? res.justificativa : null;
          setSlaJustificativaDraft('');
          setSlaModalPendente({
            payload,
            beforeCardId,
            faseOrigemNome: payload.fromFaseNome?.trim() || fromSlug || 'atual',
            faseDestinoNome: fase.nome,
            justificativaExistente,
            obrigatoria: justificativaSlaObrigatoria(justificativaExistente),
          });
        })();
        return;
      }
    }

    executarMovimentoEntreFases(payload, beforeCardId);
  };

  const confirmarJustificativaSlaDrop = () => {
    if (!slaModalPendente) return;
    const { payload, beforeCardId, justificativaExistente, obrigatoria } = slaModalPendente;
    const complemento = slaJustificativaDraft.trim();
    if (obrigatoria && !complemento) {
      alert('Informe a justificativa da quebra de SLA.');
      return;
    }
    const textoFinal = obrigatoria
      ? complemento
      : complemento
        ? [justificativaExistente, complemento].filter(Boolean).join('\n\n')
        : undefined;
    const pendente = slaModalPendente;
    setSlaModalPendente(null);
    setSlaJustificativaDraft('');
    executarMovimentoEntreFases(pendente.payload, pendente.beforeCardId, textoFinal);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, beforeCardId: string | null) => {
    if (!dndAtivo) return;
    e.preventDefault();
    e.stopPropagation();
    setColumnDragOver(false);
    setDragOverCardId(null);

    const payload = parseDragPayload(e.dataTransfer.getData('application/json'));
    if (!payload) return;
    executarDrop(payload, beforeCardId);
  };


  const columnStyle = {
    ['--moni-kanban-col-accent' as string]: columnAccent,
  } as CSSProperties;

  return (
    <>
    <div
      className={`moni-kanban-column${isUltimaFaseAtiva ? ' moni-kanban-column--fin' : ''}${columnDragOver && dndAtivo ? ' moni-kanban-column--drag-over' : ''}`}
      style={columnStyle}
    >
      <div
        className={`moni-kanban-column-hd ${isUltimaFaseAtiva ? 'moni-kanban-column-hd--fin' : ''}`}
      >
        <div className="moni-kanban-column-hd-top">
          <div className="moni-kanban-column-hd-text">
            <h2 className="moni-kanban-column-title">
              {fase.nome} ({cards.length})
            </h2>
          </div>
          <div className="moni-kanban-column-hd-actions">
            {fase.sla_dias ? (
              <span className="moni-kanban-col-sla">
                {fase.sla_dias}d {rotuloUnidadeSla(fase.sla_tipo)}
              </span>
            ) : null}
            <button
              type="button"
              className="moni-kanban-col-sort"
              aria-hidden
              tabIndex={-1}
              title="Ordenação da coluna"
            >
              <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div
        className="moni-kanban-column-body"
        onDragOver={handleDragOverColumn}
        onDragLeave={handleDragLeaveColumn}
        onDrop={(e) => handleDrop(e, null)}
      >
        {cards.map((card, i) => {
          const faseSlugCard = fase.slug ?? '';
          const aguardandoDoc =
            card.origem !== 'legado' &&
            creditoObraAguardandoDocumentacao({
              faseSlug: faseSlugCard,
              alvara_url: card.alvara_url,
              docs_terreno_url: card.docs_terreno_url,
            });
          const sla = calcularSlaKanbanCard({
            created_at: card.created_at,
            entered_fase_at: card.entered_fase_at,
            sla_iniciado_em: card.sla_iniciado_em,
            faseSlug: faseSlugCard,
            alvara_url: card.alvara_url,
            docs_terreno_url: card.docs_terreno_url,
            sla_dias: fase.sla_dias,
            sla_tipo: fase.sla_tipo,
          });
          const arquivado = cardArquivadoVisual(card);
          const concluido = cardConcluidoVisual(card);
          // Faixa lateral vermelha só com SLA estourado; demais ficam cinza discreto.
          const slaAtrasado = !arquivado && !concluido && sla.status === 'atrasado';
          const statusLateral = slaAtrasado ? 'vermelho' : 'cinza';
          const motivo = (card.motivo_arquivamento ?? '').trim();
          const responsavelNome = card.responsavel_fase_nome?.trim() || '';
          const hasAvatar = Boolean(responsavelNome);
          const hasBadge = arquivado || concluido;
          const podeArrastar = dndAtivo;
          const insertBeforeThis =
            dragOverCardId === card.id && dragInsertBefore && dndAtivo;
          // Header: FK · franqueado (profiles). Subtítulo = linha extra (ex.: interlocutor loteadores).
          const franqueadoNome = card.profiles?.full_name?.trim() || '';
          const subtituloCard = card.subtitulo?.trim() || '';
          const mostrarSubtitulo =
            Boolean(subtituloCard) &&
            subtituloCard !== franqueadoNome &&
            subtituloCard !== responsavelNome;
          const { codigo: codigoCard, tituloLimpo } = separarCodigoTitulo(card.titulo);
          const slaChip =
            !arquivado && !concluido && !aguardandoDoc ? tagSlaKanbanParaExibicao(sla) : null;
          const reuniaoIso =
            !arquivado && !concluido && card.data_reuniao
              ? String(card.data_reuniao)
              : '';
          const temReuniao = Boolean(
            reuniaoIso && indicadorDataKanban('reuniao', reuniaoIso),
          );

          const chipsParalelas = montarChipsParalelas(
            {
              kanbanId,
              faseSlug,
              faseNome: fase.nome,
              faseOrdem: fase.ordem,
              hipotesesOrdemMin,
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

          const qtdComentarios = comentariosCountPorCard?.[card.id] ?? 0;
          const qtdAnexos = anexosCountPorCard?.[card.id] ?? 0;
          const temContadores = qtdComentarios > 0 || qtdAnexos > 0;
          const temParalelas = chipsParalelas.length > 0;
          const tagsDoCard = tagsVisiveisCard(card);
          const temTagsChip = tagsDoCard.some((t) => !isKanbanTagEspecialNome(t.nome));
          const temEspecial = tagsDoCard.some((t) => isKanbanTagEspecialNome(t.nome));
          const temChipsRow =
            temTagsChip || (!arquivado && !concluido && aguardandoDoc) || Boolean(slaChip);
          const temProximaAtividade = !arquivado && !concluido;
          const semProximaAtividade = !String(card.proxima_atividade ?? '').trim();
          const proxDotEsquerda = temProximaAtividade && !semProximaAtividade;
          const proxAlertaDireita = temProximaAtividade && semProximaAtividade;

          return (
            <div key={card.id} className="moni-kanban-card-wrap">
              {insertBeforeThis ? <div aria-hidden className="moni-kanban-card-drop-line" /> : null}
              <div
                draggable={podeArrastar}
                onDragStart={(e) => {
                  if (!podeArrastar) {
                    e.preventDefault();
                    return;
                  }
                  suppressClickRef.current = true;
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({
                      cardId: card.id,
                      fromFaseId: fase.id,
                      fromFaseSlug: faseSlug,
                      fromFaseNome: fase.nome,
                      fromFaseOrdem: fase.ordem,
                      origem: card.origem === 'legado' ? 'legado' : 'nativo',
                      kanbanId: card.kanban_id ?? kanbanId,
                      created_at: card.created_at,
                      entered_fase_at: card.entered_fase_at ?? null,
                      sla_iniciado_em: card.sla_iniciado_em ?? null,
                      alvara_url: card.alvara_url ?? null,
                      docs_terreno_url: card.docs_terreno_url ?? null,
                      fromFaseSlaDias: fase.sla_dias ?? null,
                      fromFaseSlaTipo: fase.sla_tipo ?? null,
                    } satisfies DragPayload),
                  );
                }}
                onDragEnd={() => {
                  setColumnDragOver(false);
                  setDragOverCardId(null);
                  window.setTimeout(() => {
                    suppressClickRef.current = false;
                  }, 0);
                }}
                onDragOver={(e) => handleCardDragOver(e, card.id)}
                onDrop={(e) => {
                  if (!dndAtivo) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setColumnDragOver(false);
                  setDragOverCardId(null);
                  const payload = parseDragPayload(e.dataTransfer.getData('application/json'));
                  if (!payload) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const before = e.clientY < rect.top + rect.height / 2;
                  const beforeCardId = before ? card.id : cards[i + 1]?.id ?? null;
                  executarDrop(payload, beforeCardId);
                }}
                className={[
                  'moni-kanban-card',
                  'moni-kanban-card--v5',
                  `moni-kanban-card--status-${statusLateral}`,
                  slaAtrasado ? 'moni-kanban-card--sla-atrasado' : '',
                  arquivado ? 'moni-kanban-card--archived' : '',
                  concluido ? 'moni-kanban-card--done' : '',
                  arquivado || concluido ? 'moni-kanban-card--muted' : '',
                  pending ? 'moni-kanban-card--pending' : '',
                  podeArrastar ? 'moni-kanban-card--draggable' : '',
                  dragOverCardId === card.id && !dragInsertBefore && dndAtivo
                    ? 'moni-kanban-card--drag-target'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-card-title-v5="1"
              >
                <button
                  type="button"
                  onClick={() => abrirCard(card)}
                  className="moni-kanban-card-open"
                >
                  {/* 1. Header: FK · franqueado | avatar do responsável */}
                  {codigoCard || franqueadoNome || hasBadge || hasAvatar ? (
                    <div className="moni-kanban-card-header">
                      <div className="moni-kanban-card-header-meta">
                        {codigoCard ? (
                          <span className="moni-kanban-card-codigo">{codigoCard}</span>
                        ) : null}
                        {codigoCard && franqueadoNome ? (
                          <span className="moni-kanban-card-header-sep" aria-hidden>
                            ·
                          </span>
                        ) : null}
                        {franqueadoNome ? (
                          <span className="moni-kanban-card-franqueado">{franqueadoNome}</span>
                        ) : null}
                      </div>
                      {hasBadge || hasAvatar ? (
                        <div className="moni-kanban-card-header-end">
                          {arquivado ? (
                            <span className="moni-kanban-card-status-badge moni-kanban-card-status-badge--archived">
                              ARQUIVADO
                            </span>
                          ) : concluido ? (
                            <span className="moni-kanban-card-status-badge moni-kanban-card-status-badge--done">
                              CONCLUÍDO
                            </span>
                          ) : null}
                          <ResponsavelFaseAvatar nome={responsavelNome} size="md" />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* 2. Título — ★ Especial à esquerda quando houver a tag */}
                  <div className="moni-kanban-card-title-row">
                    {temEspecial ? (
                      <span className="moni-kanban-card-title-star" title="Especial" aria-label="Especial">
                        ★
                      </span>
                    ) : null}
                    <span
                      className="moni-kanban-card-title moni-kanban-card-title--neutral"
                      data-card-title-v5="1"
                    >
                      {tituloLimpo}
                    </span>
                  </div>
                  {(() => {
                    const fundingBadgeCls = fundingTipoBadgeClass(card.funding_tipo);
                    return fundingBadgeCls ? (
                      <span className={`moni-kanban-card-funding ${fundingBadgeCls}`}>
                        {card.funding_tipo}
                      </span>
                    ) : null;
                  })()}
                  {mostrarSubtitulo ? (
                    <p className="moni-kanban-card-subtitle">{subtituloCard}</p>
                  ) : null}
                  {arquivado && motivo ? (
                    <p className="moni-kanban-card-section-value line-clamp-2">{motivo}</p>
                  ) : null}

                  {/* 3. Tags de conteúdo + SLA (chips) — Especial não entra aqui */}
                  {temChipsRow ? (
                    <div className="moni-kanban-card-chips-row">
                      <KanbanCardBoardTags
                        tags={tagsDoCard}
                        modo="chips"
                        editable
                        onRemoveTag={removerTagDoCard}
                      />
                      {!arquivado && !concluido && aguardandoDoc ? (
                        <span className={CLASSE_TAG_AGUARDANDO_DOCUMENTACAO}>
                          {TAG_AGUARDANDO_DOCUMENTACAO}
                        </span>
                      ) : null}
                      {slaChip ? <KanbanSlaTag sla={sla} /> : null}
                    </div>
                  ) : null}
                </button>

                {/* 5+6. Bolinhas · reunião · menu — sempre na mesma linha */}
                <div className="moni-kanban-card-footer">
                  <div className="moni-kanban-card-footer-start">
                    {temContadores ? (
                      <div className="moni-kanban-card-counts">
                        {qtdComentarios > 0 ? (
                          <button
                            type="button"
                            onClick={() => abrirCard(card)}
                            className="moni-kanban-card-count"
                            aria-label={`${qtdComentarios} comentário(s)`}
                          >
                            <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="tabular-nums">{qtdComentarios}</span>
                          </button>
                        ) : null}
                        {qtdAnexos > 0 ? (
                          <button
                            type="button"
                            onClick={() => abrirCard(card)}
                            className="moni-kanban-card-count"
                            aria-label={`${qtdAnexos} anexo(s) Sirene`}
                          >
                            <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="tabular-nums">{qtdAnexos}</span>
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {temParalelas ? (
                      <KanbanParalelasChips chips={chipsParalelas} mode="board" />
                    ) : null}
                    {temParalelas && temReuniao ? (
                      <span className="moni-kanban-card-meta-sep" aria-hidden>
                        ·
                      </span>
                    ) : null}
                    {temReuniao ? (
                      <TextoReuniaoCard dataIso={reuniaoIso} varianteVisual="texto" />
                    ) : null}
                    {proxDotEsquerda || proxAlertaDireita ? (
                      <ProximaAtividadeDot
                        cardId={card.id}
                        proximaAtividade={card.proxima_atividade ?? null}
                        prazoAtividade={card.prazo_atividade ?? null}
                        basePath={basePath}
                      />
                    ) : null}
                  </div>
                  <div className="moni-kanban-card-footer-end">
                    <KanbanCardMenu
                      cardId={card.id}
                      origem={card.origem === 'legado' ? 'legado' : 'nativo'}
                      basePath={basePath}
                      kanbanNome={typeof kanbanNome === 'string' ? kanbanNome : undefined}
                      proximaFase={proximaFaseFunil}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {cards.length === 0 ? (
          <p className="moni-kanban-column-empty">
            {listaVaziaPorFiltro ? 'Nenhum card com os filtros atuais' : 'Nenhum card'}
          </p>
        ) : null}
        {exibirAdicionarCard && novoCardHref ? (
          <Link href={novoCardHref} className="moni-kanban-add-card">
            + Adicionar card
          </Link>
        ) : null}
      </div>
    </div>
    <KanbanSlaJustificativaModal
      open={slaModalPendente != null}
      faseOrigemNome={slaModalPendente?.faseOrigemNome ?? ''}
      faseDestinoNome={slaModalPendente?.faseDestinoNome ?? ''}
      justificativaExistente={slaModalPendente?.justificativaExistente}
      obrigatoria={slaModalPendente?.obrigatoria ?? true}
      draft={slaJustificativaDraft}
      onDraftChange={setSlaJustificativaDraft}
      salvando={pending}
      onCancel={() => {
        setSlaModalPendente(null);
        setSlaJustificativaDraft('');
      }}
      onConfirm={confirmarJustificativaSlaDrop}
    />
    </>
  );
}
