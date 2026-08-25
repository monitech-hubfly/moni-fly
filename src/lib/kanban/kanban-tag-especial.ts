import {
  estiloTagTranchePorLabel,
  trancheNumeroFromLabel,
} from '@/lib/kanban/credito-obra-tag-tranche';
import {
  estiloTagRodadaPorLabel,
  rodadaNumeroFromLabel,
} from '@/lib/kanban/divify-tag-rodada';
import { OPERACOES_TAG_INST_GARANTIDOR_NOME } from '@/lib/kanban/operacoes-tag-inst-garantidor';

/** Tag padronizada em todos os funis — dourada (tokens Moní). */
export const KANBAN_TAG_ESPECIAL_NOME = '⭐Especial';

export const KANBAN_TAG_ESPECIAL_COR = '#D4AD68';

export function isKanbanTagEspecialNome(nome: string | null | undefined): boolean {
  const n = String(nome ?? '').trim();
  return n === KANBAN_TAG_ESPECIAL_NOME;
}

export function isKanbanTagInstGarantidorNome(nome: string | null | undefined): boolean {
  return String(nome ?? '').trim() === OPERACOES_TAG_INST_GARANTIDOR_NOME;
}

export function isKanbanTagDependenciaNome(nome: string | null | undefined): boolean {
  return String(nome ?? '').trim().toLowerCase().startsWith('dependencia:');
}

/** Label "Nª/Nº rodada" (1–6). */
export function isKanbanTagRodadaNome(nome: string | null | undefined): boolean {
  return rodadaNumeroFromLabel(nome) != null;
}

/** Label "Nª/Nº tranche" (1–6). */
export function isKanbanTagTrancheNome(nome: string | null | undefined): boolean {
  return trancheNumeroFromLabel(nome) != null;
}

export type KanbanTagGrupoKind = 'rodada' | 'tranche' | 'especial';

export function classificarKanbanTagGrupo(nome: string | null | undefined): KanbanTagGrupoKind {
  if (isKanbanTagRodadaNome(nome)) return 'rodada';
  if (isKanbanTagTrancheNome(nome)) return 'tranche';
  return 'especial';
}

/** Ordena tags de rodada/tranche pelo índice numérico do label. */
export function ordenarTagsPorIndiceOrdinal<T extends { nome: string }>(tags: T[]): T[] {
  return [...tags].sort((a, b) => {
    const na =
      rodadaNumeroFromLabel(a.nome) ?? trancheNumeroFromLabel(a.nome) ?? Number.POSITIVE_INFINITY;
    const nb =
      rodadaNumeroFromLabel(b.nome) ?? trancheNumeroFromLabel(b.nome) ?? Number.POSITIVE_INFINITY;
    if (na !== nb) return na - nb;
    return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
  });
}

export type KanbanTagChipStyle = {
  className: string;
  style?: {
    background?: string;
    color?: string;
    border?: string;
  };
};

/** Hex #RGB / #RRGGBB → #rrggbb; null se inválido. */
function normalizeHexCor(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  const m3 = /^#([0-9a-fA-F]{3})$/.exec(s);
  if (m3) {
    const [r, g, b] = m3[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const m6 = /^#([0-9a-fA-F]{6})$/.exec(s);
  if (m6) return `#${m6[1]}`.toLowerCase();
  return null;
}

/** Laranja / coral — proibido no design system Moní. */
function isCorLaranjaProibida(hex: string): boolean {
  const h = normalizeHexCor(hex);
  if (!h) return false;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  // hue aproximado: R alto, G médio, B baixo
  return r > 180 && g > 60 && g < 180 && b < 120 && r > b + 40;
}

function contrasteTextoSobreFundo(hexBg: string): string {
  const h = normalizeHexCor(hexBg);
  if (!h) return 'var(--moni-text-inverse)';
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  // luminância relativa
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? 'var(--moni-navy-800)' : '#ffffff';
}

/**
 * Estilo de chip de tag no board / modal.
 * - Especial / Inst. Garantidor / Dependência: classes prontas
 * - Tranche 1ª–6ª: TRANCHE_COLORS (light/dark)
 * - Rodada 1ª–6ª: RODADA_COLORS (light/dark) — Funil Divify
 * - Demais: usa `cor` do cadastro (exceto laranja)
 * - Sem cor válida: pill padrão `moni-tag-chip`
 */
export function estiloChipTagKanban(nome: string, cor?: string): KanbanTagChipStyle {
  if (isKanbanTagEspecialNome(nome)) {
    return { className: 'moni-tag-especial' };
  }
  if (isKanbanTagInstGarantidorNome(nome)) {
    return { className: 'moni-tag-atrasado' };
  }
  if (isKanbanTagDependenciaNome(nome)) {
    return { className: 'moni-tag-dependencia' };
  }

  if (trancheNumeroFromLabel(nome) != null) {
    const tranche = estiloTagTranchePorLabel(nome);
    if (tranche) {
      return {
        className: 'moni-tag-chip-custom',
        style: {
          background: String(tranche.background ?? ''),
          color: String(tranche.color ?? ''),
          border: 'var(--moni-border-width) solid transparent',
        },
      };
    }
  }

  // "Nª rodada" / "Nº rodada" → RODADA_COLORS (light/dark)
  if (rodadaNumeroFromLabel(nome) != null) {
    const rodada = estiloTagRodadaPorLabel(nome);
    if (rodada) {
      return {
        className: 'moni-tag-chip-custom',
        style: {
          background: String(rodada.background ?? ''),
          color: String(rodada.color ?? ''),
          border: 'var(--moni-border-width) solid transparent',
        },
      };
    }
  }

  const hex = normalizeHexCor(cor);
  if (hex && !isCorLaranjaProibida(hex)) {
    return {
      className: 'moni-tag-chip-custom',
      style: {
        background: hex,
        color: contrasteTextoSobreFundo(hex),
        border: `var(--moni-border-width) solid color-mix(in srgb, ${hex} 70%, var(--moni-border-default))`,
      },
    };
  }

  return { className: 'moni-tag-chip' };
}
