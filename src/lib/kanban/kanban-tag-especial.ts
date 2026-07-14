/** Tag padronizada em todos os funis — dourada (tokens Moní). */
export const KANBAN_TAG_ESPECIAL_NOME = '⭐Especial';

export const KANBAN_TAG_ESPECIAL_COR = '#D4AD68';

export function isKanbanTagEspecialNome(nome: string | null | undefined): boolean {
  const n = String(nome ?? '').trim();
  return n === KANBAN_TAG_ESPECIAL_NOME;
}

export type KanbanTagChipStyle = {
  className: string;
  style?: {
    background?: string;
    color?: string;
    border?: string;
  };
};

/** Detecta laranja (hue ~15–45°) — proibido no design system; remapeia para dourado Moní. */
function corKanbanSemLaranja(cor: string): string {
  const raw = String(cor ?? '').trim();
  const m = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return raw || '#7a6e65';
  let hex = m[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : delta / max;
  // Laranja saturado (inclui #f97316, #ea580c, #fb923c, etc.)
  if (s >= 0.35 && h >= 12 && h <= 48) {
    return KANBAN_TAG_ESPECIAL_COR;
  }
  return `#${hex}`;
}

/** Estilo de chip de tag no modal / listagens. */
export function estiloChipTagKanban(nome: string, cor: string): KanbanTagChipStyle {
  if (isKanbanTagEspecialNome(nome)) {
    return { className: 'moni-tag-especial' };
  }
  const c = corKanbanSemLaranja(cor);
  return {
    className: 'moni-tag-chip',
    style: {
      background: `color-mix(in srgb, ${c} 14%, white)`,
      color: c,
      border: `0.5px solid ${c}`,
    },
  };
}
