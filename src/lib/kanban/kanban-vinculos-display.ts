import type { CSSProperties } from 'react';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import type { RelacionamentoCardRow } from '@/lib/actions/card-actions';
import type { CardProjetoEsteiraRow } from '@/lib/kanban/fetch-cards-projeto-esteiras';
import {
  estiloChipTagKanban,
  isKanbanTagRodadaNome,
  isKanbanTagTrancheNome,
} from '@/lib/kanban/kanban-tag-especial';

export type KanbanVinculoStatus = 'ativo' | 'concluido' | 'arquivado';

export type KanbanVinculoCardItem = {
  key: string;
  titulo: string;
  faseNome: string;
  status: KanbanVinculoStatus;
  dataLabel: string | null;
  href: string;
  onRemove?: () => void;
  /** Badge de tag preset (tranche / rodada) — estilo via estiloChipTagKanban */
  trancheBadge?: { label: string; style: CSSProperties } | null;
};

export type KanbanVinculoGrupo = {
  kanbanNome: string;
  items: KanbanVinculoCardItem[];
};

export function formatKanbanNomeVinculoHeader(nome: string): string {
  return String(nome ?? '—').trim().toUpperCase() || '—';
}

/**
 * Badge colorido a partir de label "Nª tranche" / "Nª rodada"
 * (reusa o mesmo motor dos chips do board/modal).
 */
export function badgeTagPresetFromLabel(nome: string | null | undefined): {
  label: string;
  style: CSSProperties;
} | null {
  const label = String(nome ?? '').trim();
  if (!label) return null;
  if (!isKanbanTagTrancheNome(label) && !isKanbanTagRodadaNome(label)) return null;
  const chip = estiloChipTagKanban(label);
  return {
    label,
    style: {
      background: chip.style?.background,
      color: chip.style?.color,
      border: chip.style?.border,
    },
  };
}

/** @deprecated Preferir badgeTagPresetFromLabel (também cobre rodadas). */
export function badgeTrancheFromLabel(nome: string | null | undefined): {
  label: string;
  style: CSSProperties;
} | null {
  return badgeTagPresetFromLabel(nome);
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
      trancheBadge: item.trancheBadge ?? badgeTagPresetFromLabel(item.faseNome),
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
    trancheBadge: null,
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
    trancheBadge: badgeTagPresetFromLabel(row.fase_nome),
  };
}
