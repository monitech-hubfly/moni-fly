'use client';

import type { ChangeEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Tag,
  CheckCircle2,
  Pencil,
  Archive,
  ArchiveRestore,
  BookOpen,
  Link2,
  FileText,
  Video,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Paperclip,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { calcularDiasUteis, formatIsoDateOnlyPtBr, parseIsoDateOnlyLocal } from '@/lib/dias-uteis';
import {
  formatMotivoArquivamento,
  isMotivoArquivamentoOutro,
  MOTIVO_ARQUIVAMENTO_OBS_MAX,
  MOTIVO_ARQUIVAMENTO_OBS_MIN,
  MOTIVOS_ARQUIVAMENTO_CATEGORIAS,
  motivoArquivamentoProntoParaEnviar,
} from '@/lib/kanban/motivos-arquivamento';
import {
  arquivarCard,
  desarquivarCard,
  arquivarInteracao,
  arquivarSubInteracao,
  atualizarStatusInteracao,
  atualizarStatusSubInteracao,
  criarTagKanban,
  criarChamadoSireneComAtividade,
  criarSubInteracao,
  desvincularTagCard,
  editarInteracao,
  editarSubInteracao,
  excluirSubInteracao,
  finalizarCard,
  moverCardParaFase,
  registrarConfirmacaoFaseOperacoes,
  registrarConfirmacaoFasePortfolio,
  verificarGatePortfolioStep5,
  listarTagsCard,
  listarTagsKanban,
  salvarDadosNegocioKanban,
  salvarDadosPreObra,
  salvarDadosPreObraOperacoes,
  salvarFranqueadoCardVinculado,
  salvarInstrucoesFase,
  obterInfoSyncGrupoCard,
  solicitarAprovacaoFase,
  uploadProcessoNegocioAnexo,
  togglePastelAtividade,
  type ProcessoNegocioAnexoCampo,
  vincularTagCard,
  verificarChecklistParaFase,
  verificarGateAcoplamentoModelagemCasa,
  verificarGateChecklistLegalPortfolio,
  gerarFormTokenCandidato,
  enviarEmailCard,
  reconciliarGboxPlanilhaMapaChecklist,
  type SubInteracaoStatusDb,
} from '@/lib/actions/card-actions';
import { enviarHipoteseAoPortfolio } from '@/lib/actions/card-actions';
import { deletarChamado } from '@/app/sirene/actions';
import { KANBANS_COM_CHAMADO_JURIDICO } from '@/lib/constants/kanban-ids';
import { isFrankOrFranqueadoRole, normalizeAccessRole } from '@/lib/authz';
import { FASE_IDS, FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  autorizarAberturaCreditoObra,
  consultarAberturaCreditoObraPendente,
  recusarAberturaCreditoObra,
} from '@/lib/actions/credito-obra-abertura-automatica';
import { garantirBastaoPassagemWayser } from '@/lib/actions/kanban-bastoes';
import { aplicarDataEnvioCreditoObraNoPreObra } from '@/lib/pre-obra/credito-obra-envio-data';
import { CreditoObraAberturaAutorizacaoModal } from './CreditoObraAberturaAutorizacaoModal';
import { isPortfolioKanbanRef, isLoteadoresKanbanRef } from '@/lib/kanban/portfolio-paralelas';
import {
  deveConfirmarSaidaFasePortfolio,
  portfolioConfirmacaoPergunta,
  type PortfolioConfirmacaoFaseTipo,
} from '@/lib/kanban/portfolio-confirmacao-fase';
import {
  deveConfirmarEntradaFaseOperacoes,
  deveConfirmarSaidaFaseOperacoes,
  operacoesConfirmacaoPergunta,
  type OperacoesConfirmacaoFaseTipo,
} from '@/lib/kanban/operacoes-confirmacao-fase';
import {
  cardLoteadoresPrecisaJustificativaSla,
} from '@/lib/kanban/loteadores-sla-justificativa';
import { salvarJustificativaSlaLoteadores } from '@/lib/actions/kanban-sla-justificativa';
import {
  enrichCardsParalelasContext,
  flagsParalelasFromCard,
  hipotesesOrdemMinima,
  montarChipsParalelas,
} from '@/lib/kanban/kanban-paralelas-chips';
import { isDadosCondominiosFaseSlug, isHipotesesFaseSlug, isPreBatalhaFaseSlug, filterStepOneCalculadoraFases } from '@/lib/kanban/stepone-fase-slugs';
import { filterOperacoesCalculadoraFases } from '@/lib/kanban/operacoes-fase-slugs';
import { filterPortfolioCalculadoraFases } from '@/lib/kanban/portfolio-fase-slugs';
import { PRE_BATALHA_INSTRUCOES_FASE, PRE_BATALHA_TEXTO_EXPLICATIVO_RANKING } from '@/lib/kanban/pre-batalha-checklist';
import { kanbanExibeSecaoCondominioSidebar } from '@/lib/kanban/kanban-secao-condominio';
import { fetchCondominioRowById } from '@/lib/condominios';
import {
  condominioPrazosSlaFromRow,
  type CondominioPrazosAprovacaoSla,
} from '@/lib/kanban/condominio-prazos-aprovacao';
import { estiloChipTagKanban } from '@/lib/kanban/kanban-tag-especial';
import { KanbanParalelasChips } from './KanbanParalelasChips';
import { KanbanCardModalCreditoObraDocumentacao } from './KanbanCardModalCreditoObraDocumentacao';
import { KanbanCardModalDadosPreObraOperacoes } from './KanbanCardModalDadosPreObraOperacoes';
import { KanbanCardModalNegocioPrazoField } from './KanbanCardModalNegocioPrazoField';
import { KanbanCardModalNegociacaoLinhasField } from './KanbanCardModalNegociacaoLinhasField';
import { KanbanCardModalMoedaField } from './KanbanCardModalMoedaField';
import {
  NEGOCIO_PRAZO_DRAFT_VAZIO,
  NEGOCIO_PRAZO_OPCAO_DRAFT_PADRAO,
  NEGOCIO_PRAZO_INSTRUMENTO_DRAFT_PADRAO,
  faseLabelFromOpcoes,
  formatNegocioPrazoDisplay,
  negocioPrazoDbPatchFromValores,
  negocioPrazoDraftFromValores,
  negocioPrazoOpcaoDraftFromProcesso,
  negocioPrazoInstrumentoDraftFromProcesso,
  negocioPrazoValoresFromDraft,
  negocioPrazoValoresFromProcessoModal,
  type FaseNegocioPrazoOpcao,
  type NegocioPrazoDraft,
} from '@/lib/kanban/dados-negocio-prazo';
import {
  negociacaoLinhasDraftFromLinhas,
  negociacaoLinhasDraftPadrao,
  negociacaoLinhasToDb,
  parseVinculoCalculadoraNegociacao,
  type NegociacaoLinha,
  type NegociacaoLinhaDraft,
} from '@/lib/kanban/negociacao-linhas';
import {
  buildOpcoesVinculoCalculadora,
  resolverDataPagamentoNegociacao,
  resolverNegociacaoLinhasCalculadora,
} from '@/lib/kanban/calculadora-negociacao';
import { montarTimelineCalculadoraComMarcos } from '@/lib/kanban/calculadora-fases-marcos';
import { moedaCampoValorInicial } from '@/lib/kanban/moeda-campo';
import { fetchFasesNegocioPrazoOpcoes } from '@/lib/kanban/fetch-kanban-fases';
import { KanbanCardModalCalculadoraFases } from './KanbanCardModalCalculadoraFases';
import {
  operacoesPreObraDraftFromCard,
  OPERACOES_PRE_OBRA_DRAFT_EMPTY,
  type OperacoesPreObraDraft,
} from '@/lib/kanban/previsibilidade-operacoes';
import {
  calcularSlaKanbanCard,
  creditoObraAguardandoDocumentacao,
  CLASSE_TAG_AGUARDANDO_DOCUMENTACAO,
  TAG_AGUARDANDO_DOCUMENTACAO,
} from '@/lib/kanban/kanban-card-sla';
import type { SubInteracaoTipoDb } from '@/types/kanban-subinteracao';
import {
  displayOrDash,
  fetchKanbanCardModalDetalhes,
  fmtMoedaKanban,
  preObraDraftFromProcesso,
  type KanbanCardModalDetalhes,
  type PreObraDraftKanban,
} from '@/lib/kanban/kanban-card-modal-detalhes';
import { KanbanCardModalEmpresas } from '@/components/kanban-shared/KanbanCardModalEmpresas';
import {
  ATIVIDADE_FORM_DRAFT_VAZIO,
  KanbanAtividadeFormFields,
  type AtividadeFormDraft,
} from './KanbanAtividadeFormFields';
import { PrazoNegociacaoPanel } from './PrazoNegociacaoPanel';
import { ConclusaoChamadoCriadorModal } from '@/components/sirene/ConclusaoChamadoCriadorModal';
import { ChamadoAtividadeCollapsibleSection } from './ChamadoAtividadeCollapsibleSection';
import { uploadAnexosAtividadePendentes } from '@/lib/kanban/upload-anexos-atividade';
import { formatChamadoNumero } from '@/lib/kanban/chamado-numero';
import { SlaTituloBolinha } from '@/components/SlaTituloBolinha';
import { SlaAtividadeBadge } from '@/components/SlaAtividadeBadge';
import { MultiSelectCheckbox } from '@/components/MultiSelectCheckbox';
import { SearchableSelect } from '@/components/SearchableSelect';
import { AtividadeVinculadaCard } from '@/components/AtividadeVinculadaCard';
import { AtividadeVinculadaIcon } from '@/components/AtividadeVinculadaIcon';
import { AtividadeVinculadaStatusPill } from '@/components/AtividadeVinculadaStatusPill';
import {
  type AtividadeVinculadaKind,
  labelKanbanAtividadeParaPill,
  resolveKanbanChamadoIconKind,
  resolveKanbanChamadoSurfaceKind,
} from '@/lib/atividade-vinculada-visual';
import type {
  CamposPorFaseMap,
  KanbanCardBrief,
  KanbanFase,
  KanbanFaseMaterial,
  KanbanNomeDisplay,
} from './types';
import { usePermissoes } from '@/lib/hooks/usePermissoes';
import { podeComFallbackStaff } from '@/lib/permissoes-types';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { KanbanCardModalRelacionamentos } from './KanbanCardModalRelacionamentos';
import {
  KanbanCardModalOperacoesTrancheVinculoForm,
  KanbanCardModalOperacoesTrancheVinculosSidebar,
} from './KanbanCardModalOperacoesTrancheVinculos';
import { KanbanCardModalCondominio } from './KanbanCardModalCondominio';
import { KanbanCardModalAtasReuniao } from './KanbanCardModalAtasReuniao';
import { KanbanCardDatasFields } from './KanbanCardDatasFields';
import { KanbanCardSlaBolinha } from './KanbanCardPrazoIndicadores';
import { MencaoContentEditable } from './MencaoContentEditable';
import { fetchKanbanFasesAtivas, augmentKanbanFasesComFasesDosCards, mapKanbanFaseRow } from '@/lib/kanban/fetch-kanban-fases';
import { loadHistoricoCardModal, loadHistoricoCalculadoraEsteira } from '@/lib/kanban/kanban-card-historico';
import {
  listarComentariosKanbanCard,
  publicarComentarioKanbanCard,
} from '@/lib/actions/kanban-comentarios';
import {
  listarAnexosComentariosKanbanCard,
  urlAssinadaAnexoComentarioKanbanCard,
  type KanbanComentarioAnexoRow,
} from '@/lib/actions/kanban-comentario-anexos';
import { uploadAnexosComentarioPendentes } from '@/lib/kanban/upload-anexos-comentario-card';
import { montarTituloCardSync, fetchContextoCalculadoraSyncGroup, type ContextoCalculadoraSyncGroup } from '@/lib/kanban/card-sync-group';
import { dataIsoInputValida } from '@/lib/kanban/kanban-card-datas';
import { AnexosAtividadeDraft } from './AnexosAtividadeDraft';
import { parseKanbanFaseMateriais } from '@/lib/kanban/parse-kanban-fase-materiais';
import { compareChamadosPainelRank } from '@/lib/sirene-painel-chamados-rank';
import {
  countKanbanModalInteracoesFiltrosAtivos,
  KanbanInteracoesFiltrosPanel,
  KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT,
  type KanbanModalInteracoesFiltros,
} from './KanbanInteracoesFiltrosPanel';
import {
  derivarChamadoKanbanComSubs,
  formatDataHoraHistorico,
  iconeHistoricoAcao,
  rotuloUsuarioHistorico,
  interacaoPassaFiltroResponsavelComSubs,
  interacaoPassaFiltroTimeComSubs,
  travaEfetivaParaChamado,
  countChamadosAbertosNoCard,
  isInteracaoDemonstracao,
  prazoEfetivoParaChamado,
  camposPrazoNegociacaoDeTopicoRow,
  prazoSlaSubInteracao,
  tagsTimesParaLinha,
  tagsTimesDeAtividades,
  textoResumidoAcaoHistorico,
  type ComentarioCardRow,
  type HistoricoItem,
  type InteracaoModal,
  type KanbanTimeRow,
  type SecaoEsquerdaId,
  type SubInteracaoModal,
  usuarioPodeMarcarPastelSubInteracao,
} from './kanban-card-modal-helpers';
import {
  filtrarSubAtividadesPorConclusao,
  isSubAtividadeConcluida,
} from '@/components/kanban-shared/SubInteracaoLista';
import { KanbanPastelariaAtividadeSection } from '@/components/kanban-shared/KanbanPastelariaAtividadeSection';
import {
  enrichResponsaveisIdsComLegadoMoni,
  filtrarOpcoesResponsaveisPorModoHdm,
  HDM_RESPONSAVEIS_TODOS_EMAILS,
  MONI_TODOS_EMAILS,
  inferirHdmResponsavelPorNomesTimes,
  ordenarLinhasTimeKanbanPorCatalogoMoni,
  resolveKanbanTimeNomeFromId,
  responsaveisFiltradosPorTimesIds,
  responsaveisFiltroOpcoesComCatalogoMoni,
  responsaveisDoTimeMoni,
  timesFiltroOpcoesComCatalogoMoni,
  timesMoniReceberChamadoOpcoes,
  validarParTimeResponsavelMoni,
} from '@/lib/times-responsaveis';
import { AnexosChamado } from './AnexosChamado';
import { AnexosSubchamado } from './AnexosSubchamado';
import { ChecklistCard } from './ChecklistCard';
import { ChecklistLegalCondominioCard } from './ChecklistLegalCondominioCard';
import { ChecklistCreditoSection } from '@/app/steps-viabilidade/ChecklistCreditoSection';
import { FaseChecklistCard } from './FaseChecklistCard';
import { ResponsavelFaseSidebar } from './ResponsavelFaseSidebar';
import { ResponsavelDaFaseSidebar } from './ResponsavelDaFaseSidebar';
import {
  RESPONSAVEL_DA_FASE_CHECKLIST_LABEL,
  RESPONSAVEL_FASE_CHECKLIST_LABEL,
  buscarResponsavelDaFaseSalvoPorFases,
  isValorResponsavelDaFaseLista,
} from '@/lib/kanban/responsavel-fase-checklist';
import { DadosLoteadorPersistentPanel } from './DadosLoteadorPersistentPanel';
import { deveExibirChecklistCreditoNaFase, deveExibirChecklistLegalNaFase } from '@/lib/checklist-legal/display';
import { calcularLinhasCalculadoraFases, calcularResumoExecutivoCalculadoraFases, calculadoraAncoraFromProcesso, aplicarEncadeamentoMarcoContratoNasLinhas, enriquecerLinhasCalculadoraComCusto, enriquecerLinhasCalculadoraComResponsavelDaFase } from '@/lib/kanban/calculadora-fases';
import {
  buscarDatasManuaisCalculadoraSyncGroup,
  limparDatasManuaisCalculadoraSyncGroup,
  salvarDataManualCalculadoraSyncGroup,
  CALCULADORA_FASE_SLUG_PROPAGA_FORWARD,
  type CalculadoraFaseDataManual,
} from '@/lib/kanban/calculadora-fase-datas';
import {
  calcularLinhasCalculadoraFasesEsteira,
  CALCULADORA_ESTEIRA_KANBAN_IDS,
  cardKanbanNaEsteiraPrincipalCalculadora,
  fetchCalculadoraEsteiraFasesMap,
  mesclarFasesKanbanAtualNoMapa,
  montarFasesFlatCalculadoraVisitas,
} from '@/lib/kanban/calculadora-fases-esteira';
import {
  buildLegadoFaseTimeline,
  buildLegadoFaseVisits,
  buildNativeFaseTimeline,
  buildNativeFaseVisits,
  type ProcessoCardMoveEvt,
} from '@/lib/kanban/kanban-card-timeline';

type Card = {
  id: string;
  titulo: string;
  status: string;
  created_at: string;
  fase_id: string;
  franqueado_id: string;
  kanban_id: string;
  /** Nativo: FK em `rede_franqueados` para dados do franqueado do negócio. */
  rede_franqueado_id?: string | null;
  nome_condominio?: string | null;
  condominio_id?: string | null;
  quadra?: string | null;
  lote?: string | null;
  /** Preenchido quando o card veio da view `v_processo_como_kanban_cards`. */
  etapa_slug?: string | null;
  /** Nativo: finalização explícita (`finalizarCard`). */
  concluido?: boolean;
  concluido_em?: string | null;
  arquivado?: boolean;
  /** FK em `projeto_negocio` — esteiras paralelas do mesmo negócio. */
  projeto_id?: string | null;
  processo_step_one_id?: string | null;
  acoplamento_concluido?: boolean;
  acoplamento_filho_fase_nome?: string | null;
  acoplamento_filho_fase_slug?: string | null;
  credito_terreno_ok?: boolean;
  contabilidade_ok?: boolean;
  capital_ok?: boolean;
  juridico_ok?: boolean;
  credito_obra_ok?: boolean;
  alvara_url?: string | null;
  docs_terreno_url?: string | null;
  sla_iniciado_em?: string | null;
  entered_fase_at?: string | null;
  sla_justificativa?: string | null;
  sla_justificativa_em?: string | null;
  opcao_assinada_em?: string | null;
  contrato_assinado_em?: string | null;
  obra_iniciada_em?: string | null;
  obra_finalizada_em?: string | null;
  portfolio_vinculo_rotulo?: string | null;
  tem_filho_juridico?: boolean;
  tem_filho_acoplamento?: boolean;
  filho_acoplamento_arquivado?: boolean;
  tem_filho_operacoes?: boolean;
  filho_operacoes_arquivado?: boolean;
  operacoes_filho_fase_rotulo?: string | null;
  /** Legado: status e updated_at do processo (conclusão aproximada quando status = concluido). */
  processo_meta?: { status: string; updated_at: string } | null;
  profiles?: {
    full_name: string | null;
  } | null;
};

function mapInteracaoStatusParaPainelSla(s: InteracaoModal['status']): string {
  if (s === 'concluida' || s === 'cancelada') return 'concluido';
  if (s === 'em_andamento') return 'em_andamento';
  return 'nao_iniciada';
}

function kanbanStatusParaPillKind(s: InteracaoModal['status']): AtividadeVinculadaKind {
  if (s === 'concluida') return 'concluido';
  if (s === 'cancelada') return 'cancelada';
  if (s === 'em_andamento') return 'em_andamento';
  return 'pendente';
}

function IconeMaterialTipo({ tipo }: { tipo: KanbanFaseMaterial['tipo'] }) {
  const cls = 'h-3.5 w-3.5 shrink-0 text-stone-500';
  if (tipo === 'documento') return <FileText className={cls} aria-hidden />;
  if (tipo === 'video') return <Video className={cls} aria-hidden />;
  return <Link2 className={cls} aria-hidden />;
}

/** Texto visível mínimo de um `contentEditable` (innerHTML) para habilitar Salvar/Publicar. */
function richTextPlainTrimmed(html: string): string {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').trim();
}

function mapComentariosCardRows(
  comRows: {
    id: string;
    conteudo?: string | null;
    created_at: string;
    autor_id?: string | null;
    autor_nome?: string | null;
  }[],
  anexos: KanbanComentarioAnexoRow[],
): ComentarioCardRow[] {
  const anexosPorComentario = new Map<string, ComentarioCardRow['anexos']>();
  for (const a of anexos) {
    const cid = String(a.comentario_id);
    const list = anexosPorComentario.get(cid) ?? [];
    list.push({
      id: String(a.id),
      nome_original: String(a.nome_original),
      storage_path: String(a.storage_path),
      mime_type: a.mime_type,
    });
    anexosPorComentario.set(cid, list);
  }
  return comRows.map((c) => ({
    id: String(c.id),
    conteudo: String(c.conteudo ?? ''),
    created_at: String(c.created_at),
    autor_id: c.autor_id ? String(c.autor_id) : null,
    autor_nome: c.autor_nome?.trim() || null,
    anexos: anexosPorComentario.get(String(c.id)) ?? [],
  }));
}

async function carregarComentariosCardModal(cardId: string): Promise<ComentarioCardRow[]> {
  const [comRes, anexosRes] = await Promise.all([
    listarComentariosKanbanCard(cardId),
    listarAnexosComentariosKanbanCard(cardId),
  ]);
  if (!comRes.ok) {
    console.error('[KanbanCardModal] falha ao carregar comentários', comRes.error);
    return [];
  }
  const anexos = anexosRes.ok ? anexosRes.items : [];
  return mapComentariosCardRows(comRes.items, anexos);
}

function inicioDiaLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function PainelLateralSecao({
  titulo,
  children,
  className = '',
}: {
  titulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-md bg-white p-2 ${className}`.trim()}
      style={{
        border: '0.5px solid var(--moni-border-default)',
        boxShadow: 'var(--moni-shadow-sm)',
      }}
    >
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">{titulo}</h3>
      {children}
    </section>
  );
}

/** Fundo da linha do chamado (listagem) conforme SLA do prazo efetivo. */
function corFundoChamado(dataVencimento: string | null | undefined, status: string) {
  const neutro = { background: '#f5f5f4', border: '0.5px solid #e7e5e4' };
  const st = String(status ?? '').trim().toLowerCase();
  if (st === 'concluida' || st === 'concluido' || st === 'cancelada') return neutro;
  if (!dataVencimento) return neutro;
  const alvo = parseIsoDateOnlyLocal(dataVencimento);
  if (!alvo || !Number.isFinite(alvo.getTime())) return neutro;
  const hoje = inicioDiaLocal(new Date());
  const al = inicioDiaLocal(alvo);
  if (al.getTime() < hoje.getTime()) {
    return { background: 'rgb(254 242 242)', border: '1px solid rgb(254 202 202)' };
  }
  if (al.getTime() === hoje.getTime()) {
    return { background: '#FAEEDA', border: '1px solid #D4AD68' };
  }
  const du = calcularDiasUteis(hoje, al);
  if (du <= 1) return { background: '#FAEEDA', border: '1px solid #D4AD68' };
  return neutro;
}

export type KanbanCardModalProps = {
  cardId: string;
  kanbanNome: KanbanNomeDisplay | string;
  onClose: () => void;
  /** Se não vier, as fases são carregadas do banco após obter o card. */
  fases?: KanbanFase[];
  isAdmin?: boolean;
  /** Rota do kanban (ex.: `/funil-stepone`) — usada em links auxiliares. */
  basePath?: string;
  camposPorFase?: CamposPorFaseMap;
  /** `legado`: card é `processo_step_one` (view); não usa `kanban_cards`. */
  origem?: 'legado' | 'nativo';
  /** Portal do franqueado: oculta arquivar, finalizar e mudança de fase. */
  portalFrank?: boolean;
  /** Deep link: expande chamado/atividade ao abrir o modal. */
  deepLinkInteracaoId?: string | null;
  deepLinkTopicoId?: string | null;
};

export function KanbanCardModal({
  cardId,
  kanbanNome,
  onClose,
  fases: fasesProp,
  isAdmin = false,
  basePath = '/',
  camposPorFase,
  origem = 'nativo',
  portalFrank = false,
  deepLinkInteracaoId = null,
  deepLinkTopicoId = null,
}: KanbanCardModalProps) {
  const router = useRouter();
  const { pode } = usePermissoes();
  const suprimirFecharBackdropAteRef = useRef(0);
  const ocultarGestaoCard = portalFrank === true;
  const [loading, setLoading] = useState(true);
  const [movendoFase, setMovendoFase] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [linkCandidato, setLinkCandidato] = useState<string | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [fases, setFases] = useState<KanbanFase[]>(fasesProp ?? []);
  const [fasesEsteiraCalculadora, setFasesEsteiraCalculadora] = useState<Map<string, KanbanFase[]>>(new Map());
  const [datasManuaisCalculadora, setDatasManuaisCalculadora] = useState<
    Map<string, CalculadoraFaseDataManual>
  >(() => new Map());
  const [calculadoraSlaCondominio, setCalculadoraSlaCondominio] =
    useState<CondominioPrazosAprovacaoSla | null>(null);
  const [responsavelDaFaseSalvoPorFase, setResponsavelDaFaseSalvoPorFase] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [faseAtual, setFaseAtual] = useState<KanbanFase | null>(null);
  const [secaoAberta, setSecaoAberta] = useState<Record<SecaoEsquerdaId, boolean>>({
    calculadora: false,
    cronologia: false,
    franqueado: false,
    loteador: false,
    condominio: false,
    novoNegocio: false,
    dadosEmpresas: false,
    preObra: false,
    obra: false,
    documentacaoCreditoObra: true,
    relacionamentos: false,
    atasReuniao: false,
    chamados: false,
    historico: false,
  });
  const [legadoCronologiaMoves, setLegadoCronologiaMoves] = useState<ProcessoCardMoveEvt[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [historicoCalculadora, setHistoricoCalculadora] = useState<HistoricoItem[]>([]);
  const [contextoCalculadoraSyncGroup, setContextoCalculadoraSyncGroup] =
    useState<ContextoCalculadoraSyncGroup | null>(null);
  const [comentariosCard, setComentariosCard] = useState<ComentarioCardRow[]>([]);
  const [novoComentarioCard, setNovoComentarioCard] = useState('');
  const [comentarioPendingAnexos, setComentarioPendingAnexos] = useState<File[]>([]);
  const [salvandoComentario, setSalvandoComentario] = useState(false);
  const [editingComentarioId, setEditingComentarioId] = useState<string | null>(null);
  const [editComentarioDraft, setEditComentarioDraft] = useState('');
  const [salvandoEdicaoComentario, setSalvandoEdicaoComentario] = useState(false);
  const [tagsKanban, setTagsKanban] = useState<{ id: string; nome: string; cor: string }[]>([]);
  const [tagsCard, setTagsCard] = useState<{ id: string; tag_id: string; nome: string; cor: string }[]>([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [novatagsNome, setNovaTagNome] = useState('');
  const [novaTagCor, setNovaTagCor] = useState('#F5A100');
  const [criandoTag, setCriandoTag] = useState(false);
  const [editandoNegocio, setEditandoNegocio] = useState(false);
  const [negocioDraft, setNegocioDraft] = useState<{
    tipo_aquisicao_terreno: string;
    valor_terreno: string;
    vgv_pretendido: string;
    produto_modelo_casa: string;
    link_pasta_drive: string;
    link_bca: string;
    link_gbox: string;
    link_mapa_competidores: string;
    link_acoplamento: string;
    link_apresentacao_comite: string;
    link_moni_capital_seguro_garantia: string;
    comentario_moni_capital_seguro_garantia: string;
    link_moni_capital_gastos_aporte_inicial: string;
    comentario_moni_capital_gastos_aporte_inicial: string;
    prazo_opcao: NegocioPrazoDraft;
    prazo_instrumento_garantidor: NegocioPrazoDraft;
    negociacao_linhas: NegociacaoLinhaDraft[];
  }>({
    tipo_aquisicao_terreno: '',
    valor_terreno: '',
    vgv_pretendido: '',
    produto_modelo_casa: '',
    link_pasta_drive: '',
    link_bca: '',
    link_gbox: '',
    link_mapa_competidores: '',
    link_acoplamento: '',
    link_apresentacao_comite: '',
    link_moni_capital_seguro_garantia: '',
    comentario_moni_capital_seguro_garantia: '',
    link_moni_capital_gastos_aporte_inicial: '',
    comentario_moni_capital_gastos_aporte_inicial: '',
    prazo_opcao: { ...NEGOCIO_PRAZO_OPCAO_DRAFT_PADRAO },
    prazo_instrumento_garantidor: { ...NEGOCIO_PRAZO_INSTRUMENTO_DRAFT_PADRAO },
    negociacao_linhas: negociacaoLinhasDraftPadrao(),
  });
  const [fasesNegocioPrazo, setFasesNegocioPrazo] = useState<FaseNegocioPrazoOpcao[]>([]);
  const [salvandoNegocio, setSalvandoNegocio] = useState(false);
  const [editandoFranqueado, setEditandoFranqueado] = useState(false);
  const [franqueadosLista, setFranqueadosLista] = useState<
    { id: string; n_franquia: string; nome_completo: string }[]
  >([]);
  const [novoFranqueadoId, setNovoFranqueadoId] = useState('');
  const [salvandoFranqueado, setSalvandoFranqueado] = useState(false);
  const [totalCardsSyncGrupo, setTotalCardsSyncGrupo] = useState(0);
  const [abaComentarios, setAbaComentarios] = useState<'comentarios' | 'email'>('comentarios');
  const [abaCentro, setAbaCentro] = useState<'detalhes' | 'chamados' | 'trancheVinculo' | 'calculadora'>('detalhes');
  const [trancheVinculoIndex, setTrancheVinculoIndex] = useState<number | null>(null);
  const [trancheVinculosTick, setTrancheVinculosTick] = useState(0);
  const [emailPara, setEmailPara] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [emailAssunto, setEmailAssunto] = useState('');
  const [emailMensagem, setEmailMensagem] = useState('');
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [hipotesePortfolioErro, setHipotesePortfolioErro] = useState<string | null>(null);
  const [hipotesePortfolioOk, setHipotesePortfolioOk] = useState<string | null>(null);
  const [enviandoHipotesePortfolio, setEnviandoHipotesePortfolio] = useState(false);
  const [dataReuniao, setDataReuniao] = useState('');
  const [horaReuniao, setHoraReuniao] = useState('');
  const [dataFollowup, setDataFollowup] = useState('');
  const [interacoes, setInteracoes] = useState<InteracaoModal[]>([]);
  const [erroCarregarChamados, setErroCarregarChamados] = useState<string | null>(null);
  const [modalSessao, setModalSessao] = useState<{
    userId: string | null;
    uploaderNome: string;
    ehAdminOuTeam: boolean;
    roleNorm: string;
    cargoNorm: string;
  }>({ userId: null, uploaderNome: '—', ehAdminOuTeam: false, roleNorm: '', cargoNorm: '' });
  const podeCriarChamados = useMemo(
    () =>
      podeComFallbackStaff(pode, 'criar_chamados', {
        isAdminProp: isAdmin,
        ehAdminOuTeam: modalSessao.ehAdminOuTeam,
        roleNorm: modalSessao.roleNorm,
      }),
    [pode, isAdmin, modalSessao.ehAdminOuTeam, modalSessao.roleNorm],
  );
  const [kanbanTimes, setKanbanTimes] = useState<KanbanTimeRow[]>([]);
  const [responsaveisOpcoes, setResponsaveisOpcoes] = useState<
    { id: string; nome: string; email?: string | null }[]
  >([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    titulo: '',
    descricao: '',
    categoria: 'chamado' as 'chamado' | 'melhoria',
  });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [novaInteracao, setNovaInteracao] = useState({
    titulo: '',
    descricao: '',
    categoria: 'chamado' as 'chamado' | 'melhoria',
    status: 'pendente' as const,
    trava: false,
    atividade: { ...ATIVIDADE_FORM_DRAFT_VAZIO },
  });
  const [novoChamadoFormAberto, setNovoChamadoFormAberto] = useState(false);
  const [novaAtividadeAberta, setNovaAtividadeAberta] = useState(false);
  const [subInteracoesPorPai, setSubInteracoesPorPai] = useState<Record<string, SubInteracaoModal[]>>({});
  const [subExpandida, setSubExpandida] = useState<Record<string, boolean>>({});
  const [subAtividadeExpandida, setSubAtividadeExpandida] = useState<Record<string, boolean>>({});
  const [subFormInteracaoId, setSubFormInteracaoId] = useState<string | null>(null);
  const [subNovaDraft, setSubNovaDraft] = useState<AtividadeFormDraft>({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
  const [salvandoSub, setSalvandoSub] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubDraft, setEditSubDraft] = useState<AtividadeFormDraft>({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
  const [salvandoEditSub, setSalvandoEditSub] = useState(false);
  const [filtros, setFiltros] = useState<KanbanModalInteracoesFiltros>(KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT);
  const [filtrosDraft, setFiltrosDraft] = useState<KanbanModalInteracoesFiltros>(KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT);
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const filtrosPopoverRef = useRef<HTMLDivElement>(null);
  const filtrosBtnRef = useRef<HTMLButtonElement>(null);
  const [arquivamentoAberto, setArquivamentoAberto] = useState(false);
  const [motivoCategoriaArquivamento, setMotivoCategoriaArquivamento] = useState('');
  const [motivoObservacaoOutro, setMotivoObservacaoOutro] = useState('');
  const [modalArquivarInteracao, setModalArquivarInteracao] = useState<{ id: string; tipo: 'chamado' | 'sub' } | null>(
    null,
  );
  const [motivoArquivarInteracao, setMotivoArquivarInteracao] = useState('');
  const [salvandoArquivarInteracao, setSalvandoArquivarInteracao] = useState(false);
  const [modalExcluirInteracaoId, setModalExcluirInteracaoId] = useState<string | null>(null);
  const [salvandoExcluirInteracao, setSalvandoExcluirInteracao] = useState(false);
  const [confirmandoFinalizar, setConfirmandoFinalizar] = useState(false);
  const [conclusaoInteracaoId, setConclusaoInteracaoId] = useState<string | null>(null);
  const [modalDetalhes, setModalDetalhes] = useState<KanbanCardModalDetalhes>({
    rede: null,
    processo: null,
    redeIdContrato: null,
    empresas: null,
  });
  const [preObraDraft, setPreObraDraft] = useState<PreObraDraftKanban>(() => preObraDraftFromProcesso(null));
  const [operacoesPreObraDraft, setOperacoesPreObraDraft] = useState<OperacoesPreObraDraft>(
    () => ({ ...OPERACOES_PRE_OBRA_DRAFT_EMPTY }),
  );
  const [salvandoPreObra, setSalvandoPreObra] = useState(false);
  const [creditoObraAbertura, setCreditoObraAbertura] = useState<{
    tituloCard: string;
    dataEnvio: string | null;
    dataEnvioExibicao: string | null;
  } | null>(null);
  const [creditoObraAberturaPending, setCreditoObraAberturaPending] = useState(false);
  const [uploadingNegocioAnexo, setUploadingNegocioAnexo] = useState<ProcessoNegocioAnexoCampo | null>(
    null,
  );
  const comentarioEditorRef = useRef<HTMLDivElement>(null);
  const comentarioEdicaoRef = useRef<HTMLDivElement>(null);
  const [editandoInstrucoesFase, setEditandoInstrucoesFase] = useState(false);
  const [draftInstrucoesFase, setDraftInstrucoesFase] = useState('');
  const [draftMateriaisFase, setDraftMateriaisFase] = useState<KanbanFaseMaterial[]>([]);
  const [salvandoInstrucoesFase, setSalvandoInstrucoesFase] = useState(false);
  const [relacionamentosTick, setRelacionamentosTick] = useState(0);
  const [condominioTick, setCondominioTick] = useState(0);
  const [atasReuniaoTick, setAtasReuniaoTick] = useState(0);
  const [gateStep5Toast, setGateStep5Toast] = useState<string | null>(null);
  const [acoplamentoGateToast, setAcoplamentoGateToast] = useState<string | null>(null);
  const [modalReprovacaoAcoplamento, setModalReprovacaoAcoplamento] = useState<KanbanFase | null>(null);
  const [motivoReprovacaoDraft, setMotivoReprovacaoDraft] = useState('');
  const [salvandoReprovacaoAcoplamento, setSalvandoReprovacaoAcoplamento] = useState(false);
  const [modalJustificativaSla, setModalJustificativaSla] = useState<KanbanFase | null>(null);
  const [slaJustificativaDraft, setSlaJustificativaDraft] = useState('');
  const [salvandoJustificativaSla, setSalvandoJustificativaSla] = useState(false);
  const [salvandoJustificativaSlaInline, setSalvandoJustificativaSlaInline] = useState(false);
  const [userRoleRaw, setUserRoleRaw] = useState('');
  const [modalAprovacaoFase, setModalAprovacaoFase] = useState<{
    fase: KanbanFase;
    direcao: 'avancar' | 'retroceder';
    itensPendentes: number;
  } | null>(null);
  const [solicitandoAprovacaoFase, setSolicitandoAprovacaoFase] = useState(false);
  const [modalConfirmacaoPortfolio, setModalConfirmacaoPortfolio] = useState<{
    dominio: 'portfolio' | 'operacoes';
    tipo: PortfolioConfirmacaoFaseTipo | OperacoesConfirmacaoFaseTipo;
    destinoFase: KanbanFase;
    direcao: 'avancar' | 'retroceder';
    opts?: { motivoReprovacaoAcoplamento?: string; justificativaSlaQuebra?: string };
  } | null>(null);
  const [salvandoConfirmacaoPortfolio, setSalvandoConfirmacaoPortfolio] = useState(false);

  const timesNovaFiltrados = useMemo(
    () => ordenarLinhasTimeKanbanPorCatalogoMoni(kanbanTimes, false),
    [kanbanTimes],
  );
  const kanbanTimesSubNovaFiltrados = useMemo(
    () => ordenarLinhasTimeKanbanPorCatalogoMoni(kanbanTimes, false),
    [kanbanTimes],
  );
  const kanbanTimesSubEditFiltrados = useMemo(
    () => ordenarLinhasTimeKanbanPorCatalogoMoni(kanbanTimes, false),
    [kanbanTimes],
  );

  useEffect(() => {
    setArquivamentoAberto(false);
    setMotivoCategoriaArquivamento('');
    setMotivoObservacaoOutro('');
    setConfirmandoFinalizar(false);
    setSecaoAberta((prev) => ({ ...prev, relacionamentos: false }));
    setFiltros(KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT);
    setFiltrosDraft(KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT);
    setFiltrosOpen(false);
    setModalDetalhes({ rede: null, processo: null, redeIdContrato: null, empresas: null });
    setPreObraDraft(preObraDraftFromProcesso(null));
    setOperacoesPreObraDraft({ ...OPERACOES_PRE_OBRA_DRAFT_EMPTY });
    setCreditoObraAbertura(null);
    setCreditoObraAberturaPending(false);
    setLegadoCronologiaMoves([]);
    setEditandoInstrucoesFase(false);
    setDraftInstrucoesFase('');
    setDraftMateriaisFase([]);
    setRelacionamentosTick((t) => t + 1);
    setModalSessao({ userId: null, uploaderNome: '—', ehAdminOuTeam: false, roleNorm: '', cargoNorm: '' });
    setModalExcluirInteracaoId(null);
    setSalvandoExcluirInteracao(false);
    setModalAprovacaoFase(null);
    setModalConfirmacaoPortfolio(null);
    setSalvandoConfirmacaoPortfolio(false);
    setSolicitandoAprovacaoFase(false);
    setEditingComentarioId(null);
    setEditComentarioDraft('');
    setSalvandoEdicaoComentario(false);
    setHipotesePortfolioErro(null);
    setHipotesePortfolioOk(null);
    setEnviandoHipotesePortfolio(false);
    setTagsKanban([]);
    setTagsCard([]);
    setTagsOpen(false);
    setNovaTagNome('');
    setNovaTagCor('#F5A100');
    setCriandoTag(false);
    setEditingId(null);
    setNovoChamadoFormAberto(false);
    setNovaAtividadeAberta(false);
    setSubExpandida({});
    setSubAtividadeExpandida({});
    setNovaInteracao({
      titulo: '',
      descricao: '',
      categoria: 'chamado',
      status: 'pendente',
      trava: false,
      atividade: { ...ATIVIDADE_FORM_DRAFT_VAZIO },
    });
    setEditDraft({
      titulo: '',
      descricao: '',
      categoria: 'chamado',
    });
    setNegocioDraft({
      tipo_aquisicao_terreno: '',
      valor_terreno: '',
      vgv_pretendido: '',
      produto_modelo_casa: '',
      link_pasta_drive: '',
      link_bca: '',
      link_gbox: '',
      link_mapa_competidores: '',
      link_acoplamento: '',
      link_apresentacao_comite: '',
      link_moni_capital_seguro_garantia: '',
      comentario_moni_capital_seguro_garantia: '',
      link_moni_capital_gastos_aporte_inicial: '',
      comentario_moni_capital_gastos_aporte_inicial: '',
      prazo_opcao: { ...NEGOCIO_PRAZO_OPCAO_DRAFT_PADRAO },
      prazo_instrumento_garantidor: { ...NEGOCIO_PRAZO_INSTRUMENTO_DRAFT_PADRAO },
      negociacao_linhas: negociacaoLinhasDraftPadrao(),
    });
    setEditandoNegocio(false);
    setEditandoFranqueado(false);
    setFranqueadosLista([]);
    setNovoFranqueadoId('');
    setSalvandoFranqueado(false);
    setTotalCardsSyncGrupo(0);
    setEmailPara('');
    setEmailCc('');
    setEmailBcc('');
    setEmailAssunto('');
    setEmailMensagem('');
    setDataReuniao('');
    setHoraReuniao('');
    setDataFollowup('');
  }, [cardId]);

  // Assunto padrão ao abrir o card (N°Franquia_NomeCondomínio a partir do título).
  useEffect(() => {
    if (!card || String(card.id) !== String(cardId)) return;
    const titulo = card.titulo ?? '';
    const partes = titulo.split(' - ');
    const nFranquia = partes[0]?.trim() ?? '';
    const condominio = partes[1]?.trim() ?? '';
    const assuntoPadrao = [nFranquia, condominio].filter(Boolean).join('_');
    setEmailAssunto(assuntoPadrao);
    // card: assunto deriva de titulo; id+cardId já filtram card errado, mas o linter exige card completo.
  }, [card, cardId]);

  useEffect(() => {
    const procId = modalDetalhes.processo?.id;
    if (!procId) return;
    let cancel = false;
    void (async () => {
      const opcoes = await fetchFasesNegocioPrazoOpcoes(createClient());
      if (!cancel) setFasesNegocioPrazo(opcoes);
    })();
    return () => {
      cancel = true;
    };
  }, [modalDetalhes.processo?.id]);

  useEffect(() => {
    if (!card?.fase_id) return;
    let cancel = false;
    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('kanban_fases')
        .select('id, instrucoes, materiais')
        .eq('id', card.fase_id)
        .maybeSingle();
      if (cancel || error || !data) return;
      const materiais = parseKanbanFaseMateriais((data as { materiais?: unknown }).materiais);
      const instrucoes = (data as { instrucoes?: string | null }).instrucoes ?? null;
      setFaseAtual((prev) => (prev && prev.id === card.fase_id ? { ...prev, instrucoes, materiais } : prev));
      setFases((prev) => prev.map((f) => (f.id === card.fase_id ? { ...f, instrucoes, materiais } : f)));
    })();
    return () => {
      cancel = true;
    };
  }, [card?.fase_id, card?.id]);

  useEffect(() => {
    if (filtros.lista === 'abertas' && filtros.situacao === 'concluida') {
      setFiltros((f) => ({ ...f, situacao: 'qualquer' }));
    }
  }, [filtros.lista, filtros.situacao]);

  useEffect(() => {
    if (!filtrosOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFiltrosDraft({ ...filtros });
        setFiltrosOpen(false);
      }
    };
    const onDown = (e: globalThis.MouseEvent) => {
      const t = e.target as Node;
      if (filtrosPopoverRef.current?.contains(t)) return;
      if (filtrosBtnRef.current?.contains(t)) return;
      setFiltrosDraft({ ...filtros });
      setFiltrosOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [filtrosOpen, filtros]);

  useEffect(() => {
    let fileInputAtivado = false;
    const marcarSupressao = () => {
      suprimirFecharBackdropAteRef.current = Date.now() + 800;
    };
    const onDocClick = (e: globalThis.MouseEvent) => {
      const alvo = e.target;
      if (alvo instanceof HTMLInputElement && alvo.type === 'file') {
        fileInputAtivado = true;
        marcarSupressao();
      }
    };
    const onWindowFocus = () => {
      if (!fileInputAtivado) return;
      fileInputAtivado = false;
      marcarSupressao();
    };
    document.addEventListener('click', onDocClick, true);
    window.addEventListener('focus', onWindowFocus);
    return () => {
      document.removeEventListener('click', onDocClick, true);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, []);

  useEffect(() => {
    if (fasesProp?.length) setFases(fasesProp);
  }, [fasesProp]);

  useEffect(() => {
    if (!card) {
      setFasesEsteiraCalculadora(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const map = await fetchCalculadoraEsteiraFasesMap(supabase);
      if (!cancelled) setFasesEsteiraCalculadora(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [card?.id]);

  useEffect(() => {
    if (!editingComentarioId) return;
    const el = comentarioEdicaoRef.current;
    if (!el) return;
    const row = comentariosCard.find((x) => x.id === editingComentarioId);
    if (!row) return;
    el.innerHTML = row.conteudo;
    setEditComentarioDraft(row.conteudo);
    queueMicrotask(() => el.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apenas ao abrir edição; evita apagar rascunho quando a lista recarrega.
  }, [editingComentarioId]);

  useEffect(() => {
    void loadCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, origem]);

  useEffect(() => {
    setAbaCentro('detalhes');
    setNovoChamadoFormAberto(false);
    setNovaAtividadeAberta(false);
  }, [cardId, origem]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancel) return;
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!cancel) setUserRoleRaw(String((data as { role?: string | null } | null)?.role ?? ''));
    })();
    return () => {
      cancel = true;
    };
  }, []);

  async function loadCard(opts?: { silencioso?: boolean }) {
    const silencioso = Boolean(opts?.silencioso && card);
    if (!silencioso) setLoading(true);
    try {
      const supabase = createClient();

      try {
        const {
          data: { user: sessUser },
        } = await supabase.auth.getUser();
        let uid: string | null = null;
        let unome = '—';
        let admTeam = false;
        if (sessUser) {
          uid = sessUser.id;
          const { data: me } = await supabase
            .from('profiles')
            .select('full_name, role, cargo')
            .eq('id', sessUser.id)
            .maybeSingle();
          const fn = String((me as { full_name?: string | null } | null)?.full_name ?? '').trim();
          unome = fn || '—';
          const rl = String((me as { role?: string | null } | null)?.role ?? '').toLowerCase();
          admTeam = rl === 'admin' || rl === 'team' || rl === 'consultor' || rl === 'supervisor';
          const cg = String((me as { cargo?: string | null } | null)?.cargo ?? '')
            .trim()
            .toLowerCase();
          setModalSessao({
            userId: uid,
            uploaderNome: unome,
            ehAdminOuTeam: admTeam,
            roleNorm: rl,
            cargoNorm: cg,
          });
        } else {
          setModalSessao({ userId: null, uploaderNome: '—', ehAdminOuTeam: false, roleNorm: '', cargoNorm: '' });
        }
      } catch {
        setModalSessao({ userId: null, uploaderNome: '—', ehAdminOuTeam: false, roleNorm: '', cargoNorm: '' });
      }

      type LoadedShape = {
        id: string;
        titulo: string;
        status: string;
        created_at: string;
        fase_id: string;
        franqueado_id: string;
        kanban_id: string;
        etapa_slug: string | null;
        concluido?: boolean;
        concluido_em?: string | null;
        arquivado?: boolean;
        nome_condominio?: string | null;
        condominio_id?: string | null;
        quadra?: string | null;
        lote?: string | null;
        rede_franqueado_id?: string | null;
        processo_meta?: Card['processo_meta'];
        data_reuniao?: string | null;
        data_followup?: string | null;
        hora_reuniao?: string | null;
        projeto_id?: string | null;
        processo_step_one_id?: string | null;
        acoplamento_concluido?: boolean;
        acoplamento_filho_fase_nome?: string | null;
        acoplamento_filho_fase_slug?: string | null;
        credito_terreno_ok?: boolean;
        contabilidade_ok?: boolean;
        capital_ok?: boolean;
        juridico_ok?: boolean;
        credito_obra_ok?: boolean;
        alvara_url?: string | null;
        docs_terreno_url?: string | null;
        sla_iniciado_em?: string | null;
        entered_fase_at?: string | null;
        sla_justificativa?: string | null;
        sla_justificativa_em?: string | null;
        opcao_assinada_em?: string | null;
        contrato_assinado_em?: string | null;
        obra_iniciada_em?: string | null;
        obra_finalizada_em?: string | null;
      };

      let loaded: LoadedShape | null = null;
      let nativeRedeFranqueadoId: string | null = null;

      if (origem === 'legado') {
        const { data: vRow, error: vErr } = await supabase
          .from('v_processo_como_kanban_cards')
          .select(
            'id, titulo, status, criado_em, fase_id, responsavel_id, kanban_id, etapa_slug, origem, data_reuniao, data_followup',
          )
          .eq('id', cardId)
          .maybeSingle();

        if (vErr || !vRow) {
          alert('Processo não encontrado');
          onClose();
          return;
        }

        const legadoId = String(vRow.id);
        let arquivadoShadow = false;
        let projetoIdLegado: string | null = null;
        try {
          const { data: shadowRow } = await supabase
            .from('kanban_cards')
            .select('arquivado, projeto_id')
            .eq('id', legadoId)
            .maybeSingle();
          arquivadoShadow = Boolean((shadowRow as { arquivado?: boolean | null } | null)?.arquivado);
          const pid = (shadowRow as { projeto_id?: string | null } | null)?.projeto_id;
          projetoIdLegado = pid != null && String(pid).trim() !== '' ? String(pid) : null;
        } catch {
          arquivadoShadow = false;
          projetoIdLegado = null;
        }

        loaded = {
          id: legadoId,
          titulo: String((vRow as { titulo?: string | null }).titulo ?? ''),
          status: String((vRow as { status?: string | null }).status ?? ''),
          created_at: String((vRow as { criado_em?: string | null }).criado_em ?? ''),
          fase_id: String((vRow as { fase_id?: string | null }).fase_id ?? ''),
          franqueado_id: String((vRow as { responsavel_id?: string | null }).responsavel_id ?? ''),
          kanban_id: String((vRow as { kanban_id?: string | null }).kanban_id ?? ''),
          etapa_slug:
            (vRow as { etapa_slug?: string | null }).etapa_slug != null
              ? String((vRow as { etapa_slug?: string | null }).etapa_slug)
              : null,
          data_reuniao: (vRow as { data_reuniao?: string | null }).data_reuniao ?? null,
          data_followup: (vRow as { data_followup?: string | null }).data_followup ?? null,
          arquivado: arquivadoShadow,
          projeto_id: projetoIdLegado,
        };

        try {
          const [pmRes, evRes] = await Promise.all([
            supabase.from('processo_step_one').select('status, updated_at').eq('id', loaded.id).maybeSingle(),
            supabase
              .from('processo_card_eventos')
              .select('created_at, detalhes')
              .eq('processo_id', loaded.id)
              .eq('tipo', 'card_move')
              .order('created_at', { ascending: true }),
          ]);
          const pm = pmRes.data as { status?: string | null; updated_at?: string | null } | null;
          loaded.processo_meta = pm
            ? {
                status: String(pm.status ?? ''),
                updated_at: String(pm.updated_at ?? ''),
              }
            : null;
          const evRows = (evRes.data ?? []) as { created_at: string; detalhes?: unknown }[];
          setLegadoCronologiaMoves(
            evRows.map((r) => ({
              created_at: String(r.created_at),
              detalhes: (r.detalhes as Record<string, unknown> | null) ?? null,
            })),
          );
        } catch {
          loaded.processo_meta = null;
          setLegadoCronologiaMoves([]);
        }
      } else {
        setLegadoCronologiaMoves([]);
        const cardSelectConfirmacao =
          'opcao_assinada_em, contrato_assinado_em, obra_iniciada_em, obra_finalizada_em';
        const cardSelectCore =
          `id, titulo, status, created_at, fase_id, franqueado_id, kanban_id, concluido, concluido_em, arquivado, rede_franqueado_id, nome_condominio, condominio_id, quadra, lote, data_reuniao, data_followup, hora_reuniao, projeto_id, processo_step_one_id, acoplamento_concluido, acoplamento_filho_fase_nome, acoplamento_filho_fase_slug, credito_terreno_ok, contabilidade_ok, capital_ok, juridico_ok, credito_obra_ok, alvara_url, docs_terreno_url, ${cardSelectConfirmacao}`;
        const cardSelectPreObra =
          'condominio_aprovada_em, prefeitura_aprovada_em, alvara_emitido_em, prev_aprovacao_condominio, prev_aprovacao_prefeitura, prev_emissao_alvara, prev_envio_credito_obra, prev_inicio_obra';
        const cardSelectBase = `${cardSelectCore}, ${cardSelectPreObra}`;
        const cardSelectWithSla = `${cardSelectBase}, sla_iniciado_em, entered_fase_at, sla_justificativa, sla_justificativa_em`;
        let cardRes = await supabase.from('kanban_cards').select(cardSelectWithSla).eq('id', cardId).single();
        if (cardRes.error && /does not exist/i.test(cardRes.error.message)) {
          cardRes = await supabase.from('kanban_cards').select(`${cardSelectBase}, sla_iniciado_em, entered_fase_at`).eq('id', cardId).single();
        }
        if (cardRes.error && /does not exist/i.test(cardRes.error.message)) {
          cardRes = await supabase.from('kanban_cards').select(`${cardSelectCore}, sla_iniciado_em, entered_fase_at`).eq('id', cardId).single();
        }
        if (cardRes.error && /does not exist/i.test(cardRes.error.message)) {
          cardRes = await supabase.from('kanban_cards').select(cardSelectCore).eq('id', cardId).single();
        }
        const { data: cardData, error: cardError } = cardRes;

        if (cardError || !cardData) {
          alert('Card não encontrado');
          onClose();
          return;
        }

        const ccem = (cardData as { concluido_em?: string | null }).concluido_em;
        loaded = {
          id: String(cardData.id),
          titulo: String(cardData.titulo ?? ''),
          status: String(cardData.status ?? ''),
          created_at: String(cardData.created_at ?? ''),
          fase_id: String(cardData.fase_id ?? ''),
          franqueado_id: String(cardData.franqueado_id ?? ''),
          kanban_id: String(cardData.kanban_id ?? ''),
          etapa_slug: null,
          concluido: Boolean((cardData as { concluido?: boolean | null }).concluido),
          concluido_em: ccem != null && String(ccem).trim() !== '' ? String(ccem) : null,
          arquivado: Boolean((cardData as { arquivado?: boolean | null }).arquivado),
          nome_condominio: (cardData as { nome_condominio?: string | null }).nome_condominio ?? null,
          condominio_id: (() => {
            const cid = (cardData as { condominio_id?: string | null }).condominio_id;
            return cid != null && String(cid).trim() !== '' ? String(cid) : null;
          })(),
          quadra: (cardData as { quadra?: string | null }).quadra ?? null,
          lote: (cardData as { lote?: string | null }).lote ?? null,
          rede_franqueado_id:
            (cardData as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? null,
          data_reuniao: (cardData as { data_reuniao?: string | null }).data_reuniao ?? null,
          data_followup: (cardData as { data_followup?: string | null }).data_followup ?? null,
          hora_reuniao: (cardData as { hora_reuniao?: string | null }).hora_reuniao ?? null,
          projeto_id: (() => {
            const pid = (cardData as { projeto_id?: string | null }).projeto_id;
            return pid != null && String(pid).trim() !== '' ? String(pid) : null;
          })(),
          processo_step_one_id: (() => {
            const pid = (cardData as { processo_step_one_id?: string | null }).processo_step_one_id;
            return pid != null && String(pid).trim() !== '' ? String(pid) : null;
          })(),
          acoplamento_concluido: Boolean(
            (cardData as { acoplamento_concluido?: boolean | null }).acoplamento_concluido,
          ),
          acoplamento_filho_fase_nome:
            (cardData as { acoplamento_filho_fase_nome?: string | null }).acoplamento_filho_fase_nome ??
            null,
          acoplamento_filho_fase_slug:
            (cardData as { acoplamento_filho_fase_slug?: string | null }).acoplamento_filho_fase_slug ??
            null,
          credito_terreno_ok: Boolean(
            (cardData as { credito_terreno_ok?: boolean | null }).credito_terreno_ok,
          ),
          contabilidade_ok: Boolean((cardData as { contabilidade_ok?: boolean | null }).contabilidade_ok),
          capital_ok: Boolean((cardData as { capital_ok?: boolean | null }).capital_ok),
          juridico_ok: Boolean((cardData as { juridico_ok?: boolean | null }).juridico_ok),
          credito_obra_ok: Boolean((cardData as { credito_obra_ok?: boolean | null }).credito_obra_ok),
          alvara_url: (cardData as { alvara_url?: string | null }).alvara_url ?? null,
          docs_terreno_url: (cardData as { docs_terreno_url?: string | null }).docs_terreno_url ?? null,
          sla_iniciado_em:
            (cardData as { sla_iniciado_em?: string | null }).sla_iniciado_em != null
              ? String((cardData as { sla_iniciado_em?: string | null }).sla_iniciado_em)
              : null,
          entered_fase_at:
            (cardData as { entered_fase_at?: string | null }).entered_fase_at != null
              ? String((cardData as { entered_fase_at?: string | null }).entered_fase_at)
              : null,
          sla_justificativa:
            (cardData as { sla_justificativa?: string | null }).sla_justificativa != null
              ? String((cardData as { sla_justificativa?: string | null }).sla_justificativa)
              : null,
          sla_justificativa_em:
            (cardData as { sla_justificativa_em?: string | null }).sla_justificativa_em != null
              ? String((cardData as { sla_justificativa_em?: string | null }).sla_justificativa_em)
              : null,
          opcao_assinada_em:
            (cardData as { opcao_assinada_em?: string | null }).opcao_assinada_em != null
              ? String((cardData as { opcao_assinada_em?: string | null }).opcao_assinada_em)
              : null,
          contrato_assinado_em:
            (cardData as { contrato_assinado_em?: string | null }).contrato_assinado_em != null
              ? String((cardData as { contrato_assinado_em?: string | null }).contrato_assinado_em)
              : null,
          obra_iniciada_em:
            (cardData as { obra_iniciada_em?: string | null }).obra_iniciada_em != null
              ? String((cardData as { obra_iniciada_em?: string | null }).obra_iniciada_em)
              : null,
          obra_finalizada_em:
            (cardData as { obra_finalizada_em?: string | null }).obra_finalizada_em != null
              ? String((cardData as { obra_finalizada_em?: string | null }).obra_finalizada_em)
              : null,
        };
        nativeRedeFranqueadoId =
          (cardData as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? null;
        setOperacoesPreObraDraft(operacoesPreObraDraftFromCard(cardData as Record<string, unknown>));
      }

      if (!loaded) {
        alert('Card não encontrado');
        onClose();
        return;
      }

      let profiles: Card['profiles'] = null;
      if (isAdmin && loaded.franqueado_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', loaded.franqueado_id)
          .single();
        profiles = profileData ?? null;
      }

      let cardParaEstado: Card = {
        id: loaded.id,
        titulo: loaded.titulo,
        status: loaded.status,
        created_at: loaded.created_at,
        fase_id: loaded.fase_id,
        franqueado_id: loaded.franqueado_id,
        kanban_id: loaded.kanban_id,
        nome_condominio: loaded.nome_condominio ?? null,
        condominio_id: loaded.condominio_id ?? null,
        quadra: loaded.quadra ?? null,
        lote: loaded.lote ?? null,
        rede_franqueado_id: loaded.rede_franqueado_id ?? null,
        etapa_slug: loaded.etapa_slug,
        concluido: loaded.concluido ?? false,
        concluido_em: loaded.concluido_em ?? null,
        arquivado: loaded.arquivado ?? false,
        projeto_id: loaded.projeto_id ?? null,
        acoplamento_concluido: loaded.acoplamento_concluido,
        acoplamento_filho_fase_nome: loaded.acoplamento_filho_fase_nome ?? null,
        acoplamento_filho_fase_slug: loaded.acoplamento_filho_fase_slug ?? null,
        credito_terreno_ok: loaded.credito_terreno_ok,
        contabilidade_ok: loaded.contabilidade_ok,
        capital_ok: loaded.capital_ok,
        juridico_ok: loaded.juridico_ok,
        credito_obra_ok: loaded.credito_obra_ok,
        processo_meta: loaded.processo_meta ?? null,
        profiles,
      };

      if (origem !== 'legado' && cardParaEstado.kanban_id) {
        const brief: KanbanCardBrief = {
          id: cardParaEstado.id,
          titulo: cardParaEstado.titulo,
          status: cardParaEstado.status,
          created_at: cardParaEstado.created_at,
          fase_id: cardParaEstado.fase_id,
          franqueado_id: cardParaEstado.franqueado_id,
          kanban_id: cardParaEstado.kanban_id,
          projeto_id: cardParaEstado.projeto_id,
          acoplamento_concluido: cardParaEstado.acoplamento_concluido,
          acoplamento_filho_fase_nome: cardParaEstado.acoplamento_filho_fase_nome,
          acoplamento_filho_fase_slug: cardParaEstado.acoplamento_filho_fase_slug,
          credito_terreno_ok: cardParaEstado.credito_terreno_ok,
          contabilidade_ok: cardParaEstado.contabilidade_ok,
          capital_ok: cardParaEstado.capital_ok,
          juridico_ok: cardParaEstado.juridico_ok,
          credito_obra_ok: cardParaEstado.credito_obra_ok,
        };
        const enrichedList = await enrichCardsParalelasContext(supabase, cardParaEstado.kanban_id, [brief]);
        const enrichedRow = enrichedList[0];
        if (enrichedRow) {
          cardParaEstado = {
            ...cardParaEstado,
            portfolio_vinculo_rotulo: enrichedRow.portfolio_vinculo_rotulo,
            tem_filho_juridico: enrichedRow.tem_filho_juridico,
            tem_filho_acoplamento: enrichedRow.tem_filho_acoplamento,
            filho_acoplamento_arquivado: enrichedRow.filho_acoplamento_arquivado,
            tem_filho_operacoes: enrichedRow.tem_filho_operacoes,
            filho_operacoes_arquivado: enrichedRow.filho_operacoes_arquivado,
            operacoes_filho_fase_rotulo: enrichedRow.operacoes_filho_fase_rotulo,
            acoplamento_filho_fase_nome: enrichedRow.filho_acoplamento_arquivado
              ? enrichedRow.acoplamento_filho_fase_nome ?? null
              : enrichedRow.acoplamento_filho_fase_nome ?? cardParaEstado.acoplamento_filho_fase_nome,
            acoplamento_filho_fase_slug: enrichedRow.filho_acoplamento_arquivado
              ? enrichedRow.acoplamento_filho_fase_slug ?? null
              : enrichedRow.acoplamento_filho_fase_slug ?? cardParaEstado.acoplamento_filho_fase_slug,
          };
        }
      }

      try {
        const syncInfo = await obterInfoSyncGrupoCard(cardParaEstado.id);
        if (syncInfo.ok) {
          setTotalCardsSyncGrupo(syncInfo.totalVinculados);
          const c = syncInfo.camposCanonicos;
          if (c) {
            if (c.titulo) cardParaEstado = { ...cardParaEstado, titulo: c.titulo };
            if (c.rede_franqueado_id) {
              cardParaEstado = { ...cardParaEstado, rede_franqueado_id: c.rede_franqueado_id };
            }
            if (c.nome_condominio !== undefined) {
              cardParaEstado = { ...cardParaEstado, nome_condominio: c.nome_condominio };
            }
            if (c.condominio_id !== undefined) {
              cardParaEstado = { ...cardParaEstado, condominio_id: c.condominio_id };
            }
            if (c.quadra !== undefined) cardParaEstado = { ...cardParaEstado, quadra: c.quadra };
            if (c.lote !== undefined) cardParaEstado = { ...cardParaEstado, lote: c.lote };
            if (c.data_reuniao !== undefined) {
              const drCanon = c.data_reuniao ? String(c.data_reuniao).slice(0, 10) : '';
              if (drCanon && dataIsoInputValida(drCanon)) {
                loaded = { ...loaded, data_reuniao: c.data_reuniao };
              }
            }
            if (c.data_followup !== undefined) {
              loaded = { ...loaded, data_followup: c.data_followup };
            }
            if (c.hora_reuniao !== undefined) {
              loaded = { ...loaded, hora_reuniao: c.hora_reuniao };
            }
          }
        }
      } catch {
        setTotalCardsSyncGrupo(0);
      }

      if (origem === 'legado') {
        try {
          const { data: procRow } = await supabase
            .from('processo_step_one')
            .select('numero_franquia, nome_condominio, quadra, lote, condominio_id')
            .eq('id', cardParaEstado.id)
            .maybeSingle();
          if (procRow) {
            const pr = procRow as {
              numero_franquia?: string | null;
              nome_condominio?: string | null;
              quadra?: string | null;
              lote?: string | null;
              condominio_id?: string | null;
            };
            const tituloCalc = montarTituloCardSync({
              nFranquia: pr.numero_franquia,
              nomeCondominio: pr.nome_condominio ?? cardParaEstado.nome_condominio,
              quadra: pr.quadra ?? cardParaEstado.quadra,
              lote: pr.lote ?? cardParaEstado.lote,
              tituloFallback: cardParaEstado.titulo,
            });
            cardParaEstado = {
              ...cardParaEstado,
              nome_condominio: pr.nome_condominio ?? cardParaEstado.nome_condominio,
              condominio_id: pr.condominio_id ?? cardParaEstado.condominio_id,
              quadra: pr.quadra ?? cardParaEstado.quadra,
              lote: pr.lote ?? cardParaEstado.lote,
              titulo: tituloCalc ?? cardParaEstado.titulo,
            };
          }
        } catch {
          /* mantém título da view */
        }
      }

      setCard(cardParaEstado);
      const dr = loaded.data_reuniao ? String(loaded.data_reuniao).slice(0, 10) : '';
      setDataReuniao(dr && dataIsoInputValida(dr) ? dr : '');
      setHoraReuniao(
        loaded.hora_reuniao ? String(loaded.hora_reuniao).trim().slice(0, 5) : '',
      );
      setDataFollowup(loaded.data_followup ? String(loaded.data_followup).slice(0, 10) : '');

      // Carregar tags
      if (loaded.kanban_id) {
        const [tk, tc] = await Promise.all([listarTagsKanban(loaded.kanban_id), listarTagsCard(loaded.id)]);
        setTagsKanban(tk);
        setTagsCard(tc);
      }

      try {
        let det = await fetchKanbanCardModalDetalhes(supabase, {
          origem,
          cardId: loaded.id,
          cardTitulo: cardParaEstado.titulo,
          redeFranqueadoId:
            origem === 'nativo'
              ? cardParaEstado.rede_franqueado_id ?? nativeRedeFranqueadoId
              : null,
          cardProjetoId: loaded.projeto_id ?? null,
          cardProcessoStepOneId: loaded.processo_step_one_id ?? null,
        });
        if (origem === 'nativo' && det.processo?.id) {
          const syncLinks = await reconciliarGboxPlanilhaMapaChecklist({
            cardId: loaded.id,
            processoId: det.processo.id,
          });
          if (syncLinks.ok && syncLinks.alterado) {
            det = await fetchKanbanCardModalDetalhes(supabase, {
              origem,
              cardId: loaded.id,
              cardTitulo: cardParaEstado.titulo,
              redeFranqueadoId:
                cardParaEstado.rede_franqueado_id ?? nativeRedeFranqueadoId ?? null,
              cardProjetoId: loaded.projeto_id ?? null,
              cardProcessoStepOneId: loaded.processo_step_one_id ?? null,
            });
          }
        }
        setModalDetalhes(det);
        setPreObraDraft(preObraDraftFromProcesso(det.processo));
      } catch {
        setModalDetalhes({ rede: null, processo: null, redeIdContrato: null, empresas: null });
        setPreObraDraft(preObraDraftFromProcesso(null));
      }

      const mapFaseRow = mapKanbanFaseRow;

      let fasesParaHistorico: KanbanFase[] = [];
      if (!fasesProp?.length) {
        let mapped = await fetchKanbanFasesAtivas(supabase, loaded.kanban_id);
        if (loaded.fase_id && !mapped.some((f) => f.id === loaded.fase_id)) {
          mapped = await augmentKanbanFasesComFasesDosCards(supabase, loaded.kanban_id, mapped, [
            loaded.fase_id,
          ]);
        }
        fasesParaHistorico = mapped;
        setFases(mapped);
        setFaseAtual(mapped.find((f) => f.id === loaded.fase_id) ?? null);
      } else {
        const normalizedFromProp = fasesProp.map((f) =>
          mapFaseRow({
            id: f.id,
            nome: f.nome,
            ordem: f.ordem,
            sla_dias: f.sla_dias,
            slug: f.slug ?? null,
            instrucoes: f.instrucoes ?? null,
            materiais: f.materiais as unknown,
          }),
        );
        let fasesResolved = normalizedFromProp;
        if (loaded.fase_id && !fasesResolved.some((f) => f.id === loaded.fase_id)) {
          fasesResolved = await augmentKanbanFasesComFasesDosCards(
            supabase,
            loaded.kanban_id,
            fasesResolved,
            [loaded.fase_id],
          );
        }
        fasesParaHistorico = fasesResolved;
        setFases(fasesResolved);
        setFaseAtual(fasesResolved.find((f) => f.id === loaded.fase_id) ?? null);
      }

      let cacheKanbanTimes: KanbanTimeRow[] = [];
      try {
        const { data: kt } = await supabase.from('kanban_times').select('id, nome').order('nome');
        cacheKanbanTimes = (kt ?? []).map((r) => ({ id: String(r.id), nome: String(r.nome) }));
        setKanbanTimes(cacheKanbanTimes);
      } catch {
        setKanbanTimes([]);
      }
      const nomePorTimeId = new Map(cacheKanbanTimes.map((t) => [t.id, t.nome]));

      try {
        const emailsMoni = [...MONI_TODOS_EMAILS];
        const [hdmProfRes, profOptsRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, email').in('email', emailsMoni),
          supabase
            .from('profiles')
            .select('id, full_name, email')
            .order('full_name', { ascending: true, nullsFirst: false })
            .limit(500),
        ]);
        const profOptsErr = profOptsRes.error;
        if (profOptsErr) throw profOptsErr;
        const byId = new Map<string, { id: string; nome: string; email: string | null }>();
        const ingestProf = (rows: { id: string; full_name?: string | null; email?: string | null }[] | null) => {
          for (const p of rows ?? []) {
            const id = String(p.id);
            const em = String(p.email ?? '')
              .trim()
              .toLowerCase();
            const fn = String(p.full_name ?? '').trim();
            byId.set(id, { id, nome: fn || em || id.slice(0, 8), email: em || null });
          }
        };
        ingestProf((hdmProfRes.data ?? []) as { id: string; full_name?: string | null; email?: string | null }[]);
        ingestProf((profOptsRes.data ?? []) as { id: string; full_name?: string | null; email?: string | null }[]);
        setResponsaveisOpcoes([...byId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      } catch {
        setResponsaveisOpcoes([]);
      }

      try {
        const hist = await loadHistoricoCardModal(
          supabase,
          cardId,
          origem === 'legado' ? 'legado' : 'nativo',
          fasesParaHistorico,
          loaded.kanban_id,
        );
        setHistorico(hist);
        if (
          origem !== 'legado' &&
          cardKanbanNaEsteiraPrincipalCalculadora(String(loaded.kanban_id ?? ''))
        ) {
          const histCalc = await loadHistoricoCalculadoraEsteira(
            supabase,
            cardId,
            'nativo',
            fasesEsteiraCalculadora,
          );
          setHistoricoCalculadora(histCalc);
        } else {
          setHistoricoCalculadora(hist);
        }
      } catch {
        setHistorico([]);
      }

      try {
        setComentariosCard(await carregarComentariosCardModal(cardId));
      } catch {
        setComentariosCard([]);
      }

      try {
        const { data: tokRow } = await supabase
          .from('kanban_card_form_tokens')
          .select('email_candidato')
          .eq('card_id', cardId)
          .not('email_candidato', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const emailTok = (tokRow as { email_candidato?: string | null } | null)?.email_candidato;
        if (emailTok) setEmailPara(emailTok);
      } catch {
        // sem token — mantém campo vazio
      }

      try {
        const interacoesSelect =
          'id, titulo, descricao, categoria, tipo, times_ids, responsaveis_ids, trava, status, prioridade, data_vencimento, responsavel_id, responsavel_nome_texto, time, created_at, concluida_em, origem, criado_por, arquivado, sirene_chamado_id, numero';
        let interacoesData: Record<string, unknown>[] | null = null;
        let interacoesError: { message: string } | null = null;
        {
          const first = await supabase
          .from('kanban_atividades')
            .select(interacoesSelect)
          .eq('card_id', cardId)
          .order('ordem', { ascending: true });
          interacoesData = (first.data ?? null) as Record<string, unknown>[] | null;
          interacoesError = first.error;
          if (interacoesError && /ordem/i.test(interacoesError.message)) {
            const fallback = await supabase
              .from('kanban_atividades')
              .select(interacoesSelect)
              .eq('card_id', cardId)
              .order('created_at', { ascending: true });
            interacoesData = (fallback.data ?? null) as Record<string, unknown>[] | null;
            interacoesError = fallback.error;
          }
        }

        if (interacoesError) {
          console.error('[KanbanCardModal] falha ao carregar kanban_atividades', interacoesError);
          setErroCarregarChamados(interacoesError.message);
          setInteracoes([]);
          setSubInteracoesPorPai({});
        } else if (!interacoesData?.length) {
          setErroCarregarChamados(null);
          setInteracoes([]);
          setSubInteracoesPorPai({});
        } else {
          setErroCarregarChamados(null);
          const rawRespArrays = interacoesData.map((a) => (a as { responsaveis_ids?: unknown }).responsaveis_ids);
          const respFromArrays = rawRespArrays.flatMap((arr) =>
            Array.isArray(arr) ? arr.map((x) => String(x)) : [],
          );
          const responsavelIds = [
            ...new Set([
              ...interacoesData.map((a) => a.responsavel_id).filter(Boolean),
              ...respFromArrays,
            ]),
          ] as string[];
          let responsaveisMap = new Map<string, { full_name: string | null }>();
          if (responsavelIds.length > 0) {
            const { data: responsaveisData } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', responsavelIds);
            responsaveisMap = new Map(responsaveisData?.map((r) => [r.id, { full_name: r.full_name }]) || []);
          }
          const mapeadas: InteracaoModal[] = interacoesData
            .map((a) => {
            const rawIds = (a as { times_ids?: unknown }).times_ids;
            const ids = Array.isArray(rawIds) ? rawIds.map((x) => String(x)) : [];
            const rawR = (a as { responsaveis_ids?: unknown }).responsaveis_ids;
            let respIds = Array.isArray(rawR) ? rawR.map((x) => String(x)) : [];
            const rid = a.responsavel_id ? String(a.responsavel_id) : null;
            if (respIds.length === 0 && rid) respIds = [rid];
            const tipoRaw = (a as { tipo?: string }).tipo;
            const tipo: 'atividade' | 'duvida' | 'proposicoes' = tipoRaw === 'duvida' ? 'duvida' : tipoRaw === 'proposicoes' ? 'proposicoes' : 'atividade';
            const times_resolvidos = ids.map((id) => ({ id, nome: nomePorTimeId.get(id) ?? id.slice(0, 8) }));
            const responsaveis_resolvidos = respIds.map((id) => ({
              id,
              nome: responsaveisMap.get(id)?.full_name?.trim() || id.slice(0, 8),
            }));
            const primeiroResp = respIds[0] ?? rid;
            const cp = (a as { criado_por?: string | null }).criado_por;
            const rnt = (a as { responsavel_nome_texto?: string | null }).responsavel_nome_texto;
            const responsavel_nome_texto =
              rnt != null && String(rnt).trim() !== '' ? String(rnt).trim() : null;
            return {
              id: String(a.id),
              titulo: String(a.titulo ?? ''),
              descricao: (a.descricao as string | null) ?? null,
              categoria: ((a as { categoria?: string }).categoria === 'melhoria' ? 'melhoria' : 'chamado') as
                | 'chamado'
                | 'melhoria',
              tipo,
              times_ids: ids,
              responsaveis_ids: respIds,
              trava: Boolean((a as { trava?: boolean }).trava),
              status: a.status as InteracaoModal['status'],
              prioridade: (a.prioridade as InteracaoModal['prioridade']) ?? 'normal',
              data_vencimento: (a.data_vencimento as string | null) ?? null,
              responsavel_id: rid,
              responsavel_nome_texto,
              time: (a.time as string | null) ?? null,
              created_at: String(a.created_at),
              concluida_em: (a.concluida_em as string | null) ?? null,
              criado_por: cp != null && String(cp).trim() !== '' ? String(cp) : null,
              profiles: primeiroResp ? responsaveisMap.get(primeiroResp) ?? null : null,
              times_resolvidos,
              responsaveis_resolvidos,
              arquivado: Boolean((a as { arquivado?: boolean | null }).arquivado),
              numero: (() => {
                const n = Number((a as { numero?: number | null }).numero);
                return Number.isFinite(n) ? n : null;
              })(),
              sirene_chamado_id: (() => {
                const sid = (a as { sirene_chamado_id?: number | string | null }).sirene_chamado_id;
                if (sid == null || sid === '') return null;
                const n = Number(sid);
                return Number.isFinite(n) ? n : null;
              })(),
            };
          })
            .filter((a) => !a.arquivado);
          setInteracoes(mapeadas);

          const actIds = mapeadas.map((m) => m.id);
          const { data: topicosRows } = await supabase
            .from('sirene_topicos')
            .select('id, interacao_id, nome, descricao, descricao_detalhe, tipo, times_ids, responsaveis_ids, data_fim, prazo_proposto, prazo_status, prazo_abridor_id, prazo_proposto_por, prazo_negociacao_expira_em, status, trava, pastel, historico, arquivado')
            .eq('arquivado', false)
            .in('interacao_id', actIds)
            .order('ordem', { ascending: true });

          const topicos = topicosRows ?? [];
          const tRespIds = [
            ...new Set(
              topicos.flatMap((t) => {
                const arr = (t as { responsaveis_ids?: unknown }).responsaveis_ids;
                return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
              }),
            ),
          ] as string[];
          const tTimeIds = [
            ...new Set(
              topicos.flatMap((t) => {
                const arr = (t as { times_ids?: unknown }).times_ids;
                return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
              }),
            ),
          ] as string[];
          let profTop = new Map<string, { full_name: string | null }>();
          if (tRespIds.length > 0) {
            const { data: pr } = await supabase.from('profiles').select('id, full_name').in('id', tRespIds);
            profTop = new Map((pr ?? []).map((r) => [String((r as { id: string }).id), { full_name: (r as { full_name?: string | null }).full_name ?? null }]));
          }
          const timeTopMap = new Map(cacheKanbanTimes.map((t) => [t.id, t.nome]));
          const porPai: Record<string, SubInteracaoModal[]> = {};
          for (const t of topicos) {
            const iid = String((t as { interacao_id: string }).interacao_id);
            const rawTi = (t as { times_ids?: unknown }).times_ids;
            const ti = Array.isArray(rawTi) ? rawTi.map((x) => String(x)) : [];
            const rawRi = (t as { responsaveis_ids?: unknown }).responsaveis_ids;
            let ri = Array.isArray(rawRi) ? rawRi.map((x) => String(x)) : [];
            const st = String((t as { status?: string }).status ?? 'nao_iniciado') as SubInteracaoStatusDb;
            const tipoRaw = String((t as { tipo?: string }).tipo ?? 'atividade').toLowerCase();
            const tipoSub: SubInteracaoTipoDb =
              tipoRaw === 'duvida' || tipoRaw === 'chamado' || tipoRaw === 'proposicoes' ? (tipoRaw as SubInteracaoTipoDb) : 'atividade';
            const row: SubInteracaoModal = {
              id: String((t as { id: number }).id),
              interacao_id: iid,
              tipo: tipoSub,
              nome: String((t as { nome?: string }).nome ?? (t as { descricao?: string }).descricao ?? ''),
              descricao: String((t as { descricao?: string }).descricao ?? ''),
              descricao_detalhe: (t as { descricao_detalhe?: string | null }).descricao_detalhe ?? null,
              times_ids: ti,
              responsaveis_ids: ri,
              times_resolvidos: ti.map((id) => ({ id, nome: timeTopMap.get(id) ?? id.slice(0, 8) })),
              responsaveis_resolvidos: ri.map((id) => ({
                id,
                nome: profTop.get(id)?.full_name?.trim() || id.slice(0, 8),
              })),
              data_fim: (t as { data_fim?: string | null }).data_fim != null ? String((t as { data_fim: string }).data_fim).slice(0, 10) : null,
              ...camposPrazoNegociacaoDeTopicoRow(t as Record<string, unknown>),
              status: ['nao_iniciado', 'em_andamento', 'concluido', 'aprovado'].includes(st) ? st : 'nao_iniciado',
              trava: Boolean((t as { trava?: boolean }).trava),
              pastel: Boolean((t as { pastel?: boolean }).pastel),
              historico: Array.isArray((t as { historico?: unknown }).historico)
                ? ((t as { historico: Array<{ tipo: string; em: string }> }).historico ?? [])
                : [],
            };
            if (!porPai[iid]) porPai[iid] = [];
            porPai[iid]!.push(row);
          }
          setSubInteracoesPorPai(porPai);
        }
      } catch (e) {
        console.error('[KanbanCardModal] exceção ao carregar chamados', e);
        setErroCarregarChamados('Erro inesperado ao carregar chamados.');
        setInteracoes([]);
        setSubInteracoesPorPai({});
      }

      if (origem !== 'legado') {
        const faseCarregada = fasesParaHistorico.find((f) => f.id === loaded.fase_id);
        const slugAbertura = faseCarregada?.slug?.trim() ?? '';
        if (loaded.kanban_id === KANBAN_IDS.OPERACOES && slugAbertura === FASE_SLUGS.APROVACAO_PREFEITURA) {
          const pend = await consultarAberturaCreditoObraPendente(loaded.id);
          if (pend.ok && pend.deveExibir) {
            setCreditoObraAbertura({
              tituloCard: pend.tituloCard,
              dataEnvio: pend.dataEnvio,
              dataEnvioExibicao: pend.dataEnvioExibicao,
            });
          } else {
            setCreditoObraAbertura(null);
          }
        } else {
          setCreditoObraAbertura(null);
        }

        if (
          loaded.kanban_id === KANBAN_IDS.PORTFOLIO &&
          slugAbertura === FASE_SLUGS.PASSAGEM_WAYSER
        ) {
          void garantirBastaoPassagemWayser(loaded.id);
        }
      }
    } catch {
      // noop
    } finally {
      if (!silencioso) setLoading(false);
    }
  }

  useEffect(() => {
    if (!card || !fasesProp?.length) return;
    const f = fasesProp.find((x) => x.id === card.fase_id);
    if (f) setFaseAtual(f);
  }, [card, fasesProp]);

  useEffect(() => {
    const interacaoId = String(deepLinkInteracaoId ?? '').trim();
    if (!interacaoId || interacoes.length === 0) return;
    setSubExpandida((s) => ({ ...s, [interacaoId]: true }));
    const topicoId = String(deepLinkTopicoId ?? '').trim();
    if (topicoId) {
      setSubAtividadeExpandida((s) => ({ ...s, [topicoId]: true }));
    }
  }, [deepLinkInteracaoId, deepLinkTopicoId, interacoes.length]);

  useEffect(() => {
    const topicoId = String(deepLinkTopicoId ?? '').trim();
    if (!topicoId) return;
    for (const subs of Object.values(subInteracoesPorPai)) {
      const sub = subs.find((s) => String(s.id) === topicoId);
      if (sub && isSubAtividadeConcluida(sub.status)) {
        setFiltros((f) => ({ ...f, mostrarAtividadesConcluidas: true }));
        setFiltrosDraft((f) => ({ ...f, mostrarAtividadesConcluidas: true }));
        break;
      }
    }
  }, [deepLinkTopicoId, subInteracoesPorPai]);

  async function handleAdicionarInteracao() {
    if (!card || !novaInteracao.titulo.trim()) return;
    if (!novaInteracao.descricao.trim()) {
      alert('Informe a descrição do chamado.');
      return;
    }
    const ativ = novaInteracao.atividade;
    if (!novaAtividadeAberta || !ativ.nome.trim()) {
      alert('Abra "+ Atividade" e preencha a primeira atividade.');
      setNovaAtividadeAberta(true);
      return;
    }
    if (ativ.timesIds.length === 0) {
      alert('Selecione ao menos um time na atividade.');
      return;
    }
    if (ativ.responsaveisIds.length === 0) {
      alert('Selecione ao menos um responsável na atividade.');
      return;
    }
    if (!podeCriarChamados) {
      alert('Sem permissão para criar chamados.');
      return;
    }
    setLoading(true);
    try {
      const pendingAnexos = ativ.pendingAnexos ?? [];
      const res = await criarChamadoSireneComAtividade({
        card_id: card.id,
        card_kanban_nome: typeof kanbanNome === 'string' ? kanbanNome : String(kanbanNome),
        card_titulo: card.titulo?.trim() || null,
        titulo: novaInteracao.titulo.trim(),
        descricao: novaInteracao.descricao.trim(),
        categoria: novaInteracao.categoria,
        status: novaInteracao.status,
        trava: novaInteracao.trava,
        atividade: {
          nome: ativ.nome.trim(),
          descricao_detalhe: ativ.descricaoDetalhe.trim() || null,
          times_ids: ativ.timesIds,
          responsaveis_ids: ativ.responsaveisIds,
          data_fim: ativ.data.trim() || null,
          status: ativ.status,
          pastel: ativ.pastel,
        },
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      if (res.interacaoId && pendingAnexos.length > 0) {
        const supabase = createClient();
        const { data: topico } = await supabase
          .from('sirene_topicos')
          .select('id')
          .eq('interacao_id', res.interacaoId)
          .order('ordem', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (topico) {
          await uploadAnexosAtividadePendentes(
            String((topico as { id: number }).id),
            pendingAnexos,
            modalSessao.uploaderNome,
            basePath,
          );
        }
      }
      setNovaInteracao({
        titulo: '',
        descricao: '',
        categoria: 'chamado',
        status: 'pendente',
        trava: false,
        atividade: { ...ATIVIDADE_FORM_DRAFT_VAZIO },
      });
      setNovoChamadoFormAberto(false);
      setNovaAtividadeAberta(false);
      await loadCard();
      router.refresh();
    } catch {
      alert('Erro ao criar chamado.');
    } finally {
      setLoading(false);
    }
  }

  function toggleSubNovaResponsavel(id: string) {
    setSubNovaDraft((s) => ({
      ...s,
      responsaveisIds: s.responsaveisIds.includes(id)
        ? s.responsaveisIds.filter((x) => x !== id)
        : [...s.responsaveisIds, id],
    }));
  }

  function toggleSubNovaTime(id: string) {
    setSubNovaDraft((s) => ({
      ...s,
      timesIds: s.timesIds.includes(id) ? s.timesIds.filter((x) => x !== id) : [...s.timesIds, id],
    }));
  }

  function abrirEdicaoInteracao(it: InteracaoModal) {
    setEditingId(it.id);
    setEditDraft({
      titulo: it.titulo ?? '',
      descricao: it.descricao ?? '',
      categoria: it.categoria ?? 'chamado',
    });
  }

  async function salvarEdicaoInteracao() {
    if (!editingId) return;
    if (!editDraft.titulo.trim()) {
      alert('Informe o título do chamado.');
      return;
    }
    if (!editDraft.descricao.trim()) {
      alert('Informe a descrição do chamado.');
      return;
    }
    setSalvandoEdicao(true);
    try {
      const res = await editarInteracao(editingId, {
        titulo: editDraft.titulo.trim(),
        descricao: editDraft.descricao.trim(),
        categoria: editDraft.categoria,
        basePath,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setEditingId(null);
      await loadCard();
      router.refresh();
    } catch {
      alert('Erro ao salvar chamado.');
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function reloadSubsForParent(interacaoId: string) {
    const supabase = createClient();
    const { data: topicosRows } = await supabase
      .from('sirene_topicos')
      .select('id, interacao_id, nome, descricao, descricao_detalhe, tipo, times_ids, responsaveis_ids, data_fim, prazo_proposto, prazo_status, prazo_abridor_id, prazo_proposto_por, prazo_negociacao_expira_em, status, trava, pastel, historico')
      .eq('interacao_id', interacaoId)
      .order('ordem', { ascending: true });
    const topicos = topicosRows ?? [];
    const timeTopMap = new Map(kanbanTimes.map((t) => [t.id, t.nome]));
    const tRespIds = [
      ...new Set(
        topicos.flatMap((t) => {
          const arr = (t as { responsaveis_ids?: unknown }).responsaveis_ids;
          return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
        }),
      ),
    ] as string[];
    let profTop = new Map<string, { full_name: string | null }>();
    if (tRespIds.length > 0) {
      const { data: pr } = await supabase.from('profiles').select('id, full_name').in('id', tRespIds);
      profTop = new Map(
        (pr ?? []).map((r) => [
          String((r as { id: string }).id),
          { full_name: (r as { full_name?: string | null }).full_name ?? null },
        ]),
      );
    }
    const mapped: SubInteracaoModal[] = topicos.map((t) => {
      const iid = String((t as { interacao_id: string }).interacao_id);
      const rawTi = (t as { times_ids?: unknown }).times_ids;
      const ti = Array.isArray(rawTi) ? rawTi.map((x) => String(x)) : [];
      const rawRi = (t as { responsaveis_ids?: unknown }).responsaveis_ids;
      const ri = Array.isArray(rawRi) ? rawRi.map((x) => String(x)) : [];
      const st = String((t as { status?: string }).status ?? 'nao_iniciado') as SubInteracaoStatusDb;
      const tipoRaw = String((t as { tipo?: string }).tipo ?? 'atividade').toLowerCase();
      const tipoSub: SubInteracaoTipoDb =
        tipoRaw === 'duvida' || tipoRaw === 'chamado' ? (tipoRaw as SubInteracaoTipoDb) : 'atividade';
      return {
        id: String((t as { id: number | string }).id),
        interacao_id: iid,
        tipo: tipoSub,
        nome: String((t as { nome?: string }).nome ?? (t as { descricao?: string }).descricao ?? ''),
        descricao: String((t as { descricao?: string }).descricao ?? ''),
        descricao_detalhe: (t as { descricao_detalhe?: string | null }).descricao_detalhe ?? null,
        times_ids: ti,
        responsaveis_ids: ri,
        times_resolvidos: ti.map((id) => ({ id, nome: timeTopMap.get(id) ?? id.slice(0, 8) })),
        responsaveis_resolvidos: ri.map((id) => ({
          id,
          nome: profTop.get(id)?.full_name?.trim() || id.slice(0, 8),
        })),
        data_fim:
          (t as { data_fim?: string | null }).data_fim != null
            ? String((t as { data_fim: string }).data_fim).slice(0, 10)
            : null,
        ...camposPrazoNegociacaoDeTopicoRow(t as Record<string, unknown>),
        status: ['nao_iniciado', 'em_andamento', 'concluido', 'aprovado'].includes(st) ? st : 'nao_iniciado',
        trava: Boolean((t as { trava?: boolean }).trava),
        pastel: Boolean((t as { pastel?: boolean }).pastel),
        historico: Array.isArray((t as { historico?: unknown }).historico)
          ? ((t as { historico: Array<{ tipo: string; em: string }> }).historico ?? [])
          : [],
      };
    });
    setSubInteracoesPorPai((prev) => ({ ...prev, [interacaoId]: mapped }));
  }

  async function handleCriarSubInteracao(interacaoId: string) {
    if (!subNovaDraft.nome.trim()) return;
    if (subNovaDraft.timesIds.length === 0) {
      alert('Selecione ao menos um time.');
      return;
    }
    if (subNovaDraft.responsaveisIds.length === 0) {
      alert('Selecione ao menos um responsável.');
      return;
    }
    if (!podeCriarChamados) {
      alert('Sem permissão para criar chamados.');
      return;
    }
    setSalvandoSub(true);
    try {
      const pendingAnexos = subNovaDraft.pendingAnexos ?? [];
      const res = await criarSubInteracao({
        interacao_id: interacaoId,
        nome: subNovaDraft.nome.trim(),
        descricao_detalhe: subNovaDraft.descricaoDetalhe.trim() || null,
        times_ids: subNovaDraft.timesIds,
        responsaveis_ids: subNovaDraft.responsaveisIds,
        data_fim: subNovaDraft.data.trim() || null,
        status: subNovaDraft.status,
        pastel: subNovaDraft.pastel,
        basePath,
        origem,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      if (res.topicoId && pendingAnexos.length > 0) {
        await uploadAnexosAtividadePendentes(
          res.topicoId,
          pendingAnexos,
          modalSessao.uploaderNome,
          basePath,
        );
      }
      setSubNovaDraft({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
      setSubFormInteracaoId(null);
      setSubExpandida((s) => ({ ...s, [interacaoId]: true }));
      await reloadSubsForParent(interacaoId);
      await loadCard();
    } catch {
      alert('Erro ao criar atividade.');
    } finally {
      setSalvandoSub(false);
    }
  }

  async function handleEditarSubInteracao(subId: string) {
    if (!editSubDraft.nome.trim()) {
      alert('Informe o nome da atividade.');
      return;
    }
    if (editSubDraft.timesIds.length === 0) {
      alert('Selecione ao menos um time.');
      return;
    }
    if (editSubDraft.responsaveisIds.length === 0) {
      alert('Selecione ao menos um responsável.');
      return;
    }
    setSalvandoEditSub(true);
    try {
      const res = await editarSubInteracao(
        subId,
        {
          nome: editSubDraft.nome.trim(),
          descricao_detalhe: editSubDraft.descricaoDetalhe.trim() || null,
          times_ids: editSubDraft.timesIds,
          responsaveis_ids: editSubDraft.responsaveisIds,
          data_fim: editSubDraft.data.trim() || null,
          status: editSubDraft.status,
          pastel: editSubDraft.pastel,
        },
        basePath,
      );
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setEditingSubId(null);
      const pai = Object.entries(subInteracoesPorPai).find(([, subs]) => subs.some((s) => s.id === subId));
      if (pai) await reloadSubsForParent(pai[0]);
      await loadCard();
    } catch {
      alert('Erro ao salvar atividade.');
    } finally {
      setSalvandoEditSub(false);
    }
  }

  async function handleExcluirSubInteracao(subId: string, interacaoId: string) {
    if (!window.confirm('Excluir esta atividade? Esta ação não pode ser desfeita.')) return;
    const res = await excluirSubInteracao(subId, basePath);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    await reloadSubsForParent(interacaoId);
    await loadCard();
    router.refresh();
  }

  async function handleSubStatusChange(
    parentInteracaoId: string,
    topicoId: string,
    status: SubInteracaoStatusDb,
  ) {
    const res = await atualizarStatusSubInteracao(topicoId, status, basePath);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    await loadCard();
    router.refresh();
  }

  async function handleTogglePastel(subId: string, checked: boolean) {
    const res = await togglePastelAtividade(subId, checked, basePath);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    await loadCard();
  }

  async function handleInteracaoStatusChange(
    interacaoId: string,
    novo: 'pendente' | 'em_andamento' | 'concluida',
  ) {
    if (novo === 'em_andamento') {
      alert('O status em andamento é definido automaticamente pelas atividades.');
      return;
    }
    const temSubAberta = (subInteracoesPorPai[interacaoId] ?? []).some(
      (s) => s.status !== 'concluido' && s.status !== 'aprovado',
    );
    if (novo === 'concluida' && temSubAberta) {
      alert('Conclua todas as sub-interações antes de concluir o chamado.');
      return;
    }
    if (novo === 'concluida') {
      const it = interacoes.find((x) => x.id === interacaoId);
      const criador = String(it?.criado_por ?? '');
      if (criador && criador !== modalSessao.userId) {
        alert('Somente quem abriu o chamado pode marcá-lo como concluído.');
        return;
      }
      setConclusaoInteracaoId(interacaoId);
      return;
    }
    const res = await atualizarStatusInteracao(interacaoId, novo, basePath);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    await loadCard();
    router.refresh();
  }

  async function confirmarConclusaoInteracaoCard(payload: {
    suficiente: boolean;
    texto: string;
  }) {
    const id = conclusaoInteracaoId;
    if (!id) return;
    const res = await atualizarStatusInteracao(id, 'concluida', basePath, {
      infoConclusaoCriador: payload.texto,
      resolucaoSuficiente: payload.suficiente,
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setConclusaoInteracaoId(null);
    await loadCard();
    router.refresh();
  }

  async function handleConfirmarFinalizarCard() {
    if (!card || origem === 'legado') return;
    if (!pode('finalizar_cards')) {
      alert('Sem permissão para finalizar cards.');
      return;
    }
    setLoading(true);
    try {
      const r = await finalizarCard({ cardId: card.id, basePath });
      if (!r.ok) {
        alert(r.error ?? 'Não foi possível finalizar.');
        return;
      }
      setConfirmandoFinalizar(false);
      await loadCard();
      router.refresh();
    } catch {
      alert('Erro ao finalizar o card.');
    } finally {
      setLoading(false);
    }
  }

  async function registrarMovimentoLegadoKanban(fromSlug: string, toSlug: string) {
    if (origem !== 'legado' || !card) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const nome = String((prof as { full_name?: string | null } | null)?.full_name ?? '').trim();
    await supabase.from('processo_card_eventos').insert({
      processo_id: card.id,
      autor_id: user.id,
      autor_nome: nome.length > 0 ? nome : null,
      etapa_painel: toSlug,
      tipo: 'card_move',
      descricao: 'Movimentação no funil (legado)',
      detalhes: { from: fromSlug, to: toSlug },
    });
  }

  async function executarAvancarFase(
    proximaFase: KanbanFase,
    opts?: { motivoReprovacaoAcoplamento?: string; justificativaSlaQuebra?: string },
  ) {
    if (!card || !faseAtual) return;
    setMovendoFase(true);
    try {
      const supabase = createClient();
      if (origem === 'legado') {
        const slug = proximaFase.slug?.trim();
        if (!slug) {
          alert('Esta fase não tem slug cadastrado; não é possível avançar o processo por aqui.');
          return;
        }
        const fromSlug = faseAtual.slug?.trim();
        const { error } = await supabase.from('processo_step_one').update({ etapa_painel: slug }).eq('id', card.id);
        if (error) throw error;
        if (fromSlug) await registrarMovimentoLegadoKanban(fromSlug, slug);
      } else {
        const res = await moverCardParaFase({
          cardId: card.id,
          novaFaseId: proximaFase.id,
          basePath,
          kanbanNome: typeof kanbanNome === 'string' ? kanbanNome : String(kanbanNome),
          motivoReprovacaoAcoplamento: opts?.motivoReprovacaoAcoplamento,
          justificativaSlaQuebra: opts?.justificativaSlaQuebra,
        });
        if (!res.ok) {
          const msg = res.error ?? 'Erro ao avançar fase.';
          const destinoStep5 =
            String(proximaFase.slug ?? '').trim() === FASE_SLUGS.STEP_5 &&
            isPortfolioKanbanRef(null, typeof kanbanNome === 'string' ? kanbanNome : String(kanbanNome));
          if (destinoStep5) setGateStep5Toast(msg);
          else alert(msg);
          return;
        }
      }
      await loadCard({ silencioso: true });
      router.refresh();
    } catch {
      alert('Erro ao avançar fase.');
    } finally {
      setMovendoFase(false);
    }
  }

  async function executarRetrocederFase(destinoFase: KanbanFase) {
    if (!card || !faseAtual) return;
    setMovendoFase(true);
    try {
      const supabase = createClient();
      if (origem === 'legado') {
        const slug = destinoFase.slug?.trim();
        if (!slug) {
          alert('Esta fase não tem slug cadastrado; não é possível retroceder o processo por aqui.');
          return;
        }
        const fromSlug = faseAtual.slug?.trim();
        const { error } = await supabase.from('processo_step_one').update({ etapa_painel: slug }).eq('id', card.id);
        if (error) throw error;
        if (fromSlug) await registrarMovimentoLegadoKanban(fromSlug, slug);
      } else {
        const { error } = await supabase.from('kanban_cards').update({ fase_id: destinoFase.id }).eq('id', card.id);
        if (error) throw error;
      }
      await loadCard({ silencioso: true });
      router.refresh();
    } catch {
      alert('Erro ao retroceder fase.');
    } finally {
      setMovendoFase(false);
    }
  }

  function tipoConfirmacaoSaidaAtual():
    | { dominio: 'portfolio'; tipo: PortfolioConfirmacaoFaseTipo }
    | { dominio: 'operacoes'; tipo: OperacoesConfirmacaoFaseTipo }
    | null {
    if (!card || isLegado) return null;
    const portfolio = deveConfirmarSaidaFasePortfolio({
      kanbanId: card.kanban_id,
      faseSlug: faseAtual?.slug,
      origemCard: origem,
    });
    if (portfolio) return { dominio: 'portfolio', tipo: portfolio };
    const operacoes = deveConfirmarSaidaFaseOperacoes({
      kanbanId: card.kanban_id,
      faseSlug: faseAtual?.slug,
      origemCard: origem,
    });
    if (operacoes) return { dominio: 'operacoes', tipo: operacoes };
    return null;
  }

  function perguntaConfirmacaoSaida(modal: NonNullable<typeof modalConfirmacaoPortfolio>): string {
    if (modal.dominio === 'operacoes') {
      return operacoesConfirmacaoPergunta(modal.tipo as OperacoesConfirmacaoFaseTipo);
    }
    return portfolioConfirmacaoPergunta(modal.tipo as PortfolioConfirmacaoFaseTipo);
  }

  async function iniciarMovimentoFasePortfolio(
    destinoFase: KanbanFase,
    direcao: 'avancar' | 'retroceder',
    opts?: { motivoReprovacaoAcoplamento?: string; justificativaSlaQuebra?: string },
  ) {
    const confirmacaoSaida = tipoConfirmacaoSaidaAtual();
    if (confirmacaoSaida) {
      setModalJustificativaSla(null);
      setSlaJustificativaDraft('');
      setModalReprovacaoAcoplamento(null);
      setMotivoReprovacaoDraft('');
      setModalConfirmacaoPortfolio({ ...confirmacaoSaida, destinoFase, direcao, opts });
      return;
    }
    if (direcao === 'avancar' && card) {
      const confirmacaoEntrada = deveConfirmarEntradaFaseOperacoes({
        kanbanId: card.kanban_id,
        destinoFaseSlug: destinoFase.slug,
        origemCard: origem,
        direcao,
      });
      if (confirmacaoEntrada) {
        setModalJustificativaSla(null);
        setSlaJustificativaDraft('');
        setModalReprovacaoAcoplamento(null);
        setMotivoReprovacaoDraft('');
        setModalConfirmacaoPortfolio({
          dominio: 'operacoes',
          tipo: confirmacaoEntrada,
          destinoFase,
          direcao,
          opts,
        });
        return;
      }
    }
    if (direcao === 'avancar') await executarAvancarFase(destinoFase, opts);
    else await executarRetrocederFase(destinoFase);
  }

  async function concluirConfirmacaoPortfolio(confirmou: boolean) {
    const modal = modalConfirmacaoPortfolio;
    if (!modal || !card) return;
    setSalvandoConfirmacaoPortfolio(true);
    try {
      if (confirmou) {
        const res =
          modal.dominio === 'operacoes'
            ? await registrarConfirmacaoFaseOperacoes({
                cardId: card.id,
                tipo: modal.tipo as OperacoesConfirmacaoFaseTipo,
                basePath,
              })
            : await registrarConfirmacaoFasePortfolio({
                cardId: card.id,
                tipo: modal.tipo as PortfolioConfirmacaoFaseTipo,
                basePath,
              });
        if (!res.ok) {
          alert(res.error ?? 'Não foi possível registrar a confirmação.');
          return;
        }
      }

      if (
        confirmou &&
        modal.dominio === 'operacoes' &&
        modal.tipo === 'em_obra' &&
        modal.direcao === 'avancar'
      ) {
        const confirmacaoEntrada = deveConfirmarEntradaFaseOperacoes({
          kanbanId: card.kanban_id,
          destinoFaseSlug: modal.destinoFase.slug,
          origemCard: origem,
          direcao: 'avancar',
        });
        if (confirmacaoEntrada) {
          setModalConfirmacaoPortfolio({
            dominio: 'operacoes',
            tipo: confirmacaoEntrada,
            destinoFase: modal.destinoFase,
            direcao: modal.direcao,
            opts: modal.opts,
          });
          return;
        }
      }

      if (modal.direcao === 'avancar') await executarAvancarFase(modal.destinoFase, modal.opts);
      else await executarRetrocederFase(modal.destinoFase);
      setModalConfirmacaoPortfolio(null);
    } finally {
      setSalvandoConfirmacaoPortfolio(false);
    }
  }

  async function handleAvancarFase() {
    if (!card || !faseAtual) return;
    if (!podeMoverFaseCard) {
      alert('Sem permissão para mover de fase.');
      return;
    }
    const idxAtual = fases.findIndex((f) => f.id === faseAtual.id);
    const proximaFase = idxAtual >= 0 && idxAtual < fases.length - 1 ? fases[idxAtual + 1] : undefined;
    if (!proximaFase) {
      alert('Esta é a última fase do funil.');
      return;
    }
    if (
      (isPortfolioKanbanRef(null, String(kanbanNome)) || isLoteadoresKanbanRef(card.kanban_id, String(kanbanNome))) &&
      origem !== 'legado'
    ) {
      const gate = await verificarGatePortfolioStep5(card.id, proximaFase.id);
      if (!gate.ok) {
        setGateStep5Toast(gate.error ?? 'Não é possível avançar para o Comitê.');
        return;
      }
      setGateStep5Toast(null);
    }

    if (
      !isLegado &&
      isPortfolioKanbanRef(card.kanban_id, String(kanbanNome)) &&
      (faseAtual.slug ?? '').trim() === FASE_SLUGS.STEP_4
    ) {
      const gateLegal = await verificarGateChecklistLegalPortfolio(card.id, proximaFase.id);
      if (!gateLegal.ok) {
        alert(gateLegal.error ?? 'Conclua o Checklist Legal antes de avançar.');
        return;
      }
    }

    setAcoplamentoGateToast(null);
    if (
      !isLegado &&
      card.kanban_id === KANBAN_IDS.ACOPLAMENTO &&
      (faseAtual.slug ?? '').trim() === FASE_SLUGS.MODELAGEM_CASA_GBOX
    ) {
      const gateAcop = await verificarGateAcoplamentoModelagemCasa(card.id, proximaFase.id);
      if (!gateAcop.ok) {
        setAcoplamentoGateToast(gateAcop.error);
        return;
      }
    }

    const proximaSlug = (proximaFase.slug ?? '').trim();
    if (
      !isLegado &&
      card.kanban_id === KANBAN_IDS.ACOPLAMENTO &&
      proximaSlug === FASE_SLUGS.ACOPLAMENTO_REPROVADO
    ) {
      setMotivoReprovacaoDraft('');
      setModalReprovacaoAcoplamento(proximaFase);
      return;
    }

    if (
      !isLegado &&
      isLoteadoresKanbanRef(card.kanban_id, String(kanbanNome)) &&
      cardLoteadoresPrecisaJustificativaSla({
        kanbanId: card.kanban_id,
        kanbanNome: String(kanbanNome),
        faseSlug: faseAtual.slug,
        slaStatus: slaCard.status,
        slaJustificativa: card.sla_justificativa,
        sla_dias: faseAtual.sla_dias,
      })
    ) {
      setSlaJustificativaDraft('');
      setModalJustificativaSla(proximaFase);
      return;
    }

    if (!confirm(`Avançar para a fase "${proximaFase.nome}"?`)) return;

    const checklist = await verificarChecklistParaFase(card.id);
    if (checklist.bloqueado) {
      setModalAprovacaoFase({ fase: proximaFase, direcao: 'avancar', itensPendentes: checklist.itens_pendentes });
      return;
    }
    await iniciarMovimentoFasePortfolio(proximaFase, 'avancar');
  }

  async function handleRetrocederFase() {
    if (!card || !faseAtual) return;
    if (!podeMoverFaseCard) {
      alert('Sem permissão para mover de fase.');
      return;
    }
    const idxAtual = fases.findIndex((f) => f.id === faseAtual.id);
    const faseAnterior = idxAtual > 0 ? fases[idxAtual - 1] : undefined;
    if (!faseAnterior) {
      alert('Esta é a primeira fase do funil.');
      return;
    }
    if (!confirm(`Voltar para a fase "${faseAnterior.nome}"?`)) return;
    await iniciarMovimentoFasePortfolio(faseAnterior, 'retroceder');
  }

  async function handleSolicitarAprovacaoFase() {
    if (!card || !modalAprovacaoFase) return;
    setSolicitandoAprovacaoFase(true);
    try {
      const res = await solicitarAprovacaoFase({
        card_id: card.id,
        fase_destino: modalAprovacaoFase.fase.nome ?? modalAprovacaoFase.fase.id,
        card_titulo: card.titulo,
        itens_pendentes: modalAprovacaoFase.itensPendentes,
        basePath,
      });
      if (!res.ok) {
        alert(`Erro ao solicitar aprovação: ${res.error}`);
        return;
      }
      setModalAprovacaoFase(null);
      alert('Solicitação enviada. Aguarde aprovação do Bombeiro.');
    } catch {
      alert('Erro ao enviar solicitação.');
    } finally {
      setSolicitandoAprovacaoFase(false);
    }
  }

  async function handleAbrirAnexoComentario(storagePath: string) {
    const res = await urlAssinadaAnexoComentarioKanbanCard(storagePath);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    window.open(res.url, '_blank', 'noopener,noreferrer');
  }

  async function handleEnviarComentarioCard() {
    if (!card || !novoComentarioCard.trim()) return;
    setSalvandoComentario(true);
    try {
      const conteudo = (comentarioEditorRef.current?.innerHTML ?? novoComentarioCard).trim();
      const pendingAnexos = [...comentarioPendingAnexos];
      const result = await publicarComentarioKanbanCard({
        cardId: card.id,
        conteudo,
        basePath,
      });
      if (!result.ok) {
        alert(result.error);
        return;
      }
      if (pendingAnexos.length > 0) {
        await uploadAnexosComentarioPendentes(card.id, result.comentarioId, pendingAnexos, basePath);
      }
      setNovoComentarioCard('');
      setComentarioPendingAnexos([]);
      if (comentarioEditorRef.current) comentarioEditorRef.current.innerHTML = '';
      setComentariosCard(await carregarComentariosCardModal(card.id));
    } catch (err) {
      alert(`Exceção inesperada: ${String((err as Error)?.message ?? err)}`);
    } finally {
      setSalvandoComentario(false);
    }
  }

  async function handleEditarComentario(comentarioId: string) {
    if (!card) return;
    const uid = modalSessao.userId;
    if (!uid) {
      alert('Faça login para editar o comentário.');
      return;
    }
    const html = (comentarioEdicaoRef.current?.innerHTML ?? editComentarioDraft).trim();
    const plain = (comentarioEdicaoRef.current?.innerText ?? '').trim();
    if (!plain) return;
    setSalvandoEdicaoComentario(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('kanban_card_comentarios')
        .update({ conteudo: html })
        .eq('id', comentarioId)
        .eq('autor_id', uid);
      if (error) throw error;
      setEditingComentarioId(null);
      setEditComentarioDraft('');
      if (comentarioEdicaoRef.current) comentarioEdicaoRef.current.innerHTML = '';
      setComentariosCard(await carregarComentariosCardModal(card.id));
    } catch {
      alert('Erro ao editar comentário.');
    } finally {
      setSalvandoEdicaoComentario(false);
    }
  }

  async function handleExcluirComentario(comentarioId: string) {
    if (!confirm('Excluir este comentário?')) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('kanban_card_comentarios')
        .delete()
        .eq('id', comentarioId)
        .eq('autor_id', modalSessao.userId ?? '');
      if (error) throw error;
      setComentariosCard((prev) => prev.filter((c) => c.id !== comentarioId));
    } catch {
      alert('Erro ao excluir comentário.');
    }
  }

  async function handleConfirmarArquivar() {
    if (!card) return;
    const rl = modalSessao.roleNorm;
    const podeArquivar =
      pode('arquivar_cards') ||
      rl === 'admin' ||
      rl === 'team' ||
      rl === 'supervisor' ||
      rl === 'consultor';
    if (ocultarGestaoCard || !podeArquivar) {
      alert('Sem permissão para arquivar cards.');
      return;
    }
    const motivo = formatMotivoArquivamento(motivoCategoriaArquivamento, motivoObservacaoOutro);
    if (!motivoArquivamentoProntoParaEnviar(motivoCategoriaArquivamento, motivoObservacaoOutro)) {
      if (isMotivoArquivamentoOutro(motivoCategoriaArquivamento)) {
        alert(`Para "Outro", informe uma observação de ${MOTIVO_ARQUIVAMENTO_OBS_MIN} a ${MOTIVO_ARQUIVAMENTO_OBS_MAX} caracteres.`);
      } else {
        alert('Selecione o motivo do arquivamento.');
      }
      return;
    }
    setLoading(true);
    try {
      const r = await arquivarCard({
        cardId: card.id,
        motivo,
        basePath,
        origem: origem === 'legado' ? 'legado' : 'nativo',
      });
      if (!r.ok) {
        alert(r.error ?? 'Não foi possível arquivar o card.');
        return;
      }
      router.refresh();
      onClose();
    } catch {
      alert('Erro ao arquivar o card. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmarDesarquivar() {
    if (!card) return;
    const rl = modalSessao.roleNorm;
    const podeDesarquivar =
      pode('arquivar_cards') ||
      rl === 'admin' ||
      rl === 'team' ||
      rl === 'supervisor' ||
      rl === 'consultor';
    if (ocultarGestaoCard || !podeDesarquivar) {
      alert('Sem permissão para desarquivar cards.');
      return;
    }
    if (!confirm('Desarquivar este card? Ele voltará a aparecer no kanban.')) return;
    setLoading(true);
    try {
      const r = await desarquivarCard({
        cardId: card.id,
        basePath,
        origem: origem === 'legado' ? 'legado' : 'nativo',
      });
      if (!r.ok) {
        alert(r.error ?? 'Não foi possível desarquivar o card.');
        return;
      }
      router.refresh();
      onClose();
    } catch {
      alert('Erro ao desarquivar o card. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function toggleSecaoEsquerda(id: SecaoEsquerdaId) {
    setSecaoAberta((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function abrirPainelCalculadora() {
    setAbaCentro('calculadora');
    setTrancheVinculoIndex(null);
    setSecaoAberta((prev) => ({ ...prev, calculadora: true }));
  }

  function abrirPainelChamados() {
    setAbaCentro('chamados');
    setTrancheVinculoIndex(null);
    setSecaoAberta((prev) => ({ ...prev, chamados: true }));
  }

  function abrirPainelTrancheVinculo(index: number) {
    setTrancheVinculoIndex(index);
    setAbaCentro('trancheVinculo');
    setSecaoAberta((prev) => ({ ...prev, relacionamentos: true }));
  }

  function voltarPainelDetalhes() {
    setAbaCentro('detalhes');
    setTrancheVinculoIndex(null);
  }

  const secaoHeadPainelCentro = (label: string) => {
    const ativo = abaCentro === 'chamados';
    return (
      <div
        className="mb-2 overflow-hidden rounded-lg bg-white text-xs"
        style={{
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-sm)',
        }}
      >
        <button
          type="button"
          onClick={abrirPainelChamados}
          className={`flex w-full items-center gap-2 p-2 text-left text-xs transition hover:bg-stone-50 ${
            ativo ? 'bg-violet-50 ring-1 ring-inset ring-violet-200' : ''
          }`}
        >
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
          <span className="text-xs font-semibold text-stone-800">{label}</span>
          {chamadosAbertosCount > 0 ? (
            <span
              className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
              style={{
                background: 'var(--moni-violet-100, #ede9fe)',
                color: 'var(--moni-violet-800, #5b21b6)',
              }}
              title={`${chamadosAbertosCount} chamado(s) em aberto`}
            >
              {chamadosAbertosCount}
            </span>
          ) : null}
        </button>
        {ativo ? (
          <p
            className="border-t px-2 pb-2 pt-1.5 text-[10px] text-stone-500"
            style={{ borderColor: 'var(--moni-border-subtle)' }}
          >
            Painel de chamados aberto — use <strong className="font-medium text-stone-700">Voltar</strong> no
            centro do card.
          </p>
        ) : chamadosAbertosCount > 0 ? (
          <p
            className="border-t px-2 pb-2 pt-1.5 text-[10px] text-stone-500"
            style={{ borderColor: 'var(--moni-border-subtle)' }}
          >
            {chamadosAbertosCount} em aberto no banco — clique para ver todos.
          </p>
        ) : null}
      </div>
    );
  };

  async function handleAutorizarAberturaCreditoObra() {
    if (!card?.id) return;
    setCreditoObraAberturaPending(true);
    try {
      const res = await autorizarAberturaCreditoObra(card.id, basePath);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setCreditoObraAbertura(null);
      await loadCard();
      router.refresh();
    } finally {
      setCreditoObraAberturaPending(false);
    }
  }

  async function handleRecusarAberturaCreditoObra(novaPrevisaoPrefeitura: string) {
    if (!card?.id) return;
    setCreditoObraAberturaPending(true);
    try {
      const res = await recusarAberturaCreditoObra(card.id, novaPrevisaoPrefeitura, basePath);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setCreditoObraAbertura(null);
      await loadCard();
      router.refresh();
    } finally {
      setCreditoObraAberturaPending(false);
    }
  }

  async function handleSalvarPreObraOperacoes() {
    if (!card?.id) return;
    setSalvandoPreObra(true);
    try {
      const res = await salvarDadosPreObraOperacoes({
        cardId: card.id,
        condominio_aprovada_em: operacoesPreObraDraft.condominio_aprovada_em,
        prefeitura_aprovada_em: operacoesPreObraDraft.prefeitura_aprovada_em,
        alvara_emitido_em: operacoesPreObraDraft.alvara_emitido_em,
        basePath,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      await loadCard({ silencioso: true });
      router.refresh();
    } catch {
      alert('Erro ao salvar dados pré-obra.');
    } finally {
      setSalvandoPreObra(false);
    }
  }

  async function handleSalvarPreObraKanban() {
    const pid = modalDetalhes.processo?.id;
    if (!pid) {
      alert('Sem processo vinculado para salvar pré-obra.');
      return;
    }
    setSalvandoPreObra(true);
    try {
      const res = await salvarDadosPreObra({
        processoId: pid,
        cardOrigemId: card?.id,
        previsao_aprovacao_condominio: preObraDraft.previsao_aprovacao_condominio,
        previsao_aprovacao_prefeitura: preObraDraft.previsao_aprovacao_prefeitura,
        previsao_emissao_alvara: preObraDraft.previsao_emissao_alvara,
        previsao_liberacao_credito_obra: preObraDraft.previsao_liberacao_credito_obra,
        previsao_inicio_obra: preObraDraft.previsao_inicio_obra,
        data_aprovacao_condominio: preObraDraft.data_aprovacao_condominio,
        data_aprovacao_prefeitura: preObraDraft.data_aprovacao_prefeitura,
        data_emissao_alvara: preObraDraft.data_emissao_alvara,
        data_aprovacao_credito: preObraDraft.data_aprovacao_credito,
        basePath,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      await loadCard();
      router.refresh();
    } catch {
      alert('Erro ao salvar pré-obra.');
    } finally {
      setSalvandoPreObra(false);
    }
  }

  async function handleSalvarNegocio() {
    if (!card) return;
    setSalvandoNegocio(true);
    try {
      const prazoOpcao = negocioPrazoValoresFromDraft(negocioDraft.prazo_opcao);
      const prazoInstrumento = negocioPrazoValoresFromDraft(negocioDraft.prazo_instrumento_garantidor);
      const prazoOpcaoDb = negocioPrazoDbPatchFromValores(prazoOpcao, 'prazo_opcao');
      const prazoInstrumentoDb = negocioPrazoDbPatchFromValores(
        prazoInstrumento,
        'prazo_instrumento_garantidor',
      );
      const upd = await salvarDadosNegocioKanban({
        cardId: card.id,
        processoId: modalDetalhes.processo?.id ?? '',
        payload: {
          tipo_aquisicao_terreno: negocioDraft.tipo_aquisicao_terreno || null,
          valor_terreno: negocioDraft.valor_terreno || null,
          vgv_pretendido: negocioDraft.vgv_pretendido || null,
          produto_modelo_casa: negocioDraft.produto_modelo_casa || null,
          link_pasta_drive: negocioDraft.link_pasta_drive || null,
          link_bca: negocioDraft.link_bca?.trim() || null,
          link_gbox: negocioDraft.link_gbox?.trim() || null,
          link_mapa_competidores: negocioDraft.link_mapa_competidores?.trim() || null,
          link_acoplamento: negocioDraft.link_acoplamento?.trim() || null,
          link_apresentacao_comite: negocioDraft.link_apresentacao_comite?.trim() || null,
          link_moni_capital_seguro_garantia: negocioDraft.link_moni_capital_seguro_garantia?.trim() || null,
          comentario_moni_capital_seguro_garantia:
            negocioDraft.comentario_moni_capital_seguro_garantia?.trim() || null,
          link_moni_capital_gastos_aporte_inicial:
            negocioDraft.link_moni_capital_gastos_aporte_inicial?.trim() || null,
          comentario_moni_capital_gastos_aporte_inicial:
            negocioDraft.comentario_moni_capital_gastos_aporte_inicial?.trim() || null,
          prazo_opcao_dias: prazoOpcaoDb.prazo_opcao_dias as number | null,
          prazo_opcao_sla_tipo: prazoOpcaoDb.prazo_opcao_sla_tipo as 'uteis' | 'corridos' | null,
          prazo_opcao_modo: prazoOpcaoDb.prazo_opcao_modo as 'fase' | 'data' | null,
          prazo_opcao_fase_id: prazoOpcaoDb.prazo_opcao_fase_id as string | null,
          prazo_opcao_data: prazoOpcaoDb.prazo_opcao_data as string | null,
          prazo_instrumento_garantidor_dias: prazoInstrumentoDb.prazo_instrumento_garantidor_dias as number | null,
          prazo_instrumento_garantidor_sla_tipo: prazoInstrumentoDb.prazo_instrumento_garantidor_sla_tipo as
            | 'uteis'
            | 'corridos'
            | null,
          prazo_instrumento_garantidor_modo: prazoInstrumentoDb.prazo_instrumento_garantidor_modo as
            | 'fase'
            | 'data'
            | null,
          prazo_instrumento_garantidor_fase_id: prazoInstrumentoDb.prazo_instrumento_garantidor_fase_id as
            | string
            | null,
          prazo_instrumento_garantidor_data: prazoInstrumentoDb.prazo_instrumento_garantidor_data as string | null,
          negociacao_linhas: negociacaoLinhasToDb(negocioDraft.negociacao_linhas),
        },
        basePath,
      });
      if (!upd.ok) throw new Error(upd.error);

      setEditandoNegocio(false);
      await loadCard();
    } catch {
      alert('Erro ao salvar dados do negócio.');
    } finally {
      setSalvandoNegocio(false);
    }
  }

  async function abrirEdicaoFranqueado() {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('rede_franqueados')
        .select('id, n_franquia, nome_completo')
        .order('n_franquia');
      setFranqueadosLista(
        (data ?? []).map((r) => ({
          id: String(r.id),
          n_franquia: String((r as { n_franquia?: string | null }).n_franquia ?? ''),
          nome_completo: String((r as { nome_completo?: string | null }).nome_completo ?? ''),
        })),
      );
      setNovoFranqueadoId('');
      setEditandoFranqueado(true);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar lista de franqueados.');
    }
  }

  async function handleSalvarFranqueado() {
    if (!novoFranqueadoId || !card) return;
    setSalvandoFranqueado(true);
    try {
      const franqueadoSelecionado = franqueadosLista.find((f) => f.id === novoFranqueadoId);
      if (!franqueadoSelecionado) return;

      const res = await salvarFranqueadoCardVinculado({
        cardId: card.id,
        origem,
        redeFranqueadoId: novoFranqueadoId,
        nFranquia: franqueadoSelecionado.n_franquia,
        nomeCondominio: card.nome_condominio,
        quadra: card.quadra,
        lote: card.lote,
        basePath,
      });
      if (!res.ok) throw new Error(res.error);

      setEditandoFranqueado(false);
      await loadCard();
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar franqueado vinculado.');
    } finally {
      setSalvandoFranqueado(false);
    }
  }

  async function urlContratoFranquiaAssinada(): Promise<{ url: string; fileName: string } | null> {
    const path = modalDetalhes.rede?.contrato_franquia_path?.trim();
    if (!path) return null;
    const supabase = createClient();
    const { data, error } = await supabase.storage.from('contratos-franquia').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      alert(error?.message ?? 'Não foi possível gerar o link do documento.');
      return null;
    }
    const fileName = path.split('/').filter(Boolean).pop() ?? 'contrato-franquia';
    return { url: data.signedUrl, fileName };
  }

  async function handleVisualizarContratoFranquia() {
    const signed = await urlContratoFranquiaAssinada();
    if (signed) window.open(signed.url, '_blank', 'noopener,noreferrer');
  }

  async function handleBaixarContratoFranquia() {
    const signed = await urlContratoFranquiaAssinada();
    if (!signed) return;
    const a = document.createElement('a');
    a.href = signed.url;
    a.download = signed.fileName;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleNegocioAnexoFile(
    e: ChangeEvent<HTMLInputElement>,
    field: ProcessoNegocioAnexoCampo,
  ) {
    const f = e.target.files?.[0];
    e.target.value = '';
    const pid = modalDetalhes.processo?.id;
    const cid = card?.id;
    if (!f || !cid) return;
    setUploadingNegocioAnexo(field);
    const pathKey =
      field === 'opcao_permuta'
        ? 'anexo_opcao_permuta_path'
        : field === 'contrato_permuta'
          ? 'anexo_contrato_permuta_path'
          : 'anexo_seguro_garantia_path';
    try {
      const fd = new FormData();
      fd.append('file', f);
      if (pid) fd.append('processoId', pid);
      fd.append('cardOrigemId', cid);
      fd.append('field', field);
      fd.append('basePath', basePath);
      const r = await uploadProcessoNegocioAnexo(fd);
      if (!r.ok) {
        alert(r.error);
        return;
      }
      if (r.path) {
        setModalDetalhes((prev) =>
          prev.processo
            ? {
                ...prev,
                processo: { ...prev.processo, [pathKey]: r.path! },
              }
            : prev,
        );
      }
      await loadCard();
    } catch {
      alert('Erro ao enviar anexo.');
    } finally {
      setUploadingNegocioAnexo(null);
    }
  }

  async function handleBaixarNegocioAnexo(path: string) {
    if (!path.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase.storage.from('processo-docs').createSignedUrl(path.trim(), 3600);
    if (error || !data?.signedUrl) {
      alert(error?.message ?? 'Não foi possível gerar o link.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  const timesFiltroOpcoesModal = useMemo(
    () => timesFiltroOpcoesComCatalogoMoni(kanbanTimes),
    [kanbanTimes],
  );
  const responsaveisFiltroOpcoesModal = useMemo(
    () => responsaveisFiltroOpcoesComCatalogoMoni(responsaveisOpcoes),
    [responsaveisOpcoes],
  );

  const timesChamadoOpcoes = useMemo(
    () => ordenarLinhasTimeKanbanPorCatalogoMoni(timesFiltroOpcoesComCatalogoMoni(kanbanTimes), false),
    [kanbanTimes],
  );

  const responsaveisNovaAtividade = useMemo(
    () =>
      responsaveisFiltradosPorTimesIds(novaInteracao.atividade.timesIds, timesChamadoOpcoes, responsaveisOpcoes),
    [novaInteracao.atividade.timesIds, timesChamadoOpcoes, responsaveisOpcoes],
  );

  const responsaveisSubNova = useMemo(
    () => responsaveisFiltradosPorTimesIds(subNovaDraft.timesIds, timesChamadoOpcoes, responsaveisOpcoes),
    [subNovaDraft.timesIds, timesChamadoOpcoes, responsaveisOpcoes],
  );

  const responsaveisSubEdicao = useMemo(
    () => responsaveisFiltradosPorTimesIds(editSubDraft.timesIds, timesChamadoOpcoes, responsaveisOpcoes),
    [editSubDraft.timesIds, timesChamadoOpcoes, responsaveisOpcoes],
  );

  const inferidoHdmSubNova = useMemo(() => {
    const nomes = subNovaDraft.timesIds
      .map((id) => resolveKanbanTimeNomeFromId(id, kanbanTimes))
      .filter((n): n is string => Boolean(n));
    return inferirHdmResponsavelPorNomesTimes(nomes);
  }, [subNovaDraft.timesIds, kanbanTimes]);

  const inferidoHdmSubEdicao = useMemo(() => {
    const nomes = editSubDraft.timesIds
      .map((id) => resolveKanbanTimeNomeFromId(id, kanbanTimes))
      .filter((n): n is string => Boolean(n));
    return inferirHdmResponsavelPorNomesTimes(nomes);
  }, [editSubDraft.timesIds, kanbanTimes]);

  const responsaveisOpcoesSubEdicaoHdm = useMemo(
    () => filtrarOpcoesResponsaveisPorModoHdm(responsaveisOpcoes, inferidoHdmSubEdicao != null),
    [responsaveisOpcoes, inferidoHdmSubEdicao],
  );

  const cardFrankParaRank = useMemo(() => {
    const fid = card?.franqueado_id?.trim();
    if (fid) return fid;
    const rede = card?.rede_franqueado_id?.trim();
    if (rede) return rede;
    return modalDetalhes.rede?.id?.trim() ?? null;
  }, [card?.franqueado_id, card?.rede_franqueado_id, modalDetalhes.rede?.id]);

  const interacoesFiltradas = useMemo(() => {
    const situacaoEfetiva =
      filtros.lista === 'concluidas' ? ('qualquer' as const) : filtros.situacao;
    const prazoOrdKey = (a: InteracaoModal) =>
      prazoEfetivoParaChamado(a, subInteracoesPorPai[a.id] ?? []) ?? '9999-12-31';
    const criadoTs = (a: InteracaoModal) => {
      const t = new Date(a.created_at).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    const rankInput = (it: InteracaoModal) => {
      const subs = subInteracoesPorPai[it.id] ?? [];
      return {
        frank_id: cardFrankParaRank,
        trava: travaEfetivaParaChamado(it, subs),
        data_vencimento: prazoEfetivoParaChamado(it, subs),
        atividade_status: it.status,
        criado_em: it.created_at,
      };
    };
    const buscaNorm = filtros.busca.trim().toLowerCase();
    const filtered = interacoes.filter((it) => {
      const subs = subInteracoesPorPai[it.id] ?? [];
      const concl = it.status === 'concluida';
      if (filtros.lista === 'abertas') {
        if (concl) return false;
        if (situacaoEfetiva !== 'qualquer' && it.status !== situacaoEfetiva) return false;
      } else if (filtros.lista === 'concluidas') {
        if (!concl) return false;
      } else if (situacaoEfetiva !== 'qualquer' && it.status !== situacaoEfetiva) {
        return false;
      }
      if (!interacaoPassaFiltroTimeComSubs(it, subs, filtros.time, kanbanTimes)) return false;
      if (!interacaoPassaFiltroResponsavelComSubs(it, subs, filtros.responsavel)) return false;
      if (buscaNorm) {
        const blob = `${it.titulo} ${it.descricao ?? ''} ${subs.map((s) => `${s.nome} ${s.descricao_detalhe ?? ''}`).join(' ')}`.toLowerCase();
        if (!blob.includes(buscaNorm)) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (filtros.lista === 'todas') {
        const ac = a.status === 'concluida';
        const bc = b.status === 'concluida';
        if (ac !== bc) return ac ? 1 : -1;
      }
      if (filtros.ordenacao === 'prioridade_sirene') {
        return compareChamadosPainelRank(rankInput(a), rankInput(b));
      }
      if (filtros.ordenacao === 'prazo_asc') return prazoOrdKey(a).localeCompare(prazoOrdKey(b));
      if (filtros.ordenacao === 'prazo_desc') return prazoOrdKey(b).localeCompare(prazoOrdKey(a));
      if (filtros.ordenacao === 'criado_asc') return criadoTs(a) - criadoTs(b);
      if (filtros.ordenacao === 'criado_desc') return criadoTs(b) - criadoTs(a);
      return compareChamadosPainelRank(rankInput(a), rankInput(b));
    });
  }, [interacoes, filtros, kanbanTimes, subInteracoesPorPai, cardFrankParaRank]);

  const sireneChamadoIdPastel = useMemo(() => {
    for (const it of interacoes) {
      const sid = it.sirene_chamado_id;
      if (sid != null && Number.isFinite(sid)) return sid;
    }
    return null;
  }, [interacoes]);

  const chamadosAbertosCount = useMemo(() => countChamadosAbertosNoCard(interacoes), [interacoes]);

  const faseNomePorId = useMemo(() => new Map(fases.map((f) => [f.id, f.nome])), [fases]);

  const linhasCronologiaFases = useMemo(() => {
    if (!card || fases.length === 0) return [];
    if (origem === 'legado') {
      return buildLegadoFaseTimeline(
        fases,
        {
          created_at: card.created_at,
          fase_id: card.fase_id,
          etapa_slug: card.etapa_slug ?? null,
        },
        legadoCronologiaMoves,
      );
    }
    return buildNativeFaseTimeline(
      fases,
      { created_at: card.created_at, fase_id: card.fase_id },
      historico.map((h) => ({ acao: h.acao, detalhe: h.detalhe, criado_em: h.criado_em })),
    );
  }, [card, fases, historico, legadoCronologiaMoves, origem]);

  const calculadoraFasesPack = useMemo(() => {
    if (!card) return { linhas: [], visits: [], faseIds: [] as string[] };
    try {
      const historicoMovs = (historicoCalculadora.length > 0 ? historicoCalculadora : historico).map((h) => ({
        acao: h.acao,
        detalhe: h.detalhe,
        criado_em: h.criado_em,
      }));

      const naEsteira = cardKanbanNaEsteiraPrincipalCalculadora(String(card.kanban_id ?? ''));
      const ctx = naEsteira ? contextoCalculadoraSyncGroup : null;
      const kanbanIdCalc = ctx?.kanbanIdCanonico ?? card.kanban_id;

      const fasesEsteiraMap = mesclarFasesKanbanAtualNoMapa(
        fasesEsteiraCalculadora,
        kanbanIdCalc,
        fases,
      );

      const fasesParaVisitas = montarFasesFlatCalculadoraVisitas(
        fasesEsteiraMap,
        fases,
        kanbanIdCalc,
      );

      const visitCardBase = ctx
        ? {
            created_at: ctx.createdAtCanonico ?? card.created_at,
            fase_id: ctx.faseIdCanonico,
          }
        : { created_at: card.created_at, fase_id: card.fase_id };

      const visits =
        origem === 'legado'
          ? buildLegadoFaseVisits(
              fasesParaVisitas,
              {
                created_at: visitCardBase.created_at,
                fase_id: visitCardBase.fase_id,
                etapa_slug: card.etapa_slug ?? null,
              },
              legadoCronologiaMoves,
            )
          : buildNativeFaseVisits(
              fasesParaVisitas,
              visitCardBase,
              historicoMovs,
            );

      const cardFaseSlug =
        ctx?.faseSlugCanonico ??
        fases.find((f) => f.id === card.fase_id)?.slug ??
        card.etapa_slug ??
        null;

      const calculadoraAncora = calculadoraAncoraFromProcesso(modalDetalhes.processo);

      const cardCalcInput = ctx
        ? ctx.cardCalcCanonico
        : {
            fase_id: card.fase_id,
            created_at: card.created_at,
            entered_fase_at: card.entered_fase_at,
            concluido: card.concluido,
            concluido_em: card.concluido_em,
          };

      const linhasEsteira = calcularLinhasCalculadoraFasesEsteira({
        fasesPorKanban: fasesEsteiraMap,
        cardKanbanId: kanbanIdCalc,
        cardFaseSlug,
        card: cardCalcInput,
        visits,
        ancora: calculadoraAncora,
        overrides: datasManuaisCalculadora,
        slaCondominio: calculadoraSlaCondominio,
      });

      if (linhasEsteira.length > 0) {
        return {
          linhas: linhasEsteira,
          visits,
          faseIds: linhasEsteira.map((l) => l.faseId).filter(Boolean),
        };
      }

      if (fases.length === 0) return { linhas: [], visits, faseIds: [] as string[] };

      const fasesCalculadora =
        card.kanban_id === KANBAN_IDS.STEP_ONE
          ? filterStepOneCalculadoraFases(fases)
          : card.kanban_id === KANBAN_IDS.PORTFOLIO
            ? filterPortfolioCalculadoraFases(fases)
            : card.kanban_id === KANBAN_IDS.OPERACOES
              ? filterOperacoesCalculadoraFases(fases)
              : fases;

      const linhas = calcularLinhasCalculadoraFases({
        fases: fasesCalculadora,
        card: cardCalcInput,
        visits,
        ancora: calculadoraAncora,
        overrides: datasManuaisCalculadora,
        slaCondominio: calculadoraSlaCondominio,
      });
      return {
        linhas,
        visits,
        faseIds: linhas.map((l) => l.faseId).filter(Boolean),
      };
    } catch {
      return { linhas: [], visits: [], faseIds: [] as string[] };
    }
  }, [card, fases, fasesEsteiraCalculadora, historico, historicoCalculadora, legadoCronologiaMoves, origem, modalDetalhes.processo, datasManuaisCalculadora, calculadoraSlaCondominio, contextoCalculadoraSyncGroup]);

  const calculadoraAncora = useMemo(
    () => calculadoraAncoraFromProcesso(modalDetalhes.processo),
    [modalDetalhes.processo],
  );

  const calculadoraFasesFlat = useMemo(() => {
    const list: KanbanFase[] = [];
    for (const kid of CALCULADORA_ESTEIRA_KANBAN_IDS) {
      list.push(...(fasesEsteiraCalculadora.get(kid) ?? []));
    }
    if (list.length > 0) return list;
    return card?.kanban_id === KANBAN_IDS.STEP_ONE
      ? filterStepOneCalculadoraFases(fases)
      : card?.kanban_id === KANBAN_IDS.PORTFOLIO
        ? filterPortfolioCalculadoraFases(fases)
        : card?.kanban_id === KANBAN_IDS.OPERACOES
          ? filterOperacoesCalculadoraFases(fases)
          : fases;
  }, [fasesEsteiraCalculadora, fases, card?.kanban_id]);

  const calculadoraFasesMeta = useMemo(() => {
    const map = new Map<string, KanbanFase>();
    for (const f of calculadoraFasesFlat) map.set(f.id, f);
    for (const f of fases) map.set(f.id, f);
    return map;
  }, [calculadoraFasesFlat, fases]);

  const calculadoraMarcosInput = useMemo(() => {
    const prazos = negocioPrazoValoresFromProcessoModal(modalDetalhes.processo, fasesNegocioPrazo);
    const marcos = contextoCalculadoraSyncGroup?.marcosCanonicos;
    return {
      contrato_assinado_em: marcos?.contrato_assinado_em ?? card?.contrato_assinado_em ?? null,
      obra_iniciada_em: marcos?.obra_iniciada_em ?? card?.obra_iniciada_em ?? null,
      obra_finalizada_em: marcos?.obra_finalizada_em ?? card?.obra_finalizada_em ?? null,
      concluido_em: marcos?.concluido_em ?? card?.concluido_em ?? null,
      opcao_assinada_em: marcos?.opcao_assinada_em ?? card?.opcao_assinada_em ?? null,
      prazo_opcao: prazos.prazo_opcao.modo ? prazos.prazo_opcao : null,
      prazo_instrumento_garantidor: prazos.prazo_instrumento_garantidor.modo
        ? prazos.prazo_instrumento_garantidor
        : null,
      visits: calculadoraFasesPack.visits,
    };
  }, [
    modalDetalhes.processo,
    contextoCalculadoraSyncGroup,
    card?.contrato_assinado_em,
    card?.obra_iniciada_em,
    card?.obra_finalizada_em,
    card?.concluido_em,
    card?.opcao_assinada_em,
    calculadoraFasesPack.visits,
    fasesNegocioPrazo,
  ]);

  useEffect(() => {
    const cardId = card?.id?.trim();
    if (!cardId) {
      setContextoCalculadoraSyncGroup(null);
      return;
    }

    let cancelado = false;
    void (async () => {
      const supabase = createClient();
      const ctx = await fetchContextoCalculadoraSyncGroup(supabase, cardId);
      if (!cancelado) setContextoCalculadoraSyncGroup(ctx);
    })();

    return () => {
      cancelado = true;
    };
  }, [card?.id]);

  useEffect(() => {
    const cardId = card?.id?.trim();
    const faseIds = calculadoraFasesPack.faseIds;
    if (!cardId || faseIds.length === 0) {
      setResponsavelDaFaseSalvoPorFase(new Map());
      return;
    }

    let cancelado = false;
    void (async () => {
      const supabase = createClient();
      const map = await buscarResponsavelDaFaseSalvoPorFases(supabase, cardId, faseIds);
      if (!cancelado) setResponsavelDaFaseSalvoPorFase(map);
    })();

    return () => {
      cancelado = true;
    };
  }, [card?.id, calculadoraFasesPack.faseIds.join('|')]);

  useEffect(() => {
    const cardId = card?.id?.trim();
    const faseIds = calculadoraFasesPack.faseIds;
    if (!cardId || faseIds.length === 0) {
      setDatasManuaisCalculadora(new Map());
      return;
    }

    let cancelado = false;
    void (async () => {
      const supabase = createClient();
      const map = await buscarDatasManuaisCalculadoraSyncGroup(supabase, cardId, faseIds);
      if (!cancelado) setDatasManuaisCalculadora(map);
    })();

    return () => {
      cancelado = true;
    };
  }, [card?.id, calculadoraFasesPack.faseIds.join('|')]);

  const onResponsavelDaFaseAlterado = useCallback((faseId: string, valor: string) => {
    const fid = faseId.trim();
    if (!fid) return;
    setResponsavelDaFaseSalvoPorFase((prev) => {
      const next = new Map(prev);
      const v = valor.trim();
      if (v && isValorResponsavelDaFaseLista(v)) next.set(fid, v);
      else next.delete(fid);
      return next;
    });
  }, []);

  const condominioIdCalculadora =
    card?.condominio_id?.trim() || modalDetalhes.processo?.condominio_id?.trim() || null;

  useEffect(() => {
    if (!condominioIdCalculadora) {
      setCalculadoraSlaCondominio(null);
      return;
    }

    let cancelado = false;
    void (async () => {
      const supabase = createClient();
      const row = await fetchCondominioRowById(supabase, condominioIdCalculadora);
      if (!cancelado) {
        setCalculadoraSlaCondominio(row ? condominioPrazosSlaFromRow(row) : null);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [condominioIdCalculadora, condominioTick]);

  const podeEditarDatasCalculadora =
    modalSessao.roleNorm === 'admin' || modalSessao.roleNorm === 'team';

  const salvarDataCalculadora = useCallback(
    async (faseId: string, campo: 'inicio' | 'fim', valor: string | null) => {
      const cardId = card?.id?.trim();
      if (!cardId) return { ok: false, error: 'Card não encontrado.' };

      const supabase = createClient();
      const patch =
        campo === 'inicio' ? { dataInicio: valor } : { dataFim: valor };
      const result = await salvarDataManualCalculadoraSyncGroup(
        supabase,
        cardId,
        faseId,
        patch,
        modalSessao.userId,
      );

      if (result.ok) {
        const idx = calculadoraFasesPack.faseIds.indexOf(faseId);
        const fasesPosteriores = idx >= 0 ? calculadoraFasesPack.faseIds.slice(idx + 1) : [];
        const slugFase = String(calculadoraFasesMeta.get(faseId)?.slug ?? '').trim();
        const propagaForward =
          slugFase === CALCULADORA_FASE_SLUG_PROPAGA_FORWARD ||
          faseId === FASE_IDS.PORTFOLIO_PASSAGEM_WAYSER;

        if (propagaForward && fasesPosteriores.length > 0) {
          await limparDatasManuaisCalculadoraSyncGroup(supabase, cardId, fasesPosteriores);
        }

        setDatasManuaisCalculadora((prev) => {
          const next = new Map(prev);
          const cur = { ...(next.get(faseId) ?? {}) };
          if (campo === 'inicio') cur.dataInicio = valor;
          else cur.dataFim = valor;
          next.set(faseId, cur);
          if (propagaForward) {
            for (const fid of fasesPosteriores) next.delete(fid);
          }
          return next;
        });
      }

      return result;
    },
    [
      card?.id,
      modalSessao.userId,
      calculadoraFasesPack.faseIds,
      calculadoraFasesMeta,
    ],
  );

  const calculadoraSlugPorFaseId = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, f] of calculadoraFasesMeta) {
      const slug = String(f.slug ?? '').trim();
      if (slug) map.set(id, slug);
    }
    return map;
  }, [calculadoraFasesMeta]);

  const calculadoraLinhasEncadeadas = useMemo(() => {
    if (!card) return calculadoraFasesPack.linhas;
    const naEsteira = cardKanbanNaEsteiraPrincipalCalculadora(String(card.kanban_id ?? ''));
    const ctx = naEsteira ? contextoCalculadoraSyncGroup : null;
    const cardEncadeamento = ctx
      ? ctx.cardCalcCanonico
      : {
          fase_id: card.fase_id,
          created_at: card.created_at,
          entered_fase_at: card.entered_fase_at,
          concluido: card.concluido,
          concluido_em: card.concluido_em,
        };
    return aplicarEncadeamentoMarcoContratoNasLinhas(
      calculadoraFasesPack.linhas,
      calculadoraFasesFlat,
      { contrato_assinado_em: calculadoraMarcosInput.contrato_assinado_em },
      cardEncadeamento,
      calculadoraFasesPack.visits,
      undefined,
      datasManuaisCalculadora,
    );
  }, [
    card,
    contextoCalculadoraSyncGroup,
    calculadoraFasesPack.linhas,
    calculadoraFasesPack.visits,
    calculadoraFasesFlat,
    calculadoraMarcosInput.contrato_assinado_em,
    datasManuaisCalculadora,
  ]);

  const calculadoraResumo = useMemo(
    () =>
      calcularResumoExecutivoCalculadoraFases(calculadoraLinhasEncadeadas, {
        cardConcluido: card?.concluido === true,
        visits: calculadoraFasesPack.visits,
        ancora: calculadoraAncora,
      }),
    [calculadoraLinhasEncadeadas, calculadoraFasesPack.visits, card?.concluido, calculadoraAncora],
  );

  const calculadoraLinhasEnriquecidas = useMemo(() => {
    const comResponsavel = enriquecerLinhasCalculadoraComResponsavelDaFase(
      calculadoraLinhasEncadeadas,
      calculadoraSlugPorFaseId,
      responsavelDaFaseSalvoPorFase,
    );
    return enriquecerLinhasCalculadoraComCusto(comResponsavel, calculadoraSlugPorFaseId);
  }, [calculadoraLinhasEncadeadas, calculadoraSlugPorFaseId, responsavelDaFaseSalvoPorFase]);

  const calculadoraTimelineNegociacao = useMemo(
    () =>
      montarTimelineCalculadoraComMarcos(
        calculadoraLinhasEnriquecidas,
        calculadoraFasesFlat,
        calculadoraMarcosInput,
      ),
    [calculadoraLinhasEnriquecidas, calculadoraFasesFlat, calculadoraMarcosInput],
  );

  const calculadoraOpcoesVinculoNegociacao = useMemo(
    () => buildOpcoesVinculoCalculadora(calculadoraFasesFlat),
    [calculadoraFasesFlat],
  );

  const negociacaoLinhasCalculadora = useMemo((): NegociacaoLinha[] => {
    if (editandoNegocio) {
      return negocioDraft.negociacao_linhas.map(
        ({ condicao, valor, dataPagamento, vinculoCalculadora }) => ({
          condicao,
          valor,
          dataPagamento,
          vinculoCalculadora: vinculoCalculadora || null,
        }),
      );
    }
    return modalDetalhes.processo?.negociacao_linhas ?? [];
  }, [editandoNegocio, negocioDraft.negociacao_linhas, modalDetalhes.processo?.negociacao_linhas]);

  const negociacaoDatasResolvidas = useMemo(() => {
    const map = new Map<string, { data: string | null; prevista: boolean }>();
    for (const l of negocioDraft.negociacao_linhas) {
      const vinculo = parseVinculoCalculadoraNegociacao(l.vinculoCalculadora);
      if (!vinculo) continue;
      const r = resolverDataPagamentoNegociacao(
        vinculo,
        calculadoraLinhasEnriquecidas,
        calculadoraTimelineNegociacao,
      );
      map.set(l.id, { data: r.data, prevista: r.prevista });
    }
    return map;
  }, [
    negocioDraft.negociacao_linhas,
    calculadoraLinhasEnriquecidas,
    calculadoraTimelineNegociacao,
  ]);

  const negociacaoLinhasLeituraResolvidas = useMemo(() => {
    const base = modalDetalhes.processo?.negociacao_linhas ?? [];
    return resolverNegociacaoLinhasCalculadora(
      base,
      calculadoraLinhasEnriquecidas,
      calculadoraTimelineNegociacao,
    ).map((l) => ({
      condicao: l.condicao,
      valor: l.valor,
      dataPagamento: l.dataPagamentoResolvida ?? l.dataPagamento,
      vinculoCalculadora: l.vinculoCalculadora,
    }));
  }, [modalDetalhes.processo?.negociacao_linhas, calculadoraLinhasEnriquecidas, calculadoraTimelineNegociacao]);

  const abrirEdicaoInstrucoesFase = () => {
    if (!faseAtual || !pode('editar_instrucoes')) return;
    setDraftInstrucoesFase((faseAtual.instrucoes ?? '').trim() ? String(faseAtual.instrucoes) : '');
    setDraftMateriaisFase(
      faseAtual.materiais && faseAtual.materiais.length > 0 ? faseAtual.materiais.map((m) => ({ ...m })) : [],
    );
    setEditandoInstrucoesFase(true);
  };

  async function handleEnviarHipotesePortfolio() {
    if (!card || card.concluido || card.arquivado) return;
    setHipotesePortfolioErro(null);
    setHipotesePortfolioOk(null);
    setEnviandoHipotesePortfolio(true);
    try {
      const res = await enviarHipoteseAoPortfolio(card.id);
      if (!res.ok) {
        setHipotesePortfolioErro(res.error);
        return;
      }
      setHipotesePortfolioOk('Hipótese enviada ao Portfolio');
      setRelacionamentosTick((t) => t + 1);
      router.refresh();
    } finally {
      setEnviandoHipotesePortfolio(false);
    }
  }

  async function handleSalvarInstrucoesFase() {
    if (!faseAtual || !pode('editar_instrucoes')) return;
    setSalvandoInstrucoesFase(true);
    try {
      const res = await salvarInstrucoesFase(
        faseAtual.id,
        draftInstrucoesFase.trim() || null,
        draftMateriaisFase,
        basePath,
      );
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setEditandoInstrucoesFase(false);
      const materiais = parseKanbanFaseMateriais(draftMateriaisFase);
      const inst = draftInstrucoesFase.trim() || null;
      setFaseAtual((prev) => (prev ? { ...prev, instrucoes: inst, materiais } : prev));
      setFases((prev) => prev.map((f) => (f.id === faseAtual.id ? { ...f, instrucoes: inst, materiais } : f)));
      router.refresh();
    } catch {
      alert('Erro ao salvar instruções.');
    } finally {
      setSalvandoInstrucoesFase(false);
    }
  }

  if (loading && !card) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="text-white">Carregando…</div>
      </div>
    );
  }

  if (!card) return null;

  const isLegado = origem === 'legado';

  const fmtDataHoraOuDash = (iso: string | null | undefined) => {
    const s = String(iso ?? '').trim();
    if (!s) return '—';
    return formatDataHoraHistorico(s);
  };

  const dataConclusaoExibicao =
    isLegado && card.processo_meta?.status === 'concluido' && card.processo_meta.updated_at?.trim()
      ? fmtDataHoraOuDash(card.processo_meta.updated_at)
      : !isLegado && card.concluido && card.concluido_em?.trim()
        ? fmtDataHoraOuDash(card.concluido_em)
        : '—';

  const faseSlugAtual = faseAtual?.slug?.trim() ?? '';
  const aguardandoDocumentacaoCreditoObra =
    !isLegado &&
    creditoObraAguardandoDocumentacao({
      faseSlug: faseSlugAtual,
      alvara_url: card.alvara_url,
      docs_terreno_url: card.docs_terreno_url,
    });
  const slaCard = calcularSlaKanbanCard({
    created_at: card.created_at,
    entered_fase_at: card.entered_fase_at,
    sla_iniciado_em: card.sla_iniciado_em,
    faseSlug: faseSlugAtual,
    alvara_url: card.alvara_url,
    docs_terreno_url: card.docs_terreno_url,
    sla_dias: faseAtual?.sla_dias,
    sla_tipo: faseAtual?.sla_tipo,
  });
  const exibirSecaoJustificativaSla =
    !isLegado &&
    cardLoteadoresPrecisaJustificativaSla({
      kanbanId: card.kanban_id,
      kanbanNome: String(kanbanNome),
      faseSlug: faseSlugAtual,
      slaStatus: slaCard.status,
      slaJustificativa: card.sla_justificativa,
      sla_dias: faseAtual?.sla_dias,
    });
  const exibirDadosLoteadorPersistente =
    !isLegado && isLoteadoresKanbanRef(card.kanban_id, String(kanbanNome));
  const slaJustificativaRegistrada = String(card.sla_justificativa ?? '').trim();
  const exibirSecaoDocumentacaoCreditoObra =
    !isLegado &&
    kanbanNome === 'Funil Crédito Obra' &&
    faseSlugAtual === FASE_SLUGS.CO_DOCUMENTACAO_ALVARA;
  const cardNativoConcluido = !isLegado && Boolean(card.concluido);
  const cardLegadoConcluido = isLegado && card.processo_meta?.status === 'concluido';
  const cardNativoArquivado = !isLegado && Boolean(card.arquivado);
  const cardLegadoArquivado = isLegado && Boolean(card.arquivado);
  const faseAtualIdx = faseAtual ? fases.findIndex((f) => f.id === faseAtual.id) : -1;
  const podeRetrocederFase = !cardNativoConcluido && faseAtualIdx > 0;
  const podeAvancarFase =
    !cardNativoConcluido && faseAtualIdx >= 0 && faseAtualIdx < fases.length - 1;
  const maxOrdemFases = fases.length > 0 ? Math.max(...fases.map((f) => f.ordem)) : 0;
  const estaNaUltimaFaseNativo = Boolean(faseAtual && faseAtual.ordem === maxOrdemFases);
  const exibirBotaoFinalizar =
    !isLegado && estaNaUltimaFaseNativo && !cardNativoConcluido && !cardNativoArquivado;
  const rlArch = modalSessao.roleNorm;
  const podeArquivarCardPerm =
    !ocultarGestaoCard &&
    (pode('arquivar_cards') ||
      isAdmin ||
      modalSessao.ehAdminOuTeam ||
      rlArch === 'admin' ||
      rlArch === 'team' ||
      rlArch === 'supervisor' ||
      rlArch === 'consultor');
  /** Mesmo critério ampliado de Arquivar — evita ocultar Movimentação quando `permissoes_perfil` não carregou. */
  const podeMoverFaseCard =
    !ocultarGestaoCard &&
    (pode('mover_fase') ||
      isAdmin ||
      modalSessao.ehAdminOuTeam ||
      rlArch === 'admin' ||
      rlArch === 'team' ||
      rlArch === 'supervisor' ||
      rlArch === 'consultor');
  const exibirBlocoArquivar =
    podeArquivarCardPerm &&
    !cardNativoConcluido &&
    !cardLegadoConcluido &&
    !cardNativoArquivado &&
    !cardLegadoArquivado;
  const exibirBlocoDesarquivar =
    podeArquivarCardPerm && (cardNativoArquivado || cardLegadoArquivado);
  const roleNormUsuario = normalizeAccessRole(userRoleRaw);
  const userRoleLc = (userRoleRaw || '').trim().toLowerCase();
  const usuarioFrank = portalFrank || isFrankOrFranqueadoRole(userRoleRaw);
  const mostrarBotaoJuridico =
    !isLegado &&
    !ocultarGestaoCard &&
    Boolean(card.kanban_id) &&
    (KANBANS_COM_CHAMADO_JURIDICO as readonly string[]).includes(card.kanban_id) &&
    !['frank', 'franqueado'].includes(userRoleLc) &&
    !portalFrank;

  const mostrarColunaAcoesLateral =
    !ocultarGestaoCard &&
    (podeMoverFaseCard || pode('finalizar_cards') || podeArquivarCardPerm);
  const faseIdResponsavelPainel = (card.fase_id?.trim() || faseAtual?.id?.trim() || '');
  const mostrarResponsavelFasePainel = Boolean(faseIdResponsavelPainel);
  const mostrarPainelDireitoCard = mostrarResponsavelFasePainel || mostrarColunaAcoesLateral;
  const ehFunilOperacoes =
    card.kanban_id === KANBAN_IDS.OPERACOES ||
    kanbanNome === 'Funil Pré Obra e Obra' ||
    kanbanNome === 'Funil Operações';
  const podeGerenciarRelacionamentos =
    !ocultarGestaoCard && modalSessao.ehAdminOuTeam;
  const painelCentroAlternativo =
    abaCentro === 'chamados' || abaCentro === 'trancheVinculo' || abaCentro === 'calculadora';
  const cardTitulo = card.titulo;
  const checklistExtra = card.fase_id && camposPorFase?.[card.fase_id];
  const faseChecklistFaseId = card.fase_id ?? '';
  const chipsParalelasModal =
    !isLegado && faseAtual
      ? montarChipsParalelas(
          {
            kanbanId: card.kanban_id,
            faseSlug: faseAtual.slug ?? '',
            faseNome: faseAtual.nome,
            faseOrdem: faseAtual.ordem,
            hipotesesOrdemMin: hipotesesOrdemMinima(fases),
            origem: 'nativo',
            flags: flagsParalelasFromCard(card),
            portfolioVinculoRotulo: card.portfolio_vinculo_rotulo,
            temFilhoJuridico: card.tem_filho_juridico,
            temFilhoAcoplamento: card.tem_filho_acoplamento,
            filhoAcoplamentoArquivado: card.filho_acoplamento_arquivado,
            temFilhoOperacoes: card.tem_filho_operacoes,
            filhoOperacoesArquivado: card.filho_operacoes_arquivado,
            operacoesFilhoFaseRotulo: card.operacoes_filho_fase_rotulo,
          },
          { labelsCompletos: true },
        )
      : [];

  const faseSlugHipoteses = faseAtual?.slug?.trim() ?? '';
  const isFaseHipoteses = isHipotesesFaseSlug(faseSlugHipoteses);
  const isFaseDadosCondominios =
    !isLegado && kanbanNome === 'Funil Step One' && isDadosCondominiosFaseSlug(faseSlugHipoteses);
  const exibirSecaoCondominioSidebar = kanbanExibeSecaoCondominioSidebar({
    isLegado,
    kanbanId: card.kanban_id,
    kanbanNome,
    faseAtual,
    fases,
  });
  const exibirEnviarHipotesePortfolio =
    !isLegado && kanbanNome === 'Funil Step One' && isFaseHipoteses;

  const hipotesePortfolioEnviada = Boolean(hipotesePortfolioOk);

  const rede = modalDetalhes.rede;
  const proc = modalDetalhes.processo;
  const condominioIdSidebar = card.condominio_id ?? proc?.condominio_id ?? null;
  const condominioIdChecklistLegal =
    card.condominio_id?.trim() || proc?.condominio_id?.trim() || null;
  const exibirChecklistLegalCondominio =
    !isLegado &&
    deveExibirChecklistLegalNaFase(
      card.kanban_id,
      faseAtual?.slug ?? card.etapa_slug,
      condominioIdChecklistLegal,
    );
  const exibirChecklistCredito =
    !isLegado &&
    deveExibirChecklistCreditoNaFase(card.kanban_id, faseAtual?.slug ?? card.etapa_slug);
  const processoIdChecklists = proc?.id?.trim() || null;
  const enderecoCasaLinha = rede
    ? [
        rede.endereco_casa_frank,
        rede.endereco_casa_frank_numero,
        rede.endereco_casa_frank_complemento,
        rede.cep_casa_frank,
        rede.cidade_casa_frank,
        rede.estado_casa_frank,
      ]
        .map((x) => (x ?? '').trim())
        .filter(Boolean)
        .join(', ')
    : '';
  const fmtDataBr = (iso: string | null | undefined) => {
    const s = String(iso ?? '').trim();
    if (!s) return '—';
    return formatIsoDateOnlyPtBr(s) ?? s;
  };
  const driveHref = (() => {
    const raw = proc?.link_pasta_drive?.trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  })();

  const linkHrefFromText = (raw: string | null | undefined) => {
    const t = String(raw ?? '').trim();
    if (!t) return null;
    if (/^https?:\/\//i.test(t)) return t;
    return `https://${t}`;
  };

  function renderNegocioLinkCampo(
    label: string,
    raw: string | null | undefined,
    edit?: { value: string; onChange: (v: string) => void; onBlur?: (v: string) => void },
  ) {
    const href = linkHrefFromText(edit ? edit.value : raw);
    if (edit) {
      return (
        <label className="block">
          <span className="text-[11px] font-medium text-stone-500">{label}</span>
          <input
            type="url"
            value={edit.value}
            onChange={(e) => edit.onChange(e.target.value)}
            onBlur={(e) => edit.onBlur?.(e.target.value)}
            placeholder="https://…"
            className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
          />
        </label>
      );
    }
    return (
      <div>
        <div className="text-[11px] font-medium text-stone-500">{label}</div>
        <div className="text-xs">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-moni-primary underline"
            >
              {String(raw ?? '').trim()}
            </a>
          ) : (
            '—'
          )}
        </div>
      </div>
    );
  }

  function renderNegocioLinkComComentarios(
    label: string,
    linkRaw: string | null | undefined,
    comentarioRaw: string | null | undefined,
    edit?: {
      linkValue: string;
      comentarioValue: string;
      onLinkChange: (v: string) => void;
      onComentarioChange: (v: string) => void;
    },
  ) {
    const href = linkHrefFromText(edit ? edit.linkValue : linkRaw);
    const comentario = String(edit ? edit.comentarioValue : comentarioRaw ?? '').trim();
    if (edit) {
      return (
        <div className="space-y-1.5">
          <label className="block">
            <span className="text-[11px] font-medium text-stone-500">{label}</span>
            <input
              type="text"
              value={edit.linkValue}
              onChange={(e) => edit.onLinkChange(e.target.value)}
              placeholder="https://…"
              className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-stone-500">Comentários</span>
            <textarea
              value={edit.comentarioValue}
              onChange={(e) => edit.onComentarioChange(e.target.value)}
              rows={2}
              placeholder="Observações sobre este item…"
              className="mt-0.5 w-full resize-y rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
            />
          </label>
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <div>
          <div className="text-[11px] font-medium text-stone-500">{label}</div>
          <div className="text-xs">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-moni-primary underline"
              >
                {String(linkRaw ?? '').trim()}
              </a>
            ) : (
              '—'
            )}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-medium text-stone-500">Comentários</div>
          <div className="whitespace-pre-wrap text-xs text-stone-800">{comentario || '—'}</div>
        </div>
      </div>
    );
  }

  function renderNegocioAnexoCampo(
    label: string,
    field: ProcessoNegocioAnexoCampo,
    path: string | null | undefined,
  ) {
    if (!proc?.id) return null;
    const inputId = `negocio-anexo-${field}`;
    const uploading = uploadingNegocioAnexo === field;
    const canAnexar = modalSessao.ehAdminOuTeam;
    const anexoBtnClass =
      'inline-flex cursor-pointer items-center rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-stone-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50';
    return (
      <div>
        <p className="text-[11px] font-medium text-stone-500">{label}</p>
        <input
          id={inputId}
          type="file"
          className="sr-only"
          onChange={(e) => void handleNegocioAnexoFile(e, field)}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,image/*"
          disabled={uploading}
        />
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          {path?.trim() ? (
            <>
              <button
                type="button"
                onClick={() => void handleBaixarNegocioAnexo(path)}
                className="rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-stone-50"
              >
                Baixar
              </button>
              {canAnexar ? (
                <label htmlFor={inputId} className={anexoBtnClass}>
                  {uploading ? 'Enviando…' : 'Substituir'}
                </label>
              ) : null}
            </>
          ) : canAnexar ? (
            <label htmlFor={inputId} className={anexoBtnClass}>
              {uploading ? 'Enviando…' : 'Anexar'}
            </label>
          ) : (
            <span className="text-[11px] text-stone-500">—</span>
          )}
        </div>
      </div>
    );
  }

  function renderDadosNegocioLinksEAnexos(editMode: boolean) {
    if (!proc) return null;
    return (
      <div className="space-y-2 border-t border-stone-100 pt-2">
        {renderNegocioAnexoCampo('Opção de Permuta', 'opcao_permuta', proc.anexo_opcao_permuta_path)}
        {renderNegocioLinkCampo(
          'BCA',
          proc.link_bca,
          editMode
            ? {
                value: negocioDraft.link_bca,
                onChange: (v) => setNegocioDraft((d) => ({ ...d, link_bca: v })),
              }
            : undefined,
        )}
        {renderNegocioLinkCampo(
          'Gbox',
          proc.link_gbox,
          editMode
            ? {
                value: negocioDraft.link_gbox,
                onChange: (v) => setNegocioDraft((d) => ({ ...d, link_gbox: v })),
              }
            : undefined,
        )}
        {renderNegocioLinkCampo(
          'Mapa de Competidores',
          proc.link_mapa_competidores,
          editMode
            ? {
                value: negocioDraft.link_mapa_competidores,
                onChange: (v) => setNegocioDraft((d) => ({ ...d, link_mapa_competidores: v })),
              }
            : undefined,
        )}
        {renderNegocioLinkCampo(
          'Acoplamento',
          proc.link_acoplamento,
          editMode
            ? {
                value: negocioDraft.link_acoplamento,
                onChange: (v) => setNegocioDraft((d) => ({ ...d, link_acoplamento: v })),
              }
            : undefined,
        )}
        {renderNegocioLinkCampo(
          'Apresentação do Comitê',
          proc.link_apresentacao_comite,
          editMode
            ? {
                value: negocioDraft.link_apresentacao_comite,
                onChange: (v) => setNegocioDraft((d) => ({ ...d, link_apresentacao_comite: v })),
              }
            : undefined,
        )}
        {renderNegocioAnexoCampo(
          'Contrato de Permuta',
          'contrato_permuta',
          proc.anexo_contrato_permuta_path,
        )}
        {renderNegocioAnexoCampo('Seguro garantia', 'seguro_garantia', proc.anexo_seguro_garantia_path)}
        {renderNegocioLinkComComentarios(
          'Moní Capital — seguro garantia',
          proc.link_moni_capital_seguro_garantia,
          proc.comentario_moni_capital_seguro_garantia,
          editMode
            ? {
                linkValue: negocioDraft.link_moni_capital_seguro_garantia,
                comentarioValue: negocioDraft.comentario_moni_capital_seguro_garantia,
                onLinkChange: (v) => setNegocioDraft((d) => ({ ...d, link_moni_capital_seguro_garantia: v })),
                onComentarioChange: (v) =>
                  setNegocioDraft((d) => ({ ...d, comentario_moni_capital_seguro_garantia: v })),
              }
            : undefined,
        )}
        {renderNegocioLinkComComentarios(
          'Moní Capital — gastos de Aporte Inicial',
          proc.link_moni_capital_gastos_aporte_inicial,
          proc.comentario_moni_capital_gastos_aporte_inicial,
          editMode
            ? {
                linkValue: negocioDraft.link_moni_capital_gastos_aporte_inicial,
                comentarioValue: negocioDraft.comentario_moni_capital_gastos_aporte_inicial,
                onLinkChange: (v) =>
                  setNegocioDraft((d) => ({ ...d, link_moni_capital_gastos_aporte_inicial: v })),
                onComentarioChange: (v) =>
                  setNegocioDraft((d) => ({ ...d, comentario_moni_capital_gastos_aporte_inicial: v })),
              }
            : undefined,
        )}
      </div>
    );
  }

  function abrirEdicaoNegocio() {
    if (!proc) return;
    void (async () => {
      const supabase = createClient();
      const opcoes = await fetchFasesNegocioPrazoOpcoes(supabase);
      setFasesNegocioPrazo(opcoes);
      setNegocioDraft({
        tipo_aquisicao_terreno: proc.tipo_aquisicao_terreno ?? '',
        valor_terreno: moedaCampoValorInicial(proc.valor_terreno),
        vgv_pretendido: proc.vgv_pretendido != null ? String(proc.vgv_pretendido) : '',
        produto_modelo_casa: proc.produto_modelo_casa ?? '',
        link_pasta_drive: proc.link_pasta_drive ?? '',
        link_bca: proc.link_bca ?? '',
        link_gbox: proc.link_gbox ?? '',
        link_mapa_competidores: proc.link_mapa_competidores ?? '',
        link_acoplamento: proc.link_acoplamento ?? '',
        link_apresentacao_comite: proc.link_apresentacao_comite ?? '',
        link_moni_capital_seguro_garantia: proc.link_moni_capital_seguro_garantia ?? '',
        comentario_moni_capital_seguro_garantia: proc.comentario_moni_capital_seguro_garantia ?? '',
        link_moni_capital_gastos_aporte_inicial: proc.link_moni_capital_gastos_aporte_inicial ?? '',
        comentario_moni_capital_gastos_aporte_inicial:
          proc.comentario_moni_capital_gastos_aporte_inicial ?? '',
        prazo_opcao: negocioPrazoOpcaoDraftFromProcesso(proc, opcoes),
        prazo_instrumento_garantidor: negocioPrazoInstrumentoDraftFromProcesso(proc, opcoes),
        negociacao_linhas: negociacaoLinhasDraftFromLinhas(proc.negociacao_linhas ?? []),
      });
      setEditandoNegocio(true);
    })();
  }

  const secaoHead = (id: SecaoEsquerdaId, label: string, body: ReactNode) => (
    <div
      className="mb-2 overflow-hidden rounded-lg bg-white text-xs"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        boxShadow: 'var(--moni-shadow-sm)',
      }}
    >
      <button
        type="button"
        onClick={() => toggleSecaoEsquerda(id)}
        className="flex w-full items-center gap-2 p-2 text-left text-xs transition hover:bg-stone-50"
      >
        {secaoAberta[id] ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
        )}
        <span className="text-xs font-semibold text-stone-800">{label}</span>
      </button>
      {secaoAberta[id] ? (
        <div className="border-t px-2 pb-2 pt-1.5 text-xs text-stone-600" style={{ borderColor: 'var(--moni-border-subtle)' }}>
          {body}
        </div>
      ) : null}
    </div>
  );

  const secaoHeadPainelCentroCalculadora = () => {
    const ativo = abaCentro === 'calculadora';
    const pct = calculadoraFasesPack.linhas.length > 0 ? calculadoraResumo.percentualConcluido : null;
    return (
      <div
        className="mb-2 overflow-hidden rounded-lg bg-white text-xs"
        style={{
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-sm)',
        }}
      >
        <button
          type="button"
          onClick={abrirPainelCalculadora}
          className={`flex w-full items-center gap-2 p-2 text-left text-xs transition hover:bg-stone-50 ${
            ativo ? 'bg-[var(--moni-navy-50,#eef3f5)] ring-1 ring-inset ring-[var(--moni-navy-200,#b8ccd4)]' : ''
          }`}
        >
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
          <span className="text-xs font-semibold text-stone-800">Calculadora</span>
          {pct != null ? (
            <span
              className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
              style={{
                background: 'var(--moni-navy-50, #eef3f5)',
                color: 'var(--moni-navy-800)',
              }}
              title="Progresso no funil"
            >
              {pct}%
            </span>
          ) : null}
        </button>
        {ativo ? (
          <p
            className="border-t px-2 pb-2 pt-1.5 text-[10px] text-stone-500"
            style={{ borderColor: 'var(--moni-border-subtle)' }}
          >
            Calculadora aberta — use <strong className="font-medium text-stone-700">Voltar</strong> no centro do
            card.
          </p>
        ) : pct != null ? (
          <p
            className="border-t px-2 pb-2 pt-1.5 text-[10px] text-stone-500"
            style={{ borderColor: 'var(--moni-border-subtle)' }}
          >
            {pct}% concluído no funil — clique para ver SLA e previsões.
          </p>
        ) : null}
      </div>
    );
  };

  function handleBackdropClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (Date.now() < suprimirFecharBackdropAteRef.current) return;
    onClose();
  }

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="moni-card-modal-split relative flex h-[90vh] w-full flex-col overflow-hidden bg-white sm:flex-row"
        style={{
          maxWidth: 'var(--moni-card-modal-max)',
          borderRadius: 'var(--moni-radius-xl)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kanban-card-modal-title"
      >
        <div
          className="absolute left-0 right-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-4"
          style={{
            borderColor: 'var(--moni-border-default)',
            borderTopLeftRadius: 'var(--moni-radius-xl)',
            borderTopRightRadius: 'var(--moni-radius-xl)',
          }}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <h2 id="kanban-card-modal-title" className="min-w-0 truncate text-base font-semibold sm:text-lg" style={{ color: 'var(--moni-text-primary)' }}>
              {cardTitulo}
            </h2>
            <span
              className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                background: 'var(--moni-surface-100)',
                color: 'var(--moni-text-secondary)',
                border: '0.5px solid var(--moni-border-default)',
              }}
            >
              {kanbanNome}
            </span>
            {isLegado ? (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide"
                style={{
                  background: 'var(--moni-surface-50)',
                  color: 'var(--moni-text-tertiary)',
                  border: '0.5px solid var(--moni-border-subtle)',
                }}
              >
                Legado
              </span>
            ) : null}
            {!isLegado && cardNativoConcluido ? (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  background: 'var(--moni-green-50)',
                  color: 'var(--moni-green-800)',
                  border: '0.5px solid var(--moni-green-400)',
                }}
              >
                CONCLUÍDO
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-full w-full flex-col sm:flex-row" style={{ paddingTop: '70px' }}>
          {/* Centro — conteúdo principal (mobile: primeiro) */}
          <div
            className={`moni-card-modal-center order-1 flex h-full min-h-0 flex-1 flex-col p-6 sm:order-2 sm:min-w-0 ${
              abaCentro === 'calculadora' ? 'overflow-hidden' : 'overflow-y-auto'
            }`}
            style={{ background: 'var(--moni-surface-0)' }}
          >
            {!painelCentroAlternativo ? (
            <div className="mb-6 flex flex-wrap items-center gap-1.5">
              {faseAtual ? (
                <span
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs font-semibold leading-none"
                  style={{
                    background: 'var(--moni-gold-50)',
                    color: 'var(--moni-gold-800)',
                    border: '0.5px solid var(--moni-gold-400)',
                    borderRadius: 'var(--moni-radius-pill)',
                  }}
                >
                  <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                  {faseAtual.nome}
                </span>
              ) : null}
              {aguardandoDocumentacaoCreditoObra ? (
                <span className={`text-xs leading-none ${CLASSE_TAG_AGUARDANDO_DOCUMENTACAO}`}>
                  {TAG_AGUARDANDO_DOCUMENTACAO}
                </span>
              ) : null}
              {!aguardandoDocumentacaoCreditoObra && slaCard.status !== 'ok' ? (
                <KanbanCardSlaBolinha sla={slaCard} className="mt-0" />
              ) : null}
            </div>
            ) : null}

            {!painelCentroAlternativo && chipsParalelasModal.length > 0 ? (
              <div className="mb-4">
                <KanbanParalelasChips chips={chipsParalelasModal} compact={false} />
                  </div>
            ) : null}

            {exibirSecaoJustificativaSla ? (
              <div
                className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
                role="region"
                aria-label="Justificativa de quebra de SLA"
              >
                <p className="text-sm font-medium text-amber-900">Quebra de SLA</p>
                <p className="mt-1 text-xs text-amber-800">
                  O prazo desta fase venceu. Registre a justificativa antes de avançar o card.
                </p>
                {slaJustificativaRegistrada ? (
                  <div className="mt-3 rounded-md border border-amber-200 bg-white px-3 py-2">
                    <p className="text-xs font-medium text-stone-600">Justificativa registrada</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-stone-800">{slaJustificativaRegistrada}</p>
                    {card.sla_justificativa_em ? (
                      <p className="mt-2 text-[11px] text-stone-500">
                        {formatDataHoraHistorico(card.sla_justificativa_em)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <label className="mt-3 block text-xs font-medium text-amber-900">
                      Justificativa
                      <textarea
                        value={slaJustificativaDraft}
                        onChange={(e) => setSlaJustificativaDraft(e.target.value)}
                        rows={3}
                        className="mt-1 w-full resize-none rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        placeholder="Descreva o motivo da quebra de SLA…"
                        disabled={salvandoJustificativaSlaInline}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={salvandoJustificativaSlaInline || !slaJustificativaDraft.trim()}
                      onClick={() => {
                        const texto = slaJustificativaDraft.trim();
                        if (!texto) return;
                        setSalvandoJustificativaSlaInline(true);
                        void salvarJustificativaSlaLoteadores({
                          cardId: card.id,
                          justificativa: texto,
                          basePath,
                        })
                          .then((res) => {
                            if (!res.ok) {
                              alert(res.error ?? 'Não foi possível salvar a justificativa.');
                              return;
                            }
                            setSlaJustificativaDraft('');
                            void loadCard({ silencioso: true });
                            router.refresh();
                          })
                          .finally(() => setSalvandoJustificativaSlaInline(false));
                      }}
                      className="mt-2 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {salvandoJustificativaSlaInline ? 'Salvando…' : 'Salvar justificativa'}
                    </button>
                  </>
                )}
              </div>
            ) : null}

            {abaCentro === 'trancheVinculo' && trancheVinculoIndex != null ? (
              <KanbanCardModalOperacoesTrancheVinculoForm
                cardId={card.id}
                trancheIndex={trancheVinculoIndex}
                basePath={basePath}
                refreshKey={trancheVinculosTick}
                podeGerenciar={podeGerenciarRelacionamentos}
                cardDesabilitado={
                  cardNativoArquivado ||
                  cardLegadoArquivado ||
                  cardNativoConcluido ||
                  cardLegadoConcluido
                }
                onVoltar={voltarPainelDetalhes}
                onConcluido={() => {
                  setTrancheVinculosTick((t) => t + 1);
                  void loadCard();
                  router.refresh();
                }}
              />
            ) : abaCentro === 'chamados' ? (
            <>
                      <button
                        type="button"
              onClick={voltarPainelDetalhes}
              className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
                      >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Voltar
                      </button>
            <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-4 flex min-h-0 flex-1 flex-col">
              <h4 className="mb-2 text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
                Chamados
                {interacoes.length > 0 ? (
                  <span className="ml-2 text-xs font-normal text-stone-500">
                    ({interacoes.length} no card
                    {chamadosAbertosCount > 0 ? ` · ${chamadosAbertosCount} em aberto` : ''})
                  </span>
                ) : null}
              </h4>
              {erroCarregarChamados ? (
              <div
                  className="mb-3 rounded-lg border px-3 py-2.5 text-xs"
                style={{
                    borderColor: 'var(--moni-status-overdue-border)',
                    background: 'var(--moni-status-overdue-bg)',
                    color: 'var(--moni-status-overdue-text)',
                  }}
                  role="alert"
                >
                  <p className="font-medium">Não foi possível carregar os chamados deste card.</p>
                  <p className="mt-1 opacity-90">
                    Nada foi apagado no banco — abra de novo ou tente recarregar. {erroCarregarChamados}
                  </p>
                      <button
                        type="button"
                    onClick={() => void loadCard()}
                    className="mt-2 rounded-md border border-current/30 bg-white/60 px-2.5 py-1 text-[11px] font-semibold hover:bg-white"
                  >
                    Tentar novamente
                      </button>
                    </div>
              ) : null}

              <div
                className="flex min-h-0 flex-1 flex-col rounded-lg bg-white p-3"
                style={{
                  border: '0.5px solid var(--moni-border-default)',
                  boxShadow: 'var(--moni-shadow-sm)',
                }}
              >
              <div className="relative mb-3 shrink-0">
                <button
                  ref={filtrosBtnRef}
                  type="button"
                  onClick={() => {
                    if (filtrosOpen) {
                      setFiltrosDraft({ ...filtros });
                      setFiltrosOpen(false);
                    } else {
                      setFiltrosDraft({ ...filtros });
                      setFiltrosOpen(true);
                    }
                  }}
                  className="rounded-md border px-2.5 py-1 text-[11px] font-medium transition hover:opacity-95"
                  style={{
                    borderColor: 'var(--moni-border-default)',
                    background: 'var(--moni-surface-0)',
                    color: 'var(--moni-text-primary)',
                  }}
                >
                  Filtros ({countKanbanModalInteracoesFiltrosAtivos(filtros)})
                </button>
                {filtrosOpen ? (
                  <div
                    ref={filtrosPopoverRef}
                    className="absolute left-0 top-full z-[60] mt-1 w-[min(100vw-2rem,12rem)]"
                  >
                    <KanbanInteracoesFiltrosPanel
                      draft={filtrosDraft}
                      setDraft={setFiltrosDraft}
                      kanbanTimes={timesFiltroOpcoesModal}
                      responsaveisOpcoes={responsaveisFiltroOpcoesModal}
                      onLimpar={() => setFiltrosDraft(KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT)}
                      onAplicar={() => {
                        setFiltros({ ...filtrosDraft });
                        setFiltrosOpen(false);
                      }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {interacoesFiltradas.length > 0 ? (
                <div className="mb-2 space-y-1.5">
                  {interacoesFiltradas.map((it) => {
                    const subs = subInteracoesPorPai[it.id] ?? [];
                    const subsVisiveis = filtrarSubAtividadesPorConclusao(
                      subs,
                      filtros.mostrarAtividadesConcluidas,
                    );
                    const subsDetalheAberto = subExpandida[it.id] === true;
                    const deriv = derivarChamadoKanbanComSubs(it.status, subs);
                    const statusVisual = deriv.usarDerivado ? deriv.status : it.status;
                    const prazoEfetivo = prazoEfetivoParaChamado(it, subs);
                    const surfaceKind = resolveKanbanChamadoSurfaceKind(statusVisual, prazoEfetivo);
                    const iconKind = resolveKanbanChamadoIconKind({
                      status: statusVisual,
                      alertaSubAtrasada: deriv.alertaSubAtrasada,
                    });
                    const pillKind = kanbanStatusParaPillKind(statusVisual);
                    const timeTags = tagsTimesDeAtividades(it, subs, kanbanTimes);
                    const demo = isInteracaoDemonstracao(it.id);
                    const statusInteracaoSelect =
                      it.status === 'pendente' || it.status === 'em_andamento' || it.status === 'concluida'
                        ? it.status
                        : 'pendente';
                    const temSubAbertaPai = (subInteracoesPorPai[it.id] ?? []).some(
                      (s) => s.status !== 'concluido' && s.status !== 'aprovado',
                    );
                    return (
                      <AtividadeVinculadaCard
                        key={it.id}
                        kind={surfaceKind}
                        as="div"
                        compact
                        style={corFundoChamado(prazoEfetivo, statusVisual)}
                      >
                        <div className="flex items-start gap-1.5">
                          {!demo ? (
                            <button
                              type="button"
                              className="mt-0.5 shrink-0 rounded p-0.5 text-stone-500 hover:bg-stone-200"
                              aria-expanded={subsDetalheAberto}
                              onClick={() => {
                                setSubExpandida((s) => ({ ...s, [it.id]: !subsDetalheAberto }));
                              }}
                            >
                              <ChevronRight
                                className={`h-3.5 w-3.5 transition-transform ${subsDetalheAberto ? 'rotate-90' : ''}`}
                                aria-hidden
                              />
                            </button>
                          ) : (
                            <span className="mt-0.5 inline-block w-4 shrink-0" aria-hidden />
                          )}
                          <span className="mt-0.5 shrink-0">
                            <AtividadeVinculadaIcon kind={iconKind} size="sm" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                              {editingId === it.id ? (
                                <>
                                  <input
                                    type="text"
                                    value={editDraft.titulo}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, titulo: e.target.value }))}
                                    className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 text-sm font-medium text-stone-800 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
                                    aria-label="Título do chamado"
                                    autoFocus
                                  />
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={salvandoEdicao}
                                      onClick={() => void salvarEdicaoInteracao()}
                                      className="rounded px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                                      style={{ background: 'var(--moni-text-primary)' }}
                                    >
                                      {salvandoEdicao ? '…' : 'Salvar'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={salvandoEdicao}
                                      onClick={() => setEditingId(null)}
                                      className="rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 disabled:opacity-50"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {!demo ? (
                                    <AnexosChamado
                                      chamadoId={it.id}
                                      portalFrank={portalFrank}
                                      uploader_nome={modalSessao.uploaderNome}
                                      basePath={basePath}
                                      chamadoCriadoPor={it.criado_por}
                                      sessionUserId={modalSessao.userId}
                                      sessionEhAdminOuTeam={modalSessao.ehAdminOuTeam}
                                      demo={demo}
                                    />
                                  ) : null}
                                  {it.numero != null ? (
                                    <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-stone-600">
                                      {formatChamadoNumero(it.numero)}
                                    </span>
                                  ) : null}
                                  <h5 className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight text-stone-800">
                                    {it.titulo}
                                  </h5>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <SlaTituloBolinha
                                      prazoIso={prazoEfetivo}
                                      statusPainel={mapInteracaoStatusParaPainelSla(statusVisual)}
                                      className="mt-0.5"
                                    />
                                    {!demo ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          abrirEdicaoInteracao(it);
                                        }}
                                        className="shrink-0 rounded p-0.5 text-stone-700 hover:bg-stone-200 hover:text-stone-900"
                                        aria-label="Editar título do chamado"
                                        title="Editar título"
                                      >
                                        <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                      </button>
                                    ) : null}
                                    {!demo && podeCriarChamados ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setModalArquivarInteracao({ id: it.id, tipo: 'chamado' });
                                          setMotivoArquivarInteracao('');
                                        }}
                                        className="shrink-0 rounded p-0.5 text-stone-400 hover:bg-red-50 hover:text-red-500"
                                        title="Arquivar chamado"
                                      >
                                        <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                      </button>
                                    ) : null}
                                    {!demo &&
                                    modalSessao.userId &&
                                    (modalSessao.roleNorm === 'admin' ||
                                      modalSessao.cargoNorm === 'adm' ||
                                      (it.criado_por != null && it.criado_por === modalSessao.userId)) ? (
                                      <button
                                        type="button"
                                        onClick={() => setModalExcluirInteracaoId(it.id)}
                                        className="shrink-0 rounded p-0.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                                        title="Excluir chamado"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                      </button>
                                    ) : null}
                                  </div>
                                </>
                              )}
                            </div>
                            {!subsDetalheAberto && subsVisiveis.length > 0 ? (
                              <p className="mt-1 text-[10px] text-stone-500">
                                {subsVisiveis.length} atividade{subsVisiveis.length === 1 ? '' : 's'}
                                {!filtros.mostrarAtividadesConcluidas && subs.length > subsVisiveis.length
                                  ? ` (${subs.length - subsVisiveis.length} concluída${subs.length - subsVisiveis.length === 1 ? '' : 's'} oculta${subs.length - subsVisiveis.length === 1 ? '' : 's'})`
                                  : ''}{' '}
                                — clique na seta para expandir
                              </p>
                            ) : null}
                            {subsDetalheAberto ? (
                            <>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                                style={
                                  (it.categoria ?? 'chamado') === 'melhoria'
                                    ? {
                                        background: 'var(--moni-gold-50)',
                                        color: 'var(--moni-gold-800)',
                                        border: '1px solid var(--moni-gold-200)',
                                      }
                                    : {
                                        background: 'var(--moni-status-active-bg)',
                                        color: 'var(--moni-status-active-text)',
                                        border: '1px solid var(--moni-status-active-border)',
                                      }
                                }
                              >
                                {(it.categoria ?? 'chamado') === 'melhoria' ? 'Melhoria' : 'Chamado'}
                              </span>
                              {modalSessao.ehAdminOuTeam && !demo ? (
                                statusInteracaoSelect === 'em_andamento' ? (
                                  <span className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 text-[10px]">
                                    Em andamento
                                  </span>
                                ) : (
                                <SearchableSelect
                                  value={statusInteracaoSelect}
                                  onChange={(v) =>
                                    void handleInteracaoStatusChange(
                                      it.id,
                                      v as 'pendente' | 'em_andamento' | 'concluida',
                                    )
                                  }
                                  size="xs"
                                  emptyOption={null}
                                  options={[
                                    { value: 'pendente', label: 'A fazer' },
                                    { value: 'concluida', label: 'Concluída', disabled: temSubAbertaPai },
                                  ]}
                                />
                                )
                              ) : null}
                              {travaEfetivaParaChamado(it, subs) ? (
                                <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                                  Trava
                                </span>
                              ) : null}
                              {timeTags.map((tg) => (
                                <span
                                  key={`${it.id}-${tg.id}`}
                                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                                  style={{
                                    background: 'var(--moni-surface-100)',
                                    color: 'var(--moni-text-secondary)',
                                  }}
                                >
                                  {tg.nome}
                                </span>
                              ))}
                              <SlaAtividadeBadge
                                prazoIso={prazoEfetivo}
                                status={mapInteracaoStatusParaPainelSla(statusVisual)}
                                showOkText={false}
                              />
                            </div>
                            {editingId === it.id ? (
                              <div className="mt-2 space-y-1.5 rounded-lg border border-stone-200 bg-white p-2">
                                <textarea
                                  value={editDraft.descricao}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, descricao: e.target.value }))}
                                  rows={3}
                                  placeholder="Descrição do chamado"
                                  className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                                />
                                <SearchableSelect
                                  value={editDraft.categoria}
                                  onChange={(v) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      categoria: v as 'chamado' | 'melhoria',
                                    }))
                                  }
                                  size="sm"
                                  emptyOption={null}
                                  options={[
                                    { value: 'chamado', label: 'Chamado' },
                                    { value: 'melhoria', label: 'Melhoria' },
                                  ]}
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={salvandoEdicao}
                                    onClick={() => void salvarEdicaoInteracao()}
                                    className="rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                    style={{ background: 'var(--moni-text-primary)' }}
                                  >
                                    {salvandoEdicao ? '…' : 'Salvar'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="rounded border border-stone-300 px-3 py-1.5 text-xs"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : it.descricao ? (
                              <p className="mt-1 text-xs text-stone-600">{it.descricao}</p>
                            ) : null}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                              {(!modalSessao.ehAdminOuTeam ||
                                demo ||
                                (deriv.usarDerivado && statusVisual !== statusInteracaoSelect)) ? (
                                <AtividadeVinculadaStatusPill kind={pillKind}>
                                  {labelKanbanAtividadeParaPill(statusVisual)}
                                </AtividadeVinculadaStatusPill>
                              ) : null}
                              {deriv.alertaSubAtrasada ? (
                                <span
                                  className="rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-900"
                                  title="Pelo menos uma sub-interação está com prazo vencido e não concluída"
                                >
                                  Sub-itens atrasados
                                </span>
                              ) : null}
                              {prazoEfetivo ? (
                                <span className="text-stone-600">
                                  Prazo{subs.length > 0 ? ' (efetivo)' : ''}: {formatIsoDateOnlyPtBr(prazoEfetivo)}
                                </span>
                              ) : (
                                <span className="text-stone-400">Sem prazo</span>
                              )}
                              <span className="text-stone-600">
                                Resp.:{' '}
                                <span className="font-medium">
                                  {it.responsaveis_resolvidos && it.responsaveis_resolvidos.length > 0
                                    ? it.responsaveis_resolvidos.map((r) => r.nome).join(', ')
                                    : it.responsavel_id
                                      ? it.profiles?.full_name?.trim() || '—'
                                      : it.responsavel_nome_texto ?? 'Sem responsável'}
                                </span>
                              </span>
                            </div>
                            {!demo ? (
                              <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50/80 p-2">
                                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                                    Atividades ({subsVisiveis.length}
                                    {!filtros.mostrarAtividadesConcluidas && subs.length > subsVisiveis.length
                                      ? ` de ${subs.length}`
                                      : ''}
                                    )
                                  </p>
                                </div>
                                {subsVisiveis.length > 0 ? (
                                  <ul className="mb-2 space-y-1.5">
                                    {subsVisiveis.map((sub) => {
                                      const subDetalheAberto = subAtividadeExpandida[sub.id] === true;
                                      const podePastel = usuarioPodeMarcarPastelSubInteracao(
                                        sub,
                                        modalSessao.userId,
                                      );
                                      return (
                                      <li
                                        key={sub.id}
                                        className={`rounded-md border bg-white px-2 py-1.5 text-xs ${
                                          deepLinkTopicoId != null && String(sub.id) === String(deepLinkTopicoId)
                                            ? 'border-[color:var(--moni-status-attention-border)] bg-[var(--moni-status-attention-bg)]'
                                            : 'border-stone-200'
                                        }`}
                                      >
                                        {editingSubId === sub.id ? (
                                          <div className="space-y-2">
                                            <p className="text-[10px] font-semibold text-stone-600">Editar atividade</p>
                                            <KanbanAtividadeFormFields
                                              draft={editSubDraft}
                                              setDraft={setEditSubDraft}
                                              kanbanTimes={timesChamadoOpcoes}
                                              responsaveisOpcoes={responsaveisSubEdicao}
                                              sessionUserId={modalSessao.userId}
                                              compact
                                              idPrefix={`edit-${sub.id}`}
                                              showAnexosDraft={false}
                                              anexosSubchamado={{
                                                subchamadoId: sub.id,
                                                uploader_nome: modalSessao.uploaderNome,
                                                basePath,
                                                sessionUserId: modalSessao.userId,
                                                sessionEhAdminOuTeam: modalSessao.ehAdminOuTeam,
                                              }}
                                              onDelete={() => void handleExcluirSubInteracao(sub.id, it.id)}
                                              deleteTitle="Excluir atividade"
                                            />
                                            <div className="flex flex-wrap gap-2">
                                              <button
                                                type="button"
                                                disabled={
                                                  salvandoEditSub ||
                                                  !editSubDraft.nome.trim() ||
                                                  editSubDraft.timesIds.length === 0 ||
                                                  editSubDraft.responsaveisIds.length === 0
                                                }
                                                onClick={() => void handleEditarSubInteracao(sub.id)}
                                                className="rounded px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
                                                style={{ background: 'var(--moni-text-primary)' }}
                                              >
                                                {salvandoEditSub ? '…' : 'Salvar'}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setEditingSubId(null)}
                                                className="rounded border border-stone-300 px-3 py-1.5 text-[11px]"
                                              >
                                                Cancelar
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                        <div className="flex items-start gap-1">
                                          <button
                                            type="button"
                                            className="mt-0.5 shrink-0 rounded p-0.5 text-stone-500 hover:bg-stone-200"
                                            aria-expanded={subDetalheAberto}
                                            onClick={() =>
                                              setSubAtividadeExpandida((s) => ({
                                                ...s,
                                                [sub.id]: !subDetalheAberto,
                                              }))
                                            }
                                          >
                                            <ChevronRight
                                              className={`h-3.5 w-3.5 transition-transform ${subDetalheAberto ? 'rotate-90' : ''}`}
                                              aria-hidden
                                            />
                                          </button>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <span className="rounded border border-stone-300 bg-stone-100 px-1 py-0.5 text-[9px] font-bold uppercase text-stone-700">
                                                {sub.tipo === 'duvida'
                                                  ? 'Dúvida'
                                                  : sub.tipo === 'chamado'
                                                    ? 'Chamado'
                                                    : 'Atividade'}
                                              </span>
                                              <span className="min-w-0 truncate font-medium text-stone-800">
                                                {sub.nome || sub.descricao}
                                              </span>
                                              <SlaAtividadeBadge
                                                prazoIso={prazoSlaSubInteracao(sub)}
                                                status={sub.status}
                                                showOkText={false}
                                                size="compact"
                                              />
                                              {sub.historico.some((h) => h.tipo === 'Redirecionado') ? (
                                                <span className="rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-800">
                                                  Redirecionado
                                                </span>
                                              ) : null}
                                              {podePastel ? (
                                                <label className="flex cursor-pointer items-center gap-1 text-[10px] text-stone-600">
                                                  <input
                                                    type="checkbox"
                                                    className="h-3 w-3"
                                                    checked={sub.pastel}
                                                    onChange={(e) =>
                                                      void handleTogglePastel(sub.id, e.target.checked)
                                                    }
                                                  />
                                                  Pastel
                                                </label>
                                              ) : null}
                                              {podeCriarChamados ? (
                                                <button
                                                  type="button"
                                                  title="Editar atividade"
                                                  onClick={() => {
                                                    setEditSubDraft({
                                                      nome: sub.nome || sub.descricao,
                                                      descricaoDetalhe: sub.descricao_detalhe ?? '',
                                                      data: sub.data_fim ?? '',
                                                      timesIds: sub.times_ids,
                                                      responsaveisIds: sub.responsaveis_ids,
                                                      status:
                                                        sub.status === 'aprovado' ? 'concluido' : sub.status,
                                                      pastel: sub.pastel,
                                                      pendingAnexos: [],
                                                    });
                                                    setEditingSubId(sub.id);
                                                    setSubAtividadeExpandida((s) => ({ ...s, [sub.id]: true }));
                                                  }}
                                                  className="ml-0.5 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                                                >
                                                  <Pencil className="h-3 w-3" />
                                                </button>
                                              ) : null}
                                              {modalSessao.userId &&
                                              (modalSessao.roleNorm === 'admin' ||
                                                modalSessao.cargoNorm === 'adm' ||
                                                (it.criado_por != null && it.criado_por === modalSessao.userId)) ? (
                                                <button
                                                  type="button"
                                                  title="Excluir atividade"
                                                  onClick={() => void handleExcluirSubInteracao(sub.id, it.id)}
                                                  className="rounded p-0.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </button>
                                              ) : null}
                                            </div>
                                            {subDetalheAberto ? (
                                              <div className="mt-2 space-y-1 border-t border-stone-100 pt-2">
                                                {modalSessao.ehAdminOuTeam ||
                                                sub.responsaveis_resolvidos.some((r) => r.id === modalSessao.userId) ? (
                                                  <SearchableSelect
                                                    value={sub.status}
                                                    onChange={(v) =>
                                                      void handleSubStatusChange(
                                                        it.id,
                                                        sub.id,
                                                        v as SubInteracaoStatusDb,
                                                      )
                                                    }
                                                    size="xs"
                                                    emptyOption={null}
                                                    options={[
                                                      { value: 'nao_iniciado', label: 'Não iniciado' },
                                                      { value: 'em_andamento', label: 'Em andamento' },
                                                      { value: 'concluido', label: 'Concluído' },
                                                      { value: 'aprovado', label: 'Aprovado' },
                                                    ]}
                                                  />
                                                ) : null}
                                                <div className="flex flex-wrap gap-1">
                                                  {sub.times_resolvidos.map((tg) => (
                                                    <span
                                                      key={`${sub.id}-${tg.id}`}
                                                      className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600"
                                                    >
                                                      {tg.nome}
                                                    </span>
                                                  ))}
                                                </div>
                                                <p className="text-[10px] text-stone-500">
                                                  Resp.:{' '}
                                                  {sub.responsaveis_resolvidos.length > 0
                                                    ? sub.responsaveis_resolvidos.map((r) => r.nome).join(', ')
                                                    : '—'}
                                                </p>
                                                {sub.prazo_status &&
                                                (sub.prazo_status !== 'aceito' ||
                                                  modalSessao.roleNorm === 'admin' ||
                                                  modalSessao.cargoNorm === 'adm') ? (
                                                  <PrazoNegociacaoPanel
                                                    topicoId={sub.id}
                                                    row={sub}
                                                    sessionUserId={modalSessao.userId}
                                                    abridorId={it.criado_por}
                                                    isAdmin={
                                                      modalSessao.roleNorm === 'admin' ||
                                                      modalSessao.cargoNorm === 'adm'
                                                    }
                                                    basePath={basePath}
                                                    compact
                                                    onUpdated={() => void reloadSubsForParent(it.id)}
                                                  />
                                                ) : sub.data_fim ? (
                                                  <p className="text-[10px] text-stone-500">
                                                    Prazo: {formatIsoDateOnlyPtBr(sub.data_fim) ?? sub.data_fim}
                                                  </p>
                                                ) : (
                                                  <p className="text-[10px] text-stone-400">Sem prazo</p>
                                                )}
                                                <AnexosSubchamado
                                                  subchamadoId={sub.id}
                                                  uploader_nome={modalSessao.uploaderNome}
                                                  basePath={basePath}
                                                  sessionUserId={modalSessao.userId}
                                                  sessionEhAdminOuTeam={modalSessao.ehAdminOuTeam}
                                                />
                                                {!modalSessao.ehAdminOuTeam &&
                                                sub.responsaveis_resolvidos.some((r) => r.id === modalSessao.userId) ? (
                                                  <SearchableSelect
                                                    value={sub.status}
                                                    onChange={(v) =>
                                                      void handleSubStatusChange(
                                                        it.id,
                                                        sub.id,
                                                        v as SubInteracaoStatusDb,
                                                      )
                                                    }
                                                    size="xs"
                                                    emptyOption={null}
                                                    options={[
                                                      { value: 'nao_iniciado', label: 'Não iniciado' },
                                                      { value: 'em_andamento', label: 'Em andamento' },
                                                      { value: 'concluido', label: 'Concluído' },
                                                      { value: 'aprovado', label: 'Aprovado' },
                                                    ]}
                                                  />
                                                ) : null}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                        )}
                                      </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <p className="mb-2 text-[11px] text-stone-500">
                                    {!filtros.mostrarAtividadesConcluidas && subs.length > 0
                                      ? 'Só há atividades concluídas. Ative "Mostrar atividades concluídas" nos filtros.'
                                      : 'Nenhum sub-chamado.'}
                                  </p>
                                )}
                                {subFormInteracaoId === it.id ? (
                                  <div className="space-y-1.5 border-t border-stone-200 pt-2">
                                    <p className="text-[10px] font-semibold text-stone-600">Nova atividade</p>
                                    <KanbanAtividadeFormFields
                                      draft={subNovaDraft}
                                      setDraft={setSubNovaDraft}
                                      kanbanTimes={timesChamadoOpcoes}
                                      responsaveisOpcoes={responsaveisSubNova}
                                      sessionUserId={modalSessao.userId}
                                      compact
                                      idPrefix={`nova-${it.id}`}
                                      onDelete={() => {
                                        setSubFormInteracaoId(null);
                                        setSubNovaDraft({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
                                      }}
                                      deleteTitle="Cancelar nova atividade"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={
                                          salvandoSub ||
                                          !subNovaDraft.nome.trim() ||
                                          subNovaDraft.timesIds.length === 0 ||
                                          subNovaDraft.responsaveisIds.length === 0
                                        }
                                        onClick={() => void handleCriarSubInteracao(it.id)}
                                        className="rounded px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
                                        style={{ background: 'var(--moni-text-primary)' }}
                                      >
                                        {salvandoSub ? '…' : 'Salvar atividade'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSubFormInteracaoId(null);
                                          setSubNovaDraft({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
                                        }}
                                        className="rounded border border-stone-300 px-3 py-1.5 text-[11px]"
                                      >
                                        Fechar
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {!demo && podeCriarChamados && subsDetalheAberto ? (
                              <div className="mt-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSubExpandida((s) => ({ ...s, [it.id]: true }));
                                    setSubFormInteracaoId(it.id);
                                    setSubNovaDraft({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
                                  }}
                                  className="text-left text-[11px] font-medium text-stone-700 underline-offset-2 hover:underline"
                                >
                                  + Atividade
                                </button>
                              </div>
                            ) : null}
                            </>
                            ) : null}
                          </div>
                        </div>
                      </AtividadeVinculadaCard>
                    );
                  })}
                </div>
              ) : (
                <p className="mb-2 text-sm text-stone-500">
                  {interacoes.length === 0
                    ? 'Nenhum chamado vinculado a este card no banco.'
                    : 'Nenhum chamado corresponde aos filtros atuais — limpe os filtros para ver todos.'}
                </p>
              )}

              {sireneChamadoIdPastel != null ? (
                <KanbanPastelariaAtividadeSection sireneChamadoId={sireneChamadoIdPastel} />
              ) : null}
              </div>

              <div
                className="mt-2 shrink-0 border-t pt-2"
                style={{ borderColor: 'var(--moni-border-default)' }}
              >
              {podeCriarChamados ? (
              <div
                className="rounded-md p-2"
                style={{
                  background: 'var(--moni-surface-50)',
                }}
              >
                {!novoChamadoFormAberto ? (
                  <button
                    type="button"
                    onClick={() => setNovoChamadoFormAberto(true)}
                    className="text-left text-[11px] font-medium text-stone-700 underline-offset-2 hover:underline"
                  >
                    + Novo Chamado
                  </button>
                ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-stone-600">Novo Chamado</p>
                    <button
                      type="button"
                      onClick={() => {
                        setNovoChamadoFormAberto(false);
                        setNovaAtividadeAberta(false);
                        setNovaInteracao({
                          titulo: '',
                          descricao: '',
                          categoria: 'chamado',
                          status: 'pendente',
                          trava: false,
                          atividade: { ...ATIVIDADE_FORM_DRAFT_VAZIO },
                        });
                      }}
                      className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                      title="Cancelar novo chamado"
                      aria-label="Cancelar novo chamado"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={novaInteracao.titulo}
                    onChange={(e) => setNovaInteracao((n) => ({ ...n, titulo: e.target.value }))}
                    placeholder="Título / assunto"
                    className="w-full px-2 py-1.5 text-xs"
                    style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
                  />
                  <textarea
                    value={novaInteracao.descricao}
                    onChange={(e) => setNovaInteracao((n) => ({ ...n, descricao: e.target.value }))}
                    placeholder="Descrição"
                    rows={2}
                    className="w-full resize-y px-2 py-1.5 text-xs"
                    style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <SearchableSelect
                      value={novaInteracao.categoria}
                      onChange={(v) =>
                        setNovaInteracao((n) => ({
                          ...n,
                          categoria: v as 'chamado' | 'melhoria',
                        }))
                      }
                      aria-label="Tipo do chamado"
                      size="sm"
                      emptyOption={null}
                      triggerClassName="border-[var(--moni-border-default)]"
                      options={[
                        { value: 'chamado', label: 'Chamado' },
                        { value: 'melhoria', label: 'Melhoria' },
                      ]}
                    />
                    <SearchableSelect
                      value={novaInteracao.status}
                      onChange={(v) =>
                        setNovaInteracao((n) => ({
                          ...n,
                          status: v as 'pendente',
                        }))
                      }
                      aria-label="Status do chamado"
                      size="sm"
                      emptyOption={null}
                      triggerClassName="border-[var(--moni-border-default)]"
                      options={[{ value: 'pendente', label: 'Pendente' }]}
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-stone-700">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 shrink-0"
                      checked={novaInteracao.trava}
                      onChange={(e) => setNovaInteracao((n) => ({ ...n, trava: e.target.checked }))}
                    />
                    Trava — bloqueia o card até concluir
                  </label>
                  <ChamadoAtividadeCollapsibleSection
                    aberto={novaAtividadeAberta}
                    onAbrir={() => setNovaAtividadeAberta(true)}
                    onFechar={() => {
                      setNovaAtividadeAberta(false);
                      setNovaInteracao((n) => ({
                        ...n,
                        atividade: { ...ATIVIDADE_FORM_DRAFT_VAZIO },
                      }));
                    }}
                    obrigatorio
                    className="text-[11px]"
                  >
                    <KanbanAtividadeFormFields
                      draft={novaInteracao.atividade}
                      setDraft={(up) =>
                        setNovaInteracao((n) => ({
                          ...n,
                          atividade: typeof up === 'function' ? up(n.atividade) : up,
                        }))
                      }
                      kanbanTimes={timesChamadoOpcoes}
                      responsaveisOpcoes={responsaveisNovaAtividade}
                      sessionUserId={modalSessao.userId}
                      compact
                      idPrefix="nova-ativ"
                      onDelete={() => {
                        setNovaAtividadeAberta(false);
                        setNovaInteracao((n) => ({
                          ...n,
                          atividade: { ...ATIVIDADE_FORM_DRAFT_VAZIO },
                        }));
                      }}
                      deleteTitle="Limpar atividade"
                    />
                  </ChamadoAtividadeCollapsibleSection>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleAdicionarInteracao()}
                      disabled={loading || !novaInteracao.titulo.trim() || !novaInteracao.descricao.trim()}
                      className="shrink-0 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                      style={{ background: 'var(--moni-text-primary)', borderRadius: 'var(--moni-radius-md)' }}
                    >
                      Novo Chamado
                    </button>
                  </div>
                </div>
                )}
              </div>
              ) : (
                <p className="text-xs text-stone-500">Criar chamados não está disponível para o seu perfil.</p>
              )}
              </div>
              </div>
            </div>
            </div>
            </>
            ) : abaCentro === 'calculadora' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                onClick={voltarPainelDetalhes}
                className="mb-4 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Voltar
              </button>
              <div className="flex min-h-0 flex-1 flex-col">
                <div
                  className="flex min-h-0 flex-1 flex-col rounded-lg bg-white p-4"
                  style={{
                    border: '0.5px solid var(--moni-border-default)',
                    boxShadow: 'var(--moni-shadow-sm)',
                  }}
                >
                  <KanbanCardModalCalculadoraFases
                    linhas={calculadoraLinhasEnriquecidas}
                    visits={calculadoraFasesPack.visits}
                    faseAtualId={card.fase_id}
                    cardConcluido={card.concluido === true}
                    fases={calculadoraFasesFlat}
                    fasesMeta={calculadoraFasesMeta}
                    marcos={calculadoraMarcosInput}
                    negociacaoLinhas={negociacaoLinhasCalculadora}
                    variant="painel"
                    cardId={card.id}
                    podeEditarDatas={podeEditarDatasCalculadora}
                    onSalvarData={salvarDataCalculadora}
                  />
                </div>
              </div>
            </div>
            ) : (
            <>
            {chamadosAbertosCount > 0 ? (
              <button
                type="button"
                onClick={abrirPainelChamados}
                className="mb-4 flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-xs transition hover:opacity-95"
                style={{
                  borderColor: 'var(--moni-violet-200, #ddd6fe)',
                  background: 'var(--moni-violet-50, #f5f3ff)',
                  color: 'var(--moni-violet-900, #4c1d95)',
                }}
              >
                <span>
                  <strong className="font-semibold">
                    {chamadosAbertosCount} chamado{chamadosAbertosCount === 1 ? '' : 's'} em aberto
                  </strong>
                  <span className="mt-0.5 block font-normal opacity-90">Ver painel de Chamados (dados do banco)</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            ) : null}
            <KanbanCardDatasFields
              cardId={card.id}
              origem={origem}
              basePath={basePath}
              dataReuniao={dataReuniao}
              dataFollowup={dataFollowup}
              onDataReuniaoChange={setDataReuniao}
              onDataFollowupChange={setDataFollowup}
              onAtaSalva={() => setAtasReuniaoTick((t) => t + 1)}
            />

            <div className="mb-6">
              <h4
                className="mb-3 flex items-center gap-2 text-sm font-semibold"
                style={{ color: 'var(--moni-text-secondary)' }}
              >
                <BookOpen className="h-4 w-4 shrink-0 text-stone-500" aria-hidden />
                Instruções da fase
              </h4>
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'var(--moni-surface-50)',
                  border: '0.5px solid var(--moni-border-default)',
                }}
              >
                {!faseAtual ? (
                  <p className="text-sm italic text-stone-400">Carregando fase…</p>
                ) : editandoInstrucoesFase && pode('editar_instrucoes') ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-stone-600">
                      Texto (quebras de linha preservadas)
                      <textarea
                        value={draftInstrucoesFase}
                        onChange={(e) => setDraftInstrucoesFase(e.target.value)}
                        rows={8}
                        className="mt-1 w-full rounded-md border border-stone-300 px-2 py-2 text-sm text-stone-800 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
                        placeholder="Orientações para quem trabalha nesta fase…"
                      />
                    </label>
                    <div>
                      <p className="text-xs font-medium text-stone-600">Materiais (título, URL, tipo)</p>
                      <ul className="mt-2 space-y-2">
                        {draftMateriaisFase.map((m, idx) => (
                          <li
                            key={idx}
                            className="flex flex-wrap items-end gap-2 rounded-md border border-stone-200 bg-white p-2"
                          >
                            <input
                              type="text"
                              value={m.titulo}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDraftMateriaisFase((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, titulo: v } : r)),
                                );
                              }}
                              placeholder="Título"
                              className="min-w-[6rem] flex-1 rounded border border-stone-300 px-2 py-1 text-xs"
                            />
                            <input
                              type="url"
                              value={m.url}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDraftMateriaisFase((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, url: v } : r)),
                                );
                              }}
                              placeholder="https://…"
                              className="min-w-[8rem] flex-[2] rounded border border-stone-300 px-2 py-1 text-xs"
                            />
                            <SearchableSelect
                              value={m.tipo}
                              onChange={(v) => {
                                const tipo = v as KanbanFaseMaterial['tipo'];
                                setDraftMateriaisFase((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, tipo } : r)),
                                );
                              }}
                              size="sm"
                              emptyOption={null}
                              options={[
                                { value: 'link', label: 'link' },
                                { value: 'documento', label: 'documento' },
                                { value: 'video', label: 'video' },
                              ]}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setDraftMateriaisFase((rows) => rows.filter((_, i) => i !== idx))
                              }
                              className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-red-600"
                              aria-label="Remover material"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftMateriaisFase((rows) => [
                            ...rows,
                            { titulo: '', url: '', tipo: 'link' as const },
                          ])
                        }
                        className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-stone-300 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        Adicionar material
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSalvarInstrucoesFase()}
                        disabled={salvandoInstrucoesFase}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                        style={{ background: 'var(--moni-navy-800)' }}
                      >
                        {salvandoInstrucoesFase ? 'Salvando…' : 'Salvar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoInstrucoesFase(false);
                          setDraftInstrucoesFase('');
                          setDraftMateriaisFase([]);
                        }}
                        disabled={salvandoInstrucoesFase}
                        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const isPreBatalha = isPreBatalhaFaseSlug(faseAtual.slug);
                      const txt = (faseAtual.instrucoes ?? '').trim();
                      const mats = faseAtual.materiais ?? [];
                      const tem =
                        isPreBatalha || txt.length > 0 || mats.length > 0;
                      if (!tem) {
                        return (
                          <p className="text-sm italic text-stone-400">
                            Nenhuma instrução definida para esta fase
                          </p>
                        );
                      }
                      return (
                        <div className="space-y-3">
                          {txt ? (
                            <div
                              className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800"
                              style={{ color: 'var(--moni-text-primary)' }}
                            >
                              {txt}
                            </div>
                          ) : isPreBatalha ? (
                            <div
                              className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800"
                              style={{ color: 'var(--moni-text-primary)' }}
                            >
                              {PRE_BATALHA_INSTRUCOES_FASE}
                            </div>
                          ) : null}
                          {isPreBatalha ? (
                            <div
                              className="whitespace-pre-line rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950"
                              role="note"
                            >
                              {PRE_BATALHA_TEXTO_EXPLICATIVO_RANKING}
                            </div>
                          ) : null}
                          {mats.length > 0 ? (
                            <ul className="space-y-1.5">
                              {mats.map((m, i) => (
                                <li key={`${m.url}-${i}`}>
                                  <a
                                    href={m.url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex max-w-full items-center gap-2 text-sm font-medium text-moni-primary hover:underline"
                                  >
                                    <IconeMaterialTipo tipo={m.tipo} />
                                    <span className="truncate">{m.titulo || m.url || 'Link'}</span>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      );
                    })()}
                    {pode('editar_instrucoes') ? (
                      <button
                        type="button"
                        onClick={abrirEdicaoInstrucoesFase}
                        className="mt-3 text-xs font-medium text-moni-primary hover:underline"
                      >
                        Editar instruções
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="mb-3 text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
                Checklist / itens estruturais da fase
              </h4>
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'var(--moni-surface-50)',
                  border: '0.5px solid var(--moni-border-default)',
                }}
              >
                {checklistExtra ?? (
                  <div className="space-y-4">
                    {exibirChecklistLegalCondominio ? (
                      <ChecklistLegalCondominioCard
                        cardId={card.id}
                        basePath={basePath}
                        condominioId={condominioIdChecklistLegal}
                        nomeCondominioLegado={card.nome_condominio ?? proc?.nome_condominio ?? null}
                        exibirLinkPublico
                      />
                    ) : null}

                    {exibirChecklistCredito && processoIdChecklists ? (
                      <ChecklistCreditoSection processoId={processoIdChecklists} />
                    ) : null}

                    {exibirChecklistCredito && !processoIdChecklists ? (
                      <p className="text-xs text-stone-500">
                        Processo Step One não vinculado a este card. O Checklist de Crédito ficará disponível quando
                        houver um processo associado (via rede do franqueado ou número FK no título).
                      </p>
                    ) : null}

                    <FaseChecklistCard
                      faseId={faseChecklistFaseId}
                      faseSlug={faseSlugAtual}
                      cardId={card.id}
                      isFrank={portalFrank}
                      isAdmin={isAdmin}
                      processoId={processoIdChecklists}
                      linkGboxProcesso={
                        proc?.link_gbox ??
                        proc?.link_mapa_competidores ??
                        negocioDraft.link_gbox ??
                        negocioDraft.link_mapa_competidores ??
                        null
                      }
                      onLinkGboxEspelhado={() => void loadCard({ silencioso: true })}
                      areaAtuacao={modalDetalhes.rede?.area_atuacao}
                      ocultarRedeLoteadorChecklist={exibirDadosLoteadorPersistente}
                      cardReuniaoSync={
                        exibirDadosLoteadorPersistente &&
                        faseSlugAtual === 'primeiro_contato_moni_inc'
                          ? {
                              origem,
                              basePath,
                              dataReuniao,
                              horaReuniao,
                              onDataReuniaoChange: setDataReuniao,
                              onHoraReuniaoChange: setHoraReuniao,
                            }
                          : null
                      }
                      redeFranqueado={
                        modalDetalhes.rede
                          ? {
                              nome_completo: modalDetalhes.rede.nome_completo,
                              email_frank: modalDetalhes.rede.email_frank,
                              telefone_frank: modalDetalhes.rede.telefone_frank,
                              data_nasc_frank: modalDetalhes.rede.data_nasc_frank,
                            }
                          : null
                      }
                      ocultarVazio={exibirChecklistLegalCondominio || exibirChecklistCredito}
                      condominioContext={
                        !isFaseDadosCondominios
                          ? {
                              origem,
                              basePath,
                              condominioId: card.condominio_id ?? proc?.condominio_id ?? null,
                              quadra: card.quadra ?? proc?.quadra ?? null,
                              lote: card.lote ?? proc?.lote ?? null,
                              nomeCondominioLegado: card.nome_condominio ?? proc?.nome_condominio ?? null,
                              podeEditar: !ocultarGestaoCard && modalSessao.ehAdminOuTeam,
                              podeCadastrarNovo: !ocultarGestaoCard && modalSessao.ehAdminOuTeam,
                              onSalvo: () => {
                                setCondominioTick((t) => t + 1);
                                void loadCard({ silencioso: true });
                                router.refresh();
                              },
                            }
                          : undefined
                      }
                    />
                  </div>
                )}
              </div>
              {exibirEnviarHipotesePortfolio ? (
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    disabled={
                      enviandoHipotesePortfolio ||
                      hipotesePortfolioEnviada ||
                      Boolean(card.concluido) ||
                      Boolean(card.arquivado)
                    }
                    onClick={() => void handleEnviarHipotesePortfolio()}
                    className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: 'var(--moni-navy-800)' }}
                  >
                    {enviandoHipotesePortfolio ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Enviando…
                      </span>
                    ) : (
                      'Enviar hipótese ao Portfolio'
                    )}
                  </button>
                  {hipotesePortfolioErro ? (
                    <p
                      className="rounded-lg border px-3 py-2 text-sm"
                      role="alert"
                      style={{
                        borderColor: 'var(--moni-status-error-border, #fecaca)',
                        background: 'var(--moni-status-error-bg, #fef2f2)',
                        color: 'var(--moni-status-error-text, #991b1b)',
                      }}
                    >
                      {hipotesePortfolioErro}
                    </p>
                  ) : null}
                  {hipotesePortfolioOk && !hipotesePortfolioErro ? (
                    <p
                      className="rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: 'var(--moni-status-success-border, #bbf7d0)',
                        background: 'var(--moni-status-success-bg, #f0fdf4)',
                        color: 'var(--moni-status-success-text, #166534)',
                      }}
                    >
                      {hipotesePortfolioOk}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {!portalFrank && card.fase_id && (
                <div className="mt-3">
                  {linkCandidato ? (
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={linkCandidato}
                        className="flex-1 rounded-md border px-3 py-1.5 text-xs"
                        style={{
                          borderColor: 'var(--moni-border-default)',
                          background: 'var(--moni-surface-50)',
                          color: 'var(--moni-text-primary)',
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                      <button
                        type="button"
                        title="Copiar link"
                        onClick={() => {
                          void navigator.clipboard.writeText(linkCandidato).then(() => {
                            setLinkCopiado(true);
                            setTimeout(() => setLinkCopiado(false), 2000);
                          });
                        }}
                        className="flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs"
                        style={{
                          borderColor: 'var(--moni-border-default)',
                          background: 'var(--moni-surface-100)',
                          color: linkCopiado ? 'var(--moni-status-success-text)' : 'var(--moni-text-secondary)',
                        }}
                      >
                        {linkCopiado ? <Check size={12} /> : <Copy size={12} />}
                        {linkCopiado ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={gerandoLink}
                      onClick={async () => {
                        setGerandoLink(true);
                        try {
                          const res = await gerarFormTokenCandidato(card.id, card.fase_id!);
                          if (res.ok) setLinkCandidato(res.url);
                        } finally {
                          setGerandoLink(false);
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs"
                      style={{
                        borderColor: 'var(--moni-border-default)',
                        background: 'var(--moni-surface-100)',
                        color: 'var(--moni-text-secondary)',
                      }}
                    >
                      {gerandoLink ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Link2 size={12} />
                      )}
                      {gerandoLink ? 'Gerando...' : 'Gerar link'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-auto border-t pt-4" style={{ borderColor: 'var(--moni-border-default)' }}>
              {/* Abas comentários / e-mail */}
              <div className="mb-3 flex gap-1">
                {(['comentarios', 'email'] as const).map((aba) => {
                  if (aba === 'email' && portalFrank) return null;
                  const ativo = abaComentarios === aba;
                  return (
                    <button
                      key={aba}
                      type="button"
                      onClick={() => setAbaComentarios(aba)}
                      className="rounded-md px-3 py-1 text-xs font-medium transition"
                      style={{
                        background: ativo ? 'var(--moni-primary-600)' : 'transparent',
                        color: ativo ? '#fff' : 'var(--moni-text-secondary)',
                        border: ativo ? 'none' : '0.5px solid var(--moni-border-default)',
                      }}
                    >
                      {aba === 'comentarios' ? 'Comentários' : 'E-mail'}
                    </button>
                  );
                })}
              </div>

              <div
                className="rounded-lg p-4"
                style={{
                  background: 'var(--moni-surface-50)',
                  border: '0.5px solid var(--moni-border-default)',
                }}
              >
                {abaComentarios === 'comentarios' ? (
                  <>
                    {comentariosCard.length > 0 ? (
                      <ul className="mb-4 max-h-48 space-y-3 overflow-y-auto">
                        {comentariosCard.map((c) => (
                          <li key={c.id} className="border-b border-stone-200/80 pb-3 text-sm last:border-0">
                            {editingComentarioId === c.id ? (
                              <div className="space-y-2">
                                <div className="overflow-hidden rounded-lg" style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}>
                                  <div className="flex gap-1 border-b px-2 py-1" style={{ borderColor: 'var(--moni-border-default)' }}>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        comentarioEdicaoRef.current?.focus();
                                        document.execCommand('bold');
                                      }}
                                      className="rounded px-2 py-0.5 text-xs font-bold text-stone-600 hover:bg-stone-100"
                                      title="Negrito"
                                    >B</button>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        comentarioEdicaoRef.current?.focus();
                                        document.execCommand('italic');
                                      }}
                                      className="rounded px-2 py-0.5 text-xs italic text-stone-600 hover:bg-stone-100"
                                      title="Itálico"
                                    >I</button>
                                  </div>
                                  <div
                                    ref={comentarioEdicaoRef}
                                    contentEditable
                                    suppressContentEditableWarning
                                    onInput={(e) => setEditComentarioDraft((e.currentTarget as HTMLDivElement).innerHTML)}
                                    className="min-h-[60px] w-full p-3 text-sm focus:outline-none"
                                    style={{ background: 'var(--moni-surface-0)' }}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={
                                      salvandoEdicaoComentario || !richTextPlainTrimmed(editComentarioDraft)
                                    }
                                    onClick={() => void handleEditarComentario(c.id)}
                                    className="rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                    style={{ background: 'var(--moni-text-primary)' }}
                                  >
                                    {salvandoEdicaoComentario ? '…' : 'Salvar'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingComentarioId(null);
                                      setEditComentarioDraft('');
                                      if (comentarioEdicaoRef.current) comentarioEdicaoRef.current.innerHTML = '';
                                    }}
                                    className="rounded border border-stone-300 px-3 py-1.5 text-xs"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p style={{ color: 'var(--moni-text-primary)' }} dangerouslySetInnerHTML={{ __html: c.conteudo }} />
                                {c.anexos && c.anexos.length > 0 ? (
                                  <ul className="mt-2 flex flex-col gap-1">
                                    {c.anexos.map((a) => (
                                      <li key={a.id}>
                                        <button
                                          type="button"
                                          onClick={() => void handleAbrirAnexoComentario(a.storage_path)}
                                          className="inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 text-[11px] text-sky-700 hover:bg-sky-50"
                                          title={`Abrir anexo ${a.nome_original}`}
                                        >
                                          <Paperclip className="h-3 w-3 shrink-0" aria-hidden />
                                          <span className="truncate underline">{a.nome_original}</span>
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                                <p className="mt-1 flex items-center gap-0.5 text-xs text-stone-500">
                                  {c.autor_nome?.trim() || 'Usuário'}
                                  {c.autor_id === modalSessao.userId ? (
                                    <>
                                      <button
                                        type="button"
                                        title="Editar comentário"
                                        onClick={() => { setEditingComentarioId(c.id); setEditComentarioDraft(c.conteudo); }}
                                        className="ml-1 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleExcluirComentario(c.id)}
                                        className="ml-1 rounded p-0.5 text-stone-400 hover:bg-red-50 hover:text-red-500"
                                        title="Excluir comentário"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </>
                                  ) : null}
                                  {' · '}
                                  {formatDataHoraHistorico(c.created_at)}
                                </p>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mb-4 text-xs text-stone-500">Nenhum comentário ainda.</p>
                    )}
                    <div className="overflow-visible rounded-lg" style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}>
                      <div className="flex gap-1 border-b px-2 py-1" style={{ borderColor: 'var(--moni-border-default)' }}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold'); }}
                          className="rounded px-2 py-0.5 text-xs font-bold text-stone-600 hover:bg-stone-100"
                          title="Negrito"
                        >B</button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic'); }}
                          className="rounded px-2 py-0.5 text-xs italic text-stone-600 hover:bg-stone-100"
                          title="Itálico"
                        >I</button>
                      </div>
                      <MencaoContentEditable
                        editorRef={comentarioEditorRef}
                        onInput={(html) => setNovoComentarioCard(html)}
                        className="min-h-[80px] w-full bg-[var(--moni-surface-0)] p-3 text-sm focus:outline-none empty:before:text-stone-400 empty:before:content-[attr(data-placeholder)]"
                        placeholder="Escreva um comentário… Use @ para mencionar alguém"
                      />
                    </div>
                    <div className="mt-2 px-1">
                      <AnexosAtividadeDraft
                        files={comentarioPendingAnexos}
                        onChange={setComentarioPendingAnexos}
                        disabled={salvandoComentario}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleEnviarComentarioCard()}
                      disabled={salvandoComentario || !novoComentarioCard.trim()}
                      className="mt-2 w-full rounded-lg px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                      style={{ background: 'var(--moni-text-primary)' }}
                    >
                      {salvandoComentario ? 'Enviando…' : 'Publicar'}
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                        Para
                      </label>
                      <input
                        type="email"
                        value={emailPara}
                        onChange={(e) => setEmailPara(e.target.value)}
                        placeholder="destinatario@email.com"
                        className="w-full rounded-lg p-2 text-sm focus:outline-none"
                        style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                        CC (cópia)
                      </label>
                      <input
                        type="text"
                        value={emailCc}
                        onChange={(e) => setEmailCc(e.target.value)}
                        placeholder="cc@email.com, cc2@email.com"
                        className="w-full rounded-lg p-2 text-sm focus:outline-none"
                        style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                        BCC (cópia oculta)
                      </label>
                      <input
                        type="text"
                        value={emailBcc}
                        onChange={(e) => setEmailBcc(e.target.value)}
                        placeholder="bcc@email.com, bcc2@email.com"
                        className="w-full rounded-lg p-2 text-sm focus:outline-none"
                        style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                        Assunto
                      </label>
                      <input
                        type="text"
                        value={emailAssunto}
                        onChange={(e) => setEmailAssunto(e.target.value)}
                        placeholder="Assunto do e-mail"
                        className="w-full rounded-lg p-2 text-sm focus:outline-none"
                        style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                        Mensagem
                      </label>
                      <textarea
                        value={emailMensagem}
                        onChange={(e) => setEmailMensagem(e.target.value)}
                        placeholder="Escreva a mensagem…"
                        rows={4}
                        className="w-full resize-none rounded-lg p-3 text-sm focus:outline-none"
                        style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
                      />
                    </div>
                    {erroEmail && <p className="text-xs text-red-500">{erroEmail}</p>}
                    <button
                      type="button"
                      disabled={enviandoEmail || !emailPara.trim() || !emailAssunto.trim() || !emailMensagem.trim()}
                      onClick={async () => {
                        if (!card) return;
                        setEnviandoEmail(true);
                        setErroEmail(null);
                        const res = await enviarEmailCard({
                          card_id: card.id,
                          para: emailPara.trim(),
                          assunto: emailAssunto.trim(),
                          mensagem: emailMensagem.trim(),
                          cc: emailCc.trim(),
                          bcc: emailBcc.trim(),
                          basePath,
                        });
                        setEnviandoEmail(false);
                        if (res.ok) {
                          setEmailPara('');
                          setEmailCc('');
                          setEmailBcc('');
                          setEmailAssunto('');
                          setEmailMensagem('');
                          setAbaComentarios('comentarios');
                          await loadCard();
                        } else {
                          setErroEmail(res.error);
                        }
                      }}
                      className="w-full rounded-lg px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                      style={{ background: 'var(--moni-text-primary)' }}
                    >
                      {enviandoEmail ? 'Enviando…' : 'Enviar e-mail'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            </>
            )}
          </div>

          {/* Direita — responsável, tags e ações (mobile: após o centro) */}
          {mostrarPainelDireitoCard ? (
          <aside
            className="moni-card-modal-acoes order-2 flex w-full shrink-0 flex-col gap-1.5 overflow-y-auto border-t p-2 text-xs sm:order-3 sm:h-full sm:min-w-0 sm:max-w-[var(--moni-card-modal-acoes-width)] sm:w-[var(--moni-card-modal-acoes-width)] sm:flex-none sm:border-l sm:border-t-0 sm:p-2.5"
            style={{
              borderColor: 'var(--moni-border-default)',
              background: 'var(--moni-surface-50)',
            }}
            aria-label="Ações do card"
          >
            {mostrarResponsavelFasePainel ? (
              <>
                <PainelLateralSecao titulo={RESPONSAVEL_FASE_CHECKLIST_LABEL}>
                  <ResponsavelFaseSidebar
                    cardId={card.id}
                    faseId={faseIdResponsavelPainel}
                    kanbanId={card.kanban_id}
                    nomeFranqueadoRede={rede?.nome_completo ?? null}
                    opcoes={responsaveisOpcoes}
                    readOnly={ocultarGestaoCard}
                  />
                </PainelLateralSecao>
                <PainelLateralSecao titulo={RESPONSAVEL_DA_FASE_CHECKLIST_LABEL}>
                  <ResponsavelDaFaseSidebar
                    cardId={card.id}
                    faseId={faseIdResponsavelPainel}
                    readOnly={ocultarGestaoCard}
                    onAlterado={onResponsavelDaFaseAlterado}
                  />
                </PainelLateralSecao>
              </>
            ) : null}

            {mostrarColunaAcoesLateral ? (
            <>
            <PainelLateralSecao titulo="Tags">
              <div className="mb-1.5 flex flex-wrap gap-1">
                {tagsCard.map((t) => {
                  const chip = estiloChipTagKanban(t.nome, t.cor);
                  return (
                  <span
                    key={t.id}
                    className={chip.className}
                    style={chip.style}
                  >
                    <span className="truncate">{t.nome}</span>
                    {!ocultarGestaoCard ? (
                      <button
                        type="button"
                        onClick={() =>
                          void desvincularTagCard(t.id, basePath).then(() =>
                            setTagsCard((prev) => prev.filter((x) => x.id !== t.id)),
                          )
                        }
                        className="shrink-0 rounded-full p-0.5 text-current opacity-60 transition hover:bg-black/5 hover:opacity-100"
                        aria-label={`Remover tag ${t.nome}`}
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    ) : null}
                  </span>
                  );
                })}
                {tagsCard.length === 0 ? (
                  <p className="text-[10px] text-stone-400">Nenhuma tag</p>
                ) : null}
              </div>
              {!ocultarGestaoCard && card ? (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setTagsOpen((v) => !v)}
                    className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-stone-300 bg-stone-50/80 px-2 py-1 text-[10px] font-medium text-stone-700 transition hover:border-stone-400 hover:bg-white"
                  >
                    <Tag className="h-3 w-3 shrink-0 text-stone-500" aria-hidden />
                    {tagsOpen ? 'Fechar' : 'Adicionar tag'}
                  </button>
                  {tagsOpen ? (
                    <div className="space-y-1.5 rounded border border-stone-200 bg-stone-50/50 p-1.5">
                      {tagsKanban.filter((t) => !tagsCard.some((tc) => tc.tag_id === t.id)).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {tagsKanban
                          .filter((t) => !tagsCard.some((tc) => tc.tag_id === t.id))
                          .map((t) => {
                            const chip = estiloChipTagKanban(t.nome, t.cor);
                            return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={async () => {
                                const res = await vincularTagCard(card.id, t.id, basePath);
                                if (!res.ok) {
                                  alert('Erro ao vincular tag: ' + res.error);
                                  return;
                                }
                                const tc = await listarTagsCard(card.id);
                                setTagsCard(tc);
                                setTagsOpen(false);
                              }}
                              className={`${chip.className} transition hover:opacity-90`}
                              style={chip.style}
                            >
                              {t.nome}
                            </button>
                            );
                          })}
                      </div>
                      ) : (
                        <p className="text-[11px] text-stone-500">Todas as tags do funil já estão no card.</p>
                      )}
                      {podeCriarChamados ? (
                        <div className="space-y-1.5 border-t border-stone-200 pt-1.5">
                          <p className="text-[10px] font-medium text-stone-600">Nova tag no funil</p>
                          <input
                            type="text"
                            value={novatagsNome}
                            onChange={(e) => setNovaTagNome(e.target.value)}
                            placeholder="Nome da tag"
                            className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-[10px] focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
                          />
                          <div className="flex items-center gap-1.5">
                            <label className="sr-only" htmlFor="kanban-modal-nova-tag-cor">
                              Cor da tag
                            </label>
                          <input
                              id="kanban-modal-nova-tag-cor"
                            type="color"
                            value={novaTagCor}
                            onChange={(e) => setNovaTagCor(e.target.value)}
                              className="h-7 w-7 shrink-0 cursor-pointer rounded border border-stone-200 bg-white p-0.5"
                          />
                          <button
                            type="button"
                            disabled={criandoTag || !novatagsNome.trim()}
                            onClick={() =>
                              void (async () => {
                                if (!card?.kanban_id) return;
                                setCriandoTag(true);
                                  const res = await criarTagKanban(
                                    card.kanban_id,
                                    novatagsNome.trim(),
                                    novaTagCor,
                                    basePath,
                                  );
                                if (res.ok) {
                                  const tk = await listarTagsKanban(card.kanban_id);
                                  setTagsKanban(tk);
                                  setNovaTagNome('');
                                }
                                setCriandoTag(false);
                              })()
                            }
                              className="min-w-0 flex-1 rounded px-2 py-1 text-[10px] font-semibold text-white transition disabled:opacity-50"
                            style={{ background: 'var(--moni-text-primary)' }}
                          >
                              {criandoTag ? 'Criando…' : 'Criar tag'}
                          </button>
                        </div>
                    </div>
                      ) : null}
                </div>
              ) : null}
            </div>
              ) : null}
            </PainelLateralSecao>

            {exibirBlocoDesarquivar ? (
              <PainelLateralSecao titulo="Desarquivar">
                <button
                  type="button"
                  onClick={() => void handleConfirmarDesarquivar()}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[10px] font-semibold transition disabled:opacity-50"
                  style={{
                    background: 'var(--moni-status-success-bg, #f0fdf4)',
                    color: 'var(--moni-status-success-text, #166534)',
                    border: '0.5px solid var(--moni-status-success-border, #bbf7d0)',
                  }}
                >
                  <ArchiveRestore className="h-4 w-4 shrink-0" aria-hidden />
                  {loading ? 'Desarquivando…' : 'Desarquivar card'}
                </button>
              </PainelLateralSecao>
            ) : null}

            {podeMoverFaseCard || exibirBlocoArquivar ? (
              <PainelLateralSecao titulo="Movimentação">
                {gateStep5Toast ? (
                  <p
                    className="mb-1.5 rounded px-2 py-1 text-[10px] font-medium leading-snug"
                    role="alert"
                    style={{
                      background: '#FAEEDA',
                      color: '#92400e',
                      border: '0.5px solid #D4AD68',
                    }}
                  >
                    {gateStep5Toast}
                  </p>
                ) : null}
                {acoplamentoGateToast ? (
                  <p
                    className="mb-1.5 rounded px-2 py-1 text-[10px] font-medium leading-snug"
                    role="alert"
                    style={{
                      background: '#FAEEDA',
                      color: '#92400e',
                      border: '0.5px solid #D4AD68',
                    }}
                  >
                    {acoplamentoGateToast}
                  </p>
                ) : null}
                {arquivamentoAberto ? (
                  <div className="space-y-1.5">
                    <label
                      className="block text-[10px] font-medium"
                      style={{ color: 'var(--moni-text-secondary)' }}
                      htmlFor="motivo-arquivamento-categoria"
                    >
                      Motivo <span style={{ color: 'var(--moni-status-overdue-text)' }}>*</span>
                    </label>
                    <select
                      id="motivo-arquivamento-categoria"
                      value={motivoCategoriaArquivamento}
                      onChange={(e) => {
                        setMotivoCategoriaArquivamento(e.target.value);
                        if (!isMotivoArquivamentoOutro(e.target.value)) setMotivoObservacaoOutro('');
                      }}
                      className="w-full min-w-0 rounded px-2 py-1.5 text-[10px]"
                      style={{
                        border: '0.5px solid var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                        background: 'var(--moni-surface-0)',
                        color: 'var(--moni-text-primary)',
                      }}
                    >
                      <option value="">Selecione…</option>
                      {MOTIVOS_ARQUIVAMENTO_CATEGORIAS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    {isMotivoArquivamentoOutro(motivoCategoriaArquivamento) ? (
                      <>
                        <label
                          className="block text-[10px] font-medium"
                          style={{ color: 'var(--moni-text-secondary)' }}
                          htmlFor="motivo-arquivamento-outro"
                        >
                          Observação <span style={{ color: 'var(--moni-status-overdue-text)' }}>*</span>
                        </label>
                        <textarea
                          id="motivo-arquivamento-outro"
                          value={motivoObservacaoOutro}
                          onChange={(e) => setMotivoObservacaoOutro(e.target.value)}
                          rows={2}
                          maxLength={MOTIVO_ARQUIVAMENTO_OBS_MAX}
                          placeholder="Descreva brevemente…"
                          className="w-full min-w-0 resize-none rounded px-2 py-1 text-[10px]"
                          style={{
                            border: '0.5px solid var(--moni-border-default)',
                            borderRadius: 'var(--moni-radius-md)',
                            background: 'var(--moni-surface-0)',
                            color: 'var(--moni-text-primary)',
                          }}
                        />
                        <p className="text-[9px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                          Mín. {MOTIVO_ARQUIVAMENTO_OBS_MIN} caracteres
                        </p>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleConfirmarArquivar()}
                      disabled={
                        loading ||
                        !motivoArquivamentoProntoParaEnviar(
                          motivoCategoriaArquivamento,
                          motivoObservacaoOutro,
                        )
                      }
                      className="w-full rounded px-2 py-1.5 text-[10px] font-semibold text-white transition disabled:opacity-50"
                      style={{ background: 'var(--moni-status-overdue-border)' }}
                    >
                      {loading ? 'Arquivando…' : 'Confirmar arquivamento'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setArquivamentoAberto(false);
                        setMotivoCategoriaArquivamento('');
                        setMotivoObservacaoOutro('');
                      }}
                      disabled={loading}
                      className="w-full rounded px-2 py-1 text-[10px] font-medium transition disabled:opacity-50"
                      style={{
                        border: '0.5px solid var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                        background: 'var(--moni-surface-0)',
                        color: 'var(--moni-text-secondary)',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : !modalAprovacaoFase ? (
                  <div className="moni-card-modal-movimentacao-grid">
                    <button
                      type="button"
                      onClick={() => void handleRetrocederFase()}
                      disabled={movendoFase || !podeRetrocederFase || !podeMoverFaseCard}
                      className="moni-card-modal-movimentacao-btn"
                    >
                      <ChevronLeft className="moni-card-modal-movimentacao-btn-icon" aria-hidden />
                      <span className="moni-card-modal-movimentacao-btn-label">
                        {movendoFase ? '…' : 'Anterior'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setArquivamentoAberto(true)}
                      disabled={loading || !exibirBlocoArquivar}
                      className="moni-card-modal-movimentacao-btn"
                    >
                      <span className="moni-card-modal-movimentacao-btn-label">Arquivar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAvancarFase()}
                      disabled={movendoFase || !podeAvancarFase || !podeMoverFaseCard}
                      className="moni-card-modal-movimentacao-btn moni-card-modal-movimentacao-btn--proxima"
                    >
                      <span className="moni-card-modal-movimentacao-btn-label">
                        {movendoFase ? '…' : 'Próxima'}
                      </span>
                      <ChevronRight className="moni-card-modal-movimentacao-btn-icon" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[10px] leading-snug text-stone-700">
                      Este card tem {modalAprovacaoFase.itensPendentes}{' '}
                      {modalAprovacaoFase.itensPendentes === 1 ? 'item' : 'itens'} de checklist
                      pendente{modalAprovacaoFase.itensPendentes === 1 ? '' : 's'}. Deseja solicitar aprovação para
                      avançar de fase?
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleSolicitarAprovacaoFase()}
                      disabled={solicitandoAprovacaoFase}
                      className="w-full rounded px-2 py-1.5 text-[10px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: 'var(--moni-green-600)' }}
                    >
                      {solicitandoAprovacaoFase ? 'Enviando…' : 'Solicitar aprovação'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalAprovacaoFase(null)}
                      disabled={solicitandoAprovacaoFase}
                      className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-[10px] font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </PainelLateralSecao>
            ) : null}

            {pode('finalizar_cards') && (exibirBotaoFinalizar || confirmandoFinalizar) ? (
              <PainelLateralSecao titulo="Conclusão">
                {!confirmandoFinalizar ? (
                  <button
                    type="button"
                    onClick={() => setConfirmandoFinalizar(true)}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-1 rounded border px-2 py-1.5 text-[10px] font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: 'var(--moni-green-50)',
                      color: 'var(--moni-green-800)',
                      borderColor: 'var(--moni-green-400)',
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Finalizar card
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[10px] leading-snug text-stone-700">Confirmar conclusão deste card?</p>
                    <button
                      type="button"
                      onClick={() => void handleConfirmarFinalizarCard()}
                      disabled={loading}
                      className="w-full rounded px-2 py-1.5 text-[10px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: 'var(--moni-green-600)' }}
                    >
                      {loading ? 'Finalizando…' : 'Confirmar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoFinalizar(false)}
                      disabled={loading}
                      className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-[10px] font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </PainelLateralSecao>
            ) : null}
            </>
            ) : null}
          </aside>
          ) : null}

          {/* Esquerda — dados colapsáveis (mobile: por último) */}
          <div
            className="moni-card-modal-left order-3 h-full w-full overflow-y-auto border-t p-4 text-xs sm:order-1 sm:min-w-0 sm:w-[min(45%,20rem)] sm:shrink-0 sm:border-r sm:border-t-0 sm:p-5"
            style={{
              borderColor: 'var(--moni-border-default)',
              background: 'var(--moni-surface-50)',
            }}
          >
            {totalCardsSyncGrupo > 0 ? (
              <p className="mb-3 rounded border border-sky-200 bg-sky-50 px-2.5 py-2 text-[11px] text-sky-900">
                Dados compartilhados com {totalCardsSyncGrupo} card{totalCardsSyncGrupo === 1 ? '' : 's'} vinculado
                {totalCardsSyncGrupo === 1 ? '' : 's'}. Alterações neste painel refletem em todos.
              </p>
            ) : null}
            {secaoHead(
              'cronologia',
              'ID e datas do funil',
              <div className="space-y-2">
                <div>
                  <div className="text-[11px] font-medium text-stone-500">ID do card</div>
                  <div className="break-all font-mono text-[11px] text-stone-800">{card.id}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-stone-500">Data de entrada no funil</div>
                  <div className="text-xs text-stone-800">{fmtDataHoraOuDash(card.created_at)}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-stone-500">Data de conclusão</div>
                  <div className="text-xs text-stone-800">{dataConclusaoExibicao}</div>
                  {isLegado && card.processo_meta?.status === 'concluido' ? (
                    <p className="mt-0.5 text-[10px] leading-snug text-stone-500">
                      Legado: data do último update do processo com status &quot;concluído&quot; (aprox.).
                    </p>
                  ) : null}
                </div>
                <div className="border-t border-stone-100 pt-2">
                  <p className="mb-1 text-[11px] font-semibold text-stone-600">Por fase</p>
                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
                    {linhasCronologiaFases.map((row) => (
                      <div
                        key={row.faseId}
                        className="rounded border border-stone-100 bg-stone-50/80 px-2 py-1.5"
                      >
                        <div className="text-[11px] font-medium text-stone-800">{row.faseNome}</div>
                        <div className="mt-0.5 grid grid-cols-1 gap-0.5 text-[10px] text-stone-600 sm:grid-cols-2">
                          <span>
                            <span className="text-stone-500">Entrada: </span>
                            {row.entrouEm ? fmtDataHoraOuDash(row.entrouEm) : '—'}
                          </span>
                          <span>
                            <span className="text-stone-500">Saída: </span>
                            {row.saiuEm ? fmtDataHoraOuDash(row.saiuEm) : '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>,
            )}
            {exibirDadosLoteadorPersistente
              ? secaoHead(
                  'loteador',
                  'Dados do Loteador',
                  <DadosLoteadorPersistentPanel
                    cardId={card.id}
                    variant="sidebar"
                    onSalvo={() => {
                      void loadCard({ silencioso: true });
                      router.refresh();
                    }}
                  />,
                )
              : secaoHead(
              'franqueado',
              'Dados do Franqueado',
              <div className="space-y-2">
                {isAdmin && card.profiles ? (
                  <div className="mb-1 rounded border border-stone-100 bg-stone-50/80 p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Responsável (card)</p>
                    <p className="mt-0.5 text-xs font-medium text-stone-800">
                      {card.profiles.full_name || 'Não informado'}
                    </p>
                  </div>
                ) : null}
                {editandoFranqueado ? (
                  <div className="space-y-2">
                    <label className="block">
                      <span className="text-[11px] font-medium text-stone-500">Franqueado (rede)</span>
                      <SearchableSelect
                        value={novoFranqueadoId}
                        onChange={setNovoFranqueadoId}
                        placeholder="Selecione o franqueado"
                        searchPlaceholder="Buscar por FK ou nome"
                        className="mt-0.5"
                        options={franqueadosLista.map((f) => ({
                          value: f.id,
                          label: `${f.n_franquia} — ${f.nome_completo}`,
                        }))}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSalvarFranqueado()}
                        disabled={salvandoFranqueado || !novoFranqueadoId}
                        className="rounded bg-moni-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {salvandoFranqueado ? 'Salvando…' : 'Salvar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditandoFranqueado(false)}
                        disabled={salvandoFranqueado}
                        className="rounded border border-stone-200 px-3 py-1 text-xs text-stone-600 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {!rede ? (
                      <p className="text-xs text-stone-500">Sem dados de franqueado vinculados ao card.</p>
                    ) : (
                      <>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Nº Franquia</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.n_franquia)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Modalidade</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.modalidade)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Nome</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.nome_completo)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Status</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.status_franquia)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Classificação</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.classificacao_franqueado)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Área de atuação</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.area_atuacao)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">E-mail</div>
                        <div className="break-all text-xs text-stone-800">{displayOrDash(rede.email_frank)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Telefone</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.telefone_frank)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">CPF</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.cpf_frank)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Nascimento</div>
                        <div className="text-xs text-stone-800">{fmtDataBr(rede.data_nasc_frank)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Responsável comercial</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.responsavel_comercial)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Camiseta</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.tamanho_camisa_frank)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Ass. COF</div>
                        <div className="text-xs text-stone-800">{fmtDataBr(rede.data_ass_cof)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Ass. Contrato</div>
                        <div className="text-xs text-stone-800">{fmtDataBr(rede.data_ass_contrato)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Expiração</div>
                        <div className="text-xs text-stone-800">{fmtDataBr(rede.data_expiracao_franquia)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">—</div>
                        <div className="text-xs text-stone-800">—</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-stone-500">Endereço (casa)</div>
                      <div className="text-xs text-stone-800">{displayOrDash(enderecoCasaLinha)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-stone-500">Sócios</div>
                      <div className="break-words text-xs text-stone-800">{displayOrDash(rede.socios)}</div>
                    </div>
                      </>
                    )}
                    {modalSessao.ehAdminOuTeam ? (
                      <button
                        type="button"
                        onClick={() => void abrirEdicaoFranqueado()}
                        className="mt-1 rounded border border-stone-200 px-3 py-1 text-xs text-stone-600 hover:bg-stone-50"
                      >
                        {rede ? 'Alterar franqueado vinculado' : 'Vincular franqueado'}
                      </button>
                    ) : null}
                  </>
                )}
                <div className="mt-2 border-t border-stone-100 pt-2">
                  <p className="text-[11px] font-semibold text-stone-600">Anexo: Contrato de Franquia</p>
                  <p className="mt-0.5 text-[10px] text-stone-500">
                    Documento do cadastro em Rede de Franqueados (somente consulta no card).
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {rede?.contrato_franquia_path?.trim() ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleVisualizarContratoFranquia()}
                          className="rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-stone-50"
                        >
                          Visualizar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleBaixarContratoFranquia()}
                          className="rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-stone-50"
                        >
                          Baixar
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-stone-500">
                        Nenhum contrato anexado no cadastro do franqueado.
                      </span>
                    )}
                  </div>
                </div>
              </div>,
            )}
            {exibirSecaoCondominioSidebar &&
              secaoHead(
                'condominio',
                'Dados do Condomínio',
                <KanbanCardModalCondominio
                  key={`${card.id}-cond-${condominioTick}`}
                  cardId={card.id}
                  origem={origem}
                  basePath={basePath}
                  condominioIdInicial={condominioIdSidebar}
                  quadraInicial={card.quadra ?? proc?.quadra ?? null}
                  loteInicial={card.lote ?? proc?.lote ?? null}
                  nomeCondominioLegado={card.nome_condominio ?? proc?.nome_condominio ?? null}
                  podeEditar={!ocultarGestaoCard && modalSessao.ehAdminOuTeam}
                  podeCadastrarNovo={!ocultarGestaoCard && modalSessao.ehAdminOuTeam}
                  onSalvo={() => {
                    setCondominioTick((t) => t + 1);
                    void loadCard({ silencioso: true });
                    router.refresh();
                  }}
                />,
              )}
            {secaoHead(
              'novoNegocio',
              'Dados do Negócio',
              <div className="space-y-2">
                {!proc ? (
                    <p className="text-xs text-stone-500">Sem processo vinculado — dados de negócio indisponíveis.</p>
                ) : editandoNegocio ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                      <label className="block">
                        <span className="text-[11px] font-medium text-stone-500">Tipo de negociação</span>
                        <SearchableSelect
                          value={negocioDraft.tipo_aquisicao_terreno}
                          onChange={(v) => setNegocioDraft((d) => ({ ...d, tipo_aquisicao_terreno: v }))}
                          placeholder="Selecione"
                          className="mt-0.5"
                          options={[
                            { value: 'Permuta parcial', label: 'Permuta parcial' },
                            { value: '100% Permuta', label: '100% Permuta' },
                            { value: '100% Compra e Venda Moní', label: '100% Compra e Venda Moní' },
                            { value: '100% Compra e Venda Frank', label: '100% Compra e Venda Frank' },
                          ]}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-medium text-stone-500">Valor do Terreno</span>
                        <KanbanCardModalMoedaField
                          value={negocioDraft.valor_terreno}
                          onChange={(valor_terreno) => setNegocioDraft((d) => ({ ...d, valor_terreno }))}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-medium text-stone-500">VGV pretendido</span>
                        <input
                          type="text"
                          value={negocioDraft.vgv_pretendido}
                          onChange={(e) => setNegocioDraft((d) => ({ ...d, vgv_pretendido: e.target.value }))}
                          className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-medium text-stone-500">Produto / Modelo</span>
                        <input
                          type="text"
                          value={negocioDraft.produto_modelo_casa}
                          onChange={(e) => setNegocioDraft((d) => ({ ...d, produto_modelo_casa: e.target.value }))}
                          className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-[11px] font-medium text-stone-500">Link pasta no Drive</span>
                      <input
                        type="text"
                        value={negocioDraft.link_pasta_drive}
                        onChange={(e) => setNegocioDraft((d) => ({ ...d, link_pasta_drive: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
                      />
                    </label>
                    <KanbanCardModalNegocioPrazoField
                      label="Prazo Opção"
                      draft={negocioDraft.prazo_opcao}
                      onChange={(prazo_opcao) => setNegocioDraft((d) => ({ ...d, prazo_opcao }))}
                      faseOpcoes={fasesNegocioPrazo}
                      disabled={salvandoNegocio}
                    />
                    <KanbanCardModalNegocioPrazoField
                      label="Prazo Instrumento Garantidor"
                      draft={negocioDraft.prazo_instrumento_garantidor}
                      onChange={(prazo_instrumento_garantidor) =>
                        setNegocioDraft((d) => ({ ...d, prazo_instrumento_garantidor }))
                      }
                      faseOpcoes={fasesNegocioPrazo}
                      disabled={salvandoNegocio}
                    />
                    <KanbanCardModalNegociacaoLinhasField
                      linhas={negocioDraft.negociacao_linhas}
                      onChange={(negociacao_linhas) =>
                        setNegocioDraft((d) => ({ ...d, negociacao_linhas }))
                      }
                      disabled={salvandoNegocio}
                      opcoesVinculo={calculadoraOpcoesVinculoNegociacao}
                      datasResolvidas={negociacaoDatasResolvidas}
                    />
                    {renderDadosNegocioLinksEAnexos(true)}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => void handleSalvarNegocio()}
                        disabled={salvandoNegocio}
                        className="rounded bg-moni-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {salvandoNegocio ? 'Salvando…' : 'Salvar'}
                      </button>
                      <button
                        onClick={() => setEditandoNegocio(false)}
                        disabled={salvandoNegocio}
                        className="rounded border border-stone-200 px-3 py-1 text-xs text-stone-600 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Tipo de negociação</div>
                        <div className="text-xs text-stone-800">{displayOrDash(proc.tipo_aquisicao_terreno)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Valor do Terreno</div>
                        <div className="text-xs text-stone-800">{fmtMoedaKanban(proc.valor_terreno)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">VGV pretendido</div>
                        <div className="text-xs text-stone-800">{fmtMoedaKanban(proc.vgv_pretendido)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Produto / Modelo</div>
                        <div className="text-xs text-stone-800">{displayOrDash(proc.produto_modelo_casa)}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-stone-500">Link pasta no Drive</div>
                        <div className="text-xs">
                          {driveHref ? (
                            <a
                              href={driveHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-moni-primary underline break-all"
                            >
                              {proc.link_pasta_drive?.trim()}
                            </a>
                          ) : (
                            '—'
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Prazo Opção</div>
                        <div className="text-xs text-stone-800">
                          {formatNegocioPrazoDisplay(
                            negocioPrazoValoresFromProcessoModal(proc, fasesNegocioPrazo).prazo_opcao,
                            faseLabelFromOpcoes(
                              negocioPrazoValoresFromProcessoModal(proc, fasesNegocioPrazo).prazo_opcao.faseId,
                              fasesNegocioPrazo,
                            ),
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Prazo Instrumento Garantidor</div>
                        <div className="text-xs text-stone-800">
                          {formatNegocioPrazoDisplay(
                            negocioPrazoValoresFromProcessoModal(proc, fasesNegocioPrazo).prazo_instrumento_garantidor,
                            faseLabelFromOpcoes(
                              negocioPrazoValoresFromProcessoModal(proc, fasesNegocioPrazo).prazo_instrumento_garantidor
                                .faseId,
                              fasesNegocioPrazo,
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                    <KanbanCardModalNegociacaoLinhasField
                      modoLeitura
                      linhas={[]}
                      onChange={() => {}}
                      linhasLeitura={negociacaoLinhasLeituraResolvidas}
                    />
                    {renderDadosNegocioLinksEAnexos(false)}
                    {modalSessao.ehAdminOuTeam && (
                      <button
                        type="button"
                        onClick={() => abrirEdicaoNegocio()}
                        className="mt-1 rounded border border-stone-200 px-3 py-1 text-xs text-stone-600 hover:bg-stone-50"
                      >
                        Editar dados do negócio
                      </button>
                    )}
                  </>
                )}
              </div>,
            )}
            {secaoHead(
              'dadosEmpresas',
              'Dados das Empresas',
              <KanbanCardModalEmpresas
                cardId={card.id}
                redeFranqueadoId={modalDetalhes.redeIdContrato ?? card?.rede_franqueado_id ?? null}
                incorporadora={modalDetalhes.empresas?.incorporadora ?? null}
                gestora={modalDetalhes.empresas?.gestora ?? null}
                spe={modalDetalhes.empresas?.spe ?? null}
                podeEditar={!ocultarGestaoCard && modalSessao.ehAdminOuTeam}
                onSalvo={() => void loadCard({ silencioso: true })}
              />,
            )}
            {secaoHead(
              'preObra',
              'Dados Pré Obra',
              ehFunilOperacoes && !isLegado ? (
                <KanbanCardModalDadosPreObraOperacoes
                  draft={operacoesPreObraDraft}
                  onChange={(patch) => setOperacoesPreObraDraft((d) => ({ ...d, ...patch }))}
                  onSalvar={() => void handleSalvarPreObraOperacoes()}
                  salvando={salvandoPreObra}
                  podeEditar={!ocultarGestaoCard && modalSessao.ehAdminOuTeam}
                />
              ) : !proc ? (
                <p className="text-xs text-[var(--moni-text-tertiary)]">
                  Sem processo vinculado — não é possível editar pré-obra neste card.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                    <label className="block">
                      <span className="text-[11px] font-medium text-stone-500">Previsão de Aprovação no Condomínio</span>
                      <input
                        type="date"
                        value={preObraDraft.previsao_aprovacao_condominio}
                        onChange={(e) =>
                          setPreObraDraft((d) => ({ ...d, previsao_aprovacao_condominio: e.target.value }))
                        }
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-stone-500">Previsão de Aprovação na Prefeitura</span>
                      <input
                        type="date"
                        value={preObraDraft.previsao_aprovacao_prefeitura}
                        onChange={(e) =>
                          setPreObraDraft((d) =>
                            aplicarDataEnvioCreditoObraNoPreObra({
                              ...d,
                              previsao_aprovacao_prefeitura: e.target.value,
                            }),
                          )
                        }
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-stone-500">Previsão de Emissão do Alvará</span>
                      <input
                        type="date"
                        value={preObraDraft.previsao_emissao_alvara}
                        onChange={(e) => setPreObraDraft((d) => ({ ...d, previsao_emissao_alvara: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-stone-500">Envio para Crédito Obra</span>
                      <input
                        type="date"
                        value={preObraDraft.previsao_liberacao_credito_obra}
                        readOnly
                        title="Calculado automaticamente: previsão prefeitura − 30 dias corridos, próximo dia útil"
                        className="mt-0.5 w-full cursor-not-allowed rounded border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-600"
                      />
                      <span className="mt-0.5 block text-[10px] text-stone-400">
                        Automático (prefeitura − 30 dias corridos, próximo dia útil)
                      </span>
                    </label>
                    <label className="col-span-2 block">
                      <span className="text-[11px] font-medium text-stone-500">Previsão de Início de Obra</span>
                      <input
                        type="date"
                        value={preObraDraft.previsao_inicio_obra}
                        onChange={(e) => setPreObraDraft((d) => ({ ...d, previsao_inicio_obra: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                    <label className="block min-w-0">
                      <span className="text-[11px] font-medium text-stone-500">Data de Aprovação no Condomínio</span>
                      <input
                        type="date"
                        value={preObraDraft.data_aprovacao_condominio}
                        onChange={(e) =>
                          setPreObraDraft((d) => ({ ...d, data_aprovacao_condominio: e.target.value }))
                        }
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-1 py-1 text-[11px] text-stone-800"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-[11px] font-medium text-stone-500">Data de Aprovação na Prefeitura</span>
                      <input
                        type="date"
                        value={preObraDraft.data_aprovacao_prefeitura}
                        onChange={(e) =>
                          setPreObraDraft((d) => ({ ...d, data_aprovacao_prefeitura: e.target.value }))
                        }
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-1 py-1 text-[11px] text-stone-800"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-[11px] font-medium text-stone-500">Data de Emissão do Alvará</span>
                      <input
                        type="date"
                        value={preObraDraft.data_emissao_alvara}
                        onChange={(e) => setPreObraDraft((d) => ({ ...d, data_emissao_alvara: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-1 py-1 text-[11px] text-stone-800"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-[11px] font-medium text-stone-500">Data de aprovação do crédito</span>
                      <input
                        type="date"
                        value={preObraDraft.data_aprovacao_credito}
                        onChange={(e) =>
                          setPreObraDraft((d) => ({ ...d, data_aprovacao_credito: e.target.value }))
                        }
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-1 py-1 text-[11px] text-stone-800"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSalvarPreObraKanban()}
                    disabled={salvandoPreObra}
                    className="w-full rounded-lg border border-moni-primary bg-moni-primary px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {salvandoPreObra ? 'Salvando…' : 'Salvar pré-obra'}
                  </button>
                </div>
              ),
            )}
            {secaoHeadPainelCentroCalculadora()}
            {exibirSecaoDocumentacaoCreditoObra
              ? secaoHead(
                  'documentacaoCreditoObra',
                  'Documentação Alvará e Terreno SPE',
                  <KanbanCardModalCreditoObraDocumentacao
                    cardId={card.id}
                    alvaraUrl={card.alvara_url ?? null}
                    docsTerrenoUrl={card.docs_terreno_url ?? null}
                    faseSlug={faseSlugAtual}
                    basePath={basePath}
                    onSaved={loadCard}
                  />,
                )
              : null}
            {!isLegado ? (
              secaoHead(
                'atasReuniao',
                'Atas de reunião',
                <KanbanCardModalAtasReuniao
                  key={`${card.id}-atas-${atasReuniaoTick}`}
                  cardId={card.id}
                  origem={origem}
                  refreshKey={atasReuniaoTick}
                />,
              )
            ) : null}
            {secaoHeadPainelCentro('Chamados')}
            {secaoHead(
              'relacionamentos',
              'Vínculos',
              <div className="space-y-3">
                {ehFunilOperacoes ? (
                  <KanbanCardModalOperacoesTrancheVinculosSidebar
                    key={`${card.id}-tranche-vinculos-${trancheVinculosTick}`}
                    cardId={card.id}
                    refreshKey={trancheVinculosTick}
                    trancheSelecionado={trancheVinculoIndex}
                    onSelecionar={abrirPainelTrancheVinculo}
                  />
                ) : null}
                <KanbanCardModalRelacionamentos
                  key={`${card.id}-${relacionamentosTick}`}
                  cardId={card.id}
                  cardTitulo={cardTitulo}
                  kanbanId={card.kanban_id}
                  basePath={basePath}
                  podeGerenciar={podeGerenciarRelacionamentos}
                  projetoId={card.projeto_id}
                  ocultarKanbansInternos={usuarioFrank}
                  mostrarBotaoJuridico={mostrarBotaoJuridico}
                  cardDesabilitado={
                    cardLegadoArquivado ||
                    cardLegadoConcluido ||
                    Boolean(card.arquivado) ||
                    Boolean(card.concluido)
                  }
                />
              </div>,
            )}
            {card && (
              <ChecklistCard
                cardId={card.id}
                userId={modalSessao.userId}
                isFrank={portalFrank}
                responsaveisOpcoes={responsaveisOpcoes}
                basePath={basePath}
                fases={fases}
                linhasCronologia={linhasCronologiaFases}
                faseAtualId={card.fase_id}
                areaAtuacao={modalDetalhes.rede?.area_atuacao}
                structuralRefreshKey={`${card.fase_id}-${historico.length}-${condominioTick}`}
              />
            )}
            <div
              className="overflow-hidden rounded-lg bg-white"
              style={{
                border: '0.5px solid var(--moni-border-default)',
                boxShadow: 'var(--moni-shadow-sm)',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSecaoEsquerda('historico')}
                className="flex w-full items-center gap-2 p-2 text-left text-xs transition hover:bg-stone-50"
              >
                {secaoAberta.historico ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
                )}
                <span className="text-xs font-semibold text-stone-800">Histórico</span>
              </button>
              {secaoAberta.historico ? (
                <div className="border-t px-2 pb-2 pt-1.5 text-xs" style={{ borderColor: 'var(--moni-border-subtle)' }}>
                  {historico.length === 0 ? (
                    <p className="text-xs text-stone-500">Nenhum evento ainda.</p>
                  ) : (
                    <ul className="max-h-72 list-none space-y-0 overflow-y-auto">
                      {historico.map((h) => (
                        <li key={h.id} className="flex gap-2.5 border-b border-stone-100 py-2.5 text-xs last:border-0">
                          <span className="mt-0.5 shrink-0">{iconeHistoricoAcao(h.acao)}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium leading-snug text-stone-800">
                              {textoResumidoAcaoHistorico(h.acao, h.detalhe)}
                            </p>
                            <p className="mt-0.5 text-[11px] leading-snug text-stone-500">
                              <span className="font-medium text-stone-600">
                                {rotuloUsuarioHistorico(h.usuario_nome)}
                              </span>
                              <span aria-hidden> · </span>
                              <time dateTime={h.criado_em}>{formatDataHoraHistorico(h.criado_em)}</time>
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
    {modalExcluirInteracaoId ? (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        >
          <h3 className="mb-1 text-base font-semibold text-stone-800">Excluir chamado</h3>
          <p className="mb-4 text-sm text-stone-600">
            Tem certeza que deseja excluir este chamado? Todas as subinterações e comentários serão removidos. Esta
            ação não pode ser desfeita.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={salvandoExcluirInteracao}
              onClick={async () => {
                setSalvandoExcluirInteracao(true);
                const res = await deletarChamado({
                  modo: 'interacao_kanban',
                  interacaoKanbanId: modalExcluirInteracaoId,
                  basePath,
                });
                setSalvandoExcluirInteracao(false);
                if (!res.ok) {
                  alert(res.error);
                  return;
                }
                setModalExcluirInteracaoId(null);
                await loadCard();
                router.refresh();
              }}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {salvandoExcluirInteracao ? 'Excluindo…' : 'Excluir definitivamente'}
            </button>
            <button
              type="button"
              disabled={salvandoExcluirInteracao}
              onClick={() => setModalExcluirInteracaoId(null)}
              className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    ) : null}
    {modalArquivarInteracao ? (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <h3 className="mb-1 text-base font-semibold text-stone-800">
            Arquivar {modalArquivarInteracao.tipo === 'chamado' ? 'chamado' : 'sub-chamado'}
          </h3>
          <p className="mb-4 text-sm text-stone-500">Informe o motivo. Esta ação não pode ser desfeita.</p>
          <textarea
            value={motivoArquivarInteracao}
            onChange={(e) => setMotivoArquivarInteracao(e.target.value)}
            rows={3}
            placeholder="Descreva o motivo…"
            className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none"
            autoFocus
          />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={salvandoArquivarInteracao || !motivoArquivarInteracao.trim()}
              onClick={async () => {
                if (!confirm('Tem certeza que deseja arquivar?')) return;
                setSalvandoArquivarInteracao(true);
                const res =
                  modalArquivarInteracao.tipo === 'chamado'
                    ? await arquivarInteracao(modalArquivarInteracao.id, motivoArquivarInteracao, basePath)
                    : await arquivarSubInteracao(modalArquivarInteracao.id, motivoArquivarInteracao, basePath);
                setSalvandoArquivarInteracao(false);
                if (!res.ok) {
                  alert(res.error);
                  return;
                }
                setModalArquivarInteracao(null);
                setMotivoArquivarInteracao('');
                await loadCard();
                router.refresh();
              }}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {salvandoArquivarInteracao ? 'Arquivando…' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setModalArquivarInteracao(null);
                setMotivoArquivarInteracao('');
              }}
              className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    ) : null}

    {modalJustificativaSla ? (
      <div className="fixed inset-0 z-[225] flex items-center justify-center bg-black/50 p-4">
        <div
          className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="justificativa-sla-titulo"
        >
          <h3 id="justificativa-sla-titulo" className="text-base font-semibold text-stone-900">
            Justificativa de quebra de SLA
          </h3>
          <p className="mt-2 text-sm text-stone-600">
            O SLA da fase &ldquo;{faseAtual?.nome ?? 'atual'}&rdquo; está vencido. Informe a justificativa para avançar
            para &ldquo;{modalJustificativaSla.nome}&rdquo;.
          </p>
          <label className="mt-4 block text-xs font-medium text-stone-600">
            Justificativa
            <textarea
              value={slaJustificativaDraft}
              onChange={(e) => setSlaJustificativaDraft(e.target.value)}
              rows={4}
              className="mt-1 w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
              placeholder="Descreva o motivo…"
              disabled={salvandoJustificativaSla}
              autoFocus
            />
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              disabled={salvandoJustificativaSla}
              onClick={() => {
                setModalJustificativaSla(null);
                setSlaJustificativaDraft('');
              }}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvandoJustificativaSla}
              onClick={() => {
                const justificativa = slaJustificativaDraft.trim();
                if (!justificativa) {
                  alert('Informe a justificativa da quebra de SLA.');
                  return;
                }
                const fase = modalJustificativaSla;
                setSalvandoJustificativaSla(true);
                void iniciarMovimentoFasePortfolio(fase, 'avancar', { justificativaSlaQuebra: justificativa })
                  .then(() => {
                    setModalJustificativaSla(null);
                    setSlaJustificativaDraft('');
                  })
                  .finally(() => setSalvandoJustificativaSla(false));
              }}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {salvandoJustificativaSla ? 'Salvando…' : 'Confirmar e avançar'}
            </button>
          </div>
        </div>
      </div>
    ) : null}

    {modalReprovacaoAcoplamento ? (
      <div className="fixed inset-0 z-[225] flex items-center justify-center bg-black/50 p-4">
        <div
          className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reprovacao-acoplamento-titulo"
        >
          <h3 id="reprovacao-acoplamento-titulo" className="text-base font-semibold text-stone-900">
            Mover para Paralisados
          </h3>
          <p className="mt-2 text-sm text-stone-600">
            Informe o motivo da paralisação. Os links de Gbox e Acoplamento não são obrigatórios nesta fase.
          </p>
          <label className="mt-4 block text-xs font-medium text-stone-600">
            Motivo da paralisação
            <textarea
              value={motivoReprovacaoDraft}
              onChange={(e) => setMotivoReprovacaoDraft(e.target.value)}
              rows={4}
              className="mt-1 w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
              placeholder="Descreva o motivo…"
              disabled={salvandoReprovacaoAcoplamento}
              autoFocus
            />
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              disabled={salvandoReprovacaoAcoplamento}
              onClick={() => {
                setModalReprovacaoAcoplamento(null);
                setMotivoReprovacaoDraft('');
              }}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvandoReprovacaoAcoplamento}
              onClick={() => {
                const motivo = motivoReprovacaoDraft.trim();
                if (!motivo) {
                  alert('Informe o motivo da paralisação.');
                  return;
                }
                const fase = modalReprovacaoAcoplamento;
                setSalvandoReprovacaoAcoplamento(true);
                void iniciarMovimentoFasePortfolio(fase, 'avancar', { motivoReprovacaoAcoplamento: motivo })
                  .then(() => {
                    setModalReprovacaoAcoplamento(null);
                    setMotivoReprovacaoDraft('');
                  })
                  .finally(() => setSalvandoReprovacaoAcoplamento(false));
              }}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {salvandoReprovacaoAcoplamento ? 'Salvando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    ) : null}

    {modalConfirmacaoPortfolio ? (
      <div className="fixed inset-0 z-[225] flex items-center justify-center bg-black/50 p-4">
        <div
          className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmacao-portfolio-titulo"
          style={{
            borderRadius: 'var(--moni-radius-lg)',
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
          }}
        >
          <h3
            id="confirmacao-portfolio-titulo"
            className="text-base font-semibold"
            style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
          >
            Confirmação
          </h3>
          <p className="mt-3 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            {perguntaConfirmacaoSaida(modalConfirmacaoPortfolio)}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={salvandoConfirmacaoPortfolio || movendoFase}
              onClick={() => void concluirConfirmacaoPortfolio(false)}
              className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderRadius: 'var(--moni-radius-md)',
                border: 'var(--moni-border-width) solid var(--moni-border-default)',
                color: 'var(--moni-text-secondary)',
                background: 'var(--moni-surface-elevated, #fff)',
              }}
            >
              Não — apenas avançar
            </button>
            <button
              type="button"
              disabled={salvandoConfirmacaoPortfolio || movendoFase}
              onClick={() => void concluirConfirmacaoPortfolio(true)}
              className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderRadius: 'var(--moni-radius-md)',
                background: 'var(--moni-navy-800)',
              }}
            >
              {salvandoConfirmacaoPortfolio || movendoFase ? 'Salvando…' : 'Sim'}
            </button>
          </div>
        </div>
      </div>
    ) : null}

    <CreditoObraAberturaAutorizacaoModal
      open={creditoObraAbertura != null}
      tituloCard={creditoObraAbertura?.tituloCard ?? card?.titulo ?? 'Card'}
      dataEnvioExibicao={creditoObraAbertura?.dataEnvioExibicao ?? null}
      dataEnvioIso={creditoObraAbertura?.dataEnvio ?? null}
      onAutorizar={() => void handleAutorizarAberturaCreditoObra()}
      onRecusar={(novaPref) => void handleRecusarAberturaCreditoObra(novaPref)}
      pending={creditoObraAberturaPending}
    />

    <ConclusaoChamadoCriadorModal
      open={conclusaoInteracaoId != null}
      onClose={() => setConclusaoInteracaoId(null)}
      onConfirm={(p) => void confirmarConclusaoInteracaoCard(p)}
    />
    </>
  );
}
