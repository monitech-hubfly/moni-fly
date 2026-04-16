import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  FileEdit,
  History,
  ListPlus,
  Pencil,
  PlusCircle,
} from 'lucide-react';
import type { SubInteracaoStatusDb } from '@/lib/actions/card-actions';

export type InteracaoModal = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: 'atividade' | 'duvida';
  times_ids: string[] | null;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
  data_vencimento: string | null;
  responsavel_id: string | null;
  /** Migration 117 — múltiplos responsáveis. */
  responsaveis_ids: string[];
  trava: boolean;
  time: string | null;
  created_at: string;
  concluida_em: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
  times_resolvidos?: { id: string; nome: string }[];
  responsaveis_resolvidos?: { id: string; nome: string }[];
};

export type SubInteracaoModal = {
  id: string;
  interacao_id: string;
  descricao: string;
  times_ids: string[];
  responsaveis_ids: string[];
  times_resolvidos: { id: string; nome: string }[];
  responsaveis_resolvidos: { id: string; nome: string }[];
  data_fim: string | null;
  status: SubInteracaoStatusDb;
  trava: boolean;
};

export type KanbanTimeRow = { id: string; nome: string };

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
  const raw = String(dataVencimento).trim().slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
    : new Date(dataVencimento);
  if (!Number.isFinite(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alvo = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (alvo.getTime() < today.getTime()) return 'atrasado';
  if (alvo.getTime() === today.getTime()) return 'vence_hoje';
  return null;
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

export function interacaoPassaFiltroTime(
  it: InteracaoModal,
  filtroId: string,
  catalog: KanbanTimeRow[],
): boolean {
  if (filtroId === 'todos') return true;
  if ((it.times_ids ?? []).includes(filtroId)) return true;
  const sel = catalog.find((t) => t.id === filtroId);
  if (sel && it.time) {
    const slug = nomeTimeParaSlugLegado(sel.nome);
    if (it.time.toLowerCase() === slug) return true;
  }
  return false;
}

export type HistoricoItem = {
  id: string;
  acao: string;
  usuario_nome: string | null;
  detalhe: Record<string, unknown> | null;
  criado_em: string;
};

export type ComentarioCardRow = {
  id: string;
  texto: string;
  created_at: string;
  fase_id: string | null;
  autor_id: string | null;
  autor_nome: string | null;
};

export type SecaoEsquerdaId =
  | 'franqueado'
  | 'novoNegocio'
  | 'preObra'
  | 'obra'
  | 'relacionamentos'
  | 'historico';

export function isoDateOffsetDays(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isInteracaoDemonstracao(id: string): boolean {
  return id.startsWith('__funil_demo_');
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

export function textoResumidoAcaoHistorico(acao: string, detalhe: Record<string, unknown> | null): string {
  const d = detalhe ?? {};
  switch (acao) {
    case 'fase_avancada':
      return `Fase avançada para ${String(d.fase_nova_nome ?? '—')}`;
    case 'fase_retrocedida':
      return `Fase retrocedida para ${String(d.fase_nova_nome ?? '—')}`;
    case 'card_criado':
      return 'Card criado';
    case 'interacao_criada':
      return `Novo chamado: ${String(d.titulo ?? '').trim() || '—'}`;
    case 'interacao_editada': {
      if (d.status_novo != null) return `Chamado atualizado (status: ${String(d.status_novo)})`;
      if (d.titulo_novo != null) return `Chamado renomeado para "${String(d.titulo_novo)}"`;
      if (d.descricao_alterada) return 'Descrição do chamado alterada';
      if (d.data_vencimento_nova != null) return 'Prazo do chamado alterado';
      return 'Chamado editado';
    }
    case 'campo_alterado':
      return 'Campo do card alterado';
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
    default:
      return <History className={className} aria-hidden />;
  }
}
