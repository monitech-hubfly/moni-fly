import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import type { RelacionamentoCardRow } from '@/lib/actions/card-actions';
import type { CardProjetoEsteiraRow } from '@/lib/kanban/fetch-cards-projeto-esteiras';

export type KanbanVinculoStatus = 'ativo' | 'concluido' | 'arquivado';

export type KanbanVinculoCardItem = {
  key: string;
  titulo: string;
  faseNome: string;
  status: KanbanVinculoStatus;
  dataLabel: string | null;
  href: string;
  onRemove?: () => void;
};

export type KanbanVinculoGrupo = {
  kanbanNome: string;
  items: KanbanVinculoCardItem[];
};

export function formatKanbanNomeVinculoHeader(nome: string): string {
  return String(nome ?? '—').trim().toUpperCase() || '—';
}

export function statusVinculoCard(row: {
  arquivado?: boolean | null;
  concluido?: boolean | null;
}): { status: KanbanVinculoStatus; rotulo: string; tagClass: string } {
  if (row.arquivado) {
    return { status: 'arquivado', rotulo: 'ARQUIVADO', tagClass: 'moni-tag-arquivado' };
  }
  if (row.concluido) {
    return { status: 'concluido', rotulo: 'CONCLUÍDO', tagClass: 'moni-tag-concluido' };
  }
  return { status: 'ativo', rotulo: 'ATIVO', tagClass: 'moni-tag-info' };
}

export function agruparItensVinculoPorKanban(
  items: Array<KanbanVinculoCardItem & { kanbanNome: string }>,
): KanbanVinculoGrupo[] {
  const map = new Map<string, KanbanVinculoGrupo>();
  for (const item of items) {
    const kanbanNome = String(item.kanbanNome ?? '—').trim() || '—';
    const key = kanbanNome.toLowerCase();
    let grupo = map.get(key);
    if (!grupo) {
      grupo = { kanbanNome, items: [] };
      map.set(key, grupo);
    }
    grupo.items.push({
      key: item.key,
      titulo: item.titulo,
      faseNome: item.faseNome,
      status: item.status,
      dataLabel: item.dataLabel,
      href: item.href,
      onRemove: item.onRemove,
    });
  }
  return [...map.values()];
}

export function itemVinculoFromProjetoEsteira(
  row: CardProjetoEsteiraRow,
  href: string,
): KanbanVinculoCardItem & { kanbanNome: string } {
  const st = statusVinculoCard(row);
  return {
    key: row.id,
    kanbanNome: row.kanban_nome,
    titulo: row.titulo,
    faseNome: row.fase_nome,
    status: st.status,
    dataLabel: formatIsoDateOnlyPtBr(row.created_at) ?? null,
    href,
  };
}

export function itemVinculoFromRelacionamento(
  row: RelacionamentoCardRow,
  href: string,
  onRemove?: () => void,
): KanbanVinculoCardItem & { kanbanNome: string } {
  const st = statusVinculoCard(row);
  const dataRaw = row.created_at ?? null;
  return {
    key: row.key,
    kanbanNome: row.kanban_nome,
    titulo: row.titulo,
    faseNome: row.fase_nome,
    status: st.status,
    dataLabel: dataRaw ? formatIsoDateOnlyPtBr(dataRaw) ?? dataRaw : null,
    href,
    onRemove,
  };
}
