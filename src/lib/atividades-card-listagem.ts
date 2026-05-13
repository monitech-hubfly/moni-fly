/**
 * Regras comuns para listagem de atividades em modais de card (checklist painel / legado).
 * Padrão: só em aberto; concluídas só com filtro explícito; ordenação prioriza prazo.
 */

export type ListaAtividadesCard = 'abertas' | 'concluidas' | 'todas';

/** Situação efetiva após considerar checkbox concluído. */
export type SituacaoChecklistEfetiva = 'nao_iniciada' | 'em_andamento' | 'concluido';

export type FiltroSituacaoChecklist = 'qualquer' | SituacaoChecklistEfetiva;

export function prazoChecklistParaOrdenacao(prazo: string | null | undefined): number {
  if (!prazo) return Number.POSITIVE_INFINITY;
  const raw = String(prazo).trim();
  if (!raw) return Number.POSITIVE_INFINITY;
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
}

export function checklistAtividadeConcluida(item: { concluido: boolean; status?: string | null }): boolean {
  if (item.concluido) return true;
  const st = String(item.status ?? '').trim().toLowerCase();
  return st === 'concluido' || st === 'concluida';
}

export function checklistStatusEfetivo(item: {
  concluido: boolean;
  status?: string | null;
}): SituacaoChecklistEfetiva {
  if (checklistAtividadeConcluida(item)) return 'concluido';
  const st = String(item.status ?? 'nao_iniciada').trim().toLowerCase();
  if (st === 'em_andamento') return 'em_andamento';
  return 'nao_iniciada';
}

export function checklistPassaFiltroLista(
  item: { concluido: boolean; status?: string | null },
  lista: ListaAtividadesCard,
  situacao: FiltroSituacaoChecklist,
): boolean {
  const concl = checklistAtividadeConcluida(item);
  const stEff = checklistStatusEfetivo(item);

  if (lista === 'abertas') {
    if (concl) return false;
    if (situacao !== 'qualquer' && stEff !== situacao) return false;
    return true;
  }
  if (lista === 'concluidas') {
    return concl;
  }
  if (situacao !== 'qualquer' && stEff !== situacao) return false;
  return true;
}

type ItemOrdemChecklist = {
  concluido: boolean;
  status?: string | null;
  prazo: string | null;
  responsavel_nome: string | null;
};

/** Ordena: em "todas", concluídas por último; dentro de cada grupo por prazo ou responsável. */
export function ordenarItensChecklistLista<T extends ItemOrdemChecklist>(
  items: T[],
  lista: ListaAtividadesCard,
  ordem: 'prazo' | 'responsavel',
): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (lista === 'todas') {
      const ac = checklistAtividadeConcluida(a);
      const bc = checklistAtividadeConcluida(b);
      if (ac !== bc) return ac ? 1 : -1;
    }
    if (ordem === 'responsavel') {
      const ar = (a.responsavel_nome ?? '').trim() || 'Sem responsável';
      const br = (b.responsavel_nome ?? '').trim() || 'Sem responsável';
      const c = ar.localeCompare(br, 'pt-BR', { sensitivity: 'base' });
      if (c !== 0) return c;
      const cp = prazoChecklistParaOrdenacao(a.prazo) - prazoChecklistParaOrdenacao(b.prazo);
      if (cp !== 0) return cp;
      return (a.responsavel_nome ?? '').localeCompare(b.responsavel_nome ?? '', 'pt-BR');
    }
    const cp = prazoChecklistParaOrdenacao(a.prazo) - prazoChecklistParaOrdenacao(b.prazo);
    if (cp !== 0) return cp;
    const ar = (a.responsavel_nome ?? '').trim() || 'Sem responsável';
    const br = (b.responsavel_nome ?? '').trim() || 'Sem responsável';
    return ar.localeCompare(br, 'pt-BR', { sensitivity: 'base' });
  });
  return copy;
}
