'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, MessageSquare, CheckSquare, FileText, Paperclip, Copy, Check, History, Pencil } from 'lucide-react';
import type { PainelColumnKey } from './painelColumns';
import { PAINEL_COLUMNS } from './painelColumns';
import {
  atualizarEtapaPainel,
  atualizarFaseContabilidadeDashboard,
  atualizarFaseCreditoDashboard,
  cancelarProcessoPainel,
  removerProcessoPainel,
  getResumoProcessoStep1,
  getRelacionadosProcesso,
  updateDadosPreObra,
  type ProcessoRelacionado,
  type ProcessoResumoStep1,
} from './actions';
import {
  getComentariosCard,
  enviarComentarioCard,
  getChecklistCard,
  getStep1AreasChecklist,
  updateStep1AreaChecklistConcluido,
  updateStep1AreaChecklistLink,
  updateStep1AreaChecklistAnexo,
  addChecklistItem,
  updateChecklistItem,
  toggleChecklistItem,
  updateChecklistItemStatus,
  removeChecklistItem,
  getChecklistPareceres,
  upsertChecklistParecer,
  getDocumentosCard,
  addDocumentoCard,
  updateDocumentoCardTitulo,
  updateDocumentoCardLink,
  updateDocumentoCardAnexo,
  updateDocumentoCardTexto,
  updateDocumentoCardAnexos,
  removeDocumentoCard,
  getCardChecklistAnexosHistory,
  getCardActionsHistory,
  getDadosComiteCard,
  upsertDadosComiteCard,
  getOrCreatePublicFormLink,
} from './card-actions';
import { createClient } from '@/lib/supabase/client';
import { finalizarEstudoStep1 } from '@/app/step-one/[id]/etapa/actions';
import { ATIVIDADE_TIMES } from '@/lib/atividade-times';
import {
  getStep3TemplateUrl,
  listStep3Instances,
  type StepDocInstance,
} from '@/app/step-3/actions';

import {
  getStep7TemplateUrl,
  listStep7Instances,
  type Step7DocInstance,
} from '@/app/step-7/actions';

import {
  getChecklistLegalForCard,
  saveChecklistLegalDraft,
  concluirChecklistLegal,
  type ChecklistLegalArquivos,
  type ChecklistLegalRecord,
  type ChecklistLegalRespostas,
  type ChecklistLegalFileMeta,
} from '@/app/steps-viabilidade/checklist-legal/actions';
import { ChecklistCreditoSection } from '@/app/steps-viabilidade/ChecklistCreditoSection';
import { ChecklistContabilidadeSection } from '@/app/steps-viabilidade/ChecklistContabilidadeSection';
import {
  MOTIVOS_CANCELAMENTO,
  MOTIVOS_REPROVACAO_COMITE,
  FASES_CONTABILIDADE_DASHBOARD,
  FASES_CREDITO_DASHBOARD,
} from '@/lib/painel/cancelamento-motivos';
import { precisaMotivoReprovacaoComiteNoCancelamento } from '@/lib/painel/dashboard-etapas';
import { itemMatchesResponsavelFilter, itemMatchesTimeFilter } from '@/lib/checklist-atividade-arrays';

function prazoDbToDateInput(prazo: string | null): string {
  const raw = (prazo ?? '').trim();
  if (!raw) return '';
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return '';
}

function dateInputToPrazoDb(iso: string): string | null {
  const t = iso.trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const [y, m, d] = t.split('-');
  return `${d}/${m}/${y}`;
}

function toggleNomeLista(list: string[], nome: string, ligado: boolean): string[] {
  const s = nome.trim();
  if (!s) return list;
  const set = new Set(list);
  if (ligado) set.add(s);
  else set.delete(s);
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

const RESPONSAVEIS_POR_TIME: Record<string, string[]> = {
  Marketing: ['Negão'],
  'Novos Franks': ['Paula'],
  'Portfólio': ['Helenna'],
  Portfolio: ['Helenna'], // fallback caso venha sem acento
  Acoplamento: ['Elisabete'],
  Waysers: ['Nathalia', 'Rafael'],
  'Frank Moní': [], // não definido na regra informada
  Crédito: ['Kim', 'Neil'],
  Produto: ['Vini', 'Fábio'],
  Homologações: ['Karoline', 'Helena', 'Jéssica', 'Letícia'],
  'Modelo Virtual': ['Bruna', 'Larissa', 'Vitor'],
  Executivo: ['Bruna', 'Larissa', 'Vitor'],
  'Caneta Verde': ['Fernanda', 'Ingrid'],
};

type Props = {
  processoId: string;
  etapaKey: PainelColumnKey;
  processoLabel: string;
  tipoAquisicaoTerreno: string | null;
  status: string;
  onClose: () => void;
};

type Tab = 'dados' | 'comentarios' | 'checklist' | 'checklist_step1' | 'checklist_history' | 'documentos';

const NOVO_NEGOCIO_ESTUDOS_DOCS_TITULOS = [
  'BCA',
  'Carta Proposta',
  'Mapa de Competidores + Batalha de Casas',
  'Gadgets',
  'Fotos do Terreno',
  'Fotos do Condomínio',
] as const;

const ACOPLAMENTO_CHECKLIST_TITULOS = [
  'Modelagem do terreno',
  'Modelagem da casa',
  'Gbox',
  'Validação do Acoplamento',
  'Alterações do acoplamento',
] as const;

const COMITE_MATERIAL_CHECKLIST_TITULOS = ['Material para o Comitê'] as const;
const STEP4_PLANIALTIMETRICO_CHECKLIST_TITULOS = ['Planialtimétrico'] as const;
const PROJETO_LEGAL_CHECKLIST_TITULOS = ['Projeto Legal', 'ART de Projeto', 'RRT de Execução', 'Demais RRTs'] as const;
const APROVACAO_CONDOMINIO_BASE_TITULOS = ['Protocolo do Condomínio', 'Aprovação do Condomínio'] as const;
const APROVACAO_PREFEITURA_BASE_TITULOS = ['Protocolo da Prefeitura', 'Aprovação do Prefeitura', 'Alvará de Obra'] as const;
// Guardamos a regra de obrigatoriedade para reativar depois.
const ENFORCE_CHECKLIST_LEGAL_REQUIRED = false;

/** Fases do Kanban após "Aprovação na Prefeitura" (atividades na aba Atividades). */
const ETAPAS_POS_APROVACAO_PREFEITURA: PainelColumnKey[] = [
  'revisao_bca',
  'processos_cartorarios',
  'aguardando_credito',
  'em_obra',
  'moni_care',
];

function isEtapaPosAprovacaoPrefeitura(etapa: PainelColumnKey | string): boolean {
  return ETAPAS_POS_APROVACAO_PREFEITURA.includes(etapa as PainelColumnKey);
}

function isChecklistAnexosEstruturalCard(etapaPainel: string, titulo: string): boolean {
  const etapa = String(etapaPainel ?? '').trim();
  const nome = String(titulo ?? '').trim();
  if (!etapa || !nome) return false;
  if (etapa === 'step_4' && STEP4_PLANIALTIMETRICO_CHECKLIST_TITULOS.includes(nome as (typeof STEP4_PLANIALTIMETRICO_CHECKLIST_TITULOS)[number])) return true;
  if (etapa === 'step_5' && COMITE_MATERIAL_CHECKLIST_TITULOS.includes(nome as (typeof COMITE_MATERIAL_CHECKLIST_TITULOS)[number])) return true;
  if (etapa === 'projeto_legal' && PROJETO_LEGAL_CHECKLIST_TITULOS.includes(nome as (typeof PROJETO_LEGAL_CHECKLIST_TITULOS)[number])) return true;
  if (etapa === 'aprovacao_condominio') {
    if (APROVACAO_CONDOMINIO_BASE_TITULOS.includes(nome as (typeof APROVACAO_CONDOMINIO_BASE_TITULOS)[number])) return true;
    if (/^Comunique-se Condom[ií]nio\s+\d+$/i.test(nome)) return true;
  }
  if (etapa === 'aprovacao_prefeitura') {
    if (APROVACAO_PREFEITURA_BASE_TITULOS.includes(nome as (typeof APROVACAO_PREFEITURA_BASE_TITULOS)[number])) return true;
    if (/^Comunique-se Prefeitura\s+\d+$/i.test(nome)) return true;
  }
  if (etapa === 'acoplamento' && ACOPLAMENTO_CHECKLIST_TITULOS.includes(nome as (typeof ACOPLAMENTO_CHECKLIST_TITULOS)[number])) return true;
  return false;
}

export function CardDetalheModal({
  processoId,
  etapaKey,
  processoLabel,
  tipoAquisicaoTerreno,
  status,
  onClose,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(
    etapaKey === 'step_2' || isEtapaPosAprovacaoPrefeitura(etapaKey)
      ? 'checklist'
      : etapaKey === 'step_1' ||
          etapaKey === 'step_3' ||
          etapaKey === 'aprovacao_moni_novo_negocio' ||
          etapaKey === 'credito_terreno' ||
          etapaKey === 'credito_obra' ||
          etapaKey === 'contabilidade_incorporadora' ||
          etapaKey === 'contabilidade_spe' ||
          etapaKey === 'contabilidade_gestora' ||
          etapaKey === 'step_7'
        ? 'checklist_step1'
        : 'dados',
  );
  const [etapaAtual, setEtapaAtual] = useState<PainelColumnKey>(etapaKey);
  const [resumo, setResumo] = useState<ProcessoResumoStep1 | null>(null);
  const [relacionados, setRelacionados] = useState<{
    pai: ProcessoRelacionado | null;
    filhos: ProcessoRelacionado[];
    irmaos: ProcessoRelacionado[];
  }>({ pai: null, filhos: [], irmaos: [] });
  const [dadosPreObraForm, setDadosPreObraForm] = useState({
    previsao_aprovacao_condominio: '',
    previsao_aprovacao_prefeitura: '',
    previsao_emissao_alvara: '',
    data_aprovacao_condominio: '',
    data_aprovacao_prefeitura: '',
    data_emissao_alvara: '',
    data_aprovacao_credito: '',
    previsao_liberacao_credito_obra: '',
    previsao_inicio_obra: '',
  });
  const [savingDadosPreObra, setSavingDadosPreObra] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState<null | 'cancelar' | 'remover'>(null);
  const [motivo, setMotivo] = useState('');
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [motivoCancelamentoOutro, setMotivoCancelamentoOutro] = useState('');
  const [motivoReprovacaoComite, setMotivoReprovacaoComite] = useState('');
  const [motivoReprovacaoOutro, setMotivoReprovacaoOutro] = useState('');
  const [observacaoCancelamento, setObservacaoCancelamento] = useState('');
  const [loadingMotivo, setLoadingMotivo] = useState(false);
  const [loadingFinalizar, setLoadingFinalizar] = useState(false);
  const [loadingAprovacaoNovoNegocio, setLoadingAprovacaoNovoNegocio] = useState(false);
  const [savingFaseDashboard, setSavingFaseDashboard] = useState(false);

  const [comentarios, setComentarios] = useState<Array<{ id: string; autor_nome: string | null; texto: string; created_at: string }>>([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [loadingComentario, setLoadingComentario] = useState(false);

  const [loadingActionsHistory, setLoadingActionsHistory] = useState(false);
  const [actionsHistory, setActionsHistory] = useState<
    Array<{ id: string; autor_nome: string | null; etapa_painel: string | null; tipo: string; descricao: string | null; created_at: string }>
  >([]);

  const [loadingChecklistHistory, setLoadingChecklistHistory] = useState(false);
  const [checklistAnexosHistory, setChecklistAnexosHistory] = useState<
    Array<{
      id: string;
      autor_nome: string | null;
      etapa_painel: string | null;
      tipo: string;
      descricao: string | null;
      created_at: string;
      detalhes: Record<string, unknown> | null;
    }>
  >([]);

  const [checklistItens, setChecklistItens] = useState<
    Array<{
      id: string;
      titulo: string;
      prazo: string | null;
      times_nomes: string[];
      responsaveis_nomes: string[];
      time_nome: string | null;
      responsavel_nome: string | null;
      status: 'nao_iniciada' | 'em_andamento' | 'concluido';
      concluido: boolean;
      ordem: number;
    }>
  >([]);
  const [novoChecklistTitulo, setNovoChecklistTitulo] = useState('');
  const [novoChecklistPrazo, setNovoChecklistPrazo] = useState('');
  const [novoChecklistTimes, setNovoChecklistTimes] = useState<string[]>([]);
  const [novoChecklistResponsaveis, setNovoChecklistResponsaveis] = useState<string[]>([]);
  const [novoChecklistStatus, setNovoChecklistStatus] = useState<'nao_iniciada' | 'em_andamento' | 'concluido'>('nao_iniciada');
  const [atividadeEdicao, setAtividadeEdicao] = useState<null | {
    id: string;
    titulo: string;
    prazoIso: string;
    times: string[];
    responsaveis: string[];
    status: 'nao_iniciada' | 'em_andamento' | 'concluido';
  }>(null);
  const [salvandoEdicaoAtividade, setSalvandoEdicaoAtividade] = useState(false);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [loadingAcoplamentoChecklist, setLoadingAcoplamentoChecklist] = useState(false);
  const [updatingChecklistStatusId, setUpdatingChecklistStatusId] = useState<string | null>(null);
  const [filtroChecklistStatus, setFiltroChecklistStatus] = useState<'todos' | 'nao_iniciada' | 'em_andamento' | 'concluido'>('todos');
  const [filtroChecklistTime, setFiltroChecklistTime] = useState('todos');
  const [filtroChecklistResponsavel, setFiltroChecklistResponsavel] = useState('todos');
  const [ordenacaoChecklist, setOrdenacaoChecklist] = useState<'responsavel' | 'prazo'>('prazo');
  const [step1AreasItens, setStep1AreasItens] = useState<
    Array<{
      id: string;
      area_nome: string;
      area_ordem: number;
      etapa_nome: string;
      concluido: boolean;
      link_url: string | null;
      storage_path: string | null;
      nome_original: string | null;
      ativo_na_rede: boolean;
    }>
  >([]);
  const [step1Collapsed, setStep1Collapsed] = useState<Record<string, boolean>>({});
  const [savingStep1ItemId, setSavingStep1ItemId] = useState<string | null>(null);
  const [acoplamentoChecklistItens, setAcoplamentoChecklistItens] = useState<
    Array<{
      id: string;
      titulo: string;
      concluido: boolean;
      ordem: number;
    }>
  >([]);
  const [loadingComiteChecklist, setLoadingComiteChecklist] = useState(false);
  const [comiteMaterialChecklistItens, setComiteMaterialChecklistItens] = useState<
    Array<{ id: string; titulo: string; concluido: boolean; ordem: number }>
  >([]);
  const [loadingStep4PlanialtimetricoChecklist, setLoadingStep4PlanialtimetricoChecklist] = useState(false);
  const [step4PlanialtimetricoChecklistItens, setStep4PlanialtimetricoChecklistItens] = useState<
    Array<{ id: string; titulo: string; concluido: boolean; ordem: number }>
  >([]);
  const [loadingProjetoLegalChecklist, setLoadingProjetoLegalChecklist] = useState(false);
  const [projetoLegalChecklistItens, setProjetoLegalChecklistItens] = useState<
    Array<{ id: string; titulo: string; concluido: boolean; ordem: number }>
  >([]);
  const [loadingAprovacaoCondominioChecklist, setLoadingAprovacaoCondominioChecklist] = useState(false);
  const [aprovacaoCondominioBaseItens, setAprovacaoCondominioBaseItens] = useState<
    Array<{ id: string; titulo: string; concluido: boolean; ordem: number }>
  >([]);
  const [aprovacaoCondominioComuniqueItens, setAprovacaoCondominioComuniqueItens] = useState<
    Array<{ id: string; titulo: string; concluido: boolean; ordem: number }>
  >([]);
  const [loadingAprovacaoPrefeituraChecklist, setLoadingAprovacaoPrefeituraChecklist] = useState(false);
  const [aprovacaoPrefeituraBaseItens, setAprovacaoPrefeituraBaseItens] = useState<
    Array<{ id: string; titulo: string; concluido: boolean; ordem: number }>
  >([]);
  const [aprovacaoPrefeituraComuniqueItens, setAprovacaoPrefeituraComuniqueItens] = useState<
    Array<{ id: string; titulo: string; concluido: boolean; ordem: number }>
  >([]);
  const [checklistPareceres, setChecklistPareceres] = useState<Record<string, string>>({});
  const [loadingDadosComite, setLoadingDadosComite] = useState(false);
  const [dadosComite, setDadosComite] = useState<{
    id: string;
    comite_moni_concluido: boolean;
    comite_resultado: 'pendente' | 'aprovado' | 'reprovado' | null;
    parecer_texto: string | null;
    link_url: string | null;
    storage_path: string | null;
    nome_original: string | null;
  } | null>(null);

  const progressoComite = useMemo(() => {
    const total = 2;
    const materialOk = comiteMaterialChecklistItens.some((i) => i.titulo === 'Material para o Comitê' && i.concluido);
    const comiteMoniOk = Boolean(dadosComite?.comite_moni_concluido);
    const concluido = [materialOk, comiteMoniOk].filter(Boolean).length;
    const percentual = Math.round((concluido / total) * 100);
    return { concluido, total, percentual, completo: concluido === total };
  }, [comiteMaterialChecklistItens, dadosComite?.comite_moni_concluido]);

  const precisaMotivoReprovacaoCancel = useMemo(() => {
    const comiteAprovado = dadosComite?.comite_resultado === 'aprovado';
    return precisaMotivoReprovacaoComiteNoCancelamento(comiteAprovado, etapaAtual);
  }, [dadosComite?.comite_resultado, etapaAtual]);

  const [dadosCollapsed, setDadosCollapsed] = useState({
    franqueado: true,
    novoNegocio: true,
    preObra: true,
    relacionados: true,
    aprovacoes: true,
    credito: true,
    contabilidade: true,
  });

  const BUCKET = 'processo-docs';
  const supabase = useMemo(() => createClient(), []);

  const [copiedLinkUrl, setCopiedLinkUrl] = useState<string | null>(null);

  const copyLinkToClipboard = async (url: string) => {
    const markCopied = () => {
      setCopiedLinkUrl(url);
      window.setTimeout(() => setCopiedLinkUrl((prev) => (prev === url ? null : prev)), 1800);
    };

    const fallbackCopy = (text: string) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.left = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    };

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        markCopied();
        return;
      }
      if (fallbackCopy(url)) {
        markCopied();
        return;
      }
      const manual = window.prompt('Copie o link abaixo:', url);
      if (manual !== null) markCopied();
    } catch {
      if (fallbackCopy(url)) {
        markCopied();
        return;
      }
      const manual = window.prompt('Copie o link abaixo:', url);
      if (manual !== null) markCopied();
    }
  };

  const getPublicShareFormUrl = async (formType: 'legal' | 'credito') => {
    const res = await getOrCreatePublicFormLink(processoId, formType);
    if (!res.ok) {
      alert(res.error);
      return null;
    }
    const path = `/public/forms/${formType}?token=${encodeURIComponent(res.token)}`;
    return typeof window === 'undefined' ? path : `${window.location.origin}${path}`;
  };

  const getLinkForRelatedCard = (processo: { id: string; etapa_painel?: string | null }) => {
    const etapa = String(processo.etapa_painel ?? '');
    if (etapa === 'credito_terreno' || etapa === 'credito_obra') {
      return `/painel-credito?card=${encodeURIComponent(processo.id)}`;
    }
    if (
      etapa === 'contabilidade_incorporadora' ||
      etapa === 'contabilidade_spe' ||
      etapa === 'contabilidade_gestora'
    ) {
      return `/painel-contabilidade?card=${encodeURIComponent(processo.id)}`;
    }
    return `/painel-novos-negocios?card=${encodeURIComponent(processo.id)}`;
  };

  const getDocStatusLabel = (status: string | null | undefined) => {
    const normalized = String(status ?? '').trim().toLowerCase();
    if (normalized === 'aguardando_revisao' || normalized === 'aprovado' || normalized === 'assinado') {
      return 'ASSINADO';
    }
    if (normalized === 'reprovado') return 'REPROVADO';
    if (normalized === 'enviado_assinatura') return 'ENVIADO_ASSINATURA';
    return normalized ? normalized.toUpperCase() : 'ASSINADO';
  };

  const [novoNegocioEstudosDocsItens, setNovoNegocioEstudosDocsItens] = useState<
    Array<{
      id: string;
      titulo: string;
      storage_path: string | null;
      nome_original: string | null;
      link_url: string | null;
      texto_livre: string | null;
      anexos_json: Array<{ storage_path: string | null; nome_original: string | null }>;
      ordem: number;
    }>
  >([]);
  const [loadingNovoNegocioEstudosDocs, setLoadingNovoNegocioEstudosDocs] = useState(false);
  const [uploadingNovoNegocioDocId, setUploadingNovoNegocioDocId] = useState<string | null>(null);
  const [uploadingChecklistAnexoDocId, setUploadingChecklistAnexoDocId] = useState<string | null>(null);
  const [checklistDocsByEtapa, setChecklistDocsByEtapa] = useState<
    Record<
      string,
      Array<{
        id: string;
        titulo: string;
        storage_path: string | null;
        nome_original: string | null;
        link_url: string | null;
        ordem: number;
      }>
    >
  >({});

  const [documentosItens, setDocumentosItens] = useState<
    Array<{
      id: string;
      titulo: string;
      storage_path: string | null;
      nome_original: string | null;
      link_url: string | null;
      ordem: number;
    }>
  >([]);
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);
  const [novoDocumentoLoading, setNovoDocumentoLoading] = useState(false);
  const [uploadingDocumentoId, setUploadingDocumentoId] = useState<string | null>(null);

  // Step 3: Opções (documento de opções dentro do Kanban)
  const [loadingStep3Opcoes, setLoadingStep3Opcoes] = useState(false);
  const [step3TemplateUrl, setStep3TemplateUrl] = useState<string | null>(null);
  const [step3Instances, setStep3Instances] = useState<StepDocInstance[]>([]);
  const [step3UploadFile, setStep3UploadFile] = useState<File | null>(null);
  const [step3Uploading, setStep3Uploading] = useState(false);

  // Step 7: Contrato (documento de contrato dentro do Kanban)
  const [loadingStep7Contrato, setLoadingStep7Contrato] = useState(false);
  const [step7TemplateUrl, setStep7TemplateUrl] = useState<string | null>(null);
  const [step7Instances, setStep7Instances] = useState<Step7DocInstance[]>([]);
  const [step7UploadFile, setStep7UploadFile] = useState<File | null>(null);
  const [step7Uploading, setStep7Uploading] = useState(false);

  // Step 4: Checklist Legal
  const EMPTY_CHECKLIST_LEGAL_ARQUIVOS: ChecklistLegalArquivos = {
    manual_condominio_pdf: [],
    codigo_obras_pdf: [],
    outros_documentos_pdf: [],
    aprovacao_matricula_pdf: [],
    aprovacao_planialtimetrico_pdf: [],
    aprovacao_spt_pdf: [],
    terreno_abrigos_medidores_pdf: [],
  };

  const EMPTY_CHECKLIST_LEGAL_RESPOSTAS: ChecklistLegalRespostas = {
    q1_aprov_tel_setor: '',
    q2_aprov_tel_subprefeitura: '',
    q3_aprov_pre_fabricadas: '',
    q6_aprov_taxas: '',
    q7_aprov_laud_sondagem: '',
    q9_aprov_doc_solicitados_selecionados: [],
    q9_aprov_doc_solicitados_outro_text: '',
    q10_aprov_prazo_condominio: '',
    q11_aprov_prazo_prefeitura: '',

    q12_terreno_recuo_frontal: '',
    q13_terreno_recuo_lateral: '',
    q14_terreno_recuo_fundos: '',
    q15_terreno_taxa_ocupacao: '',
    q16_terreno_coeficiente_aproveitamento: '',
    q17_terreno_permeabilidade_minima: '',
    q18_terreno_regra_area_permeavel: '',
    q19_terreno_area_construida_minima: '',
    q20_terreno_cobertura_recuos: '',
    q21_terreno_piscinas_recuos: '',
    q22_terreno_ediculas_permitidas: '',
    q24_terreno_ediculas_especificacoes: '',

    q25_gabarito_altura_maxima: '',
    q26_gabarito_pavimentos: '',
    q27_gabarito_subsolos: '',
    q28_gabarito_excecoes: '',

    q29_divisas_altura_muros: '',
    q30_divisas_restricao_area_comum: '',
    q31_divisas_muro_arrimo_opcional: '',
    q32_divisas_areas_gourmet: '',

    q33_passeios_alteracoes: '',
    q34_passeios_paginacao: '',
    q35_passeios_plantio_arvores: '',

    q36_inst_medidores_posicionamento: '',
    q37_inst_pocos_fossas: '',
    q38_inst_esgoto_orientado: '',
    q39_inst_faixa_servitude: '',

    q40_outras_observacoes: '',
  };

  const [loadingChecklistLegal, setLoadingChecklistLegal] = useState(false);
  const [checklistLegalRecord, setChecklistLegalRecord] = useState<ChecklistLegalRecord | null>(null);
  const [checklistLegalHasOwnRecord, setChecklistLegalHasOwnRecord] = useState(false);
  const [checklistLegalDrawerOpen, setChecklistLegalDrawerOpen] = useState(false);
  const [checklistLegalDrawerPage, setChecklistLegalDrawerPage] = useState(0);
  const [checklistLegalDrawerSaving, setChecklistLegalDrawerSaving] = useState(false);
  const [checklistLegalRespostas, setChecklistLegalRespostas] = useState<ChecklistLegalRespostas>(EMPTY_CHECKLIST_LEGAL_RESPOSTAS);
  const [checklistLegalArquivos, setChecklistLegalArquivos] = useState<ChecklistLegalArquivos>(EMPTY_CHECKLIST_LEGAL_ARQUIVOS);

  const strTrim = (v: unknown) => String(v ?? '').trim();
  const arrayLen = (v: unknown) => (Array.isArray(v) ? v.length : 0);

  const computeChecklistLegalCompletoClient = (respostas: ChecklistLegalRespostas, arquivos: ChecklistLegalArquivos) => {
    const manualOk = arrayLen(arquivos.manual_condominio_pdf) > 0;
    const codigoOk = arrayLen(arquivos.codigo_obras_pdf) > 0;
    const textOk = (key: string) => Boolean(strTrim(respostas[key] ?? ''));

    const selected = (respostas.q9_aprov_doc_solicitados_selecionados as unknown) as string[] | undefined;
    const otherText = respostas.q9_aprov_doc_solicitados_outro_text;
    const q9Ok = Array.isArray(selected) && selected.length > 0 && (!selected.includes('Outro') || Boolean(strTrim(otherText)));

    return (
      manualOk &&
      codigoOk &&
      textOk('q1_aprov_tel_setor') &&
      textOk('q2_aprov_tel_subprefeitura') &&
      textOk('q3_aprov_pre_fabricadas') &&
      textOk('q6_aprov_taxas') &&
      textOk('q7_aprov_laud_sondagem') &&
      q9Ok &&
      textOk('q10_aprov_prazo_condominio') &&
      textOk('q11_aprov_prazo_prefeitura') &&
      textOk('q12_terreno_recuo_frontal') &&
      textOk('q13_terreno_recuo_lateral') &&
      textOk('q14_terreno_recuo_fundos') &&
      textOk('q15_terreno_taxa_ocupacao') &&
      textOk('q16_terreno_coeficiente_aproveitamento') &&
      textOk('q17_terreno_permeabilidade_minima') &&
      textOk('q18_terreno_regra_area_permeavel') &&
      textOk('q19_terreno_area_construida_minima') &&
      textOk('q20_terreno_cobertura_recuos') &&
      textOk('q21_terreno_piscinas_recuos') &&
      textOk('q22_terreno_ediculas_permitidas') &&
      textOk('q25_gabarito_altura_maxima') &&
      textOk('q26_gabarito_pavimentos') &&
      textOk('q27_gabarito_subsolos') &&
      textOk('q28_gabarito_excecoes') &&
      textOk('q29_divisas_altura_muros') &&
      textOk('q30_divisas_restricao_area_comum') &&
      textOk('q32_divisas_areas_gourmet') &&
      textOk('q33_passeios_alteracoes') &&
      textOk('q34_passeios_paginacao') &&
      textOk('q35_passeios_plantio_arvores') &&
      textOk('q36_inst_medidores_posicionamento') &&
      textOk('q37_inst_pocos_fossas') &&
      textOk('q38_inst_esgoto_orientado') &&
      textOk('q39_inst_faixa_servitude')
    );
  };

  const computeChecklistLegalProgressoClient = (
    respostas: ChecklistLegalRespostas,
    arquivos: ChecklistLegalArquivos,
  ) => {
    const manualOk = arrayLen(arquivos.manual_condominio_pdf) > 0;
    const codigoOk = arrayLen(arquivos.codigo_obras_pdf) > 0;
    const textOk = (key: string) => Boolean(strTrim(respostas[key] ?? ''));

    const selected = (respostas.q9_aprov_doc_solicitados_selecionados as unknown) as string[] | undefined;
    const otherText = respostas.q9_aprov_doc_solicitados_outro_text;
    const q9Ok = Array.isArray(selected) && selected.length > 0 && (!selected.includes('Outro') || Boolean(strTrim(otherText)));

    const checks = [
      manualOk,
      codigoOk,
      textOk('q1_aprov_tel_setor'),
      textOk('q2_aprov_tel_subprefeitura'),
      textOk('q3_aprov_pre_fabricadas'),
      textOk('q6_aprov_taxas'),
      textOk('q7_aprov_laud_sondagem'),
      q9Ok,
      textOk('q10_aprov_prazo_condominio'),
      textOk('q11_aprov_prazo_prefeitura'),
      textOk('q12_terreno_recuo_frontal'),
      textOk('q13_terreno_recuo_lateral'),
      textOk('q14_terreno_recuo_fundos'),
      textOk('q15_terreno_taxa_ocupacao'),
      textOk('q16_terreno_coeficiente_aproveitamento'),
      textOk('q17_terreno_permeabilidade_minima'),
      textOk('q18_terreno_regra_area_permeavel'),
      textOk('q19_terreno_area_construida_minima'),
      textOk('q20_terreno_cobertura_recuos'),
      textOk('q21_terreno_piscinas_recuos'),
      textOk('q22_terreno_ediculas_permitidas'),
      textOk('q25_gabarito_altura_maxima'),
      textOk('q26_gabarito_pavimentos'),
      textOk('q27_gabarito_subsolos'),
      textOk('q28_gabarito_excecoes'),
      textOk('q29_divisas_altura_muros'),
      textOk('q30_divisas_restricao_area_comum'),
      textOk('q32_divisas_areas_gourmet'),
      textOk('q33_passeios_alteracoes'),
      textOk('q34_passeios_paginacao'),
      textOk('q35_passeios_plantio_arvores'),
      textOk('q36_inst_medidores_posicionamento'),
      textOk('q37_inst_pocos_fossas'),
      textOk('q38_inst_esgoto_orientado'),
      textOk('q39_inst_faixa_servitude'),
    ];
    const total = checks.length;
    const concluidos = checks.filter(Boolean).length;
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;
    return { total, concluidos, percentual };
  };

  const checklistLegalCompleto = useMemo(
    () =>
      ENFORCE_CHECKLIST_LEGAL_REQUIRED
        ? computeChecklistLegalCompletoClient(checklistLegalRespostas, checklistLegalArquivos)
        : Boolean(checklistLegalRecord?.completo),
    [checklistLegalRespostas, checklistLegalArquivos, checklistLegalRecord?.completo],
  );
  const checklistLegalProgresso = useMemo(
    () => computeChecklistLegalProgressoClient(checklistLegalRespostas, checklistLegalArquivos),
    [checklistLegalRespostas, checklistLegalArquivos],
  );

  const loadComentarios = async () => {
    const r = await getComentariosCard(processoId);
    if (r.ok) setComentarios(r.comentarios);
  };

  const loadActionsHistory = async () => {
    setLoadingActionsHistory(true);
    try {
      const r = await getCardActionsHistory(processoId);
      if (r.ok) setActionsHistory(r.eventos);
    } finally {
      setLoadingActionsHistory(false);
    }
  };

  const loadChecklistHistory = async () => {
    setLoadingChecklistHistory(true);
    try {
      const r = await getCardChecklistAnexosHistory(processoId);
      if (r.ok) setChecklistAnexosHistory(r.eventos);
    } finally {
      setLoadingChecklistHistory(false);
    }
  };
  const loadChecklist = async () => {
    const r = await getChecklistCard(processoId, etapaAtual);
    if (r.ok) setChecklistItens((r.itens ?? []).filter((i) => !isChecklistAnexosEstruturalCard(etapaAtual, i.titulo)));
  };
  const loadStep1AreasChecklist = async () => {
    const r = await getStep1AreasChecklist(processoId);
    if (r.ok) {
      setStep1AreasItens(r.itens);
      setStep1Collapsed((prev) => {
        const next = { ...prev };
        const areas = [...new Set(r.itens.map((x) => x.area_nome))];
        for (const area of areas) {
          if (!(area in next)) next[area] = true; // minimizado por padrão
        }
        return next;
      });
    }
  };

  const loadDocumentos = async () => {
    setLoadingDocumentos(true);
    const r = await getDocumentosCard(processoId, etapaAtual);
    if (r.ok) setDocumentosItens(r.itens);
    setLoadingDocumentos(false);
  };

  const loadNovoNegocioEstudosDocs = async () => {
    setLoadingNovoNegocioEstudosDocs(true);
    // As entradas de "Estudos Novo Negócio" ficam sempre gravadas em etapa_painel = 'step_2',
    // então, na fase de Aprovação, carregamos a mesma etapa anterior.
    const r = await getDocumentosCard(processoId, 'step_2');
    if (r.ok) {
      const alvoTitulos = NOVO_NEGOCIO_ESTUDOS_DOCS_TITULOS as unknown as string[];
      const existentes = new Set((r.itens ?? []).map((d) => d.titulo));
      const missing = alvoTitulos.filter((t) => !existentes.has(t));

      // Backfill defensivo: caso existam cards antigos sem seed.
      if (missing.length > 0) {
        for (const titulo of missing) {
          const ins = await addDocumentoCard(processoId, 'step_2', titulo);
          if (!ins.ok) break;
        }
      }

      const r2 = await getDocumentosCard(processoId, 'step_2');
      if (r2.ok) {
        setNovoNegocioEstudosDocsItens((r2.itens ?? []).filter((d) => alvoTitulos.includes(d.titulo)));
      } else {
        setNovoNegocioEstudosDocsItens([]);
      }
    } else {
      setNovoNegocioEstudosDocsItens([]);
    }
    setLoadingNovoNegocioEstudosDocs(false);
  };

  const loadChecklistDocsForEtapa = async (etapaPainel: string, titulos: string[]) => {
    if (!titulos.length) return;
    const uniqueTitles = [...new Set(titulos.map((t) => String(t).trim()).filter(Boolean))];
    const r = await getDocumentosCard(processoId, etapaPainel);
    if (!r.ok) return;
    const existentes = r.itens ?? [];
    const existentesTitulos = new Set(existentes.map((d) => d.titulo));
    const faltantes = uniqueTitles.filter((t) => !existentesTitulos.has(t));
    for (const titulo of faltantes) {
      const ins = await addDocumentoCard(processoId, etapaPainel, titulo);
      if (!ins.ok) break;
    }
    const r2 = await getDocumentosCard(processoId, etapaPainel);
    if (!r2.ok) return;
    setChecklistDocsByEtapa((prev) => ({
      ...prev,
      [etapaPainel]: (r2.itens ?? []).filter((d) => uniqueTitles.includes(d.titulo)),
    }));
  };

  const renderChecklistLinkAnexo = (
    etapaPainel: string,
    titulo: string,
    concluido: boolean,
  ) => {
    const doc = (checklistDocsByEtapa[etapaPainel] ?? []).find((d) => d.titulo === titulo) ?? null;
    const publicUrl =
      doc?.storage_path &&
      supabase.storage.from(BUCKET).getPublicUrl(doc.storage_path).data.publicUrl;

    return (
      <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="relative">
          <input
            type="url"
            value={doc?.link_url ?? ''}
            disabled={!doc}
            onChange={(e) => {
              const v = e.target.value;
              if (!doc) return;
              setChecklistDocsByEtapa((prev) => ({
                ...prev,
                [etapaPainel]: (prev[etapaPainel] ?? []).map((x) =>
                  x.id === doc.id ? { ...x, link_url: v } : x,
                ),
              }));
            }}
            onBlur={async (e) => {
              if (!doc) return;
              const v = e.target.value;
              const res = await updateDocumentoCardLink(doc.id, v);
              if (!res.ok) alert(res.error);
              await loadChecklistDocsForEtapa(etapaPainel, [titulo]);
            }}
            placeholder="https://..."
            className={`w-full rounded border px-2 py-1 pr-9 text-xs ${
              concluido ? 'border-green-300 text-green-700' : 'border-stone-300 text-stone-700'
            }`}
          />
          {doc?.link_url ? (
            <button
              type="button"
              onClick={() => copyLinkToClipboard(doc.link_url as string)}
              title={copiedLinkUrl === doc.link_url ? 'Link copiado' : 'Copiar link'}
              className={`absolute right-2 top-1/2 -translate-y-1 rounded p-1 ${
                copiedLinkUrl === doc.link_url ? 'text-green-700' : 'text-stone-500 hover:bg-stone-50'
              }`}
            >
              {copiedLinkUrl === doc.link_url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          ) : null}
        </div>

        <div className="space-y-1">
          <input
            type="file"
            disabled={!doc || uploadingChecklistAnexoDocId === doc?.id}
            onChange={async (e) => {
              const file = e.target.files?.[0] ?? null;
              if (!file || !doc) return;
              setUploadingChecklistAnexoDocId(doc.id);
              try {
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const path = `${processoId}/checklist-anexos/${etapaPainel}/${doc.id}/${crypto.randomUUID()}_${safeName}`;
                const uploadRes = await supabase.storage.from(BUCKET).upload(path, file, {
                  cacheControl: '3600',
                  upsert: false,
                });
                if (uploadRes.error) throw uploadRes.error;
                const saveRes = await updateDocumentoCardAnexo(doc.id, path, file.name);
                if (!saveRes.ok) throw new Error(saveRes.error);
                await loadChecklistDocsForEtapa(etapaPainel, [titulo]);
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Erro ao enviar arquivo.');
              } finally {
                setUploadingChecklistAnexoDocId(null);
                e.currentTarget.value = '';
              }
            }}
            className={`w-full rounded border px-2 py-1 text-xs file:mr-2 file:rounded file:border-0 file:px-2 file:py-1 ${
              concluido
                ? 'border-green-300 text-green-700 file:bg-green-100 file:text-green-800'
                : 'border-stone-300 text-stone-700 file:bg-stone-100 file:text-stone-700'
            }`}
          />
          {doc?.nome_original ? (
            doc?.storage_path && publicUrl ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className={`block text-[11px] ${
                  concluido ? 'text-green-700 hover:underline' : 'text-stone-500 hover:underline'
                }`}
              >
                Anexo: {doc.nome_original}
              </a>
            ) : (
              <span className={`block text-[11px] ${concluido ? 'text-green-700' : 'text-stone-500'}`}>
                Anexo: {doc.nome_original}
              </span>
            )
          ) : null}
        </div>
      </div>
    );
  };

  const renderChecklistLinkAnexoEspelho = (etapaPainel: string, titulo: string, concluido: boolean) => {
    const doc = (checklistDocsByEtapa[etapaPainel] ?? []).find((d) => d.titulo === titulo) ?? null;
    const publicUrl =
      doc?.storage_path &&
      supabase.storage.from(BUCKET).getPublicUrl(doc.storage_path).data.publicUrl;

    return (
      <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <div className={`rounded border px-2 py-1 text-xs ${concluido ? 'border-green-300 text-green-700' : 'border-stone-300 text-stone-700'}`}>
            {doc?.link_url ? (
              <div className="flex items-center justify-between gap-2">
                <a href={doc.link_url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                  {doc.link_url}
                </a>
                <button
                  type="button"
                  onClick={() => copyLinkToClipboard(doc.link_url as string)}
                  title={copiedLinkUrl === doc.link_url ? 'Link copiado' : 'Copiar link'}
                  className={copiedLinkUrl === doc.link_url ? 'text-green-700' : 'text-stone-500 hover:text-stone-700'}
                >
                  {copiedLinkUrl === doc.link_url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            ) : (
              <span className="text-stone-500">Sem link</span>
            )}
          </div>
        </div>

        <div className={`rounded border px-2 py-1 text-xs ${concluido ? 'border-green-300 text-green-700' : 'border-stone-300 text-stone-700'}`}>
          {doc?.nome_original ? (
            doc?.storage_path && publicUrl ? (
              <a href={publicUrl} target="_blank" rel="noreferrer" className="hover:underline">
                Anexo: {doc.nome_original}
              </a>
            ) : (
              <span>Anexo: {doc.nome_original}</span>
            )
          ) : (
            <span className="text-stone-500">Sem anexo</span>
          )}
        </div>
      </div>
    );
  };

  const loadStep3Opcoes = async () => {
    setLoadingStep3Opcoes(true);
    try {
      const [tplRes, instances] = await Promise.all([
        getStep3TemplateUrl(),
        listStep3Instances(processoId),
      ]);

      setStep3TemplateUrl(tplRes.ok ? tplRes.url : null);
      setStep3Instances(instances);
    } finally {
      setLoadingStep3Opcoes(false);
    }
  };

  const loadStep7Contrato = async () => {
    setLoadingStep7Contrato(true);
    try {
      const [tplRes, instances] = await Promise.all([
        getStep7TemplateUrl(),
        listStep7Instances(processoId),
      ]);

      setStep7TemplateUrl(tplRes.ok ? tplRes.url : null);
      setStep7Instances(instances);
    } finally {
      setLoadingStep7Contrato(false);
    }
  };

  const loadAcoplamentoChecklist = async () => {
    setLoadingAcoplamentoChecklist(true);
    try {
      const r = await getChecklistCard(processoId, 'acoplamento');
      if (!r.ok) {
        setAcoplamentoChecklistItens([]);
        return;
      }

      const existentes = r.itens ?? [];
      const existentesTitulos = new Set(existentes.map((i) => i.titulo));
      const faltantes = ACOPLAMENTO_CHECKLIST_TITULOS.filter((t) => !existentesTitulos.has(t));

      if (faltantes.length > 0) {
        for (const titulo of faltantes) {
          const ins = await addChecklistItem(processoId, 'acoplamento', titulo, null, null, null, 'nao_iniciada');
          if (!ins.ok) break;
        }
      }

      const r2 = await getChecklistCard(processoId, 'acoplamento');
      if (!r2.ok) {
        setAcoplamentoChecklistItens([]);
        return;
      }
      const ordemTitulo = new Map<string, number>(ACOPLAMENTO_CHECKLIST_TITULOS.map((t, i) => [t, i]));
      const itens = (r2.itens ?? [])
        .filter((i) => ACOPLAMENTO_CHECKLIST_TITULOS.includes(i.titulo as (typeof ACOPLAMENTO_CHECKLIST_TITULOS)[number]))
        .sort((a, b) => (ordemTitulo.get(a.titulo) ?? 999) - (ordemTitulo.get(b.titulo) ?? 999))
        .map((i) => ({ id: i.id, titulo: i.titulo, concluido: i.concluido, ordem: i.ordem }));

      setAcoplamentoChecklistItens(itens);
    } finally {
      setLoadingAcoplamentoChecklist(false);
    }
  };

  const loadComiteChecklist = async () => {
    setLoadingComiteChecklist(true);
    try {
      const r = await getChecklistCard(processoId, 'step_5');
      if (!r.ok) {
        setComiteMaterialChecklistItens([]);
        return;
      }

      const existentes = r.itens ?? [];
      const titulos = new Set(existentes.map((i) => i.titulo));
      const faltantes = COMITE_MATERIAL_CHECKLIST_TITULOS.filter((t) => !titulos.has(t));
      if (faltantes.length > 0) {
        for (const titulo of faltantes) {
          const ins = await addChecklistItem(processoId, 'step_5', titulo, null, null, null, 'nao_iniciada');
          if (!ins.ok) break;
        }
      }

      const r2 = await getChecklistCard(processoId, 'step_5');
      if (!r2.ok) {
        setComiteMaterialChecklistItens([]);
        return;
      }
      setComiteMaterialChecklistItens(
        (r2.itens ?? [])
          .filter((i) => COMITE_MATERIAL_CHECKLIST_TITULOS.includes(i.titulo as (typeof COMITE_MATERIAL_CHECKLIST_TITULOS)[number]))
          .map((i) => ({ id: i.id, titulo: i.titulo, concluido: i.concluido, ordem: i.ordem })),
      );
    } finally {
      setLoadingComiteChecklist(false);
    }
  };

  const loadDadosComite = async () => {
    setLoadingDadosComite(true);
    try {
      const r = await getDadosComiteCard(processoId);
      if (r.ok) setDadosComite(r.data);
    } finally {
      setLoadingDadosComite(false);
    }
  };

  const loadStep4PlanialtimetricoChecklist = async () => {
    setLoadingStep4PlanialtimetricoChecklist(true);
    try {
      const r = await getChecklistCard(processoId, 'step_4');
      if (!r.ok) {
        setStep4PlanialtimetricoChecklistItens([]);
        return;
      }

      const existentes = r.itens ?? [];
      const titulos = new Set(existentes.map((i) => i.titulo));
      const faltantes = STEP4_PLANIALTIMETRICO_CHECKLIST_TITULOS.filter((t) => !titulos.has(t));
      if (faltantes.length > 0) {
        for (const titulo of faltantes) {
          const ins = await addChecklistItem(processoId, 'step_4', titulo, null, null, null, 'nao_iniciada');
          if (!ins.ok) break;
        }
      }

      const r2 = await getChecklistCard(processoId, 'step_4');
      if (!r2.ok) {
        setStep4PlanialtimetricoChecklistItens([]);
        return;
      }
      setStep4PlanialtimetricoChecklistItens(
        (r2.itens ?? [])
          .filter((i) =>
            STEP4_PLANIALTIMETRICO_CHECKLIST_TITULOS.includes(
              i.titulo as (typeof STEP4_PLANIALTIMETRICO_CHECKLIST_TITULOS)[number],
            ),
          )
          .map((i) => ({ id: i.id, titulo: i.titulo, concluido: i.concluido, ordem: i.ordem })),
      );
    } finally {
      setLoadingStep4PlanialtimetricoChecklist(false);
    }
  };

  const loadProjetoLegalChecklist = async () => {
    setLoadingProjetoLegalChecklist(true);
    try {
      const r = await getChecklistCard(processoId, 'projeto_legal');
      if (!r.ok) {
        setProjetoLegalChecklistItens([]);
        return;
      }
      const existentes = r.itens ?? [];
      const titulos = new Set(existentes.map((i) => i.titulo));
      const faltantes = PROJETO_LEGAL_CHECKLIST_TITULOS.filter((t) => !titulos.has(t));
      if (faltantes.length > 0) {
        for (const titulo of faltantes) {
          const ins = await addChecklistItem(processoId, 'projeto_legal', titulo, null, null, null, 'nao_iniciada');
          if (!ins.ok) break;
        }
      }
      const r2 = await getChecklistCard(processoId, 'projeto_legal');
      if (!r2.ok) {
        setProjetoLegalChecklistItens([]);
        return;
      }
      setProjetoLegalChecklistItens(
        (r2.itens ?? [])
          .filter((i) => PROJETO_LEGAL_CHECKLIST_TITULOS.includes(i.titulo as (typeof PROJETO_LEGAL_CHECKLIST_TITULOS)[number]))
          .map((i) => ({ id: i.id, titulo: i.titulo, concluido: i.concluido, ordem: i.ordem })),
      );
    } finally {
      setLoadingProjetoLegalChecklist(false);
    }
  };

  const loadAprovacaoCondominioChecklist = async () => {
    setLoadingAprovacaoCondominioChecklist(true);
    try {
      const r = await getChecklistCard(processoId, 'aprovacao_condominio');
      if (!r.ok) {
        setAprovacaoCondominioBaseItens([]);
        setAprovacaoCondominioComuniqueItens([]);
        return;
      }
      const existentes = r.itens ?? [];
      const titulos = new Set(existentes.map((i) => i.titulo));
      const faltantes = APROVACAO_CONDOMINIO_BASE_TITULOS.filter((t) => !titulos.has(t));
      if (faltantes.length > 0) {
        for (const titulo of faltantes) {
          const ins = await addChecklistItem(processoId, 'aprovacao_condominio', titulo, null, null, null, 'nao_iniciada');
          if (!ins.ok) break;
        }
      }
      const r2 = await getChecklistCard(processoId, 'aprovacao_condominio');
      if (!r2.ok) {
        setAprovacaoCondominioBaseItens([]);
        setAprovacaoCondominioComuniqueItens([]);
        return;
      }
      const itens = (r2.itens ?? []).map((i) => ({ id: i.id, titulo: i.titulo, concluido: i.concluido, ordem: i.ordem }));
      setAprovacaoCondominioBaseItens(
        itens.filter((i) =>
          APROVACAO_CONDOMINIO_BASE_TITULOS.includes(i.titulo as (typeof APROVACAO_CONDOMINIO_BASE_TITULOS)[number]),
        ),
      );
      const comunique = itens.filter((i) => /^Comunique-se Condom[ií]nio\s+\d+$/i.test(i.titulo));
      setAprovacaoCondominioComuniqueItens(comunique);
      const parecerRes = await getChecklistPareceres(comunique.map((c) => c.id));
      if (parecerRes.ok) setChecklistPareceres((prev) => ({ ...prev, ...parecerRes.pareceres }));
    } finally {
      setLoadingAprovacaoCondominioChecklist(false);
    }
  };

  const loadAprovacaoPrefeituraChecklist = async () => {
    setLoadingAprovacaoPrefeituraChecklist(true);
    try {
      const r = await getChecklistCard(processoId, 'aprovacao_prefeitura');
      if (!r.ok) {
        setAprovacaoPrefeituraBaseItens([]);
        setAprovacaoPrefeituraComuniqueItens([]);
        return;
      }
      const existentes = r.itens ?? [];
      const titulos = new Set(existentes.map((i) => i.titulo));
      const faltantes = APROVACAO_PREFEITURA_BASE_TITULOS.filter((t) => !titulos.has(t));
      if (faltantes.length > 0) {
        for (const titulo of faltantes) {
          const ins = await addChecklistItem(processoId, 'aprovacao_prefeitura', titulo, null, null, null, 'nao_iniciada');
          if (!ins.ok) break;
        }
      }
      const r2 = await getChecklistCard(processoId, 'aprovacao_prefeitura');
      if (!r2.ok) {
        setAprovacaoPrefeituraBaseItens([]);
        setAprovacaoPrefeituraComuniqueItens([]);
        return;
      }
      const itens = (r2.itens ?? []).map((i) => ({ id: i.id, titulo: i.titulo, concluido: i.concluido, ordem: i.ordem }));
      setAprovacaoPrefeituraBaseItens(
        itens.filter((i) =>
          APROVACAO_PREFEITURA_BASE_TITULOS.includes(i.titulo as (typeof APROVACAO_PREFEITURA_BASE_TITULOS)[number]),
        ),
      );
      const comunique = itens.filter((i) => /^Comunique-se Prefeitura\s+\d+$/i.test(i.titulo));
      setAprovacaoPrefeituraComuniqueItens(comunique);
      const parecerRes = await getChecklistPareceres(comunique.map((c) => c.id));
      if (parecerRes.ok) setChecklistPareceres((prev) => ({ ...prev, ...parecerRes.pareceres }));
    } finally {
      setLoadingAprovacaoPrefeituraChecklist(false);
    }
  };

  const loadChecklistLegal = async () => {
    setLoadingChecklistLegal(true);
    try {
      const r = await getChecklistLegalForCard(processoId);
      if (!r.ok) {
        // mantém o formulário vazio, apenas sem travar o modal
        setChecklistLegalRecord(null);
        setChecklistLegalHasOwnRecord(false);
        setChecklistLegalRespostas(EMPTY_CHECKLIST_LEGAL_RESPOSTAS);
        setChecklistLegalArquivos(EMPTY_CHECKLIST_LEGAL_ARQUIVOS);
        return;
      }

      setChecklistLegalHasOwnRecord(r.hasOwnRecord);
      setChecklistLegalRecord(r.record);
      if (r.record) {
        setChecklistLegalRespostas(r.record.respostas_json ?? EMPTY_CHECKLIST_LEGAL_RESPOSTAS);
        setChecklistLegalArquivos(r.record.arquivos_json ?? EMPTY_CHECKLIST_LEGAL_ARQUIVOS);
      } else {
        setChecklistLegalRespostas(EMPTY_CHECKLIST_LEGAL_RESPOSTAS);
        setChecklistLegalArquivos(EMPTY_CHECKLIST_LEGAL_ARQUIVOS);
      }
    } finally {
      setLoadingChecklistLegal(false);
    }
  };

  useEffect(() => {
    loadComentarios();
  }, [processoId]);

  useEffect(() => {
    if (tab === 'comentarios') loadActionsHistory();
  }, [tab, processoId]);

  useEffect(() => {
    if (tab === 'checklist_history') loadChecklistHistory();
  }, [tab, processoId]);
  useEffect(() => {
    (async () => {
      const r = await getResumoProcessoStep1(processoId);
      if (r.ok) {
        setResumo(r.data);
        setDadosPreObraForm({
          previsao_aprovacao_condominio: r.data.previsao_aprovacao_condominio ?? '',
          previsao_aprovacao_prefeitura: r.data.previsao_aprovacao_prefeitura ?? '',
          previsao_emissao_alvara: r.data.previsao_emissao_alvara ?? '',
          data_aprovacao_condominio: r.data.data_aprovacao_condominio ?? '',
          data_aprovacao_prefeitura: r.data.data_aprovacao_prefeitura ?? '',
          data_emissao_alvara: r.data.data_emissao_alvara ?? '',
          data_aprovacao_credito: r.data.data_aprovacao_credito ?? '',
          previsao_liberacao_credito_obra: r.data.previsao_liberacao_credito_obra ?? '',
          previsao_inicio_obra: r.data.previsao_inicio_obra ?? '',
        });
      }
      const rel = await getRelacionadosProcesso(processoId);
      if (rel.ok) {
        setRelacionados({
          pai: rel.pai,
          filhos: rel.filhos,
          irmaos: rel.irmaos,
        });
      }
    })();
  }, [processoId]);

  useEffect(() => {
    setDadosCollapsed({
      franqueado: true,
      novoNegocio: true,
      preObra: true,
      relacionados: true,
      aprovacoes: true,
      credito: true,
      contabilidade: true,
    });
  }, [processoId]);
  useEffect(() => {
    if (tab !== 'checklist') return;
    loadChecklist();
  }, [tab, processoId, etapaAtual]);

  useEffect(() => {
    if (tab !== 'checklist_step1') return;
    if ((etapaAtual === 'step_4' || etapaAtual === 'acoplamento') && step4PlanialtimetricoChecklistItens.length > 0) {
      loadChecklistDocsForEtapa('step_4', step4PlanialtimetricoChecklistItens.map((i) => i.titulo));
    }
  }, [tab, processoId, etapaAtual, step4PlanialtimetricoChecklistItens]);

  useEffect(() => {
    if (tab !== 'checklist_step1') return;
    if (etapaAtual === 'step_5' && comiteMaterialChecklistItens.length > 0) {
      loadChecklistDocsForEtapa('step_5', comiteMaterialChecklistItens.map((i) => i.titulo));
    }
  }, [tab, processoId, etapaAtual, comiteMaterialChecklistItens]);

  useEffect(() => {
    if (tab !== 'checklist_step1') return;
    if (etapaAtual === 'projeto_legal' && projetoLegalChecklistItens.length > 0) {
      loadChecklistDocsForEtapa('projeto_legal', projetoLegalChecklistItens.map((i) => i.titulo));
    }
  }, [tab, processoId, etapaAtual, projetoLegalChecklistItens]);

  useEffect(() => {
    if (tab !== 'checklist_step1') return;
    if (etapaAtual === 'aprovacao_condominio' && aprovacaoCondominioBaseItens.length > 0) {
      loadChecklistDocsForEtapa('aprovacao_condominio', aprovacaoCondominioBaseItens.map((i) => i.titulo));
    }
  }, [tab, processoId, etapaAtual, aprovacaoCondominioBaseItens]);

  useEffect(() => {
    if (tab !== 'checklist_step1') return;
    if (etapaAtual === 'aprovacao_prefeitura' && aprovacaoPrefeituraBaseItens.length > 0) {
      loadChecklistDocsForEtapa('aprovacao_prefeitura', aprovacaoPrefeituraBaseItens.map((i) => i.titulo));
    }
  }, [tab, processoId, etapaAtual, aprovacaoPrefeituraBaseItens]);

  useEffect(() => {
    if (tab !== 'checklist_step1') return;
    if (etapaAtual === 'acoplamento' && acoplamentoChecklistItens.length > 0) {
      loadChecklistDocsForEtapa('acoplamento', acoplamentoChecklistItens.map((i) => i.titulo));
    }
  }, [tab, processoId, etapaAtual, acoplamentoChecklistItens]);

  useEffect(() => {
    if (tab !== 'checklist_step1') return;
    if (etapaAtual === 'step_1') loadStep1AreasChecklist();
    if (etapaAtual === 'step_3' || etapaAtual === 'credito_terreno') loadStep3Opcoes();
    if (etapaAtual === 'step_7') loadStep7Contrato();
    if (etapaAtual === 'step_4') {
      loadChecklistLegal();
      loadStep4PlanialtimetricoChecklist();
    }
    if (etapaAtual === 'projeto_legal') loadProjetoLegalChecklist();
    if (etapaAtual === 'aprovacao_condominio') loadAprovacaoCondominioChecklist();
    if (etapaAtual === 'aprovacao_prefeitura') loadAprovacaoPrefeituraChecklist();
    if (etapaAtual === 'step_5') {
      loadComiteChecklist();
      loadDadosComite();
    }
    if (etapaAtual === 'acoplamento') {
      loadChecklistLegal();
      loadStep4PlanialtimetricoChecklist();
      loadAcoplamentoChecklist();
    }
    if (
      etapaAtual === 'step_2' ||
      etapaAtual === 'aprovacao_moni_novo_negocio'
    ) {
      loadNovoNegocioEstudosDocs();
    }
  }, [tab, processoId, etapaAtual]);

  useEffect(() => {
    if (tab !== 'dados') return;
    if (etapaAtual !== 'step_4') return;
    loadChecklistLegal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, processoId, etapaAtual]);

  useEffect(() => {
    if (tab === 'documentos') loadDocumentos();
  }, [tab, processoId, etapaAtual]);

  const handleEnviarComentario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoComentario.trim()) return;
    setLoadingComentario(true);
    const res = await enviarComentarioCard(processoId, novoComentario);
    setLoadingComentario(false);
    if (res.ok) {
      setNovoComentario('');
      loadComentarios();
      loadActionsHistory();
      router.refresh();
    }
  };

  const handleSalvarDadosPreObra = async () => {
    setSavingDadosPreObra(true);
    try {
      const res = await updateDadosPreObra(processoId, {
        previsao_aprovacao_condominio: dadosPreObraForm.previsao_aprovacao_condominio || null,
        previsao_aprovacao_prefeitura: dadosPreObraForm.previsao_aprovacao_prefeitura || null,
        previsao_emissao_alvara: dadosPreObraForm.previsao_emissao_alvara || null,
        data_aprovacao_condominio: dadosPreObraForm.data_aprovacao_condominio || null,
        data_aprovacao_prefeitura: dadosPreObraForm.data_aprovacao_prefeitura || null,
        data_emissao_alvara: dadosPreObraForm.data_emissao_alvara || null,
        data_aprovacao_credito: dadosPreObraForm.data_aprovacao_credito || null,
        previsao_liberacao_credito_obra: dadosPreObraForm.previsao_liberacao_credito_obra || null,
        previsao_inicio_obra: dadosPreObraForm.previsao_inicio_obra || null,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      const resumoAtualizado = await getResumoProcessoStep1(processoId);
      if (resumoAtualizado.ok) setResumo(resumoAtualizado.data);
      router.refresh();
    } finally {
      setSavingDadosPreObra(false);
    }
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoChecklistTitulo.trim()) return;
    setLoadingChecklist(true);
    try {
      const prazoFormatado = dateInputToPrazoDb(novoChecklistPrazo);

      const res = await addChecklistItem(
        processoId,
        etapaAtual,
        novoChecklistTitulo,
        prazoFormatado,
        null,
        null,
        novoChecklistStatus,
        novoChecklistTimes,
        novoChecklistResponsaveis,
      );

      if (!res.ok) {
        alert(res.error);
        return;
      }

      setNovoChecklistTitulo('');
      setNovoChecklistPrazo('');
      setNovoChecklistTimes([]);
      setNovoChecklistResponsaveis([]);
      setNovoChecklistStatus('nao_iniciada');
      loadChecklist();
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleSalvarEdicaoAtividade = async () => {
    if (!atividadeEdicao) return;
    setSalvandoEdicaoAtividade(true);
    try {
      const prazoFormatado = dateInputToPrazoDb(atividadeEdicao.prazoIso);
      const res = await updateChecklistItem(atividadeEdicao.id, {
        titulo: atividadeEdicao.titulo,
        prazo: prazoFormatado,
        timesNomes: atividadeEdicao.times,
        responsaveisNomes: atividadeEdicao.responsaveis,
        status: atividadeEdicao.status,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setAtividadeEdicao(null);
      await loadChecklist();
      loadChecklistHistory();
    } finally {
      setSalvandoEdicaoAtividade(false);
    }
  };

  const handleToggleChecklist = async (itemId: string, concluido: boolean) => {
    const res = await toggleChecklistItem(itemId, !concluido);
    if (res.ok) loadChecklist();
  };

  const handleStep1ToggleConcluido = async (itemId: string, concluido: boolean) => {
    setSavingStep1ItemId(itemId);
    const res = await updateStep1AreaChecklistConcluido(itemId, !concluido);
    setSavingStep1ItemId(null);
    if (res.ok) loadStep1AreasChecklist();
    else alert(res.error);
  };

  const handleStep1UpdateLink = async (itemId: string, linkUrl: string) => {
    setSavingStep1ItemId(itemId);
    const res = await updateStep1AreaChecklistLink(itemId, linkUrl || null);
    setSavingStep1ItemId(null);
    if (!res.ok) alert(res.error);
  };

  const handleUploadStep3Opcao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!step3UploadFile) return;

    setStep3Uploading(true);
    try {
      const formData = new FormData();
      formData.append('processoId', processoId);
      formData.append('file', step3UploadFile);

      const res = await fetch('/api/step-3/upload-modal', {
        method: 'POST',
        body: formData,
      });

      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Erro ao enviar documento da Opção.');
      }

      setStep3UploadFile(null);
      await loadStep3Opcoes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao enviar documento da Opção.');
    } finally {
      setStep3Uploading(false);
    }
  };

  const handleUploadStep7Contrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!step7UploadFile) return;

    setStep7Uploading(true);
    try {
      const formData = new FormData();
      formData.append('processoId', processoId);
      formData.append('file', step7UploadFile);

      const res = await fetch('/api/step-7/upload-modal', {
        method: 'POST',
        body: formData,
      });

      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Erro ao enviar documento da Contrato.');
      }

      setStep7UploadFile(null);
      await loadStep7Contrato();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao enviar documento da Contrato.');
    } finally {
      setStep7Uploading(false);
    }
  };

  const handleUploadChecklistLegalFiles = async (fieldKey: string, selected: File[] | null) => {
    if (!selected || selected.length === 0) return;
    const MAX_BYTES = 10 * 1024 * 1024;
    for (const f of selected) {
      if (f.size > MAX_BYTES) {
        alert('Arquivo muito grande. O limite é 10MB por arquivo.');
        return;
      }
      const name = String(f.name ?? '').toLowerCase();
      const isPdf = f.type.includes('pdf') || name.endsWith('.pdf');
      if (!isPdf) {
        alert('Formato inválido. Envie apenas PDF.');
        return;
      }
    }
    const formData = new FormData();
    formData.append('processoId', processoId);
    formData.append('fieldKey', fieldKey);
    for (const f of selected) formData.append('files', f);

    const res = await fetch('/api/checklist-legal/upload', {
      method: 'POST',
      body: formData,
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; files?: ChecklistLegalFileMeta[] } | null;
    if (!res.ok || !json?.ok || !Array.isArray(json.files)) {
      throw new Error(json?.error ?? 'Erro ao enviar arquivo.');
    }

    setChecklistLegalArquivos((prev) => ({
      ...prev,
      [fieldKey]: json.files,
    }));
  };

  const persistChecklistLegalDraft = async () => {
    const r = await saveChecklistLegalDraft(processoId, checklistLegalRespostas, checklistLegalArquivos);
    if (!r.ok) throw new Error(r.error);

    // assim que salvar um rascunho pela primeira vez, passa a ser "do card"
    if (!checklistLegalHasOwnRecord) setChecklistLegalHasOwnRecord(true);
    setChecklistLegalRecord((prev) =>
      prev
        ? { ...prev, respostas_json: checklistLegalRespostas, arquivos_json: checklistLegalArquivos, completo: checklistLegalCompleto, updated_at: new Date().toISOString() }
        : {
            processo_id: processoId,
            nome_condominio: resumo?.nome_condominio ?? '',
            respostas_json: checklistLegalRespostas,
            arquivos_json: checklistLegalArquivos,
            completo: checklistLegalCompleto,
            updated_at: new Date().toISOString(),
          },
    );
  };

  const handleConcluirChecklistLegal = async () => {
    const r = await concluirChecklistLegal(processoId, checklistLegalRespostas, checklistLegalArquivos);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    setChecklistLegalDrawerOpen(false);
    await loadChecklistLegal();
  };

  const goChecklistLegalPage = async (targetPage: number) => {
    try {
      setChecklistLegalDrawerSaving(true);
      await persistChecklistLegalDraft();
      setChecklistLegalDrawerPage(targetPage);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar rascunho do Checklist Legal.');
    } finally {
      setChecklistLegalDrawerSaving(false);
    }
  };

  const handleChangeChecklistStatus = async (
    itemId: string,
    status: 'nao_iniciada' | 'em_andamento' | 'concluido',
  ) => {
    setUpdatingChecklistStatusId(itemId);
    const res = await updateChecklistItemStatus(itemId, status);
    setUpdatingChecklistStatusId(null);
    if (res.ok) loadChecklist();
    else alert(res.error);
  };

  const salvarDadosPreObraParcial = async (patch: Partial<typeof dadosPreObraForm>) => {
    const merged = { ...dadosPreObraForm, ...patch };
    const res = await updateDadosPreObra(processoId, {
      previsao_aprovacao_condominio: merged.previsao_aprovacao_condominio || null,
      previsao_aprovacao_prefeitura: merged.previsao_aprovacao_prefeitura || null,
      previsao_emissao_alvara: merged.previsao_emissao_alvara || null,
      data_aprovacao_condominio: merged.data_aprovacao_condominio || null,
      data_aprovacao_prefeitura: merged.data_aprovacao_prefeitura || null,
      data_emissao_alvara: merged.data_emissao_alvara || null,
      data_aprovacao_credito: merged.data_aprovacao_credito || null,
      previsao_liberacao_credito_obra: merged.previsao_liberacao_credito_obra || null,
      previsao_inicio_obra: merged.previsao_inicio_obra || null,
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setDadosPreObraForm(merged);
  };

  const handleRemoveChecklist = async (itemId: string) => {
    const res = await removeChecklistItem(itemId);
    if (res.ok) loadChecklist();
  };

  const indiceAtual = useMemo(
    () => PAINEL_COLUMNS.findIndex((c) => c.key === etapaAtual),
    [etapaAtual],
  );

  const isColunaPermitida = (key: PainelColumnKey) => {
    if (key === 'credito_terreno' && tipoAquisicaoTerreno === 'Permuta') return false;
    return true;
  };

  const podeFinalizarStep1 = etapaAtual === 'step_1' && status !== 'concluido';

  const handleFinalizarStep1 = async () => {
    if (!podeFinalizarStep1) return;
    if (!confirm('Finalizar este estudo Step 1? Ele poderá ser usado no Step 2.')) return;
    setLoadingFinalizar(true);
    const result = await finalizarEstudoStep1(processoId);
    setLoadingFinalizar(false);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  const etapaAnterior: PainelColumnKey | null = useMemo(() => {
    // Step 2 (Novo Negócio) não pode voltar para etapa anterior
    if (etapaAtual === 'step_2') return null;
    for (let i = indiceAtual - 1; i >= 0; i -= 1) {
      const k = PAINEL_COLUMNS[i]?.key as PainelColumnKey | undefined;
      if (k && isColunaPermitida(k)) return k;
    }
    return null;
  }, [indiceAtual, etapaAtual]);

  const proximaEtapa: PainelColumnKey | null = useMemo(() => {
    // Step 1 não pode avançar para Step 2 (cards permanecem no Step 1)
    if (etapaAtual === 'step_1') return null;
    for (let i = indiceAtual + 1; i < PAINEL_COLUMNS.length; i += 1) {
      const k = PAINEL_COLUMNS[i]?.key as PainelColumnKey | undefined;
      if (k && isColunaPermitida(k)) return k;
    }
    return null;
  }, [indiceAtual, etapaAtual]);

  const step3Signed = useMemo(
    () => step3Instances.some((inst) => inst.status === 'assinado' || Boolean(inst.arquivo_assinado_path)),
    [step3Instances],
  );

  const step7Signed = useMemo(
    () => step7Instances.some((inst) => inst.status === 'assinado' || Boolean(inst.arquivo_assinado_path)),
    [step7Instances],
  );

  const podeAvancarEtapa = useMemo(() => {
    if (!proximaEtapa) return false;
    if (etapaAtual === 'step_3' || etapaAtual === 'credito_terreno') return step3Signed;
    if (etapaAtual === 'step_7') return step7Signed;
    return true;
  }, [proximaEtapa, etapaAtual, step3Signed, step7Signed]);

  const handleMoverEtapa = async (direction: 'prev' | 'next') => {
    if (direction === 'prev' && etapaAtual === 'step_2') return;
    const destino = direction === 'prev' ? etapaAnterior : proximaEtapa;
    if (!destino || destino === etapaAtual) return;

    if (direction === 'next' && !podeAvancarEtapa) {
      const msg =
        etapaAtual === 'step_3' || etapaAtual === 'credito_terreno'
          ? 'Para avançar, anexe ao menos uma Minuta de Opção assinada.'
          : etapaAtual === 'step_7'
            ? 'Para avançar, anexe ao menos um Contrato assinado.'
            : 'Para avançar, conclua a seção exigida.';
      alert(msg);
      return;
    }

    const res = await atualizarEtapaPainel(processoId, destino);
    if (res.ok) {
      setEtapaAtual(destino);
      if (tab === 'checklist') {
        await loadChecklist();
      }
      if (tab === 'documentos') {
        await loadDocumentos();
      }
      router.refresh();
    }
  };

  const formatDate = (val: string | null | undefined) => {
    if (!val) return '—';
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('pt-BR');
  };
  const show = (val: string | null | undefined) => (val && String(val).trim() ? String(val) : '—');
  const parsePrazoBrOrIso = (prazo: string | null | undefined): Date | null => {
    if (!prazo) return null;
    const raw = String(prazo).trim();
    if (!raw) return null;
    const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) {
      const [, dd, mm, yyyy] = br;
      const d = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
      return Number.isFinite(d.getTime()) ? d : null;
    }
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const d = new Date(`${raw}T12:00:00`);
      return Number.isFinite(d.getTime()) ? d : null;
    }
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : null;
  };
  const getPrazoTag = (
    prazo: string | null | undefined,
    status: 'nao_iniciada' | 'em_andamento' | 'concluido',
    concluido?: boolean,
  ) => {
    if (concluido || status === 'concluido') return null;
    const data = parsePrazoBrOrIso(prazo);
    if (!data) return null;
    const hoje = new Date();
    const hojeDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const amanhaDia = new Date(hojeDia.getFullYear(), hojeDia.getMonth(), hojeDia.getDate() + 1);
    const prazoDia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
    if (prazoDia.getTime() < hojeDia.getTime()) return 'atrasado' as const;
    if (prazoDia.getTime() === amanhaDia.getTime()) return 'atencao' as const;
    return null;
  };

  const parsePrazoOrdenacao = (prazo: string | null | undefined): number => {
    if (!prazo) return Number.POSITIVE_INFINITY;
    const raw = String(prazo).trim();
    const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) {
      const [, dd, mm, yyyy] = br;
      const d = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
      const t = d.getTime();
      return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
    }
    const d = new Date(raw);
    const t = d.getTime();
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  };

  const checklistItensFiltradosOrdenados = useMemo(() => {
    const filtrados = checklistItens.filter((item) => {
      if (filtroChecklistStatus !== 'todos' && item.status !== filtroChecklistStatus) return false;
      if (!itemMatchesTimeFilter(item.times_nomes, item.time_nome, filtroChecklistTime)) return false;
      if (!itemMatchesResponsavelFilter(item.responsaveis_nomes, item.responsavel_nome, filtroChecklistResponsavel)) {
        return false;
      }
      return true;
    });

    const copy = [...filtrados];
    copy.sort((a, b) => {
      if (ordenacaoChecklist === 'responsavel') {
        const ar = (a.responsavel_nome ?? '').trim() || 'Sem responsável';
        const br = (b.responsavel_nome ?? '').trim() || 'Sem responsável';
        const c = ar.localeCompare(br, 'pt-BR', { sensitivity: 'base' });
        if (c !== 0) return c;
        return parsePrazoOrdenacao(a.prazo) - parsePrazoOrdenacao(b.prazo);
      }
      const cPrazo = parsePrazoOrdenacao(a.prazo) - parsePrazoOrdenacao(b.prazo);
      if (cPrazo !== 0) return cPrazo;
      const ar = (a.responsavel_nome ?? '').trim() || 'Sem responsável';
      const br = (b.responsavel_nome ?? '').trim() || 'Sem responsável';
      return ar.localeCompare(br, 'pt-BR', { sensitivity: 'base' });
    });
    return copy;
  }, [checklistItens, filtroChecklistStatus, filtroChecklistTime, filtroChecklistResponsavel, ordenacaoChecklist]);

  const checklistResponsaveisPorFiltro = useMemo(() => {
    const timeKey = filtroChecklistTime === 'todos' ? null : filtroChecklistTime;
    const base =
      timeKey === null ? Object.values(RESPONSAVEIS_POR_TIME).flat() : (RESPONSAVEIS_POR_TIME[timeKey] ?? []);

    const fromItems = new Set<string>();
    for (const it of checklistItens) {
      if (timeKey && !itemMatchesTimeFilter(it.times_nomes, it.time_nome, timeKey)) continue;
      const rs =
        it.responsaveis_nomes.length > 0
          ? it.responsaveis_nomes
          : (it.responsavel_nome ?? '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
      for (const r of rs) fromItems.add(r);
    }

    const normalized = new Set(base.map((x) => x.trim()).filter(Boolean));
    for (const r of fromItems) normalized.add(r);

    return Array.from(normalized).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [checklistItens, filtroChecklistTime]);

  const checklistResponsaveisParaNovo = useMemo(() => {
    const base = new Set<string>();
    if (novoChecklistTimes.length === 0) {
      for (const arr of Object.values(RESPONSAVEIS_POR_TIME)) {
        for (const x of arr) base.add(x.trim());
      }
    } else {
      for (const tk of novoChecklistTimes) {
        for (const x of RESPONSAVEIS_POR_TIME[tk] ?? []) base.add(x.trim());
      }
    }

    for (const it of checklistItens) {
      if (novoChecklistTimes.length > 0) {
        const itTimes =
          it.times_nomes.length > 0
            ? it.times_nomes
            : (it.time_nome ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        if (!itTimes.some((t) => novoChecklistTimes.includes(t))) continue;
      }
      const rs =
        it.responsaveis_nomes.length > 0
          ? it.responsaveis_nomes
          : (it.responsavel_nome ?? '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
      for (const r of rs) {
        if (r.trim()) base.add(r.trim());
      }
    }

    return Array.from(base).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [checklistItens, novoChecklistTimes]);

  const checklistResponsaveisParaEdicao = useMemo(() => {
    const selTimes = atividadeEdicao?.times ?? [];
    const base = new Set<string>();
    if (selTimes.length === 0) {
      for (const arr of Object.values(RESPONSAVEIS_POR_TIME)) {
        for (const x of arr) base.add(x.trim());
      }
    } else {
      for (const tk of selTimes) {
        for (const x of RESPONSAVEIS_POR_TIME[tk] ?? []) base.add(x.trim());
      }
    }
    for (const it of checklistItens) {
      if (selTimes.length > 0) {
        const itTimes =
          it.times_nomes.length > 0
            ? it.times_nomes
            : (it.time_nome ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        if (!itTimes.some((t) => selTimes.includes(t))) continue;
      }
      const rs =
        it.responsaveis_nomes.length > 0
          ? it.responsaveis_nomes
          : (it.responsavel_nome ?? '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
      for (const r of rs) {
        if (r.trim()) base.add(r.trim());
      }
    }
    return Array.from(base).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [checklistItens, atividadeEdicao?.times]);

  useEffect(() => {
    if (filtroChecklistResponsavel === 'todos') return;
    if (!checklistResponsaveisPorFiltro.includes(filtroChecklistResponsavel)) {
      setFiltroChecklistResponsavel('todos');
    }
  }, [checklistResponsaveisPorFiltro, filtroChecklistResponsavel]);

  useEffect(() => {
    if (novoChecklistResponsaveis.length === 0) return;
    if (checklistResponsaveisParaNovo.length === 0) return;
    setNovoChecklistResponsaveis((prev) => prev.filter((r) => checklistResponsaveisParaNovo.includes(r)));
  }, [checklistResponsaveisParaNovo, novoChecklistTimes]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex h-[88vh] w-[min(96vw,1200px)] max-w-[1200px] flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3">
          <div>
            <h2 className="font-semibold text-stone-900">{processoLabel}</h2>
            <p className="text-xs text-stone-500">Dados, comentários, atividades, checklist e documentos</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setMotivo('');
                setMotivoCancelamento('');
                setMotivoCancelamentoOutro('');
                setMotivoReprovacaoComite('');
                setMotivoReprovacaoOutro('');
                setObservacaoCancelamento('');
                setConfirmOpen('cancelar');
              }}
              className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100"
            >
              Cancelar…
            </button>
            <button
              type="button"
              onClick={() => {
                setMotivo('');
                setConfirmOpen('remover');
              }}
              className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
            >
              Remover…
            </button>
            {podeFinalizarStep1 && (
              <button
                type="button"
                onClick={handleFinalizarStep1}
                disabled={loadingFinalizar}
                className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs text-green-800 hover:bg-green-100 disabled:opacity-50"
              >
                {loadingFinalizar ? 'Finalizando…' : 'Finalizar estudo'}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleMoverEtapa('prev')}
              disabled={!etapaAnterior}
              className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100 disabled:opacity-40"
            >
              ← Voltar etapa
            </button>
            <button
              type="button"
              onClick={() => handleMoverEtapa('next')}
              disabled={!proximaEtapa || !podeAvancarEtapa}
              className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100 disabled:opacity-40"
              title={
                !proximaEtapa
                  ? 'Etapa final'
                  : podeAvancarEtapa
                    ? ''
                    : etapaAtual === 'step_3' || etapaAtual === 'credito_terreno'
                      ? 'Avance após anexar ao menos uma Minuta de Opção assinada.'
                      : etapaAtual === 'step_7'
                        ? 'Avance após anexar ao menos um Contrato assinado.'
                        : ''
              }
            >
              Avançar etapa →
            </button>
            <button
              type="button"
              disabled
              title="Em breve"
              className="cursor-not-allowed rounded border border-stone-200 bg-stone-100 px-2 py-1 text-xs text-stone-400"
            >
              Abrir processo
            </button>
            <button type="button" onClick={onClose} className="rounded p-1.5 text-stone-500 hover:bg-stone-200">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {confirmOpen && (
          <div className="border-b border-stone-200 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-stone-800">
              {confirmOpen === 'cancelar'
                ? 'Cancelar card (desistiu de ser franqueado)'
                : 'Remover card (criado errado)'}
            </p>
            <p className="mt-1 text-xs text-stone-600">
              {confirmOpen === 'cancelar'
                ? 'Preencha os motivos obrigatórios. Observações adicionais são opcionais.'
                : 'Informe o motivo (obrigatório).'}
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {confirmOpen === 'cancelar' ? (
                <>
                  <label className="text-xs font-medium text-stone-700">Motivo do cancelamento</label>
                  <select
                    value={motivoCancelamento}
                    onChange={(e) => setMotivoCancelamento(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  >
                    <option value="">Selecione…</option>
                    {MOTIVOS_CANCELAMENTO.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  {motivoCancelamento === 'Outro' && (
                    <textarea
                      value={motivoCancelamentoOutro}
                      onChange={(e) => setMotivoCancelamentoOutro(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                      placeholder="Descreva o motivo (Outro)…"
                    />
                  )}
                  {precisaMotivoReprovacaoCancel && (
                    <>
                      <label className="text-xs font-medium text-stone-700">Motivo de reprovação em comitê</label>
                      <select
                        value={motivoReprovacaoComite}
                        onChange={(e) => setMotivoReprovacaoComite(e.target.value)}
                        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                      >
                        <option value="">Selecione…</option>
                        {MOTIVOS_REPROVACAO_COMITE.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      {motivoReprovacaoComite === 'Outro' && (
                        <textarea
                          value={motivoReprovacaoOutro}
                          onChange={(e) => setMotivoReprovacaoOutro(e.target.value)}
                          rows={2}
                          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                          placeholder="Descreva (Outro)…"
                        />
                      )}
                    </>
                  )}
                  <label className="text-xs font-medium text-stone-700">Observações (opcional)</label>
                  <textarea
                    value={observacaoCancelamento}
                    onChange={(e) => setObservacaoCancelamento(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    placeholder="Detalhes adicionais…"
                  />
                </>
              ) : (
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                  placeholder="Descreva o motivo..."
                />
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (confirmOpen === 'cancelar') {
                      if (!motivoCancelamento) return;
                      if (motivoCancelamento === 'Outro' && !motivoCancelamentoOutro.trim()) return;
                      if (precisaMotivoReprovacaoCancel) {
                        if (!motivoReprovacaoComite) return;
                        if (motivoReprovacaoComite === 'Outro' && !motivoReprovacaoOutro.trim()) return;
                      }
                    } else if (!motivo.trim()) return;
                    setLoadingMotivo(true);
                    const res =
                      confirmOpen === 'cancelar'
                        ? await cancelarProcessoPainel(processoId, {
                            motivoCancelamento: motivoCancelamento as (typeof MOTIVOS_CANCELAMENTO)[number],
                            motivoCancelamentoOutro: motivoCancelamentoOutro.trim() || null,
                            motivoReprovacaoComite: precisaMotivoReprovacaoCancel
                              ? (motivoReprovacaoComite as (typeof MOTIVOS_REPROVACAO_COMITE)[number])
                              : null,
                            motivoReprovacaoOutro: motivoReprovacaoOutro.trim() || null,
                            observacao: observacaoCancelamento.trim() || null,
                          })
                        : await removerProcessoPainel(processoId, motivo);
                    setLoadingMotivo(false);
                    if (res.ok) {
                      setConfirmOpen(null);
                      router.refresh();
                      onClose();
                    } else if (!res.ok) {
                      window.alert(res.error);
                    }
                  }}
                  disabled={
                    loadingMotivo ||
                    (confirmOpen === 'cancelar'
                      ? !motivoCancelamento ||
                        (motivoCancelamento === 'Outro' && !motivoCancelamentoOutro.trim()) ||
                        (precisaMotivoReprovacaoCancel &&
                          (!motivoReprovacaoComite ||
                            (motivoReprovacaoComite === 'Outro' && !motivoReprovacaoOutro.trim())))
                      : !motivo.trim())
                  }
                  className="rounded-lg bg-moni-primary px-3 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-50"
                >
                  {loadingMotivo ? 'Salvando…' : 'Confirmar'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(null)}
                  disabled={loadingMotivo}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-b border-stone-200">
          <div className="flex items-center">
            {(
              [
                { key: 'dados', label: 'Dados' },
                { key: 'comentarios', label: 'Comentários' },
                { key: 'checklist_step1', label: 'Checklist/Anexos' },
                { key: 'checklist', label: 'Atividades' },
                { key: 'documentos', label: 'Documentos' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium ${
                  tab === t.key ? 'border-b-2 border-moni-primary text-moni-primary' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {t.key === 'dados' && <FileText className="h-4 w-4" />}
                {t.key === 'comentarios' && <MessageSquare className="h-4 w-4" />}
                {(t.key === 'checklist' || t.key === 'checklist_step1') && <CheckSquare className="h-4 w-4" />}
                {t.key === 'documentos' && <Paperclip className="h-4 w-4" />}
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setTab('checklist_history')}
            className={`ml-auto flex items-center gap-1.5 border-l px-4 py-2 text-sm font-medium ${
              tab === 'checklist_history'
                ? 'border-moni-accent bg-moni-accent/15 border-b-2 text-moni-accent'
                : 'border-moni-accent/30 bg-moni-accent/8 text-moni-accent hover:bg-moni-accent/15'
            }`}
          >
            <History className="h-4 w-4" />
            Hist. Checklist/Anexos
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
          {tab === 'dados' && resumo && (
            <div className="mb-4 space-y-3">
              {(etapaAtual === 'contabilidade_incorporadora' ||
                etapaAtual === 'contabilidade_spe' ||
                etapaAtual === 'contabilidade_gestora') && (
                <div className="rounded-lg border border-stone-200 bg-amber-50/40 p-3">
                  <p className="text-xs font-semibold text-stone-700">Fase no dashboard (Contabilidade)</p>
                  <p className="mt-0.5 text-[11px] text-stone-500">
                    Usada nos gráficos do Dashboard Novos Negócios. Ao mover o card entre colunas, a fase alinha
                    automaticamente; ajuste aqui para &quot;Em andamento&quot; ou &quot;Encerrado&quot;.
                  </p>
                  <select
                    disabled={savingFaseDashboard}
                    value={(resumo as { fase_contabilidade?: string | null }).fase_contabilidade ?? ''}
                    onChange={async (e) => {
                      const v = e.target.value as (typeof FASES_CONTABILIDADE_DASHBOARD)[number];
                      if (!v) return;
                      setSavingFaseDashboard(true);
                      const res = await atualizarFaseContabilidadeDashboard(processoId, v);
                      const r2 = await getResumoProcessoStep1(processoId);
                      if (r2.ok) setResumo(r2.data);
                      setSavingFaseDashboard(false);
                      if (!res.ok) window.alert(res.error);
                    }}
                    className="mt-2 w-full max-w-md rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {FASES_CONTABILIDADE_DASHBOARD.map((k) => (
                      <option key={k} value={k}>
                        {k === 'abertura_incorporadora'
                          ? 'Abertura Incorporadora'
                          : k === 'abertura_spe'
                            ? 'Abertura SPE'
                            : k === 'abertura_gestora'
                              ? 'Abertura Gestora'
                              : k === 'em_andamento'
                                ? 'Em andamento'
                                : 'Encerrado'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(etapaAtual === 'credito_terreno' || etapaAtual === 'credito_obra') && (
                <div className="rounded-lg border border-stone-200 bg-sky-50/40 p-3">
                  <p className="text-xs font-semibold text-stone-700">Fase no dashboard (Crédito)</p>
                  <p className="mt-0.5 text-[11px] text-stone-500">
                    Usada nos gráficos do Dashboard Novos Negócios. Ajuste para Crédito aprovado ou Encerrado quando
                    aplicável.
                  </p>
                  <select
                    disabled={savingFaseDashboard}
                    value={(resumo as { fase_credito?: string | null }).fase_credito ?? ''}
                    onChange={async (e) => {
                      const v = e.target.value as (typeof FASES_CREDITO_DASHBOARD)[number];
                      if (!v) return;
                      setSavingFaseDashboard(true);
                      const res = await atualizarFaseCreditoDashboard(processoId, v);
                      const r2 = await getResumoProcessoStep1(processoId);
                      if (r2.ok) setResumo(r2.data);
                      setSavingFaseDashboard(false);
                      if (!res.ok) window.alert(res.error);
                    }}
                    className="mt-2 w-full max-w-md rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {FASES_CREDITO_DASHBOARD.map((k) => (
                      <option key={k} value={k}>
                        {k === 'check_legal_mais_credito'
                          ? 'Check Legal + Crédito'
                          : k === 'contratacao_credito'
                            ? 'Contratação Crédito'
                            : k === 'credito_aprovado'
                              ? 'Crédito Aprovado'
                              : 'Encerrado'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-stone-700">Dados do Franqueado</p>
                  <button
                    type="button"
                    onClick={() =>
                      setDadosCollapsed((prev) => ({
                        ...prev,
                        franqueado: !prev.franqueado,
                      }))
                    }
                    className="text-xs font-medium text-moni-accent hover:underline"
                  >
                    {dadosCollapsed.franqueado ? 'Expandir' : 'Recolher'}
                  </button>
                </div>

                {!dadosCollapsed.franqueado ? (
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <span className="text-xs text-stone-500">Nº franquia</span>
                      <div className="text-stone-800">{show(resumo.numero_franquia)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Modalidade</span>
                      <div className="text-stone-800">{show(resumo.modalidade)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Nome</span>
                      <div className="text-stone-800">{show(resumo.nome_franqueado)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Status</span>
                      <div className="text-stone-800">{show(resumo.status_franquia)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Classificação</span>
                      <div className="text-stone-800">{show(resumo.classificacao_franqueado)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Área de atuação</span>
                      <div className="text-stone-800">{show(resumo.area_atuacao_franquia)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">E-mail</span>
                      <div className="text-stone-800">{show(resumo.email_franqueado)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Telefone</span>
                      <div className="text-stone-800">{show(resumo.telefone_frank)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">CPF</span>
                      <div className="text-stone-800">
                        <span className="blur-[7px] select-none text-stone-500" aria-hidden="true">
                          {show(resumo.cpf_frank)}
                        </span>
                        <span className="sr-only">{show(resumo.cpf_frank)}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Nascimento</span>
                      <div className="text-stone-800">
                        <span className="blur-[7px] select-none text-stone-500" aria-hidden="true">
                          {formatDate(resumo.data_nasc_frank)}
                        </span>
                        <span className="sr-only">{formatDate(resumo.data_nasc_frank)}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Responsável comercial</span>
                      <div className="text-stone-800">{show(resumo.responsavel_comercial)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Camiseta</span>
                      <div className="text-stone-800">
                        <span className="blur-[7px] select-none text-stone-500" aria-hidden="true">
                          {show(resumo.tamanho_camiseta_frank)}
                        </span>
                        <span className="sr-only">{show(resumo.tamanho_camiseta_frank)}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Ass. COF</span>
                      <div className="text-stone-800">{formatDate(resumo.data_ass_cof)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Ass. Contrato</span>
                      <div className="text-stone-800">{formatDate(resumo.data_ass_contrato)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Expiração</span>
                      <div className="text-stone-800">{formatDate(resumo.data_expiracao_franquia)}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs text-stone-500">Endereço (casa)</span>
                      <div className="text-stone-800">
                        {[
                          show(resumo.endereco_casa_frank),
                          show(resumo.endereco_casa_frank_numero),
                          show(resumo.endereco_casa_frank_complemento),
                          show(resumo.cidade_casa_frank),
                          show(resumo.estado_casa_frank),
                          show(resumo.cep_casa_frank),
                        ]
                          .filter((v) => v !== '—')
                          .join(' · ') || '—'}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs text-stone-500">Sócios</span>
                      <div className="whitespace-pre-wrap text-stone-800">{show(resumo.socios)}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs text-stone-500">Observações</span>
                      <div className="whitespace-pre-wrap text-stone-800">{show(resumo.observacoes)}</div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-stone-700">Dados do Novo Negócio</p>
                  <button
                    type="button"
                    onClick={() =>
                      setDadosCollapsed((prev) => ({
                        ...prev,
                        novoNegocio: !prev.novoNegocio,
                      }))
                    }
                    className="text-xs font-medium text-moni-accent hover:underline"
                  >
                    {dadosCollapsed.novoNegocio ? 'Expandir' : 'Recolher'}
                  </button>
                </div>

                {!dadosCollapsed.novoNegocio ? (
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <span className="text-xs text-stone-500">Nº franquia</span>
                      <div className="text-stone-800">{show(resumo.numero_franquia)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Nome do franqueado</span>
                      <div className="text-stone-800">{show(resumo.nome_franqueado)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">E-mail</span>
                      <div className="text-stone-800">{show(resumo.email_franqueado)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Estado (UF)</span>
                      <div className="text-stone-800">{show(resumo.estado)}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs text-stone-500">Cidade</span>
                      <div className="text-stone-800">{show(resumo.cidade)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Tipo de negociação</span>
                      <div className="text-stone-800">{show(resumo.tipo_aquisicao_terreno)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Valor do Terreno</span>
                      <div className="text-stone-800">{show(resumo.valor_terreno)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">VGV pretendido</span>
                      <div className="text-stone-800">{show(resumo.vgv_pretendido)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500">Produto / Modelo</span>
                      <div className="text-stone-800">{show(resumo.produto_modelo_casa)}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs text-stone-500">Link pasta no Drive</span>
                      <div className="break-all text-stone-800">{show(resumo.link_pasta_drive)}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs text-stone-500">Nome do Condomínio</span>
                      <div className="text-stone-800">{show(resumo.nome_condominio)}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs text-stone-500">Quadra / Lote</span>
                      <div className="text-stone-800">{show(resumo.quadra_lote)}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs text-stone-500">Observações</span>
                      <div className="whitespace-pre-wrap text-stone-800">{show(resumo.observacoes)}</div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-stone-700">Dados Pré Obra</p>
                  <button
                    type="button"
                    onClick={() =>
                      setDadosCollapsed((prev) => ({
                        ...prev,
                        preObra: !prev.preObra,
                      }))
                    }
                    className="text-xs font-medium text-moni-accent hover:underline"
                  >
                    {dadosCollapsed.preObra ? 'Expandir' : 'Recolher'}
                  </button>
                </div>

                {!dadosCollapsed.preObra ? (
                  <div className="mt-2 space-y-3">
                    <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-stone-500">Previsão de Aprovação no Condomínio</label>
                        <input
                          type="text"
                          value={dadosPreObraForm.previsao_aprovacao_condominio}
                          onChange={(e) =>
                            setDadosPreObraForm((prev) => ({
                              ...prev,
                              previsao_aprovacao_condominio: e.target.value,
                            }))
                          }
                          placeholder="Ex.: 20/04/2026"
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-stone-500">Previsão de Aprovação na Prefeitura</label>
                        <input
                          type="text"
                          value={dadosPreObraForm.previsao_aprovacao_prefeitura}
                          onChange={(e) =>
                            setDadosPreObraForm((prev) => ({
                              ...prev,
                              previsao_aprovacao_prefeitura: e.target.value,
                            }))
                          }
                          placeholder="Ex.: 30/04/2026"
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-stone-500">Previsão de Emissão do Alvará</label>
                        <input
                          type="text"
                          value={dadosPreObraForm.previsao_emissao_alvara}
                          onChange={(e) =>
                            setDadosPreObraForm((prev) => ({
                              ...prev,
                              previsao_emissao_alvara: e.target.value,
                            }))
                          }
                          placeholder="Ex.: 15/05/2026"
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500">Data de Aprovação no Condomínio</label>
                        <input
                          type="date"
                          value={dadosPreObraForm.data_aprovacao_condominio}
                          onChange={(e) =>
                            setDadosPreObraForm((prev) => ({
                              ...prev,
                              data_aprovacao_condominio: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500">Data de Aprovação na Prefeitura</label>
                        <input
                          type="date"
                          value={dadosPreObraForm.data_aprovacao_prefeitura}
                          onChange={(e) =>
                            setDadosPreObraForm((prev) => ({
                              ...prev,
                              data_aprovacao_prefeitura: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-stone-500">Data de Emissão do Alvará</label>
                        <input
                          type="date"
                          value={dadosPreObraForm.data_emissao_alvara}
                          onChange={(e) =>
                            setDadosPreObraForm((prev) => ({
                              ...prev,
                              data_emissao_alvara: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-stone-500">Data de aprovação do crédito</label>
                        <input
                          type="date"
                          value={dadosPreObraForm.data_aprovacao_credito}
                          onChange={(e) =>
                            setDadosPreObraForm((prev) => ({
                              ...prev,
                              data_aprovacao_credito: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-stone-500">Previsão de Liberação do Crédito para Obra</label>
                        <input
                          type="text"
                          value={dadosPreObraForm.previsao_liberacao_credito_obra}
                          onChange={(e) =>
                            setDadosPreObraForm((prev) => ({
                              ...prev,
                              previsao_liberacao_credito_obra: e.target.value,
                            }))
                          }
                          placeholder="Ex.: 25/05/2026"
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-stone-500">Previsão de Início de Obra</label>
                        <input
                          type="text"
                          value={dadosPreObraForm.previsao_inicio_obra}
                          onChange={(e) =>
                            setDadosPreObraForm((prev) => ({
                              ...prev,
                              previsao_inicio_obra: e.target.value,
                            }))
                          }
                          placeholder="Ex.: 10/06/2026"
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSalvarDadosPreObra}
                        disabled={savingDadosPreObra}
                        className="rounded bg-moni-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-60"
                      >
                        {savingDadosPreObra ? 'Salvando…' : 'Salvar Dados Pré Obra'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-stone-700">Relacionamentos</p>
                  <button
                    type="button"
                    onClick={() =>
                      setDadosCollapsed((prev) => ({
                        ...prev,
                        relacionados: !prev.relacionados,
                      }))
                    }
                    className="text-xs font-medium text-moni-accent hover:underline"
                  >
                    {dadosCollapsed.relacionados ? 'Expandir' : 'Recolher'}
                  </button>
                </div>

                {!dadosCollapsed.relacionados ? (
                  <div className="mt-2 space-y-3 text-sm">
                    {relacionados.pai ? (
                      <div className="rounded border border-stone-200 bg-white p-2">
                        <p className="text-xs font-semibold text-stone-600">Card pai</p>
                        <a
                          href={getLinkForRelatedCard(relacionados.pai)}
                          className="mt-1 inline-flex items-center text-moni-accent hover:underline"
                        >
                          {(relacionados.pai.numero_franquia ?? '—') + ' · ' + (relacionados.pai.nome_condominio ?? relacionados.pai.cidade ?? 'Sem identificação')}
                        </a>
                      </div>
                    ) : null}

                    {relacionados.filhos.length > 0 ? (
                      <div className="rounded border border-stone-200 bg-white p-2">
                        <p className="text-xs font-semibold text-stone-600">Cards filhos</p>
                        <div className="mt-1 flex flex-col gap-1">
                          {relacionados.filhos.map((f) => (
                            <a key={f.id} href={getLinkForRelatedCard(f)} className="text-moni-accent hover:underline">
                              {(f.numero_franquia ?? '—') + ' · ' + (f.nome_condominio ?? f.cidade ?? 'Sem identificação')}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {relacionados.irmaos.length > 0 ? (
                      <div className="rounded border border-stone-200 bg-white p-2">
                        <p className="text-xs font-semibold text-stone-600">Outros filhos relacionados</p>
                        <div className="mt-1 flex flex-col gap-1">
                          {relacionados.irmaos.map((f) => (
                            <a key={f.id} href={getLinkForRelatedCard(f)} className="text-moni-accent hover:underline">
                              {(f.numero_franquia ?? '—') + ' · ' + (f.nome_condominio ?? f.cidade ?? 'Sem identificação')}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {!relacionados.pai && relacionados.filhos.length === 0 && relacionados.irmaos.length === 0 ? (
                      <div className="rounded border border-dashed border-stone-200 bg-white p-3 text-xs text-stone-500">
                        Nenhum card relacionado encontrado.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {tab === 'dados' && resumo && etapaAtual === 'step_4' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-stone-700">Dados para Aprovações</p>
                  <button
                    type="button"
                    onClick={() =>
                      setDadosCollapsed((prev) => ({
                        ...prev,
                        aprovacoes: !prev.aprovacoes,
                      }))
                    }
                    className="text-xs font-medium text-moni-accent hover:underline"
                  >
                    {dadosCollapsed.aprovacoes ? 'Expandir' : 'Recolher'}
                  </button>
                </div>
                {!dadosCollapsed.aprovacoes ? (
                  <div className="mt-2 rounded border border-stone-200 bg-white p-3 text-sm text-stone-700">
                    Dados de aprovações do Checklist Legal seguem disponíveis na aba Checklist/Anexos.
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-stone-700">Dados para Crédito</p>
                  <button
                    type="button"
                    onClick={() =>
                      setDadosCollapsed((prev) => ({
                        ...prev,
                        credito: !prev.credito,
                      }))
                    }
                    className="text-xs font-medium text-moni-accent hover:underline"
                  >
                    {dadosCollapsed.credito ? 'Expandir' : 'Recolher'}
                  </button>
                </div>
                {!dadosCollapsed.credito ? <ChecklistCreditoSection processoId={processoId} showInDados /> : null}
              </div>
            </div>
          )}

          {tab === 'dados' &&
            resumo &&
            (etapaAtual === 'contabilidade_incorporadora' ||
              etapaAtual === 'contabilidade_spe' ||
              etapaAtual === 'contabilidade_gestora') && (
              <div className="space-y-3">
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-stone-700">
                      {etapaAtual === 'contabilidade_incorporadora'
                        ? 'Dados da Incorporadora'
                        : etapaAtual === 'contabilidade_spe'
                          ? 'Dados da SPE'
                          : 'Dados da Gestora'}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setDadosCollapsed((prev) => ({
                          ...prev,
                          contabilidade: !prev.contabilidade,
                        }))
                      }
                      className="text-xs font-medium text-moni-accent hover:underline"
                    >
                      {dadosCollapsed.contabilidade ? 'Expandir' : 'Recolher'}
                    </button>
                  </div>
                  {!dadosCollapsed.contabilidade ? (
                    <div className="mt-2">
                      <ChecklistContabilidadeSection
                        processoId={processoId}
                        entidade={
                          etapaAtual === 'contabilidade_incorporadora'
                            ? 'incorporadora'
                            : etapaAtual === 'contabilidade_spe'
                              ? 'spe'
                              : 'gestora'
                        }
                        showInDados
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            )}

          {tab === 'dados' && !resumo && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
              Carregando dados…
            </div>
          )}
          {tab === 'comentarios' && (
            <div className="space-y-4">
              <div className="space-y-2">
                {comentarios.map((c) => (
                  <div key={c.id} className="rounded-lg border border-stone-200 bg-stone-50 p-2 text-sm">
                    <p className="font-medium text-stone-700">{c.autor_nome ?? 'Anônimo'}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-stone-600">{c.texto}</p>
                    <p className="mt-1 text-[10px] text-stone-400">
                      {new Date(c.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleEnviarComentario} className="flex gap-2">
                <input
                  type="text"
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  placeholder="Comentário (use @nome para mencionar)"
                  className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm"
                />
                <button type="submit" disabled={loadingComentario} className="rounded bg-moni-primary px-3 py-2 text-sm text-white hover:bg-moni-secondary disabled:opacity-50">
                  Enviar
                </button>
              </form>

              <div className="mt-2 rounded-lg border border-stone-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-stone-800">Histórico de ações</h3>
                  {loadingActionsHistory ? (
                    <span className="text-xs text-stone-500">Carregando…</span>
                  ) : (
                    <span className="text-xs text-stone-500">{actionsHistory.length} evento(s)</span>
                  )}
                </div>

                {loadingActionsHistory ? (
                  <p className="mt-2 text-sm text-stone-500">Carregando histórico…</p>
                ) : actionsHistory.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-500">Nenhuma ação registrada ainda.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {actionsHistory.map((e) => (
                      <li key={e.id} className="rounded border border-stone-100 bg-stone-50 p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-stone-800">{e.autor_nome ?? 'Anônimo'}</p>
                          <p className="text-xs text-stone-400">{new Date(e.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                        <p className="mt-1 text-sm text-stone-700">{e.descricao ?? e.tipo}</p>
                        {e.etapa_painel ? <p className="text-xs text-stone-500">Etapa: {e.etapa_painel}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === 'checklist_history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-stone-800">Histórico de Checklist/Anexos</h3>
                {loadingChecklistHistory ? (
                  <span className="text-xs text-stone-500">Carregando…</span>
                ) : (
                  <span className="text-xs text-stone-500">{checklistAnexosHistory.length} evento(s)</span>
                )}
              </div>

              {loadingChecklistHistory ? (
                <p className="text-sm text-stone-500">Carregando histórico…</p>
              ) : checklistAnexosHistory.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
                  Nenhum histórico de checklist/anexos ainda.
                </div>
              ) : (
                <ul className="space-y-2">
                  {checklistAnexosHistory.map((e) => (
                    <li key={e.id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-stone-800">{e.autor_nome ?? 'Anônimo'}</p>
                        <p className="text-xs text-stone-400">{new Date(e.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                      <p className="mt-1 text-stone-700">{e.descricao ?? e.tipo}</p>
                      {e.etapa_painel ? (
                        <p className="mt-1 text-xs text-stone-500">Etapa: {e.etapa_painel}</p>
                      ) : null}
                      {e.tipo === 'checklist_edit' && e.detalhes ? (
                        <details className="mt-2 rounded border border-stone-100 bg-stone-50 p-2 text-xs text-stone-600">
                          <summary className="cursor-pointer font-medium text-stone-700">Ver alterações</summary>
                          {(() => {
                            const antes = e.detalhes.antes as Record<string, unknown> | undefined;
                            const depois = e.detalhes.depois as Record<string, unknown> | undefined;
                            if (!antes || !depois) {
                              return (
                                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">
                                  {JSON.stringify(e.detalhes, null, 2)}
                                </pre>
                              );
                            }
                            const keys = ['titulo', 'prazo', 'times_nomes', 'responsaveis_nomes', 'status'] as const;
                            return (
                              <ul className="mt-2 space-y-1">
                                {keys.map((k) => {
                                  const a = antes[k];
                                  const d = depois[k];
                                  if (JSON.stringify(a) === JSON.stringify(d)) return null;
                                  const fmt = (v: unknown) =>
                                    Array.isArray(v) ? (v as string[]).join(', ') : String(v ?? '—');
                                  return (
                                    <li key={k}>
                                      <span className="font-medium text-stone-700">{k}:</span>{' '}
                                      <span className="text-red-700 line-through">{fmt(a)}</span>
                                      {' → '}
                                      <span className="text-green-800">{fmt(d)}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            );
                          })()}
                        </details>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'checklist_step1' && (
            etapaAtual === 'step_1' ? (
              <div className="space-y-4">
                {(() => {
                  const grouped = step1AreasItens.reduce((acc, item) => {
                    const key = item.area_nome || 'Sem área';
                    const list = acc[key] ?? [];
                    list.push(item);
                    acc[key] = list;
                    return acc;
                  }, {} as Record<string, typeof step1AreasItens>);
                  // Areas removidas da rede devem aparecer no final (vermelho pastel fraco).
                  const orderedAreas = Object.keys(grouped).sort((a, b) => {
                    const aItens = grouped[a] ?? [];
                    const bItens = grouped[b] ?? [];
                    const aAtivo = Boolean(aItens[0]?.ativo_na_rede);
                    const bAtivo = Boolean(bItens[0]?.ativo_na_rede);
                    if (aAtivo !== bAtivo) return aAtivo ? -1 : 1;

                    const ao = aItens[0]?.area_ordem ?? Number.MAX_SAFE_INTEGER;
                    const bo = bItens[0]?.area_ordem ?? Number.MAX_SAFE_INTEGER;
                    if (ao !== bo) return ao - bo;
                    return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
                  });

                  return orderedAreas.map((area) => {
                    const itens = grouped[area];
                    const isAtivoNaRede = Boolean(itens[0]?.ativo_na_rede);
                    const collapsed = Boolean(step1Collapsed[area]);
                    return (
                      <section
                        key={area}
                        className={`rounded-lg border p-3 ${
                          isAtivoNaRede ? 'border-stone-200 bg-white' : 'border-red-200 bg-red-50/50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setStep1Collapsed((prev) => ({ ...prev, [area]: !collapsed }))}
                          className="flex w-full items-center justify-between"
                        >
                          <span
                            className={`text-sm font-semibold ${isAtivoNaRede ? 'text-stone-800' : 'text-red-700'}`}
                          >
                            {area}
                          </span>
                          <span className={`text-xs ${isAtivoNaRede ? 'text-stone-500' : 'text-red-600'}`}>
                            {collapsed ? 'Expandir' : 'Minimizar'}
                          </span>
                        </button>
                        {collapsed ? null : (
                          <div className="mt-3 space-y-2">
                            {itens.map((item) => (
                              <div
                                key={item.id}
                                className={`rounded border p-2 ${
                                  item.concluido
                                    ? 'border-green-200'
                                    : isAtivoNaRede
                                      ? 'border-stone-200'
                                      : 'border-red-200'
                                }`}
                              >
                                <div
                                  className={`text-sm ${
                                    item.concluido
                                      ? 'text-green-700'
                                      : isAtivoNaRede
                                        ? 'text-stone-800'
                                        : 'text-red-700'
                                  }`}
                                >
                                  <label className="inline-flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={item.concluido}
                                      disabled={savingStep1ItemId === item.id}
                                      onChange={() => handleStep1ToggleConcluido(item.id, item.concluido)}
                                      className="h-4 w-4 rounded border-stone-300"
                                    />
                                    <span className={item.concluido ? 'font-medium' : ''}>{item.etapa_nome}</span>
                                  </label>
                                </div>
                                <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_240px]">
                                  <div className="relative">
                                    <input
                                      type="url"
                                      defaultValue={item.link_url ?? ''}
                                      placeholder="https://..."
                                      onBlur={(e) => handleStep1UpdateLink(item.id, e.target.value)}
                                      className={`w-full rounded border px-2 py-1 pr-9 text-xs ${
                                        item.concluido
                                          ? 'border-green-300 text-green-700'
                                          : isAtivoNaRede
                                            ? 'border-stone-300 text-stone-700'
                                            : 'border-red-200 text-red-700'
                                      }`}
                                    />
                                    {item.link_url ? (
                                      <button
                                        type="button"
                                        onClick={() => copyLinkToClipboard(item.link_url as string)}
                                        title={copiedLinkUrl === item.link_url ? 'Link copiado' : 'Copiar link'}
                                        className={`absolute right-2 top-1/2 -translate-y-1 rounded p-1 ${
                                          copiedLinkUrl === item.link_url
                                            ? 'text-green-700'
                                            : 'text-stone-500 hover:bg-stone-50'
                                        }`}
                                      >
                                        {copiedLinkUrl === item.link_url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                      </button>
                                    ) : null}
                                  </div>
                                  <div className="space-y-1">
                                    <input
                                      type="file"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0] ?? null;
                                        if (!file) return;
                                        setSavingStep1ItemId(item.id);
                                        try {
                                          const path = `${processoId}/step1-areas/${item.id}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                                          const uploadRes = await supabase.storage
                                            .from(BUCKET)
                                            .upload(path, file, { cacheControl: '3600', upsert: false });
                                          if (uploadRes.error) {
                                            alert(uploadRes.error.message);
                                            return;
                                          }
                                          const saveRes = await updateStep1AreaChecklistAnexo(item.id, path, file.name);
                                          if (!saveRes.ok) {
                                            alert(saveRes.error);
                                            return;
                                          }
                                          await loadStep1AreasChecklist();
                                        } finally {
                                          setSavingStep1ItemId(null);
                                          e.target.value = '';
                                        }
                                      }}
                                      className={`w-full rounded border px-2 py-1 text-xs file:mr-2 file:rounded file:border-0 file:px-2 file:py-1 ${
                                        item.concluido
                                          ? 'border-green-300 text-green-700 file:bg-green-100 file:text-green-800'
                                          : isAtivoNaRede
                                            ? 'border-stone-300 text-stone-700 file:bg-stone-100 file:text-stone-700'
                                            : 'border-red-200 text-red-700 file:bg-red-50 file:text-red-700'
                                      }`}
                                    />
                                    {item.nome_original ? (
                                      item.storage_path ? (
                                        <a
                                          href={supabase.storage.from(BUCKET).getPublicUrl(item.storage_path).data.publicUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className={`block text-[11px] ${
                                            item.concluido
                                              ? 'text-green-700 hover:underline'
                                              : isAtivoNaRede
                                                ? 'text-stone-500 hover:underline'
                                                : 'text-red-600 hover:underline'
                                          }`}
                                        >
                                          Anexo: {item.nome_original}
                                        </a>
                                      ) : (
                                        <span
                                          className={`block text-[11px] ${
                                            item.concluido
                                              ? 'text-green-700'
                                              : isAtivoNaRede
                                                ? 'text-stone-500'
                                                : 'text-red-600'
                                          }`}
                                        >
                                          Anexo: {item.nome_original}
                                        </span>
                                      )
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  });
                })()}
              </div>
            ) : etapaAtual === 'step_2' ||
                etapaAtual === 'aprovacao_moni_novo_negocio' ? (
              <div className="space-y-4">
                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-stone-800">Estudos Novo Negócio</h3>
                    {etapaAtual === 'aprovacao_moni_novo_negocio' ? (
                      <span className="rounded bg-moni-primary/10 px-2 py-0.5 text-xs font-medium text-moni-primary">
                        Aprovação Moní
                      </span>
                    ) : null}
                  </div>

                  {loadingNovoNegocioEstudosDocs ? (
                    <p className="mt-3 text-sm text-stone-500">Carregando…</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {(NOVO_NEGOCIO_ESTUDOS_DOCS_TITULOS as unknown as string[]).map((titulo) => {
                        const doc = novoNegocioEstudosDocsItens.find((d) => d.titulo === titulo) ?? null;
                        const anexosExtras = Array.isArray(doc?.anexos_json) ? (doc?.anexos_json ?? []) : [];
                        const anexosTodos = [
                          ...(doc?.storage_path ? [{ storage_path: doc.storage_path, nome_original: doc.nome_original }] : []),
                          ...anexosExtras,
                        ].filter((a) => a.storage_path);
                        const isGadgets = titulo === 'Gadgets';
                        const isFotosMulti = titulo === 'Fotos do Terreno' || titulo === 'Fotos do Condomínio';
                        const concluido = Boolean(
                          doc?.link_url || doc?.storage_path || doc?.nome_original || anexosExtras.length > 0 || doc?.texto_livre,
                        );
                        const publicUrl =
                          doc?.storage_path &&
                          supabase.storage.from(BUCKET).getPublicUrl(doc.storage_path).data.publicUrl;
                        const isApproval = etapaAtual === 'aprovacao_moni_novo_negocio';

                        return (
                          <div key={titulo} className="rounded border border-stone-200 p-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={concluido}
                                disabled
                                className="h-4 w-4 rounded border-stone-300"
                              />
                              <p className="text-sm font-medium text-stone-800">{titulo}</p>
                            </div>

                            <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_240px]">
                              <div className="relative">
                                {isGadgets ? (
                                  <textarea
                                    value={doc?.texto_livre ?? ''}
                                    disabled={isApproval || !doc}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      if (!doc) return;
                                      setNovoNegocioEstudosDocsItens((prev) =>
                                        prev.map((x) => (x.id === doc.id ? { ...x, texto_livre: v } : x)),
                                      );
                                    }}
                                    onBlur={async (e) => {
                                      if (!doc || isApproval) return;
                                      const res = await updateDocumentoCardTexto(doc.id, e.target.value);
                                      if (!res.ok) alert(res.error);
                                      await loadNovoNegocioEstudosDocs();
                                    }}
                                    placeholder="Descreva os gadgets..."
                                    rows={2}
                                    className={`mb-2 w-full rounded border px-2 py-1 text-xs ${
                                      concluido ? 'border-green-300 text-green-700' : 'border-stone-300 text-stone-700'
                                    } ${isApproval ? 'bg-stone-50' : ''}`}
                                  />
                                ) : null}
                                <input
                                  type="url"
                                  value={doc?.link_url ?? ''}
                                  disabled={isApproval || !doc}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (!doc) return;
                                    setNovoNegocioEstudosDocsItens((prev) => prev.map((x) => (x.id === doc.id ? { ...x, link_url: v } : x)));
                                  }}
                                  onBlur={async (e) => {
                                    if (!doc || isApproval) return;
                                    const v = e.target.value;
                                    const res = await updateDocumentoCardLink(doc.id, v);
                                    if (!res.ok) alert(res.error);
                                    await loadNovoNegocioEstudosDocs();
                                  }}
                                  placeholder="https://..."
                                  className={`w-full rounded border px-2 py-1 pr-9 text-xs ${
                                    concluido ? 'border-green-300 text-green-700' : 'border-stone-300 text-stone-700'
                                  } ${isApproval ? 'bg-stone-50' : ''}`}
                                />

                                {doc?.link_url ? (
                                  <button
                                    type="button"
                                    onClick={() => copyLinkToClipboard(doc.link_url as string)}
                                    disabled={isApproval}
                                    title={copiedLinkUrl === doc.link_url ? 'Link copiado' : 'Copiar link'}
                                    className={`absolute right-2 top-1/2 -translate-y-1 rounded p-1 ${
                                      copiedLinkUrl === doc.link_url ? 'text-green-700' : 'text-stone-500 hover:bg-stone-50'
                                    } ${isApproval ? 'opacity-50' : ''}`}
                                  >
                                    {copiedLinkUrl === doc.link_url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                  </button>
                                ) : null}
                              </div>

                              <div className="space-y-1">
                                <input
                                  type="file"
                                  multiple={isFotosMulti}
                                  disabled={isApproval || !doc || uploadingNovoNegocioDocId === doc?.id}
                                  onChange={async (e) => {
                                    const files = e.target.files ? Array.from(e.target.files) : [];
                                    if (files.length === 0 || !doc) return;

                                    setUploadingNovoNegocioDocId(doc.id);
                                    try {
                                      const step2StageKey = 'step_2';
                                      const novosAnexos: Array<{ storage_path: string; nome_original: string | null }> = [];
                                      for (const file of files) {
                                        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                                        const path = `${processoId}/card-docs/${step2StageKey}/${doc.id}/${crypto.randomUUID()}_${safeName}`;
                                        const uploadRes = await supabase.storage.from(BUCKET).upload(path, file, {
                                          cacheControl: '3600',
                                          upsert: false,
                                        });
                                        if (uploadRes.error) throw uploadRes.error;
                                        novosAnexos.push({ storage_path: path, nome_original: file.name });
                                      }

                                      if (isFotosMulti) {
                                        const atuais = (doc.anexos_json ?? [])
                                          .filter((a) => a?.storage_path)
                                          .map((a) => ({
                                            storage_path: String(a.storage_path),
                                            nome_original: a.nome_original ?? null,
                                          }));
                                        const saveRes = await updateDocumentoCardAnexos(doc.id, [...atuais, ...novosAnexos]);
                                        if (!saveRes.ok) throw new Error(saveRes.error);
                                      } else {
                                        const first = novosAnexos[0];
                                        const saveRes = await updateDocumentoCardAnexo(doc.id, first.storage_path, first.nome_original ?? '');
                                        if (!saveRes.ok) throw new Error(saveRes.error);
                                      }

                                      await loadNovoNegocioEstudosDocs();
                                    } catch (err) {
                                      alert(err instanceof Error ? err.message : 'Erro ao enviar arquivo.');
                                    } finally {
                                      setUploadingNovoNegocioDocId(null);
                                      e.currentTarget.value = '';
                                    }
                                  }}
                                  className={`w-full rounded border px-2 py-1 text-xs file:mr-2 file:rounded file:border-0 file:px-2 file:py-1 ${
                                    concluido
                                      ? 'border-green-300 text-green-700 file:bg-green-100 file:text-green-800'
                                      : 'border-stone-300 text-stone-700 file:bg-stone-100 file:text-stone-700'
                                  } ${isApproval ? 'bg-stone-50' : ''}`}
                                />

                                {anexosTodos.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {anexosTodos.map((anexo, idx) => {
                                      const url =
                                        anexo.storage_path &&
                                        supabase.storage.from(BUCKET).getPublicUrl(String(anexo.storage_path)).data.publicUrl;
                                      const nome = anexo.nome_original ?? `Anexo ${idx + 1}`;
                                      return url ? (
                                        <a
                                          key={`${String(anexo.storage_path)}-${idx}`}
                                          href={url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className={`block text-[11px] ${
                                            concluido ? 'text-green-700 hover:underline' : 'text-stone-500 hover:underline'
                                          }`}
                                        >
                                          Anexo: {nome}
                                        </a>
                                      ) : (
                                        <span
                                          key={`${String(anexo.storage_path)}-${idx}`}
                                          className={`block text-[11px] ${concluido ? 'text-green-700' : 'text-stone-500'}`}
                                        >
                                          Anexo: {nome}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : null}

                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {etapaAtual === 'aprovacao_moni_novo_negocio' ? (
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={loadingAprovacaoNovoNegocio}
                      onClick={async () => {
                        setLoadingAprovacaoNovoNegocio(true);
                        try {
                          const res = await atualizarEtapaPainel(processoId, 'step_3');
                          if (!res.ok) {
                            alert(res.error);
                            return;
                          }
                          router.refresh();
                          onClose();
                        } finally {
                          setLoadingAprovacaoNovoNegocio(false);
                        }
                      }}
                      className="rounded-lg bg-moni-primary px-3 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-60"
                    >
                      {loadingAprovacaoNovoNegocio ? 'Processando…' : 'Aprovar'}
                    </button>
                    <button
                      type="button"
                      disabled={loadingAprovacaoNovoNegocio}
                      onClick={async () => {
                        setLoadingAprovacaoNovoNegocio(true);
                        try {
                          const res = await atualizarEtapaPainel(processoId, 'step_2');
                          if (!res.ok) {
                            alert(res.error);
                            return;
                          }
                          router.refresh();
                          onClose();
                        } finally {
                          setLoadingAprovacaoNovoNegocio(false);
                        }
                      }}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                    >
                      {loadingAprovacaoNovoNegocio ? 'Processando…' : 'Reprovar'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : etapaAtual === 'step_3' ? (
              <div className="space-y-4">
                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-stone-800">Opção</h3>
                    <span className="rounded bg-moni-primary/10 px-2 py-0.5 text-xs font-medium text-moni-primary">
                      Step 3
                    </span>
                  </div>

                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-stone-800">Documento de Opções</h4>
                    <p className="mt-1 text-sm text-stone-600">
                      1) Baixe o Template da Minuta de Opção, 2) preencha as informações em aberto, 3)
                      anexe a Minuta de Opção assinada.
                    </p>
                  </div>

                  {loadingStep3Opcoes ? (
                    <p className="mt-4 text-sm text-stone-500">Carregando…</p>
                  ) : (
                    <>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {step3TemplateUrl ? (
                          <a
                            href={step3TemplateUrl}
                            className="inline-flex items-center rounded-lg border border-moni-accent bg-white px-3 py-1.5 text-sm font-medium text-moni-accent hover:bg-moni-accent/5"
                          >
                            Baixar Template da Minuta de Opção
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-100 px-3 py-1.5 text-sm text-stone-400"
                          >
                            Template não configurado
                          </button>
                        )}

                        <form onSubmit={handleUploadStep3Opcao} className="flex flex-wrap items-center gap-2 text-sm">
                          <input
                            type="file"
                            accept=".pdf,.docx,.doc"
                            className="block w-64 cursor-pointer text-xs text-stone-600 file:mr-2 file:rounded-md file:border-0 file:bg-moni-accent file:px-2 file:py-1 file:text-xs file:font-medium file:text-white hover:file:bg-moni-accent/90"
                            required={Boolean(step3UploadFile)}
                            onChange={(e) => setStep3UploadFile(e.target.files?.[0] ?? null)}
                          />
                          <button
                            type="submit"
                            disabled={!step3UploadFile || step3Uploading}
                            className="rounded-lg bg-moni-primary px-3 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-60"
                          >
                            {step3Uploading ? 'Anexando…' : 'Anexar Minuta de Opção assinada'}
                          </button>
                        </form>
                      </div>

                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-stone-800">Documentos assinados</h4>

                        {step3Instances.length === 0 ? (
                          <p className="mt-2 text-sm text-stone-500">Nenhuma Minuta de Opção assinada anexada ainda.</p>
                        ) : (
                          <ul className="mt-2 space-y-1 text-sm text-stone-700">
                            {step3Instances.map((inst) => {
                              const diff = inst.diff_json as any;
                              const changes = (diff?.changes ?? []) as Array<any>;
                              const totalDiffs = diff?.summary?.total ?? changes.length ?? 0;

                              return (
                                <li key={inst.id} className="rounded border border-stone-200 px-3 py-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="min-w-0">
                                      Versão {inst.versao} ·{' '}
                                      <span className="text-xs font-semibold uppercase text-stone-500">{getDocStatusLabel(inst.status)}</span>
                                    </span>
                                    <span className="shrink-0 text-xs text-stone-400">
                                      {new Date(inst.created_at).toLocaleString('pt-BR')}
                                    </span>
                                  </div>

                                  <div className="mt-1">
                                    {inst.arquivo_download_url ? (
                                      <a
                                        href={inst.arquivo_download_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs font-medium text-moni-accent hover:underline"
                                      >
                                        Baixar documento anexado
                                      </a>
                                    ) : (
                                      <span className="text-xs text-stone-400">Arquivo indisponível para download</span>
                                    )}
                                  </div>

                                  {inst.status === 'reprovado' && inst.motivo_reprovacao ? (
                                    <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                                      Parecer: {inst.motivo_reprovacao}
                                    </p>
                                  ) : null}

                                  {totalDiffs > 0 ? (
                                    <details className="mt-2">
                                      <summary className="cursor-pointer text-sm font-medium text-stone-700">
                                        Divergências em relação ao template ({totalDiffs})
                                      </summary>
                                      <ul className="mt-2 max-h-60 overflow-y-auto rounded border border-stone-200 bg-stone-50 p-2 text-sm">
                                        {changes.map((c, i) => (
                                          <li key={i} className="border-b border-stone-100 py-1.5 last:border-0">
                                            <span className="text-xs font-medium text-stone-500">{c.context}</span>
                                            {c.type === 'add' && (
                                              <p className="mt-0.5 text-green-800">
                                                <span className="font-medium">+ </span>
                                                {c.documentSlice}
                                              </p>
                                            )}
                                            {c.type === 'remove' && (
                                              <p className="mt-0.5 text-red-800">
                                                <span className="font-medium">− </span>
                                                {c.templateSlice}
                                              </p>
                                            )}
                                            {c.type === 'replace' && (
                                              <>
                                                <p className="mt-0.5 text-red-800">
                                                  <span className="font-medium">− </span>
                                                  {c.templateSlice}
                                                </p>
                                                <p className="mt-0.5 text-green-800">
                                                  <span className="font-medium">+ </span>
                                                  {c.documentSlice}
                                                </p>
                                              </>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </details>
                                  ) : diff ? (
                                    <p className="mt-2 text-xs text-stone-500">
                                      Nenhuma divergência detectada em relação ao template.
                                    </p>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </section>
              </div>
            ) : etapaAtual === 'credito_terreno' || etapaAtual === 'credito_obra' ? (
              <div className="min-h-[220px]" />
            ) : etapaAtual === 'step_7' ? (
              <div className="space-y-4">
                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-stone-800">Contrato</h3>
                    <span className="rounded bg-moni-primary/10 px-2 py-0.5 text-xs font-medium text-moni-primary">
                      Step 7
                    </span>
                  </div>

                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-stone-800">Documento de Contrato</h4>
                    <p className="mt-1 text-sm text-stone-600">
                      1) Baixe o Template do Contrato, 2) preencha as informações em aberto, 3) anexe o Contrato assinado.
                    </p>
                  </div>

                  {loadingStep7Contrato ? (
                    <p className="mt-4 text-sm text-stone-500">Carregando…</p>
                  ) : (
                    <>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                          {step7TemplateUrl ? (
                            <a
                              href={step7TemplateUrl}
                              className="inline-flex items-center rounded-lg border border-moni-accent bg-white px-3 py-1.5 text-sm font-medium text-moni-accent hover:bg-moni-accent/5"
                            >
                              Baixar Template do Contrato
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-100 px-3 py-1.5 text-sm text-stone-400"
                            >
                              Template não configurado
                            </button>
                          )}

                          <form
                            onSubmit={handleUploadStep7Contrato}
                            className="flex flex-wrap items-center gap-2 text-sm"
                          >
                            <input
                              type="file"
                              accept=".pdf,.docx,.doc"
                              className="block w-64 cursor-pointer text-xs text-stone-600 file:mr-2 file:rounded-md file:border-0 file:bg-moni-accent file:px-2 file:py-1 file:text-xs file:font-medium file:text-white hover:file:bg-moni-accent/90"
                              required={Boolean(step7UploadFile)}
                              onChange={(e) => setStep7UploadFile(e.target.files?.[0] ?? null)}
                            />
                            <button
                              type="submit"
                              disabled={!step7UploadFile || step7Uploading}
                              className="rounded-lg bg-moni-primary px-3 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-60"
                            >
                              {step7Uploading ? 'Anexando…' : 'Anexar Contrato assinado'}
                            </button>
                          </form>
                      </div>

                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-stone-800">Documentos assinados</h4>

                        {step7Instances.length === 0 ? (
                          <p className="mt-2 text-sm text-stone-500">Nenhum Contrato assinado anexado ainda.</p>
                        ) : (
                          <ul className="mt-2 space-y-1 text-sm text-stone-700">
                            {step7Instances.map((inst) => {
                              const diff = inst.diff_json as any;
                              const changes = (diff?.changes ?? []) as Array<any>;
                              const totalDiffs = diff?.summary?.total ?? changes.length ?? 0;

                              return (
                                <li key={inst.id} className="rounded border border-stone-200 px-3 py-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="min-w-0">
                                      Versão {inst.versao} ·{' '}
                                      <span className="text-xs font-semibold uppercase text-stone-500">{getDocStatusLabel(inst.status)}</span>
                                    </span>
                                    <span className="shrink-0 text-xs text-stone-400">
                                      {new Date(inst.created_at).toLocaleString('pt-BR')}
                                    </span>
                                  </div>

                                  <div className="mt-1">
                                    {inst.arquivo_download_url ? (
                                      <a
                                        href={inst.arquivo_download_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs font-medium text-moni-accent hover:underline"
                                      >
                                        Baixar documento anexado
                                      </a>
                                    ) : (
                                      <span className="text-xs text-stone-400">Arquivo indisponível para download</span>
                                    )}
                                  </div>

                                  {inst.status === 'reprovado' && inst.motivo_reprovacao ? (
                                    <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                                      Parecer: {inst.motivo_reprovacao}
                                    </p>
                                  ) : null}

                                  {totalDiffs > 0 ? (
                                    <details className="mt-2">
                                      <summary className="cursor-pointer text-sm font-medium text-stone-700">
                                        Divergências em relação ao template ({totalDiffs})
                                      </summary>
                                      <ul className="mt-2 max-h-60 overflow-y-auto rounded border border-stone-200 bg-stone-50 p-2 text-sm">
                                        {changes.map((c, i) => (
                                          <li key={i} className="border-b border-stone-100 py-1.5 last:border-0">
                                            <span className="text-xs font-medium text-stone-500">{c.context}</span>
                                            {c.type === 'add' && (
                                              <p className="mt-0.5 text-green-800">
                                                <span className="font-medium">+ </span>
                                                {c.documentSlice}
                                              </p>
                                            )}
                                            {c.type === 'remove' && (
                                              <p className="mt-0.5 text-red-800">
                                                <span className="font-medium">− </span>
                                                {c.templateSlice}
                                              </p>
                                            )}
                                            {c.type === 'replace' && (
                                              <>
                                                <p className="mt-0.5 text-red-800">
                                                  <span className="font-medium">− </span>
                                                  {c.templateSlice}
                                                </p>
                                                <p className="mt-0.5 text-green-800">
                                                  <span className="font-medium">+ </span>
                                                  {c.documentSlice}
                                                </p>
                                              </>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </details>
                                  ) : diff ? (
                                    <p className="mt-2 text-xs text-stone-500">
                                      Nenhuma divergência detectada em relação ao template.
                                    </p>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </section>
              </div>
            ) : etapaAtual === 'step_4' ? (
              <div className="space-y-4">
                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-stone-800">Checklist Legal</h3>

                      {loadingChecklistLegal ? (
                        <p className="text-sm text-stone-500">Carregando…</p>
                      ) : checklistLegalCompleto ? (
                        <span className="inline-flex items-center rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-800 border border-green-200">
                          Checklist Legal completo
                        </span>
                      ) : (
                        <div className="space-y-2">
                          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 font-medium">
                            Este processo não avança enquanto todas as informações do Checklist Legal não forem preenchidas.
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded bg-stone-100">
                            <div className="h-full bg-amber-500 transition-all" style={{ width: `${checklistLegalProgresso.percentual}%` }} />
                          </div>
                          <p className="text-xs text-stone-500">Progresso: {checklistLegalProgresso.percentual}%</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const url = await getPublicShareFormUrl('legal');
                          if (!url) return;
                          await copyLinkToClipboard(url);
                        }}
                        className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                      >
                        Copiar link para compartilhar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChecklistLegalDrawerOpen(true);
                          setChecklistLegalDrawerPage(0);
                        }}
                        disabled={loadingChecklistLegal}
                        className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-60"
                      >
                        {checklistLegalHasOwnRecord ? 'Editar Checklist Legal' : 'Preencher Checklist Legal'}
                      </button>
                    </div>
                  </div>

                  {checklistLegalRecord ? (
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-stone-800">Documentos Base</p>
                        <div className="mt-2 space-y-2 text-sm">
                          <div>
                            <div className="text-xs text-stone-500">Manual do Condomínio</div>
                            <div className="mt-1 space-y-1">
                              {(checklistLegalArquivos.manual_condominio_pdf ?? []).map((f, idx) => {
                                const publicUrl =
                                  f.storage_path &&
                                  supabase.storage.from(BUCKET).getPublicUrl(f.storage_path).data.publicUrl;
                                if (!publicUrl) return null;
                                return (
                                  <a key={`${f.storage_path}-${idx}`} href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-moni-accent hover:underline">
                                    <FileText className="h-4 w-4" />
                                    {f.nome_original ?? 'Arquivo'}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-stone-500">Código de Obras da Subprefeitura</div>
                            <div className="mt-1 space-y-1">
                              {(checklistLegalArquivos.codigo_obras_pdf ?? []).map((f, idx) => {
                                const publicUrl =
                                  f.storage_path &&
                                  supabase.storage.from(BUCKET).getPublicUrl(f.storage_path).data.publicUrl;
                                if (!publicUrl) return null;
                                return (
                                  <a key={`${f.storage_path}-${idx}`} href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-moni-accent hover:underline">
                                    <FileText className="h-4 w-4" />
                                    {f.nome_original ?? 'Arquivo'}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-stone-500">Outros documentos</div>
                            <div className="mt-1 space-y-1">
                              {(checklistLegalArquivos.outros_documentos_pdf ?? []).length === 0 ? (
                                <span className="text-stone-500">—</span>
                              ) : (
                                (checklistLegalArquivos.outros_documentos_pdf ?? []).map((f, idx) => {
                                  const publicUrl =
                                    f.storage_path && supabase.storage.from(BUCKET).getPublicUrl(f.storage_path).data.publicUrl;
                                  if (!publicUrl) return null;
                                  return (
                                    <a key={`${f.storage_path}-${idx}`} href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-moni-accent hover:underline">
                                      <FileText className="h-4 w-4" />
                                      {f.nome_original ?? 'Arquivo'}
                                    </a>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-stone-800">Dos Processos de Aprovação</p>
                        <div className="mt-2 space-y-2 text-sm">
                          <div>
                            <div className="text-xs text-stone-500">1) Telefone de contato (setor aprovações)</div>
                            <div className="mt-1 text-stone-800">{strTrim(checklistLegalRespostas.q1_aprov_tel_setor)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-stone-500">2) Telefone de contato (subprefeitura)</div>
                            <div className="mt-1 text-stone-800">{strTrim(checklistLegalRespostas.q2_aprov_tel_subprefeitura)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-stone-500">3) Pré-fabricadas / steel frame / estrutura leve</div>
                            <div className="mt-1 text-stone-800">{strTrim(checklistLegalRespostas.q3_aprov_pre_fabricadas)}</div>
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">4) Matrícula (arquivo)</div>
                            <div className="mt-1 space-y-1">
                              {(checklistLegalArquivos.aprovacao_matricula_pdf ?? []).length === 0 ? (
                                <span className="text-stone-500">—</span>
                              ) : (
                                (checklistLegalArquivos.aprovacao_matricula_pdf ?? []).map((f, idx) => {
                                  const publicUrl =
                                    f.storage_path && supabase.storage.from(BUCKET).getPublicUrl(f.storage_path).data.publicUrl;
                                  if (!publicUrl) return null;
                                  return (
                                    <a key={`${f.storage_path}-${idx}`} href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-moni-accent hover:underline">
                                      <FileText className="h-4 w-4" />
                                      {f.nome_original ?? 'Arquivo'}
                                    </a>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">5) Levantamento planialtimétrico (arquivo)</div>
                            <div className="mt-1 space-y-1">
                              {(checklistLegalArquivos.aprovacao_planialtimetrico_pdf ?? []).length === 0 ? (
                                <span className="text-stone-500">—</span>
                              ) : (
                                (checklistLegalArquivos.aprovacao_planialtimetrico_pdf ?? []).map((f, idx) => {
                                  const publicUrl =
                                    f.storage_path && supabase.storage.from(BUCKET).getPublicUrl(f.storage_path).data.publicUrl;
                                  if (!publicUrl) return null;
                                  return (
                                    <a key={`${f.storage_path}-${idx}`} href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-moni-accent hover:underline">
                                      <FileText className="h-4 w-4" />
                                      {f.nome_original ?? 'Arquivo'}
                                    </a>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">6) Taxas e respectivos valores</div>
                            <div className="mt-1 whitespace-pre-wrap text-stone-800">{strTrim(checklistLegalRespostas.q6_aprov_taxas)}</div>
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">7) Laudo de sondagem do terreno (quais)</div>
                            <div className="mt-1 whitespace-pre-wrap text-stone-800">{strTrim(checklistLegalRespostas.q7_aprov_laud_sondagem)}</div>
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">8) SPT (arquivo)</div>
                            <div className="mt-1 space-y-1">
                              {(checklistLegalArquivos.aprovacao_spt_pdf ?? []).length === 0 ? (
                                <span className="text-stone-500">—</span>
                              ) : (
                                (checklistLegalArquivos.aprovacao_spt_pdf ?? []).map((f, idx) => {
                                  const publicUrl =
                                    f.storage_path && supabase.storage.from(BUCKET).getPublicUrl(f.storage_path).data.publicUrl;
                                  if (!publicUrl) return null;
                                  return (
                                    <a key={`${f.storage_path}-${idx}`} href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-moni-accent hover:underline">
                                      <FileText className="h-4 w-4" />
                                      {f.nome_original ?? 'Arquivo'}
                                    </a>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">9) Documentos solicitados</div>
                            <div className="mt-1 space-y-1">
                              {(checklistLegalRespostas.q9_aprov_doc_solicitados_selecionados as unknown as string[] | undefined)?.filter((v) => v !== 'Outro').length ? (
                                <div className="flex flex-wrap gap-2">
                                  {(checklistLegalRespostas.q9_aprov_doc_solicitados_selecionados as unknown as string[]).filter((v) => v !== 'Outro').map((opt) => (
                                    <span key={opt} className="rounded bg-stone-100 border border-stone-200 px-2 py-0.5 text-xs text-stone-700">
                                      {opt}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-stone-500">—</span>
                              )}
                              {((checklistLegalRespostas.q9_aprov_doc_solicitados_selecionados as unknown as string[]) ?? []).includes('Outro') ? (
                                <div className="text-sm text-stone-800">
                                  Outro: <span className="font-medium">{strTrim(checklistLegalRespostas.q9_aprov_doc_solicitados_outro_text)}</span>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">10) Prazo solicitado pelo condomínio</div>
                            <div className="mt-1 text-stone-800">{strTrim(checklistLegalRespostas.q10_aprov_prazo_condominio)}</div>
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">11) Prazo solicitado pela prefeitura</div>
                            <div className="mt-1 text-stone-800">{strTrim(checklistLegalRespostas.q11_aprov_prazo_prefeitura)}</div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-stone-800">Do Terreno (12-24)</p>
                        <div className="mt-2 space-y-2 text-sm">
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {[
                              ['12) Recuo FRONTAL', 'q12_terreno_recuo_frontal'],
                              ['13) Recuo LATERAL', 'q13_terreno_recuo_lateral'],
                              ['14) Recuo FUNDOS', 'q14_terreno_recuo_fundos'],
                              ['15) Taxa de ocupação', 'q15_terreno_taxa_ocupacao'],
                              ['16) Coeficiente de aproveitamento', 'q16_terreno_coeficiente_aproveitamento'],
                              ['17) Permeabilidade mínima', 'q17_terreno_permeabilidade_minima'],
                              ['22) Edículas (permitidas?)', 'q22_terreno_ediculas_permitidas'],
                            ].map(([label, key]) => (
                              <div key={String(key)}>
                                <div className="text-xs text-stone-500">{label}</div>
                                <div className="mt-1 text-stone-800">{strTrim(checklistLegalRespostas[key])}</div>
                              </div>
                            ))}
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">18) Regra de uso da área permeável</div>
                            <div className="mt-1 whitespace-pre-wrap text-stone-800">{strTrim(checklistLegalRespostas.q18_terreno_regra_area_permeavel)}</div>
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">19) Área construída mínima</div>
                            <div className="mt-1 text-stone-800">{strTrim(checklistLegalRespostas.q19_terreno_area_construida_minima)}</div>
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">20) Projeção de cobertura / elementos nos recuos</div>
                            <div className="mt-1 whitespace-pre-wrap text-stone-800">{strTrim(checklistLegalRespostas.q20_terreno_cobertura_recuos)}</div>
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">21) Piscinas / casas de máquinas / abrigo para carros</div>
                            <div className="mt-1 whitespace-pre-wrap text-stone-800">{strTrim(checklistLegalRespostas.q21_terreno_piscinas_recuos)}</div>
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">23) Abrigos / medidores (arquivo)</div>
                            <div className="mt-1 space-y-1">
                              {(checklistLegalArquivos.terreno_abrigos_medidores_pdf ?? []).length === 0 ? (
                                <span className="text-stone-500">—</span>
                              ) : (
                                (checklistLegalArquivos.terreno_abrigos_medidores_pdf ?? []).map((f, idx) => {
                                  const publicUrl =
                                    f.storage_path && supabase.storage.from(BUCKET).getPublicUrl(f.storage_path).data.publicUrl;
                                  if (!publicUrl) return null;
                                  return (
                                    <a key={`${f.storage_path}-${idx}`} href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-moni-accent hover:underline">
                                      <FileText className="h-4 w-4" />
                                      {f.nome_original ?? 'Arquivo'}
                                    </a>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-stone-500">24) Edículas (especificações)</div>
                            <div className="mt-1 whitespace-pre-wrap text-stone-800">{strTrim(checklistLegalRespostas.q24_terreno_ediculas_especificacoes) || '—'}</div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-stone-800">Gabarito (25-28)</p>
                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 text-sm">
                          {[
                            ['25) Altura máxima', 'q25_gabarito_altura_maxima'],
                            ['26) Pavimentos', 'q26_gabarito_pavimentos'],
                            ['27) Subsolo', 'q27_gabarito_subsolos'],
                            ['28) Exceções', 'q28_gabarito_excecoes'],
                          ].map(([label, key]) => (
                            <div key={String(key)} className="rounded border border-stone-200 p-2">
                              <div className="text-xs text-stone-500">{label}</div>
                              <div className="mt-1 whitespace-pre-wrap text-stone-800">{strTrim(checklistLegalRespostas[key])}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-stone-800">Divisas do Lote (29-32)</p>
                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 text-sm">
                          {[
                            ['29) Altura máxima muros', 'q29_divisas_altura_muros'],
                            ['30) Restrição com áreas comuns', 'q30_divisas_restricao_area_comum'],
                            ['31) Muro arrimo (opcional)', 'q31_divisas_muro_arrimo_opcional'],
                            ['32) Áreas gourmet/de lazer', 'q32_divisas_areas_gourmet'],
                          ].map(([label, key]) => (
                            <div key={String(key)} className="rounded border border-stone-200 p-2">
                              <div className="text-xs text-stone-500">{label}</div>
                              <div className="mt-1 whitespace-pre-wrap text-stone-800">{strTrim(checklistLegalRespostas[key]) || '—'}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-stone-800">Passeios (33-35)</p>
                        <div className="mt-2 space-y-2 text-sm">
                          {[
                            ['33) Alterações no passeio', 'q33_passeios_alteracoes'],
                            ['34) Paginação específica', 'q34_passeios_paginacao'],
                            ['35) Plantio de árvores', 'q35_passeios_plantio_arvores'],
                          ].map(([label, key]) => (
                            <div key={String(key)}>
                              <div className="text-xs text-stone-500">{label}</div>
                              <div className="mt-1 whitespace-pre-wrap text-stone-800">{strTrim(checklistLegalRespostas[key])}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-stone-800">Instalações Prediais (36-39)</p>
                        <div className="mt-2 space-y-2 text-sm">
                          {[
                            ['36) Abrigos/medidores (água/luz/telefone/TV)', 'q36_inst_medidores_posicionamento'],
                            ['37) Poços artesianos / fossas / sumidouros', 'q37_inst_pocos_fossas'],
                            ['38) Esgoto orientado pelo condomínio', 'q38_inst_esgoto_orientado'],
                            ['39) Faixa de servidão de passagem', 'q39_inst_faixa_servitude'],
                          ].map(([label, key]) => (
                            <div key={String(key)}>
                              <div className="text-xs text-stone-500">{label}</div>
                              <div className="mt-1 whitespace-pre-wrap text-stone-800">{strTrim(checklistLegalRespostas[key])}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-stone-800">Outras Observações (40)</p>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-stone-800">{strTrim(checklistLegalRespostas.q40_outras_observacoes) || '—'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                      Checklist Legal ainda não preenchido.
                    </div>
                  )}
                </section>

                {checklistLegalDrawerOpen ? (
                  <div className="fixed inset-0 z-60 flex items-stretch justify-end bg-black/40 p-3">
                    <div className="w-full max-w-4xl min-w-[700px] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
                      <div className="flex items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-stone-900">Checklist Legal</p>
                          <p className="text-xs text-stone-500">Página {checklistLegalDrawerPage + 1} / 10</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setChecklistLegalDrawerOpen(false)}
                          className="rounded p-1 text-stone-500 hover:bg-stone-200"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="px-4 pt-3">
                        <div className="h-2 w-full rounded bg-stone-100 overflow-hidden">
                          <div
                            className="h-full bg-moni-accent transition-all"
                            style={{ width: `${((checklistLegalDrawerPage + 1) / 10) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="max-h-[85vh] overflow-y-auto p-4">
                        {checklistLegalDrawerPage === 0 && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                1) PDF do Manual do Condomínio em questão <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="mt-1 w-full text-xs"
                                onChange={(e) =>
                                  handleUploadChecklistLegalFiles(
                                    'manual_condominio_pdf',
                                    e.target.files ? Array.from(e.target.files) : null,
                                  )
                                }
                              />
                              <div className="mt-2 text-xs text-stone-500 space-y-1">
                                {(checklistLegalArquivos.manual_condominio_pdf ?? []).length === 0 ? (
                                  <div>—</div>
                                ) : (
                                  (checklistLegalArquivos.manual_condominio_pdf ?? []).map((f, idx) => (
                                    <div key={`${f.storage_path}-${idx}`}>
                                      {f.nome_original}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                2) PDF do Código de Obras da Subprefeitura em questão <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="mt-1 w-full text-xs"
                                onChange={(e) =>
                                  handleUploadChecklistLegalFiles(
                                    'codigo_obras_pdf',
                                    e.target.files ? Array.from(e.target.files) : null,
                                  )
                                }
                              />
                              <div className="mt-2 text-xs text-stone-500 space-y-1">
                                {(checklistLegalArquivos.codigo_obras_pdf ?? []).length === 0 ? (
                                  <div>—</div>
                                ) : (
                                  (checklistLegalArquivos.codigo_obras_pdf ?? []).map((f, idx) => (
                                    <div key={`${f.storage_path}-${idx}`}>
                                      {f.nome_original}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                3) Outros códigos, padrões ou documentos necessários (opcional)
                              </label>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                multiple
                                className="mt-1 w-full text-xs"
                                onChange={(e) =>
                                  handleUploadChecklistLegalFiles(
                                    'outros_documentos_pdf',
                                    e.target.files ? Array.from(e.target.files) : null,
                                  )
                                }
                              />
                              <div className="mt-2 text-xs text-stone-500 space-y-1">
                                {(checklistLegalArquivos.outros_documentos_pdf ?? []).length === 0 ? (
                                  <div>—</div>
                                ) : (
                                  (checklistLegalArquivos.outros_documentos_pdf ?? []).map((f, idx) => (
                                    <div key={`${f.storage_path}-${idx}`}>
                                      {f.nome_original}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {checklistLegalDrawerPage === 1 && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                1) Qual o telefone de contato do setor de aprovações do condomínio em questão? <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q1_aprov_tel_setor ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q1_aprov_tel_setor: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                2) Telefone de contato do setor de aprovações da Subprefeitura? <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q2_aprov_tel_subprefeitura ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q2_aprov_tel_subprefeitura: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                3) Condomínio permite pré-fabricadas / steel frame / estrutura leve / modulares? <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q3_aprov_pre_fabricadas ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q3_aprov_pre_fabricadas: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                4) Terreno possui matrícula? (opcional, anexe PDF)
                              </label>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="mt-1 w-full text-xs"
                                onChange={(e) =>
                                  handleUploadChecklistLegalFiles(
                                    'aprovacao_matricula_pdf',
                                    e.target.files ? Array.from(e.target.files) : null,
                                  )
                                }
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                5) Terreno possui levantamento planialtimétrico? (opcional, anexe PDF)
                              </label>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="mt-1 w-full text-xs"
                                onChange={(e) =>
                                  handleUploadChecklistLegalFiles(
                                    'aprovacao_planialtimetrico_pdf',
                                    e.target.files ? Array.from(e.target.files) : null,
                                  )
                                }
                              />
                            </div>
                          </div>
                        )}

                        {checklistLegalDrawerPage === 2 && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                6) Existem taxas no processo de aprovação? Se sim, quais e valores <span className="text-red-600">*</span>
                              </label>
                              <p className="mt-1 text-xs text-stone-500">
                                Exemplos: Taxa de Análise ou Aprovação de Projeto — cobrada pela prefeitura ou condomínio... (conforme manual).
                              </p>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q6_aprov_taxas ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q6_aprov_taxas: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                7) Solicita laudo de sondagem? Se sim, quais? <span className="text-red-600">*</span>
                              </label>
                              <p className="mt-1 text-xs text-stone-500">
                                Exemplo: Relatório Técnico de Sondagem a Percussão (SPT) com ART e recomendações...
                              </p>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q7_aprov_laud_sondagem ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q7_aprov_laud_sondagem: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                8) Caso já tenha o SPT, anexe abaixo (opcional)
                              </label>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="mt-1 w-full text-xs"
                                onChange={(e) =>
                                  handleUploadChecklistLegalFiles(
                                    'aprovacao_spt_pdf',
                                    e.target.files ? Array.from(e.target.files) : null,
                                  )
                                }
                              />
                            </div>

                            <div className="rounded-lg border border-stone-200 p-3">
                              <p className="text-sm font-medium text-stone-800">
                                9) Documentos que o condomínio solicita para aprovação do projeto <span className="text-red-600">*</span>
                              </p>
                              <p className="mt-1 text-xs text-stone-500">Selecione os documentos exigidos.</p>

                              {[
                                'RG do proprietário',
                                'CPF do proprietário',
                                'CNH do proprietário',
                                'Escritura do terreno',
                                'Projeto Legal',
                                'Projeto Arquitetônico',
                                'Memorial Descritivo',
                                'Relatório Técnico de Sondagem a Percussão (SPT)',
                                'Outro',
                              ].map((opt) => {
                                const selected = (checklistLegalRespostas.q9_aprov_doc_solicitados_selecionados as unknown as string[] | undefined) ?? [];
                                const checked = selected.includes(opt);
                                return (
                                  <label key={opt} className="mt-2 flex items-start gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const next = e.target.checked ? [...selected, opt] : selected.filter((x) => x !== opt);
                                        setChecklistLegalRespostas((prev) => ({
                                          ...prev,
                                          q9_aprov_doc_solicitados_selecionados: next,
                                          q9_aprov_doc_solicitados_outro_text:
                                            opt === 'Outro' && !e.target.checked ? '' : (prev.q9_aprov_doc_solicitados_outro_text as any) ?? '',
                                        }));
                                      }}
                                      className="mt-1 h-4 w-4"
                                    />
                                    <span className="text-stone-700">{opt === 'Outro' ? 'Outro:' : opt}</span>
                                  </label>
                                );
                              })}

                              {((checklistLegalRespostas.q9_aprov_doc_solicitados_selecionados as unknown as string[]) ?? []).includes('Outro') ? (
                                <div className="mt-3">
                                  <label className="block text-sm font-medium text-stone-700">Outro (descreva)</label>
                                  <input
                                    type="text"
                                    className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                    value={String(checklistLegalRespostas.q9_aprov_doc_solicitados_outro_text ?? '')}
                                    onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q9_aprov_doc_solicitados_outro_text: e.target.value }))}
                                  />
                                </div>
                              ) : null}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                10) Prazo solicitado pelo condomínio (dias úteis ou corridos) <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q10_aprov_prazo_condominio ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q10_aprov_prazo_condominio: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                11) Prazo solicitado pela prefeitura (dias úteis ou corridos) <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q11_aprov_prazo_prefeitura ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q11_aprov_prazo_prefeitura: e.target.value }))}
                              />
                            </div>
                          </div>
                        )}

                        {checklistLegalDrawerPage === 3 && (
                          <div className="space-y-4">
                            {[
                              ['12_terreno_recuo_frontal', '12) Recuo FRONTAL mínimo solicitado pelo condomínio', true],
                              ['13_terreno_recuo_lateral', '13) Recuo LATERAL mínimo solicitado pelo condomínio', true],
                              ['14_terreno_recuo_fundos', '14) Recuo DE FUNDOS mínimo solicitado pelo condomínio', true],
                              ['15_terreno_taxa_ocupacao', '15) Taxa de ocupação máxima permitida pelo condomínio', true],
                              ['16_terreno_coeficiente_aproveitamento', '16) Coeficiente de aproveitamento máximo permitido pelo condomínio', true],
                              ['17_terreno_permeabilidade_minima', '17) Taxa de permeabilidade mínima solicitada pelo condomínio', true],
                            ].map(([keySuffix, label, required]) => {
                              const key = `q${keySuffix}`; // não usado: vamos usar mapping direto
                              return null;
                            })}
                            <div>
                              <label className="block text-sm font-medium text-stone-700">12) Recuo FRONTAL mínimo solicitado pelo condomínio <span className="text-red-600">*</span></label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q12_terreno_recuo_frontal ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q12_terreno_recuo_frontal: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-stone-700">13) Recuo LATERAL mínimo solicitado pelo condomínio <span className="text-red-600">*</span></label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q13_terreno_recuo_lateral ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q13_terreno_recuo_lateral: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-stone-700">14) Recuo DE FUNDOS mínimo solicitado pelo condomínio <span className="text-red-600">*</span></label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q14_terreno_recuo_fundos ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q14_terreno_recuo_fundos: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-stone-700">15) Taxa de ocupação máxima permitida pelo condomínio <span className="text-red-600">*</span></label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q15_terreno_taxa_ocupacao ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q15_terreno_taxa_ocupacao: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-stone-700">16) Coeficiente de aproveitamento máximo permitido pelo condomínio <span className="text-red-600">*</span></label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q16_terreno_coeficiente_aproveitamento ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q16_terreno_coeficiente_aproveitamento: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-stone-700">17) Taxa de permeabilidade mínima solicitada pelo condomínio <span className="text-red-600">*</span></label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q17_terreno_permeabilidade_minima ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q17_terreno_permeabilidade_minima: e.target.value }))}
                              />
                            </div>
                          </div>
                        )}

                        {checklistLegalDrawerPage === 4 && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                18) Regra do uso da área permeável <span className="text-red-600">*</span>
                              </label>
                              <p className="mt-1 text-xs text-stone-500">
                                Ex.: Taxa de permeabilidade mínima 20%...
                              </p>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q18_terreno_regra_area_permeavel ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q18_terreno_regra_area_permeavel: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                19) Área construída mínima (m²) <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q19_terreno_area_construida_minima ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q19_terreno_area_construida_minima: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                20) Projeção de cobertura / elementos nos recuos <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q20_terreno_cobertura_recuos ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q20_terreno_cobertura_recuos: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                21) Piscinas / máquinas / abrigo para carros <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q21_terreno_piscinas_recuos ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q21_terreno_piscinas_recuos: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                22) Edículas: permitidas além da construção principal? <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q22_terreno_ediculas_permitidas ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q22_terreno_ediculas_permitidas: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                23) Padrão para abrigos/medidores (opcional, anexe PDF)
                              </label>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="mt-1 w-full text-xs"
                                onChange={(e) =>
                                  handleUploadChecklistLegalFiles(
                                    'terreno_abrigos_medidores_pdf',
                                    e.target.files ? Array.from(e.target.files) : null,
                                  )
                                }
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                24) Especificações das edículas (opcional)
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q24_terreno_ediculas_especificacoes ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q24_terreno_ediculas_especificacoes: e.target.value }))}
                              />
                            </div>
                          </div>
                        )}

                        {checklistLegalDrawerPage === 5 && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                25) Altura máxima do conjunto arquitetônico <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q25_gabarito_altura_maxima ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q25_gabarito_altura_maxima: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                26) Quantos pavimentos acima do nível do lote <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q26_gabarito_pavimentos ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q26_gabarito_pavimentos: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                27) Subsolo: permitido? Qual altura máxima? <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q27_gabarito_subsolos ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q27_gabarito_subsolos: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                28) Observações/exceções sobre o gabarito <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q28_gabarito_excecoes ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q28_gabarito_excecoes: e.target.value }))}
                              />
                            </div>
                          </div>
                        )}

                        {checklistLegalDrawerPage === 6 && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                29) Altura máxima permitida para muros de divisa <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q29_divisas_altura_muros ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q29_divisas_altura_muros: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                30) Restrições para muros com áreas comuns/de lazer <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q30_divisas_restricao_area_comum ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q30_divisas_restricao_area_comum: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">31) Arrimo: altura máxima total (opcional)</label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q31_divisas_muro_arrimo_opcional ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q31_divisas_muro_arrimo_opcional: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                32) Áreas gourmet/de lazer: fechamento específico? <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q32_divisas_areas_gourmet ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q32_divisas_areas_gourmet: e.target.value }))}
                              />
                            </div>
                          </div>
                        )}

                        {checklistLegalDrawerPage === 7 && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                33) É permitido fazer alterações no passeio? <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q33_passeios_alteracoes ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q33_passeios_alteracoes: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                34) Paginção específica para adaptar o passeio <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q34_passeios_paginacao ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q34_passeios_paginacao: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                35) Plantio de árvores no passeio <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q35_passeios_plantio_arvores ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q35_passeios_plantio_arvores: e.target.value }))}
                              />
                            </div>
                          </div>
                        )}

                        {checklistLegalDrawerPage === 8 && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                36) Posicionamento dos abrigos para medidores <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q36_inst_medidores_posicionamento ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q36_inst_medidores_posicionamento: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                37) Poços artesianos, fossas ou sumidouros <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q37_inst_pocos_fossas ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q37_inst_pocos_fossas: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                38) Lançamentos de esgoto orientado pelo condomínio <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q38_inst_esgoto_orientado ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q38_inst_esgoto_orientado: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-stone-700">
                                39) Faixa de servidão / recuo específico do terreno <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                rows={4}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q39_inst_faixa_servitude ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q39_inst_faixa_servitude: e.target.value }))}
                              />
                            </div>
                          </div>
                        )}

                        {checklistLegalDrawerPage === 9 && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-stone-700">40) Outras observações (opcional)</label>
                              <textarea
                                rows={5}
                                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                                value={String(checklistLegalRespostas.q40_outras_observacoes ?? '')}
                                onChange={(e) => setChecklistLegalRespostas((prev) => ({ ...prev, q40_outras_observacoes: e.target.value }))}
                              />
                            </div>

                            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
                              <p className="font-medium text-stone-800">Revisão e status</p>
                              <p className="mt-1 text-stone-600">
                                {checklistLegalCompleto ? (
                                  <span className="text-green-700 font-medium">Checklist Legal está 100% preenchido.</span>
                                ) : (
                                  <span className="text-red-700 font-medium">Ainda falta responder algum campo obrigatório.</span>
                                )}
                              </p>
                            </div>

                            <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                              <p className="font-medium text-stone-800">Resumo das respostas</p>
                              <div className="mt-2 space-y-2 text-stone-700">
                                <div>
                                  <span className="text-xs text-stone-500">Documentos Base</span>
                                  <div>
                                    Manual: {(checklistLegalArquivos.manual_condominio_pdf ?? []).length ? 'OK' : '—'} · Código Obras:{' '}
                                    {(checklistLegalArquivos.codigo_obras_pdf ?? []).length ? 'OK' : '—'}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs text-stone-500">Aprovação</span>
                                  <div>
                                    Q1: {strTrim(checklistLegalRespostas.q1_aprov_tel_setor) ? 'OK' : '—'} · Q2:{' '}
                                    {strTrim(checklistLegalRespostas.q2_aprov_tel_subprefeitura) ? 'OK' : '—'} · Q6:{' '}
                                    {strTrim(checklistLegalRespostas.q6_aprov_taxas) ? 'OK' : '—'} · Q7:{' '}
                                    {strTrim(checklistLegalRespostas.q7_aprov_laud_sondagem) ? 'OK' : '—'} · Q9:{' '}
                                    {(checklistLegalRespostas.q9_aprov_doc_solicitados_selecionados as unknown as string[] | undefined)?.length
                                      ? 'OK'
                                      : '—'}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs text-stone-500">Terreno</span>
                                  <div>
                                    Q12-Q22: {checklistLegalCompleto ? 'OK' : 'preencha campos pendentes'}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs text-stone-500">Gabarito/Divisas/Passeios/Instalações</span>
                                  <div>
                                    {checklistLegalCompleto ? 'OK' : 'verifique os campos obrigatórios'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-stone-200 bg-white px-4 py-3">
                        <button
                          type="button"
                          disabled={checklistLegalDrawerSaving || checklistLegalDrawerPage === 0}
                          onClick={() => {
                            if (checklistLegalDrawerPage === 0) return;
                            goChecklistLegalPage(checklistLegalDrawerPage - 1);
                          }}
                          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                        >
                          Voltar
                        </button>

                        {checklistLegalDrawerPage < 9 ? (
                          <button
                            type="button"
                            disabled={checklistLegalDrawerSaving}
                            onClick={() => goChecklistLegalPage(checklistLegalDrawerPage + 1)}
                            className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-60"
                          >
                            Avançar →
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={checklistLegalDrawerSaving}
                            onClick={handleConcluirChecklistLegal}
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {checklistLegalDrawerSaving ? 'Concluindo…' : 'Concluir Checklist'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <h3 className="text-sm font-semibold text-stone-800">Planialtimétrico</h3>
                  {loadingStep4PlanialtimetricoChecklist ? (
                    <p className="mt-3 text-sm text-stone-500">Carregando checklist…</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {step4PlanialtimetricoChecklistItens.map((item) => (
                        <div key={item.id} className="rounded border border-stone-200 p-2 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.concluido}
                              onChange={async () => {
                                const res = await toggleChecklistItem(item.id, !item.concluido);
                                if (!res.ok) {
                                  alert(res.error);
                                  return;
                                }
                                loadStep4PlanialtimetricoChecklist();
                              }}
                              className="h-4 w-4 rounded border-stone-300"
                            />
                            <span className={item.concluido ? 'font-medium text-green-700' : 'text-stone-800'}>{item.titulo}</span>
                          </label>
                          {renderChecklistLinkAnexo('step_4', item.titulo, item.concluido)}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <ChecklistCreditoSection processoId={processoId} />
              </div>
            ) : etapaAtual === 'step_5' ? (
              <div className="space-y-4">
                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-stone-800">Progresso do Comitê</h3>
                    {progressoComite.completo ? (
                      <span className="inline-flex items-center rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
                        Checklist Comitê completo
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                        Checklist Comitê em andamento
                      </span>
                    )}
                  </div>
                  {!progressoComite.completo ? (
                    <div className="mt-3">
                      <div className="h-2 w-full overflow-hidden rounded bg-stone-100">
                        <div
                          className="h-full bg-amber-500 transition-all"
                          style={{ width: `${progressoComite.percentual}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        {progressoComite.concluido}/{progressoComite.total} concluído(s) ({progressoComite.percentual}%)
                      </p>
                    </div>
                  ) : null}
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <h3 className="text-sm font-semibold text-stone-800">Material do Franqueado</h3>
                  {loadingComiteChecklist ? (
                    <p className="mt-3 text-sm text-stone-500">Carregando checklist…</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {comiteMaterialChecklistItens.map((item) => (
                        <div key={item.id} className="rounded border border-stone-200 p-2 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.concluido}
                              onChange={async () => {
                                const res = await toggleChecklistItem(item.id, !item.concluido);
                                if (!res.ok) {
                                  alert(res.error);
                                  return;
                                }
                                loadComiteChecklist();
                              }}
                              className="h-4 w-4 rounded border-stone-300"
                            />
                            <span className={item.concluido ? 'font-medium text-green-700' : 'text-stone-800'}>{item.titulo}</span>
                          </label>
                          {renderChecklistLinkAnexo('step_5', item.titulo, item.concluido)}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <h3 className="text-sm font-semibold text-stone-800">Comitê Moní</h3>

                  {loadingDadosComite ? (
                    <p className="mt-3 text-sm text-stone-500">Carregando…</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-xs text-stone-500">Resultado do comitê</label>
                        <select
                          value={dadosComite?.comite_resultado ?? 'pendente'}
                          onChange={async (e) => {
                            const value = e.target.value as 'pendente' | 'aprovado' | 'reprovado';
                            const res = await upsertDadosComiteCard(processoId, { comite_resultado: value });
                            if (!res.ok) {
                              alert(res.error);
                              return;
                            }
                            loadDadosComite();
                          }}
                          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                        >
                          <option value="pendente">Pendente</option>
                          <option value="aprovado">Aprovado</option>
                          <option value="reprovado">Reprovado</option>
                        </select>
                      </div>

                      <label className="flex items-center gap-2 rounded border border-stone-200 p-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(dadosComite?.comite_moni_concluido)}
                          onChange={async (e) => {
                            const res = await upsertDadosComiteCard(processoId, { comite_moni_concluido: e.target.checked });
                            if (!res.ok) {
                              alert(res.error);
                              return;
                            }
                            loadDadosComite();
                          }}
                          className="h-4 w-4 rounded border-stone-300"
                        />
                        <span className={dadosComite?.comite_moni_concluido ? 'font-medium text-green-700' : 'text-stone-800'}>
                          Pareceres do comitê
                        </span>
                      </label>

                      <div>
                        <label className="text-xs text-stone-500">Parecer do comitê</label>
                        <textarea
                          defaultValue={dadosComite?.parecer_texto ?? ''}
                          onBlur={async (e) => {
                            const res = await upsertDadosComiteCard(processoId, { parecer_texto: e.target.value || null });
                            if (!res.ok) alert(res.error);
                          }}
                          rows={4}
                          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
                          placeholder="Escreva aqui os pareceres do comitê..."
                        />
                      </div>

                      <div className="relative">
                        <label className="text-xs text-stone-500">Link</label>
                        <input
                          type="url"
                          defaultValue={dadosComite?.link_url ?? ''}
                          onBlur={async (e) => {
                            const res = await upsertDadosComiteCard(processoId, { link_url: e.target.value || null });
                            if (!res.ok) alert(res.error);
                          }}
                          placeholder="https://..."
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1 pr-9 text-xs"
                        />
                        {dadosComite?.link_url ? (
                          <button
                            type="button"
                            onClick={() => copyLinkToClipboard(dadosComite.link_url!)}
                            title={copiedLinkUrl === dadosComite.link_url ? 'Link copiado' : 'Copiar link'}
                            className={`absolute right-2 top-[26px] rounded p-1 ${
                              copiedLinkUrl === dadosComite.link_url ? 'text-green-700' : 'text-stone-500 hover:bg-stone-50'
                            }`}
                          >
                            {copiedLinkUrl === dadosComite.link_url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        ) : null}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-stone-500">Anexo</label>
                        <input
                          type="file"
                          onChange={async (e) => {
                            const file = e.target.files?.[0] ?? null;
                            if (!file) return;
                            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                            const path = `${processoId}/comite-moni/step_5/${crypto.randomUUID()}_${safeName}`;
                            const uploadRes = await supabase.storage.from(BUCKET).upload(path, file, {
                              cacheControl: '3600',
                              upsert: false,
                            });
                            if (uploadRes.error) {
                              alert(uploadRes.error.message);
                              return;
                            }
                            const res = await upsertDadosComiteCard(processoId, {
                              storage_path: path,
                              nome_original: file.name,
                            });
                            if (!res.ok) {
                              alert(res.error);
                              return;
                            }
                            e.currentTarget.value = '';
                            loadDadosComite();
                          }}
                          className="w-full rounded border border-stone-300 px-2 py-1 text-xs file:mr-2 file:rounded file:border-0 file:bg-stone-100 file:px-2 file:py-1"
                        />

                        {dadosComite?.nome_original ? (
                          dadosComite.storage_path ? (
                            <a
                              href={supabase.storage.from(BUCKET).getPublicUrl(dadosComite.storage_path).data.publicUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-[11px] text-stone-600 hover:underline"
                            >
                              Anexo: {dadosComite.nome_original}
                            </a>
                          ) : (
                            <span className="block text-[11px] text-stone-600">Anexo: {dadosComite.nome_original}</span>
                          )
                        ) : null}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            ) : etapaAtual === 'projeto_legal' ? (
              <div className="space-y-4">
                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <h3 className="text-sm font-semibold text-stone-800">Projeto Legal</h3>
                  {loadingProjetoLegalChecklist ? (
                    <p className="mt-3 text-sm text-stone-500">Carregando checklist…</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {projetoLegalChecklistItens.map((item) => (
                        <div key={item.id} className="rounded border border-stone-200 p-2 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.concluido}
                              onChange={async () => {
                                const res = await toggleChecklistItem(item.id, !item.concluido);
                                if (!res.ok) {
                                  alert(res.error);
                                  return;
                                }
                                loadProjetoLegalChecklist();
                              }}
                              className="h-4 w-4 rounded border-stone-300"
                            />
                            <span className={item.concluido ? 'font-medium text-green-700' : 'text-stone-800'}>{item.titulo}</span>
                          </label>
                          {renderChecklistLinkAnexo('projeto_legal', item.titulo, item.concluido)}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : etapaAtual === 'aprovacao_condominio' ? (
              <div className="space-y-4">
                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <h3 className="text-sm font-semibold text-stone-800">Aprovação no Condomínio</h3>
                  {loadingAprovacaoCondominioChecklist ? (
                    <p className="mt-3 text-sm text-stone-500">Carregando checklist…</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {aprovacaoCondominioBaseItens.map((item) => (
                        <div key={item.id} className="rounded border border-stone-200 p-2 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.concluido}
                              onChange={async () => {
                                const res = await toggleChecklistItem(item.id, !item.concluido);
                                if (!res.ok) {
                                  alert(res.error);
                                  return;
                                }
                                loadAprovacaoCondominioChecklist();
                              }}
                              className="h-4 w-4 rounded border-stone-300"
                            />
                            <span className={item.concluido ? 'font-medium text-green-700' : 'text-stone-800'}>{item.titulo}</span>
                          </label>
                          {renderChecklistLinkAnexo('aprovacao_condominio', item.titulo, item.concluido)}
                        </div>
                      ))}
                      <div className="rounded border border-stone-200 p-2 text-sm">
                        <label className="block text-xs text-stone-500">Data de aprovação no condomínio</label>
                        <input
                          type="date"
                          value={dadosPreObraForm.data_aprovacao_condominio}
                          onChange={(e) =>
                            setDadosPreObraForm((prev) => ({
                              ...prev,
                              data_aprovacao_condominio: e.target.value,
                            }))
                          }
                          onBlur={async (e) => {
                            await salvarDadosPreObraParcial({ data_aprovacao_condominio: e.target.value });
                          }}
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-stone-800">Comunique-se Condomínio</h3>
                    <button
                      type="button"
                      onClick={async () => {
                        const nums = aprovacaoCondominioComuniqueItens
                          .map((i) => Number((i.titulo.match(/(\d+)$/)?.[1] ?? '0')))
                          .filter((n) => Number.isFinite(n));
                        const next = (nums.length ? Math.max(...nums) : 0) + 1;
                        const title = `Comunique-se Condomínio ${next}`;
                        const ins = await addChecklistItem(processoId, 'aprovacao_condominio', title, null, null, null, 'nao_iniciada');
                        if (!ins.ok) {
                          alert(ins.error);
                          return;
                        }
                        loadAprovacaoCondominioChecklist();
                      }}
                      className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                    >
                      + Adicionar Comunique-se
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {aprovacaoCondominioComuniqueItens.length === 0 ? (
                      <p className="text-sm text-stone-500">Nenhum Comunique-se criado ainda.</p>
                    ) : (
                      aprovacaoCondominioComuniqueItens.map((item) => (
                        <div key={item.id} className="rounded border border-stone-200 p-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={item.concluido}
                              onChange={async () => {
                                const res = await toggleChecklistItem(item.id, !item.concluido);
                                if (!res.ok) {
                                  alert(res.error);
                                  return;
                                }
                                loadAprovacaoCondominioChecklist();
                              }}
                              className="h-4 w-4 rounded border-stone-300"
                            />
                            <span className={item.concluido ? 'font-medium text-green-700' : 'text-stone-800'}>{item.titulo}</span>
                          </label>
                          <textarea
                            defaultValue={checklistPareceres[item.id] ?? ''}
                            onBlur={async (e) => {
                              const res = await upsertChecklistParecer(item.id, e.target.value || null);
                              if (!res.ok) {
                                alert(res.error);
                                return;
                              }
                              setChecklistPareceres((prev) => ({ ...prev, [item.id]: e.target.value ?? '' }));
                            }}
                            rows={3}
                            className="mt-2 w-full rounded border border-stone-300 px-2 py-1 text-sm"
                            placeholder="Inserir pareceres do condomínio..."
                          />
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            ) : etapaAtual === 'aprovacao_prefeitura' ? (
              <div className="space-y-4">
                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <h3 className="text-sm font-semibold text-stone-800">Aprovação na Prefeitura</h3>
                  {loadingAprovacaoPrefeituraChecklist ? (
                    <p className="mt-3 text-sm text-stone-500">Carregando checklist…</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {aprovacaoPrefeituraBaseItens.map((item) => (
                        <div key={item.id} className="rounded border border-stone-200 p-2 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.concluido}
                              onChange={async () => {
                                const res = await toggleChecklistItem(item.id, !item.concluido);
                                if (!res.ok) {
                                  alert(res.error);
                                  return;
                                }
                                loadAprovacaoPrefeituraChecklist();
                              }}
                              className="h-4 w-4 rounded border-stone-300"
                            />
                            <span className={item.concluido ? 'font-medium text-green-700' : 'text-stone-800'}>{item.titulo}</span>
                          </label>
                          {renderChecklistLinkAnexo('aprovacao_prefeitura', item.titulo, item.concluido)}
                        </div>
                      ))}
                      <div className="rounded border border-stone-200 p-2 text-sm">
                        <label className="block text-xs text-stone-500">Data de aprovação na prefeitura</label>
                        <input
                          type="date"
                          value={dadosPreObraForm.data_aprovacao_prefeitura}
                          onChange={(e) =>
                            setDadosPreObraForm((prev) => ({
                              ...prev,
                              data_aprovacao_prefeitura: e.target.value,
                            }))
                          }
                          onBlur={async (e) => {
                            await salvarDadosPreObraParcial({ data_aprovacao_prefeitura: e.target.value });
                          }}
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="rounded border border-stone-200 p-2 text-sm">
                        <label className="block text-xs text-stone-500">Data de emissão do alvará</label>
                        <input
                          type="date"
                          value={dadosPreObraForm.data_emissao_alvara}
                          onChange={(e) =>
                            setDadosPreObraForm((prev) => ({
                              ...prev,
                              data_emissao_alvara: e.target.value,
                            }))
                          }
                          onBlur={async (e) => {
                            await salvarDadosPreObraParcial({ data_emissao_alvara: e.target.value });
                          }}
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-stone-800">Comunique-se Prefeitura</h3>
                    <button
                      type="button"
                      onClick={async () => {
                        const nums = aprovacaoPrefeituraComuniqueItens
                          .map((i) => Number((i.titulo.match(/(\d+)$/)?.[1] ?? '0')))
                          .filter((n) => Number.isFinite(n));
                        const next = (nums.length ? Math.max(...nums) : 0) + 1;
                        const title = `Comunique-se Prefeitura ${next}`;
                        const ins = await addChecklistItem(processoId, 'aprovacao_prefeitura', title, null, null, null, 'nao_iniciada');
                        if (!ins.ok) {
                          alert(ins.error);
                          return;
                        }
                        loadAprovacaoPrefeituraChecklist();
                      }}
                      className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                    >
                      + Adicionar Comunique-se
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {aprovacaoPrefeituraComuniqueItens.length === 0 ? (
                      <p className="text-sm text-stone-500">Nenhum Comunique-se criado ainda.</p>
                    ) : (
                      aprovacaoPrefeituraComuniqueItens.map((item) => (
                        <div key={item.id} className="rounded border border-stone-200 p-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={item.concluido}
                              onChange={async () => {
                                const res = await toggleChecklistItem(item.id, !item.concluido);
                                if (!res.ok) {
                                  alert(res.error);
                                  return;
                                }
                                loadAprovacaoPrefeituraChecklist();
                              }}
                              className="h-4 w-4 rounded border-stone-300"
                            />
                            <span className={item.concluido ? 'font-medium text-green-700' : 'text-stone-800'}>{item.titulo}</span>
                          </label>
                          <textarea
                            defaultValue={checklistPareceres[item.id] ?? ''}
                            onBlur={async (e) => {
                              const res = await upsertChecklistParecer(item.id, e.target.value || null);
                              if (!res.ok) {
                                alert(res.error);
                                return;
                              }
                              setChecklistPareceres((prev) => ({ ...prev, [item.id]: e.target.value ?? '' }));
                            }}
                            rows={3}
                            className="mt-2 w-full rounded border border-stone-300 px-2 py-1 text-sm"
                            placeholder="Inserir pareceres da prefeitura..."
                          />
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            ) : isEtapaPosAprovacaoPrefeitura(etapaAtual) ? (
              <div className="space-y-4">
                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <h3 className="text-sm font-semibold text-stone-800">
                    {PAINEL_COLUMNS.find((c) => c.key === etapaAtual)?.title ?? etapaAtual}
                  </h3>
                  <p className="mt-2 text-sm text-stone-600">
                    Use a aba <strong>Atividades</strong> para criar tarefas com prazo, time e responsável nesta fase.
                  </p>
                </section>
              </div>
            ) : etapaAtual === 'acoplamento' ? (
              <div className="space-y-4">
                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-stone-800">Checklist Legal (espelho etapa anterior)</h3>
                    <span className="rounded bg-moni-primary/10 px-2 py-0.5 text-xs font-medium text-moni-primary">
                      Step 4
                    </span>
                  </div>

                  {loadingChecklistLegal ? (
                    <p className="mt-3 text-sm text-stone-500">Carregando…</p>
                  ) : !checklistLegalRecord ? (
                    <div className="mt-3 rounded border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                      Nenhum Checklist Legal preenchido para este processo.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3 text-sm">
                      <div>
                        <p className="text-sm font-semibold text-stone-800">Documentos Base</p>
                        <div className="mt-2 space-y-2">
                          <div>
                            <div className="text-xs text-stone-500">Manual do Condomínio</div>
                            <div className="mt-1 space-y-1">
                              {(checklistLegalArquivos.manual_condominio_pdf ?? []).map((f, idx) => {
                                const publicUrl = f.storage_path && supabase.storage.from(BUCKET).getPublicUrl(f.storage_path).data.publicUrl;
                                if (!publicUrl) return null;
                                return (
                                  <a key={`${f.storage_path}-${idx}`} href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-moni-accent hover:underline">
                                    <FileText className="h-4 w-4" />
                                    {f.nome_original ?? 'Arquivo'}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-stone-500">Código de Obras da Subprefeitura</div>
                            <div className="mt-1 space-y-1">
                              {(checklistLegalArquivos.codigo_obras_pdf ?? []).map((f, idx) => {
                                const publicUrl = f.storage_path && supabase.storage.from(BUCKET).getPublicUrl(f.storage_path).data.publicUrl;
                                if (!publicUrl) return null;
                                return (
                                  <a key={`${f.storage_path}-${idx}`} href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-moni-accent hover:underline">
                                    <FileText className="h-4 w-4" />
                                    {f.nome_original ?? 'Arquivo'}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-stone-500">Outros documentos</div>
                            <div className="mt-1 space-y-1">
                              {(checklistLegalArquivos.outros_documentos_pdf ?? []).length === 0 ? (
                                <span className="text-stone-500">—</span>
                              ) : (
                                (checklistLegalArquivos.outros_documentos_pdf ?? []).map((f, idx) => {
                                  const publicUrl = f.storage_path && supabase.storage.from(BUCKET).getPublicUrl(f.storage_path).data.publicUrl;
                                  if (!publicUrl) return null;
                                  return (
                                    <a key={`${f.storage_path}-${idx}`} href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-moni-accent hover:underline">
                                      <FileText className="h-4 w-4" />
                                      {f.nome_original ?? 'Arquivo'}
                                    </a>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {[
                          ['Q1 - Telefone setor aprovações', 'q1_aprov_tel_setor'],
                          ['Q2 - Telefone subprefeitura', 'q2_aprov_tel_subprefeitura'],
                          ['Q3 - Pré-fabricadas/steel frame', 'q3_aprov_pre_fabricadas'],
                          ['Q6 - Taxas e valores', 'q6_aprov_taxas'],
                          ['Q7 - Laudos de sondagem', 'q7_aprov_laud_sondagem'],
                          ['Q10 - Prazo condomínio', 'q10_aprov_prazo_condominio'],
                          ['Q11 - Prazo prefeitura', 'q11_aprov_prazo_prefeitura'],
                          ['Q12 - Recuo frontal', 'q12_terreno_recuo_frontal'],
                          ['Q13 - Recuo lateral', 'q13_terreno_recuo_lateral'],
                          ['Q14 - Recuo fundos', 'q14_terreno_recuo_fundos'],
                          ['Q15 - Taxa ocupação', 'q15_terreno_taxa_ocupacao'],
                          ['Q16 - Coeficiente aproveitamento', 'q16_terreno_coeficiente_aproveitamento'],
                          ['Q17 - Permeabilidade mínima', 'q17_terreno_permeabilidade_minima'],
                          ['Q18 - Regra área permeável', 'q18_terreno_regra_area_permeavel'],
                          ['Q19 - Área construída mínima', 'q19_terreno_area_construida_minima'],
                          ['Q20 - Cobertura/elementos nos recuos', 'q20_terreno_cobertura_recuos'],
                          ['Q21 - Piscinas/casas de máquina/abrigo', 'q21_terreno_piscinas_recuos'],
                          ['Q22 - Edículas permitidas', 'q22_terreno_ediculas_permitidas'],
                          ['Q24 - Especificações edículas', 'q24_terreno_ediculas_especificacoes'],
                          ['Q25 - Altura máxima', 'q25_gabarito_altura_maxima'],
                          ['Q26 - Pavimentos', 'q26_gabarito_pavimentos'],
                          ['Q27 - Subsolos', 'q27_gabarito_subsolos'],
                          ['Q28 - Exceções de gabarito', 'q28_gabarito_excecoes'],
                          ['Q29 - Altura muros', 'q29_divisas_altura_muros'],
                          ['Q30 - Restrição em áreas comuns', 'q30_divisas_restricao_area_comum'],
                          ['Q31 - Muro arrimo (opcional)', 'q31_divisas_muro_arrimo_opcional'],
                          ['Q32 - Áreas gourmet/de lazer', 'q32_divisas_areas_gourmet'],
                          ['Q33 - Alterações nos passeios', 'q33_passeios_alteracoes'],
                          ['Q34 - Paginação nos passeios', 'q34_passeios_paginacao'],
                          ['Q35 - Plantio árvores', 'q35_passeios_plantio_arvores'],
                          ['Q36 - Medidores/abrigos', 'q36_inst_medidores_posicionamento'],
                          ['Q37 - Poços/fossas/sumidouros', 'q37_inst_pocos_fossas'],
                          ['Q38 - Esgoto orientado', 'q38_inst_esgoto_orientado'],
                          ['Q39 - Faixa de servidão', 'q39_inst_faixa_servitude'],
                        ].map(([label, key]) => (
                          <div key={String(key)} className="rounded border border-stone-200 p-2">
                            <div className="text-xs text-stone-500">{label}</div>
                            <div className="mt-1 whitespace-pre-wrap text-stone-800">{strTrim((checklistLegalRespostas as any)[key]) || '—'}</div>
                          </div>
                        ))}
                        <div className="md:col-span-2 rounded border border-stone-200 p-2">
                          <div className="text-xs text-stone-500">Q9 - Documentos solicitados</div>
                          <div className="mt-1 text-stone-800">
                            {(() => {
                              const sel = ((checklistLegalRespostas as any).q9_aprov_doc_solicitados_selecionados as string[] | undefined) ?? [];
                              const outro = strTrim((checklistLegalRespostas as any).q9_aprov_doc_solicitados_outro_text);
                              const base = sel.filter((s) => s !== 'Outro');
                              if (base.length === 0 && !outro) return '—';
                              return `${base.join(', ')}${sel.includes('Outro') ? `; Outro: ${outro || '—'}` : ''}`;
                            })()}
                          </div>
                        </div>
                        <div className="md:col-span-2 rounded border border-stone-200 p-2">
                          <div className="text-xs text-stone-500">Q40 - Outras observações</div>
                          <div className="mt-1 whitespace-pre-wrap text-stone-800">{strTrim(checklistLegalRespostas.q40_outras_observacoes) || '—'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-stone-800">Planialtimétrico (espelho etapa anterior)</h3>
                    <span className="rounded bg-moni-primary/10 px-2 py-0.5 text-xs font-medium text-moni-primary">
                      Step 4
                    </span>
                  </div>

                  {loadingStep4PlanialtimetricoChecklist ? (
                    <p className="mt-3 text-sm text-stone-500">Carregando…</p>
                  ) : step4PlanialtimetricoChecklistItens.length === 0 ? (
                    <div className="mt-3 rounded border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                      Nenhum item de Planialtimétrico preenchido para este processo.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {step4PlanialtimetricoChecklistItens.map((item) => (
                        <div key={item.id} className="rounded border border-stone-200 p-2 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.concluido}
                              readOnly
                              disabled
                              className="h-4 w-4 rounded border-stone-300"
                            />
                            <span className={item.concluido ? 'font-medium text-green-700' : 'text-stone-800'}>{item.titulo}</span>
                          </label>
                          {renderChecklistLinkAnexoEspelho('step_4', item.titulo, item.concluido)}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-3">
                  <h3 className="text-sm font-semibold text-stone-800">Acoplamento</h3>
                  {loadingAcoplamentoChecklist ? (
                    <p className="mt-3 text-sm text-stone-500">Carregando checklist…</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {acoplamentoChecklistItens.map((item) => (
                        <div key={item.id} className="rounded border border-stone-200 p-2 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.concluido}
                              onChange={async () => {
                                const res = await toggleChecklistItem(item.id, !item.concluido);
                                if (!res.ok) {
                                  alert(res.error);
                                  return;
                                }
                                loadAcoplamentoChecklist();
                              }}
                              className="h-4 w-4 rounded border-stone-300"
                            />
                            <span className={item.concluido ? 'font-medium text-green-700' : 'text-stone-800'}>{item.titulo}</span>
                          </label>
                          {renderChecklistLinkAnexo('acoplamento', item.titulo, item.concluido)}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : etapaAtual === 'contabilidade_incorporadora' ? (
              <div className="space-y-4">
                <ChecklistContabilidadeSection processoId={processoId} entidade="incorporadora" />
              </div>
            ) : etapaAtual === 'contabilidade_spe' ? (
              <div className="space-y-4">
                <ChecklistContabilidadeSection processoId={processoId} entidade="spe" />
              </div>
            ) : etapaAtual === 'contabilidade_gestora' ? (
              <div className="space-y-4">
                <ChecklistContabilidadeSection processoId={processoId} entidade="gestora" />
              </div>
            ) : (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
                Sem checklist/anexos configurado para esta etapa.
              </div>
            )
          )}

          {tab === 'checklist' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <select
                  value={filtroChecklistStatus}
                  onChange={(e) =>
                    setFiltroChecklistStatus(
                      e.target.value as 'todos' | 'nao_iniciada' | 'em_andamento' | 'concluido',
                    )
                  }
                  className="rounded border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="todos">Status: todos</option>
                  <option value="nao_iniciada">Status: não iniciada</option>
                  <option value="em_andamento">Status: em andamento</option>
                  <option value="concluido">Status: concluída</option>
                </select>
                <select
                  value={filtroChecklistTime}
                  onChange={(e) => setFiltroChecklistTime(e.target.value)}
                  className="rounded border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="todos">Time: todos</option>
                  {ATIVIDADE_TIMES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                </select>
                <select
                  value={filtroChecklistResponsavel}
                  onChange={(e) => setFiltroChecklistResponsavel(e.target.value)}
                  className="rounded border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="todos">Responsável: todos</option>
                  {checklistResponsaveisPorFiltro.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  value={ordenacaoChecklist}
                  onChange={(e) => setOrdenacaoChecklist(e.target.value as 'responsavel' | 'prazo')}
                  className="rounded border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="prazo">Ordenar por prazo (menor → maior)</option>
                  <option value="responsavel">Ordenar por responsável</option>
                </select>
              </div>

              <div className="rounded-lg border border-moni-primary/25 bg-moni-primary/5 px-3 py-2 text-xs text-stone-700">
                <p className="font-semibold text-stone-800">Vários times e responsáveis</p>
                <p className="mt-1 text-stone-600">
                  Marque <strong>uma ou mais</strong> caixas em Times e em Responsáveis. Para alterar título, prazo,
                  times ou responsáveis depois de criada, use o botão <strong>Editar</strong> à direita de cada
                  atividade.
                </p>
              </div>

              <form onSubmit={handleAddChecklist} className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/60 p-3">
                <p className="text-xs font-semibold text-stone-600">Nova atividade</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_160px_200px_auto]">
                  <input
                    type="text"
                    value={novoChecklistTitulo}
                    onChange={(e) => setNovoChecklistTitulo(e.target.value)}
                    placeholder="Atividade (o que fazer)"
                    className="rounded border border-stone-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={novoChecklistPrazo}
                    onChange={(e) => setNovoChecklistPrazo(e.target.value)}
                    className="rounded border border-stone-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={novoChecklistStatus}
                    onChange={(e) =>
                      setNovoChecklistStatus(e.target.value as 'nao_iniciada' | 'em_andamento' | 'concluido')
                    }
                    className="rounded border border-stone-300 px-3 py-2 text-sm"
                  >
                    <option value="nao_iniciada">Não iniciada</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluido">Concluída</option>
                  </select>
                  <button
                    type="submit"
                    disabled={loadingChecklist}
                    className="rounded bg-moni-primary px-3 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-50"
                  >
                    Adicionar
                  </button>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-stone-600">Times (um ou mais)</p>
                  <div className="flex max-h-32 flex-wrap gap-x-3 gap-y-1 overflow-y-auto rounded border border-stone-200 bg-white p-2">
                    {ATIVIDADE_TIMES.map((time) => (
                      <label key={time} className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-700">
                        <input
                          type="checkbox"
                          checked={novoChecklistTimes.includes(time)}
                          onChange={(e) =>
                            setNovoChecklistTimes((prev) => toggleNomeLista(prev, time, e.target.checked))
                          }
                          className="h-3.5 w-3.5 rounded border-stone-300"
                        />
                        {time}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-stone-600">Responsáveis (um ou mais)</p>
                  <div className="flex max-h-32 flex-wrap gap-x-3 gap-y-1 overflow-y-auto rounded border border-stone-200 bg-white p-2">
                    {checklistResponsaveisParaNovo.map((r) => (
                      <label key={r} className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-700">
                        <input
                          type="checkbox"
                          checked={novoChecklistResponsaveis.includes(r)}
                          onChange={(e) =>
                            setNovoChecklistResponsaveis((prev) => toggleNomeLista(prev, r, e.target.checked))
                          }
                          className="h-3.5 w-3.5 rounded border-stone-300"
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                </div>
              </form>

              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Atividades do card</p>
              <ul className="space-y-2">
                {checklistItensFiltradosOrdenados.map((item) => (
                  <li key={item.id} className="rounded-lg border border-stone-200 bg-white p-2">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={item.concluido}
                        onChange={() => handleToggleChecklist(item.id, item.concluido)}
                        className="mt-1 h-4 w-4 rounded border-stone-300"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${item.concluido ? 'text-stone-400 line-through' : 'text-stone-800'}`}
                          style={{ wordBreak: 'break-word' }}
                        >
                          <span className="font-medium">Atividade:</span> {item.titulo}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                          <span>
                            Prazo: <span className="font-medium text-stone-600">{item.prazo ?? '—'}</span>
                          </span>
                          <span>
                            Times: <span className="font-medium text-stone-600">{item.time_nome?.trim() || '—'}</span>
                          </span>
                          <span>
                            Responsáveis:{' '}
                            <span className="font-medium text-stone-600">{item.responsavel_nome?.trim() || '—'}</span>
                          </span>
                          {getPrazoTag(item.prazo, item.status, item.concluido) === 'atrasado' && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800">Atrasado</span>
                          )}
                          {getPrazoTag(item.prazo, item.status, item.concluido) === 'atencao' && (
                            <span className="rounded bg-yellow-100 px-1.5 py-0.5 font-medium text-yellow-800">Atenção</span>
                          )}
                          <select
                            value={item.status}
                            disabled={updatingChecklistStatusId === item.id}
                            onChange={(e) =>
                              handleChangeChecklistStatus(
                                item.id,
                                e.target.value as 'nao_iniciada' | 'em_andamento' | 'concluido',
                              )
                            }
                            className="ml-auto min-w-[170px] rounded border border-stone-300 px-2 py-1 text-xs"
                          >
                            <option value="nao_iniciada">Não iniciada</option>
                            <option value="em_andamento">Em andamento</option>
                            <option value="concluido">Concluída</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
                        <button
                          type="button"
                          onClick={() =>
                            setAtividadeEdicao({
                              id: item.id,
                              titulo: item.titulo,
                              prazoIso: prazoDbToDateInput(item.prazo),
                              times:
                                item.times_nomes.length > 0
                                  ? [...item.times_nomes]
                                  : (item.time_nome ?? '')
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                              responsaveis:
                                item.responsaveis_nomes.length > 0
                                  ? [...item.responsaveis_nomes]
                                  : (item.responsavel_nome ?? '')
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                              status: item.status,
                            })
                          }
                          className="inline-flex items-center justify-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800 shadow-sm hover:bg-stone-50"
                        >
                          <Pencil className="h-3.5 w-3.5 text-moni-primary" aria-hidden />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveChecklist(item.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                    {atividadeEdicao?.id === item.id ? (
                      <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
                        <p className="text-xs font-semibold text-stone-600">Editar atividade</p>
                        <input
                          type="text"
                          value={atividadeEdicao.titulo}
                          onChange={(e) => setAtividadeEdicao((p) => (p ? { ...p, titulo: e.target.value } : p))}
                          className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                        />
                        <input
                          type="date"
                          value={atividadeEdicao.prazoIso}
                          onChange={(e) => setAtividadeEdicao((p) => (p ? { ...p, prazoIso: e.target.value } : p))}
                          className="w-full max-w-[200px] rounded border border-stone-300 px-3 py-2 text-sm"
                        />
                        <div>
                          <p className="mb-1 text-xs font-medium text-stone-600">Times</p>
                          <div className="flex max-h-28 flex-wrap gap-x-3 gap-y-1 overflow-y-auto rounded border border-stone-200 bg-stone-50/80 p-2">
                            {ATIVIDADE_TIMES.map((time) => (
                              <label key={time} className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-700">
                                <input
                                  type="checkbox"
                                  checked={atividadeEdicao.times.includes(time)}
                                  onChange={(e) =>
                                    setAtividadeEdicao((p) =>
                                      p
                                        ? { ...p, times: toggleNomeLista(p.times, time, e.target.checked) }
                                        : p,
                                    )
                                  }
                                  className="h-3.5 w-3.5 rounded border-stone-300"
                                />
                                {time}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium text-stone-600">Responsáveis</p>
                          <div className="flex max-h-28 flex-wrap gap-x-3 gap-y-1 overflow-y-auto rounded border border-stone-200 bg-stone-50/80 p-2">
                            {checklistResponsaveisParaEdicao.map((r) => (
                              <label key={r} className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-700">
                                <input
                                  type="checkbox"
                                  checked={atividadeEdicao.responsaveis.includes(r)}
                                  onChange={(e) =>
                                    setAtividadeEdicao((p) =>
                                      p
                                        ? {
                                            ...p,
                                            responsaveis: toggleNomeLista(p.responsaveis, r, e.target.checked),
                                          }
                                        : p,
                                    )
                                  }
                                  className="h-3.5 w-3.5 rounded border-stone-300"
                                />
                                {r}
                              </label>
                            ))}
                          </div>
                        </div>
                        <select
                          value={atividadeEdicao.status}
                          onChange={(e) =>
                            setAtividadeEdicao((p) =>
                              p
                                ? {
                                    ...p,
                                    status: e.target.value as 'nao_iniciada' | 'em_andamento' | 'concluido',
                                  }
                                : p,
                            )
                          }
                          className="rounded border border-stone-300 px-2 py-1 text-sm"
                        >
                          <option value="nao_iniciada">Não iniciada</option>
                          <option value="em_andamento">Em andamento</option>
                          <option value="concluido">Concluída</option>
                        </select>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={salvandoEdicaoAtividade}
                            onClick={() => void handleSalvarEdicaoAtividade()}
                            className="rounded bg-moni-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-moni-secondary disabled:opacity-50"
                          >
                            {salvandoEdicaoAtividade ? 'Salvando…' : 'Salvar alterações'}
                          </button>
                          <button
                            type="button"
                            disabled={salvandoEdicaoAtividade}
                            onClick={() => setAtividadeEdicao(null)}
                            className="rounded border border-stone-300 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
                {checklistItensFiltradosOrdenados.length === 0 && (
                  <li className="rounded border border-dashed border-stone-300 bg-stone-50 p-3 text-sm text-stone-500">
                    Nenhuma atividade encontrada para os filtros selecionados.
                  </li>
                )}
              </ul>
            </div>
          )}

          {tab === 'documentos' && (
            <div className="space-y-4">
              {loadingDocumentos ? (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
                  Carregando documentos…
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={novoDocumentoLoading}
                  onClick={async () => {
                    setNovoDocumentoLoading(true);
                    const res = await addDocumentoCard(processoId, etapaAtual, 'Documento');
                    setNovoDocumentoLoading(false);
                    if (res.ok) await loadDocumentos();
                    else alert(res.error);
                  }}
                  className="rounded bg-moni-primary px-3 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-50"
                >
                  {novoDocumentoLoading ? 'Adicionando…' : 'Adicionar documento'}
                </button>
              </div>

              <div className="space-y-3">
                {documentosItens.map((doc) => {
                  const publicUrl =
                    doc.storage_path && supabase.storage.from(BUCKET).getPublicUrl(doc.storage_path).data.publicUrl;
                  return (
                    <div key={doc.id} className="rounded-lg border border-stone-200 bg-white p-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_220px_1fr]">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-stone-600">
                            Nome do documento
                          </label>
                          <input
                            type="text"
                            value={doc.titulo}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDocumentosItens((prev) => prev.map((x) => (x.id === doc.id ? { ...x, titulo: v } : x)));
                            }}
                            onBlur={async (e) => {
                              const v = e.target.value;
                              const res = await updateDocumentoCardTitulo(doc.id, v);
                              if (!res.ok) alert(res.error);
                            }}
                            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-stone-600">
                            Anexo
                          </label>
                          <div className="space-y-2">
                            <input
                              type="file"
                              onChange={async (e) => {
                                const file = e.target.files?.[0] ?? null;
                                if (!file) return;
                                setUploadingDocumentoId(doc.id);
                                try {
                                  const path = `${processoId}/card-docs/${String(etapaAtual)}/${crypto.randomUUID()}_${file.name.replace(
                                    /[^a-zA-Z0-9._-]/g,
                                    '_',
                                  )}`;
                                  const uploadRes = await supabase.storage
                                    .from(BUCKET)
                                    .upload(path, file, { cacheControl: '3600', upsert: false });
                                  if (uploadRes.error) throw uploadRes.error;
                                  const res = await updateDocumentoCardAnexo(doc.id, path, file.name);
                                  if (!res.ok) throw new Error(res.error);
                                  await loadDocumentos();
                                } catch (err) {
                                  alert(err instanceof Error ? err.message : 'Erro ao enviar arquivo.');
                                } finally {
                                  setUploadingDocumentoId(null);
                                  e.currentTarget.value = '';
                                }
                              }}
                              disabled={uploadingDocumentoId === doc.id}
                              className="w-full text-sm text-stone-600 file:mr-2 file:rounded file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:text-stone-800"
                            />
                            {doc.storage_path && publicUrl ? (
                              <a
                                href={publicUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-xs font-medium text-moni-accent hover:underline"
                              >
                                Anexo: {doc.nome_original ?? 'Arquivo'}
                              </a>
                            ) : (
                              <p className="text-xs text-stone-400">Nenhum anexo</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-stone-600">
                            Link
                          </label>
                          <div className="space-y-2">
                            <div className="relative">
                              <input
                                type="url"
                                value={doc.link_url ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setDocumentosItens((prev) => prev.map((x) => (x.id === doc.id ? { ...x, link_url: v } : x)));
                                }}
                                onBlur={async (e) => {
                                  const v = e.target.value;
                                  const res = await updateDocumentoCardLink(doc.id, v);
                                  if (!res.ok) alert(res.error);
                                }}
                                placeholder="https://..."
                                className="w-full rounded-lg border border-stone-300 px-3 py-2 pr-10 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                              />

                              {doc.link_url ? (
                                <button
                                  type="button"
                                  onClick={() => copyLinkToClipboard(doc.link_url as string)}
                                  title={copiedLinkUrl === doc.link_url ? 'Link copiado' : 'Copiar link'}
                                  className={`absolute right-2 top-1/2 -translate-y-1 rounded p-1 ${
                                    copiedLinkUrl === doc.link_url ? 'text-green-700' : 'text-stone-500 hover:bg-stone-50'
                                  }`}
                                >
                                  {copiedLinkUrl === doc.link_url ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await removeDocumentoCard(doc.id);
                            if (!res.ok) alert(res.error);
                            else await loadDocumentos();
                          }}
                          className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  );
                })}

                {documentosItens.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-stone-200 p-4 text-center text-sm text-stone-400">
                    Nenhum documento ainda.
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
