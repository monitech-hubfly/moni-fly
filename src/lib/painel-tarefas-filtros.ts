import { ATIVIDADE_TIMES } from '@/lib/atividade-times';
import { itemMatchesTimeFilter } from '@/lib/checklist-atividade-arrays';

/** Classes compartilhadas: mesmo padrão do grid de filtros da aba Atividades no card. */
export const PAINEL_TAREFAS_SELECT_CLASS =
  'w-full min-w-0 rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700';

export const PAINEL_TAREFAS_SEARCH_CLASS =
  'w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-moni-primary focus:outline-none focus:ring-1 focus:ring-moni-primary';

export type PainelTarefasFiltrosState = {
  busca: string;
  time: string;
  franqueado: string;
  etapa: string;
  /** Alinhado à aba Atividades do card: `todos` = sem filtro de status */
  status: 'todos' | 'nao_iniciada' | 'em_andamento' | 'concluido';
  tag: 'todas' | 'atrasado' | 'atencao';
  ordenacao: 'responsavel' | 'prazo';
};

export function defaultPainelTarefasFiltros(): PainelTarefasFiltrosState {
  return {
    busca: '',
    time: 'todos',
    franqueado: 'todos',
    etapa: 'todas',
    status: 'todos',
    tag: 'todas',
    ordenacao: 'responsavel',
  };
}

export function painelTarefasFiltrosTemAlgumAtivo(f: PainelTarefasFiltrosState): boolean {
  const d = defaultPainelTarefasFiltros();
  return (
    f.busca.trim() !== d.busca ||
    f.time !== d.time ||
    f.franqueado !== d.franqueado ||
    f.etapa !== d.etapa ||
    f.status !== d.status ||
    f.tag !== d.tag ||
    f.ordenacao !== d.ordenacao
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
    const d = new Date(`${raw}T12:00:00`);
    return Number.isFinite(d.getTime()) ? d : null;
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
  etapa_painel: string;
  titulo: string;
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
    if (filtros.status !== 'todos' && t.status !== filtros.status) return false;
    const tagPrazo = getPrazoTagAtividade(t.prazo, t.status);
    if (filtros.tag !== 'todas' && tagPrazo !== filtros.tag) return false;
    if (!itemMatchesTimeFilter(t.times_nomes, t.time_nome, filtros.time)) return false;
    if (filtros.franqueado !== 'todos' && (t.nome_franqueado ?? '').trim() !== filtros.franqueado) return false;
    if (filtros.etapa !== 'todas' && (t.etapa_painel ?? '').trim() !== filtros.etapa) return false;
    const buscaNorm = normalizarParaBusca(filtros.busca);
    if (!buscaNorm) return true;
    const texto = [t.numero_franquia, t.nome_franqueado, t.nome_condominio].filter(Boolean).join(' ') || '';
    return normalizarParaBusca(texto).includes(buscaNorm);
  });
}
