import { ATIVIDADE_TIMES } from '@/lib/atividade-times';
import { itemMatchesTimeFilter } from '@/lib/checklist-atividade-arrays';
import { calcularDiasUteis, parseIsoDateOnlyLocal } from '@/lib/dias-uteis';

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parsePrazoIsoDate(iso: string | null | undefined): Date | null {
  return parseIsoDateOnlyLocal(iso);
}

/**
 * Rótulo de SLA em dias úteis para o painel de interações.
 * Concluídas ou sem prazo retornam variante `nenhum`.
 */
export function rotuloSlaInteracaoPainel(
  prazoIso: string | null | undefined,
  statusPainel: string,
): { variante: 'nenhum' | 'atrasado' | 'vence_hoje' | 'vence_futuro'; texto: string } {
  const st = String(statusPainel ?? '').trim().toLowerCase();
  if (st === 'concluido' || st === 'concluida') return { variante: 'nenhum', texto: '—' };
  const due = parsePrazoIsoDate(prazoIso ?? null);
  if (!due) return { variante: 'nenhum', texto: '—' };
  const hoje = startOfLocalDay(new Date());
  const dueD = startOfLocalDay(due);
  if (dueD < hoje) {
    const depoisDoPrazo = new Date(dueD);
    depoisDoPrazo.setDate(depoisDoPrazo.getDate() + 1);
    const du = calcularDiasUteis(startOfLocalDay(depoisDoPrazo), hoje);
    return { variante: 'atrasado', texto: du > 0 ? `Atrasado ${du} d.u.` : 'Atrasado' };
  }
  if (dueD.getTime() === hoje.getTime()) {
    return { variante: 'vence_hoje', texto: 'Vence hoje' };
  }
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const du = calcularDiasUteis(startOfLocalDay(amanha), dueD);
  return { variante: 'vence_futuro', texto: du > 0 ? `Vence em ${du} d.u.` : 'Vence hoje' };
}

/**
 * Bolinha ao lado do título do card, alinhada às tags de SLA em d.u.:
 * - vermelho: atrasado
 * - amarelo: vence hoje ou vence em 1 d.u. (alerta / “um dia útil antes”)
 * - null: em dia, sem prazo ou concluído
 */
export function bolinhaSlaInteracaoTitulo(
  prazoIso: string | null | undefined,
  statusPainel: string,
): 'vermelho' | 'amarelo' | null {
  const r = rotuloSlaInteracaoPainel(prazoIso, statusPainel);
  if (r.variante === 'nenhum') return null;
  if (r.variante === 'atrasado') return 'vermelho';
  if (r.variante === 'vence_hoje') return 'amarelo';
  if (r.variante === 'vence_futuro') {
    if (r.texto.includes('1 d.u.')) return 'amarelo';
    return null;
  }
  return null;
}

/**
 * Classificação de fundo do chamado no Kanban (apenas por prazo; concluído/cancelado tratados antes).
 * - atrasado: prazo &lt; hoje
 * - proximo: vence hoje ou em 1 dia útil (igual ao rótulo do painel)
 * - normal: 2+ dias úteis ou equivalente / sem alerta de brevidade
 */
export function classificarSlaFundoChamado(
  prazoIso: string | null | undefined,
): 'atrasado' | 'proximo' | 'normal' {
  const due = parsePrazoIsoDate(prazoIso ?? null);
  if (!due) return 'normal';
  const hoje = startOfLocalDay(new Date());
  const dueD = startOfLocalDay(due);
  if (dueD < hoje) return 'atrasado';
  const r = rotuloSlaInteracaoPainel(prazoIso, 'nao_iniciada');
  if (r.variante === 'vence_hoje') return 'proximo';
  if (r.variante === 'vence_futuro' && r.texto.includes('1 d.u.')) return 'proximo';
  return 'normal';
}

/** Classes compartilhadas: mesmo padrão do grid de filtros da aba Atividades no card. */
export const PAINEL_TAREFAS_SELECT_CLASS =
  'w-full min-w-0 rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700';

export const PAINEL_TAREFAS_SEARCH_CLASS =
  'w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-moni-primary focus:outline-none focus:ring-1 focus:ring-moni-primary';

export type PainelTarefasFiltrosState = {
  busca: string;
  /** `todos` | UUID do kanban */
  kanban: string;
  time: string;
  /** `todos` | `__sem_responsavel__` | `responsavel_id` (UUID) */
  responsavel: string;
  status: 'todos' | 'nao_iniciada' | 'em_andamento' | 'concluido';
  tipo: 'todos' | 'atividade' | 'duvida';
  /** Coluna `sla_status` da view (sem prazo = NULL na view) */
  sla_status: 'todos' | 'atrasado' | 'vence_hoje' | 'ok' | 'sem_prazo';
};

export function defaultPainelTarefasFiltros(): PainelTarefasFiltrosState {
  return {
    busca: '',
    kanban: 'todos',
    time: 'todos',
    responsavel: 'todos',
    status: 'todos',
    tipo: 'todos',
    sla_status: 'todos',
  };
}

export function painelTarefasFiltrosTemAlgumAtivo(f: PainelTarefasFiltrosState): boolean {
  const d = defaultPainelTarefasFiltros();
  return (
    f.busca.trim() !== d.busca ||
    f.kanban !== d.kanban ||
    f.time !== d.time ||
    f.responsavel !== d.responsavel ||
    f.status !== d.status ||
    f.tipo !== d.tipo ||
    f.sla_status !== d.sla_status
  );
}

export function normalizarParaBusca(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function parsePrazoBrOrIso(prazo: string | null | undefined): Date | null {
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
    const d = parseIsoDateOnlyLocal(raw);
    return d && Number.isFinite(d.getTime()) ? d : null;
  }

  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function getPrazoTagAtividade(
  prazo: string | null | undefined,
  status: string,
): 'atrasado' | 'atencao' | null {
  const statusNorm = String(status ?? '').trim().toLowerCase();
  if (statusNorm === 'concluido' || statusNorm === 'concluida') return null;
  const data = parsePrazoBrOrIso(prazo);
  if (!data) return null;
  const hoje = new Date();
  const hojeDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const amanhaDia = new Date(hojeDia.getFullYear(), hojeDia.getMonth(), hojeDia.getDate() + 1);
  const prazoDia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  if (prazoDia.getTime() < hojeDia.getTime()) return 'atrasado';
  if (prazoDia.getTime() === amanhaDia.getTime()) return 'atencao';
  return null;
}

export type TarefaPainelFiltroRow = {
  etapa_painel?: string;
  titulo: string;
  descricao?: string | null;
  card_titulo?: string | null;
  kanban_id?: string | null;
  kanban_nome?: string | null;
  tipo?: string | null;
  sla_status?: string | null;
  responsavel_id?: string | null;
  time_nome: string | null;
  responsavel_nome: string | null;
  times_nomes?: string[];
  responsaveis_nomes?: string[];
  prazo: string | null;
  status: string;
  numero_franquia?: string | null;
  nome_franqueado?: string | null;
  nome_condominio?: string | null;
};

/** Catálogo de times + valores que já apareceram nos dados (mesma ideia do modal + dinâmico). */
export function mergeTimesDisponiveis(dinamicos: string[]): string[] {
  const set = new Set<string>();
  for (const t of ATIVIDADE_TIMES) set.add(t);
  for (const t of dinamicos) {
    const s = t.trim();
    if (s) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

export function aplicarFiltrosTarefasPainel<T extends TarefaPainelFiltroRow>(
  tarefas: T[],
  filtros: PainelTarefasFiltrosState,
): T[] {
  return tarefas.filter((t) => {
    const tipoNorm = String(t.tipo ?? 'atividade').trim().toLowerCase();

    if (filtros.status !== 'todos' && t.status !== filtros.status) return false;

    if (filtros.responsavel !== 'todos') {
      if (filtros.responsavel === '__sem_responsavel__') {
        if (t.responsavel_id) return false;
      } else if (String(t.responsavel_id ?? '') !== filtros.responsavel) return false;
    }
    if (filtros.tipo !== 'todos' && tipoNorm !== filtros.tipo) return false;
    if (filtros.sla_status !== 'todos') {
      const sla = t.sla_status == null || String(t.sla_status).trim() === '' ? null : String(t.sla_status);
      if (filtros.sla_status === 'sem_prazo') {
        if (sla != null) return false;
      } else if (sla !== filtros.sla_status) return false;
    }
    if (!itemMatchesTimeFilter(t.times_nomes, t.time_nome, filtros.time)) return false;
    if (filtros.kanban !== 'todos' && String(t.kanban_id ?? '') !== filtros.kanban) return false;
    const buscaNorm = normalizarParaBusca(filtros.busca);
    if (!buscaNorm) return true;
    const texto =
      [
        t.numero_franquia,
        t.nome_franqueado,
        t.nome_condominio,
        t.titulo,
        t.descricao,
        t.card_titulo,
        t.kanban_nome,
        t.responsavel_nome,
      ]
        .filter(Boolean)
        .join(' ') || '';
    return normalizarParaBusca(texto).includes(buscaNorm);
  });
}
