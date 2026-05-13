import type { KanbanFaseMaterial, KanbanFaseMaterialTipo } from '@/components/kanban-shared/types';

const TIPOS: KanbanFaseMaterialTipo[] = ['link', 'documento', 'video'];

function normalizarTipo(raw: unknown): KanbanFaseMaterialTipo {
  const t = String(raw ?? 'link').trim().toLowerCase();
  return TIPOS.includes(t as KanbanFaseMaterialTipo) ? (t as KanbanFaseMaterialTipo) : 'link';
}

/** Normaliza JSONB `materiais` da fase para lista tipada. */
export function parseKanbanFaseMateriais(raw: unknown): KanbanFaseMaterial[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: KanbanFaseMaterial[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const titulo = String(o.titulo ?? '').trim();
    const url = String(o.url ?? '').trim();
    if (!titulo && !url) continue;
    out.push({
      titulo: titulo || url || 'Material',
      url: url || '#',
      tipo: normalizarTipo(o.tipo),
    });
  }
  return out;
}
