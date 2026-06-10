import type { ReactNode } from 'react';
import { parseIsoDateOnlyLocal } from '@/lib/dias-uteis';
import { prazoIsoEfetivoSla, type PrazoNegociacaoCampos } from '@/lib/kanban/prazo-negociacao';
import { MONI_RESP_FILTRO_PREFIX, MONI_TIME_FILTRO_PREFIX } from '@/lib/times-responsaveis';
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  CheckCircle2,
  FileEdit,
  History,
  ListPlus,
  Pencil,
  PlusCircle,
  Tag,
} from 'lucide-react';
import type { SubInteracaoStatusDb } from '@/lib/actions/card-actions';
import { nomesTimesIncluemBombeiro } from '@/lib/kanban/chamados-validacao';
import type { SubInteracaoTipoDb } from '@/types/kanban-subinteracao';

export type InteracaoModal = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria?: 'chamado' | 'melhoria';
  tipo: 'atividade' | 'duvida' | 'proposicoes';
  times_ids: string[] | null;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
  data_vencimento: string | null;
  responsavel_id: string | null;
  /** Quando `responsavel_id` é null: nome livre (ex.: responsável externo). */
  responsavel_nome_texto?: string | null;
  /** Migration 117 — múltiplos responsáveis. */
  responsaveis_ids: string[];
  trava: boolean;
  time: string | null;
  created_at: string;
  concluida_em: string | null;
  /** Quem abriu o chamado (portal Frank: só este usuário pode anexar). */
  criado_por: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
  times_resolvidos?: { id: string; nome: string }[];
  responsaveis_resolvidos?: { id: string; nome: string }[];
  /** Quando true, linha oculta no modal (filtrada após carregar). */
  arquivado?: boolean;
  /** Número sequencial global (#0001). */
  numero?: number | null;
  /** Chamado Sirene espelhado (origem sirene). */
  sirene_chamado_id?: number | null;
};

export type SubInteracaoModal = {
  id: string;
  interacao_id: string;
  tipo: SubInteracaoTipoDb;
  nome: string;
  descricao: string;
  descricao_detalhe: string | null;
  times_ids: string[];
  responsaveis_ids: string[];
  times_resolvidos: { id: string; nome: string }[];
  responsaveis_resolvidos: { id: string; nome: string }[];
  data_fim: string | null;
  prazo_proposto: string | null;
  prazo_status: string | null;
  prazo_abridor_id: string | null;
  prazo_proposto_por: string | null;
  prazo_negociacao_expira_em: string | null;
  status: SubInteracaoStatusDb;
  trava: boolean;
  pastel: boolean;
  historico: Array<{ tipo: string; em: string; por?: string | null }>;
};

export function prazoSlaSubInteracao(sub: PrazoNegociacaoCampos): string | null {
  return prazoIsoEfetivoSla(sub);
}

function ymdFromDb(v: unknown): string | null {
  if (v == null || String(v).trim() === '') return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Campos de negociação vindos do SELECT em `sirene_topicos`. */
export function camposPrazoNegociacaoDeTopicoRow(t: Record<string, unknown>): Pick<
  SubInteracaoModal,
  'prazo_proposto' | 'prazo_status' | 'prazo_abridor_id' | 'prazo_proposto_por' | 'prazo_negociacao_expira_em'
> {
  return {
    prazo_proposto: ymdFromDb(t.prazo_proposto),
    prazo_status: t.prazo_status != null ? String(t.prazo_status) : null,
    prazo_abridor_id:
      t.prazo_abridor_id != null && String(t.prazo_abridor_id).trim() !== ''
        ? String(t.prazo_abridor_id)
        : null,
    prazo_proposto_por:
      t.prazo_proposto_por != null && String(t.prazo_proposto_por).trim() !== ''
        ? String(t.prazo_proposto_por)
        : null,
    prazo_negociacao_expira_em:
      t.prazo_negociacao_expira_em != null ? String(t.prazo_negociacao_expira_em) : null,
  };
}

export type KanbanTimeRow = { id: string; nome: string };

/** Responsável da sub-atividade, fora do time Bombeiro — pode marcar Pastel no modal. */
export function usuarioPodeMarcarPastelSubInteracao(
  sub: Pick<SubInteracaoModal, 'responsaveis_ids' | 'times_resolvidos'>,
  userId: string | null | undefined,
): boolean {
  if (userId == null || String(userId).trim() === '') return false;
  const uid = String(userId);
  if (!sub.responsaveis_ids.some((id) => String(id) === uid)) return false;
  const nomes = sub.times_resolvidos.map((t) => t.nome);
  return !nomesTimesIncluemBombeiro(nomes);
}

/** Variante para linhas do painel Sirene (`TopicoPainelLinha`). */
export function usuarioPodeMarcarPastelTopicoPainel(
  topico: { responsaveis_ids: string[]; times_ids: string[]; time_responsavel?: string },
  timesCatalog: { id: string; nome: string }[],
  userId: string | null | undefined,
): boolean {
  const timesResolvidos =
    topico.times_ids.length > 0
      ? topico.times_ids.map((id) => ({
          id,
          nome: timesCatalog.find((t) => t.id === id)?.nome ?? '',
        }))
      : topico.time_responsavel?.trim()
        ? [{ id: '', nome: topico.time_responsavel.trim() }]
        : [];
  return usuarioPodeMarcarPastelSubInteracao(
    { responsaveis_ids: topico.responsaveis_ids, times_resolvidos: timesResolvidos },
    userId,
  );
}

export function nomeTimeParaSlugLegado(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

export function slaInteracaoBadge(
  dataVencimento: string | null,
  status: InteracaoModal['status'],
): 'atrasado' | 'vence_hoje' | null {
  if (status === 'concluida' || status === 'cancelada') return null;
  if (!dataVencimento) return null;
  const d = parseIsoDateOnlyLocal(dataVencimento);
  if (!d || !Number.isFinite(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alvo = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (alvo.getTime() < today.getTime()) return 'atrasado';
  if (alvo.getTime() === today.getTime()) return 'vence_hoje';
  return null;
}

/** Prazo exibido/SLA: com sub-interações abertas, o último `data_fim`; senão o do chamado. */
export function prazoEfetivoParaChamado(it: InteracaoModal, subs: SubInteracaoModal[]): string | null {
  const chamadoYmd = (): string | null => {
    const v = it.data_vencimento ? String(it.data_vencimento).trim().slice(0, 10) : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  };
  if (!subs.length) return chamadoYmd();

  const datas = subs
    .filter((s) => s.status !== 'concluido')
    .map((s) => prazoIsoEfetivoSla(s))
    .filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const ultimo = datas.length > 0 ? datas[datas.length - 1]! : null;
  return ultimo ?? chamadoYmd();
}

const subConcluida = (s: SubInteracaoModal) => s.status === 'concluido' || s.status === 'aprovado';

function startLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Com sub-interações, o status exibido segue regras só visuais (não persiste).
 * `alertaSubAtrasada`: sub com `data_fim` &lt; hoje e não concluída — badge laranja ao lado do status.
 */
export function derivarChamadoKanbanComSubs(
  statusManual: InteracaoModal['status'],
  subs: SubInteracaoModal[],
): { usarDerivado: boolean; status: InteracaoModal['status']; alertaSubAtrasada: boolean } {
  if (subs.length === 0) {
    return { usarDerivado: false, status: statusManual, alertaSubAtrasada: false };
  }
  const hoje = startLocal(new Date());
  const prazoSubPassou = (s: SubInteracaoModal) => {
    const prazo = prazoIsoEfetivoSla(s);
    if (!prazo || subConcluida(s)) return false;
    const p = parseIsoDateOnlyLocal(prazo);
    if (!p) return false;
    return startLocal(p).getTime() < hoje.getTime();
  };
  const alertaSubAtrasada = subs.some((s) => prazoSubPassou(s));

  if (subs.every(subConcluida)) {
    return { usarDerivado: true, status: 'concluida', alertaSubAtrasada: false };
  }
  if (subs.some((s) => s.status === 'em_andamento')) {
    return { usarDerivado: true, status: 'em_andamento', alertaSubAtrasada };
  }
  if (alertaSubAtrasada) {
    return { usarDerivado: false, status: statusManual, alertaSubAtrasada: true };
  }
  return { usarDerivado: false, status: statusManual, alertaSubAtrasada: false };
}

export function tagsTimesParaLinha(it: InteracaoModal, catalog: KanbanTimeRow[]): { id: string; nome: string }[] {
  if (it.times_resolvidos && it.times_resolvidos.length > 0) return it.times_resolvidos;
  const ids = it.times_ids ?? [];
  if (ids.length > 0 && catalog.length > 0) {
    const map = new Map(catalog.map((t) => [t.id, t.nome]));
    return ids.map((id) => ({ id, nome: map.get(id) ?? id.slice(0, 8) }));
  }
  if (it.time?.trim()) return [{ id: '_legado', nome: it.time.replace(/_/g, ' ') }];
  return [];
}

/** Times únicos de todas as atividades abertas do chamado (fallback ao pai legado). */
export function tagsTimesDeAtividades(
  it: InteracaoModal,
  subs: SubInteracaoModal[],
  catalog: KanbanTimeRow[],
): { id: string; nome: string }[] {
  if (subs.length > 0) {
    const seen = new Map<string, { id: string; nome: string }>();
    for (const sub of subs) {
      for (const t of sub.times_resolvidos ?? []) {
        if (!seen.has(t.id)) seen.set(t.id, t);
      }
      if ((sub.times_resolvidos ?? []).length === 0) {
        for (const id of sub.times_ids ?? []) {
          if (seen.has(id)) continue;
          const hit = catalog.find((x) => x.id === id);
          seen.set(id, { id, nome: hit?.nome ?? id.slice(0, 8) });
        }
      }
    }
    if (seen.size > 0) return [...seen.values()];
  }
  return tagsTimesParaLinha(it, catalog);
}

/** Trava efetiva: apenas no chamado (interação pai / sirene_chamados), nunca em atividades. */
export function travaEfetivaParaChamado(it: InteracaoModal, _subs?: SubInteracaoModal[]): boolean {
  return Boolean(it.trava);
}

function subPassaFiltroTime(
  sub: SubInteracaoModal,
  filtroId: string,
  catalog: KanbanTimeRow[],
): boolean {
  if (filtroId === 'todos') return true;
  if (filtroId.startsWith(MONI_TIME_FILTRO_PREFIX)) {
    const nome = filtroId.slice(MONI_TIME_FILTRO_PREFIX.length).trim().toLowerCase();
    if (!nome) return false;
    for (const t of sub.times_resolvidos ?? []) {
      if (t.nome.trim().toLowerCase() === nome) return true;
    }
    for (const id of sub.times_ids ?? []) {
      const hit = catalog.find((x) => x.id === id);
      if (hit && hit.nome.trim().toLowerCase() === nome) return true;
    }
    return false;
  }
  return (sub.times_ids ?? []).includes(filtroId);
}

function subPassaFiltroResponsavel(sub: SubInteracaoModal, filtroId: string): boolean {
  if (filtroId === 'todos') return true;
  const ids = [...(sub.responsaveis_ids ?? [])];
  return ids.includes(filtroId);
}

export function interacaoPassaFiltroTimeComSubs(
  it: InteracaoModal,
  subs: SubInteracaoModal[],
  filtroId: string,
  catalog: KanbanTimeRow[],
): boolean {
  if (filtroId === 'todos') return true;
  if (subs.length > 0) {
    return subs.some((s) => subPassaFiltroTime(s, filtroId, catalog));
  }
  return interacaoPassaFiltroTime(it, filtroId, catalog);
}

export function interacaoPassaFiltroResponsavelComSubs(
  it: InteracaoModal,
  subs: SubInteracaoModal[],
  filtroId: string,
): boolean {
  if (filtroId === 'todos') return true;
  if (subs.length > 0) {
    return subs.some((s) => subPassaFiltroResponsavel(s, filtroId));
  }
  return interacaoPassaFiltroResponsavel(it, filtroId);
}

export function interacaoPassaFiltroTime(
  it: InteracaoModal,
  filtroId: string,
  catalog: KanbanTimeRow[],
): boolean {
  if (filtroId === 'todos') return true;
  if (filtroId.startsWith(MONI_TIME_FILTRO_PREFIX)) {
    const nome = filtroId.slice(MONI_TIME_FILTRO_PREFIX.length).trim();
    if (!nome) return false;
    const n = nome.toLowerCase();
    for (const t of tagsTimesParaLinha(it, catalog)) {
      if (t.nome.trim().toLowerCase() === n) return true;
    }
    if (it.time) {
      const slug = nomeTimeParaSlugLegado(nome);
      if (it.time.toLowerCase() === slug) return true;
    }
    return false;
  }
  if ((it.times_ids ?? []).includes(filtroId)) return true;
  const sel = catalog.find((t) => t.id === filtroId);
  if (sel && it.time) {
    const slug = nomeTimeParaSlugLegado(sel.nome);
    if (it.time.toLowerCase() === slug) return true;
  }
  return false;
}

export function interacaoPassaFiltroResponsavel(it: InteracaoModal, filtroId: string): boolean {
  if (filtroId === 'todos') return true;
  if (filtroId.startsWith(MONI_RESP_FILTRO_PREFIX)) {
    let nome = '';
    try {
      nome = decodeURIComponent(filtroId.slice(MONI_RESP_FILTRO_PREFIX.length)).trim();
    } catch {
      nome = filtroId.slice(MONI_RESP_FILTRO_PREFIX.length).trim();
    }
    if (!nome) return false;
    const nomes: string[] = [];
    for (const r of it.responsaveis_resolvidos ?? []) {
      const x = r.nome?.trim();
      if (x) nomes.push(x);
    }
    const pf = it.profiles?.full_name?.trim();
    if (pf) nomes.push(pf);
    const txt = it.responsavel_nome_texto?.trim();
    if (txt) nomes.push(txt);
    return nomes.some((x) => x === nome);
  }
  const ids = [...(it.responsaveis_ids ?? [])];
  if (it.responsavel_id) ids.push(it.responsavel_id);
  return ids.includes(filtroId);
}

export type HistoricoItem = {
  id: string;
  acao: string;
  usuario_nome: string | null;
  detalhe: Record<string, unknown> | null;
  criado_em: string;
};

export type ComentarioCardAnexoRow = {
  id: string;
  nome_original: string;
  storage_path: string;
  mime_type: string | null;
};

export type ComentarioCardRow = {
  id: string;
  conteudo: string;
  created_at: string;
  autor_id: string | null;
  autor_nome: string | null;
  anexos?: ComentarioCardAnexoRow[];
};

export type SecaoEsquerdaId =
  | 'cronologia'
  | 'franqueado'
  | 'condominio'
  | 'novoNegocio'
  | 'preObra'
  | 'obra'
  | 'documentacaoCreditoObra'
  | 'relacionamentos'
  | 'atasReuniao'
  | 'chamados'
  | 'historico';

export function isoDateOffsetDays(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** UUID (Postgres gen_random_uuid / padrão RFC) — nunca tratado como linha de demo embutida. */
const UUID_INTERACAO_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Apenas IDs dos placeholders `interacoesDemonstracao()` (`__funil_demo_*`)
 * ou futuros `demo-1`, `demo-2`, etc. Dados reais do banco usam UUID e retornam false.
 */
export function isInteracaoDemonstracao(id: unknown): boolean {
  const s = String(id ?? '').trim();
  if (!s) return false;
  if (UUID_INTERACAO_RE.test(s)) return false;
  if (s.startsWith('__funil_demo_')) return true;
  if (s.toLowerCase().startsWith('demo-')) return true;
  return false;
}

/** Chamado persistido em aberto (exclui demo e status finais). */
export function interacaoChamadoEmAberto(it: InteracaoModal): boolean {
  if (isInteracaoDemonstracao(it.id)) return false;
  return it.status !== 'concluida' && it.status !== 'cancelada';
}

export function countChamadosAbertosNoCard(interacoes: InteracaoModal[]): number {
  return interacoes.filter(interacaoChamadoEmAberto).length;
}

/**
 * Exemplos **somente visuais** para testar layout (prazos, badges, listas) no modal/cartão
 * em modo demonstração. Não há UUIDs reais: `responsavel_id` fica `null`, `responsaveis_ids`
 * vazio. O **Painel de Chamados** e dados persistidos vêm sempre do banco; isto não substitui
 * dados reais. `data_vencimento` usa `isoDateOffsetDays` (passado/futuro) só para variar a UI.
 */
export function interacoesDemonstracao(): InteracaoModal[] {
  const now = new Date().toISOString();
  return [
    {
      id: '__funil_demo_concluida__',
      titulo: 'Levantar dados cadastrais do município',
      descricao: 'Coletar informações básicas: população, PIB, taxa de crescimento',
      tipo: 'atividade',
      times_ids: [],
      responsaveis_ids: [],
      trava: false,
      status: 'concluida',
      prioridade: 'alta',
      data_vencimento: isoDateOffsetDays(-18),
      responsavel_id: null,
      time: 'operacoes',
      created_at: now,
      concluida_em: now,
      criado_por: null,
    },
    {
      id: '__funil_demo_andamento__',
      titulo: 'Validar informações com a prefeitura',
      descricao: 'Confirmar dados junto aos órgãos oficiais',
      tipo: 'atividade',
      times_ids: [],
      responsaveis_ids: [],
      trava: false,
      status: 'em_andamento',
      prioridade: 'alta',
      data_vencimento: isoDateOffsetDays(0),
      responsavel_id: null,
      time: 'juridico',
      created_at: now,
      concluida_em: null,
      criado_por: null,
    },
    {
      id: '__funil_demo_prazo_atencao__',
      titulo: 'Agendar reunião com corretores locais',
      descricao: 'Marcar encontro para entender dinâmica do mercado imobiliário',
      tipo: 'duvida',
      times_ids: [],
      responsaveis_ids: [],
      trava: false,
      status: 'pendente',
      prioridade: 'normal',
      data_vencimento: isoDateOffsetDays(1),
      responsavel_id: null,
      time: 'comercial',
      created_at: now,
      concluida_em: null,
      criado_por: null,
    },
    {
      id: '__funil_demo_urgente__',
      titulo: 'Solicitar certidões e documentos necessários',
      descricao: 'Reunir toda documentação legal para análise de viabilidade',
      tipo: 'atividade',
      times_ids: [],
      responsaveis_ids: [],
      trava: false,
      status: 'pendente',
      prioridade: 'urgente',
      data_vencimento: isoDateOffsetDays(21),
      responsavel_id: null,
      time: 'juridico',
      created_at: now,
      concluida_em: null,
      criado_por: null,
    },
    {
      id: '__funil_demo_atrasado__',
      titulo: 'Preparar relatório fotográfico da região',
      descricao: 'Fazer registros visuais dos principais pontos de interesse',
      tipo: 'atividade',
      times_ids: [],
      responsaveis_ids: [],
      trava: false,
      status: 'pendente',
      prioridade: 'baixa',
      data_vencimento: isoDateOffsetDays(-12),
      responsavel_id: null,
      time: 'comercial',
      created_at: now,
      concluida_em: null,
      criado_por: null,
    },
  ];
}

export function formatDataHoraHistorico(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month} às ${h}h${min}`;
}

export function rotuloUsuarioHistorico(nome: string | null | undefined): string {
  const n = nome?.trim();
  if (n) return n;
  return 'Sistema';
}

export function textoResumidoAcaoHistorico(acao: string, detalhe: Record<string, unknown> | null): string {
  const d = detalhe ?? {};
  switch (acao) {
    case 'fase_avancada':
      return `Fase avançada para ${String(d.fase_nova_nome ?? '—')}`;
    case 'fase_retrocedida':
      return `Fase retrocedida para ${String(d.fase_nova_nome ?? '—')}`;
    case 'card_criado':
      return 'Card criado';
    case 'card_arquivado':
      return 'Card arquivado';
    case 'card_concluido':
      return 'Card finalizado';
    case 'interacao_criada':
      return `Novo chamado: ${String(d.titulo ?? '').trim() || '—'}`;
    case 'interacao_arquivada':
      return `Chamado arquivado: ${String(d.titulo ?? '').trim() || '—'}`;
    case 'interacao_editada': {
      if (d.status_novo != null) return `Chamado atualizado (status: ${String(d.status_novo)})`;
      if (d.titulo_novo != null) return `Chamado renomeado para "${String(d.titulo_novo)}"`;
      if (d.descricao_alterada) return 'Descrição do chamado alterada';
      if (d.data_vencimento_nova != null) return 'Prazo do chamado alterado';
      return 'Chamado atualizado';
    }
    case 'comentario_criado':
      return 'Comentário publicado no card';
    case 'tag_vinculada':
      return `Tag adicionada: ${String(d.tag_nome ?? '').trim() || '—'}`;
    case 'tag_removida':
      return `Tag removida: ${String(d.tag_nome ?? '').trim() || '—'}`;
    case 'sla_justificado': {
      const fase = String(d.fase_nome ?? '').trim();
      return fase ? `Justificativa de quebra de SLA (${fase})` : 'Justificativa de quebra de SLA registrada';
    }
    case 'campo_alterado': {
      const desc = String(d.descricao ?? '').trim();
      if (desc) return desc;
      const campos = d.campos;
      if (Array.isArray(campos) && campos.length > 0) {
        const nomes = campos
          .map((c) => (c && typeof c === 'object' ? String((c as { campo?: string }).campo ?? '') : ''))
          .filter(Boolean);
        if (nomes.length) return `Campos alterados: ${nomes.join(', ')}`;
      }
      return 'Campo do card alterado';
    }
    default:
      return acao.replace(/_/g, ' ');
  }
}

export function iconeHistoricoAcao(acao: string): ReactNode {
  const className = 'h-4 w-4 shrink-0 text-stone-500';
  switch (acao) {
    case 'fase_avancada':
      return <ArrowRight className={className} aria-hidden />;
    case 'fase_retrocedida':
      return <ArrowLeft className={className} aria-hidden />;
    case 'card_criado':
      return <PlusCircle className={className} aria-hidden />;
    case 'interacao_criada':
      return <ListPlus className={className} aria-hidden />;
    case 'interacao_editada':
      return <Pencil className={className} aria-hidden />;
    case 'campo_alterado':
      return <FileEdit className={className} aria-hidden />;
    case 'card_arquivado':
      return <Archive className={className} aria-hidden />;
    case 'card_concluido':
      return <CheckCircle2 className={className} aria-hidden />;
    case 'comentario_criado':
      return <FileEdit className={className} aria-hidden />;
    case 'tag_vinculada':
    case 'tag_removida':
      return <Tag className={className} aria-hidden />;
    case 'interacao_arquivada':
      return <Archive className={className} aria-hidden />;
    default:
      return <History className={className} aria-hidden />;
  }
}
