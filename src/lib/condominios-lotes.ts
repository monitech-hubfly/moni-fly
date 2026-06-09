/** Lotes vinculados ao cadastro em `condominios_lotes`. */

import type { ChaveLoteCheckbox } from '@/lib/kanban/lotes-disponiveis-condominio';

export type CondominioLoteAtributos = Record<ChaveLoteCheckbox, boolean>;

export type CondominioLoteRow = {
  id: string;
  condominio_id: string;
  quadra: string | null;
  lote: string | null;
  area_m2: number | null;
  valor: number | null;
  situacao_documental: string | null;
  fotos_path: string | null;
  observacoes: string | null;
  kanban_card_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
} & CondominioLoteAtributos;

export type CondominioLotePatch = {
  condominio_id: string;
  quadra?: string | null;
  lote?: string | null;
  area_m2?: number | null;
  valor?: number | null;
  situacao_documental?: string | null;
  fotos_path?: string | null;
  observacoes?: string | null;
  kanban_card_id?: string | null;
} & Partial<CondominioLoteAtributos>;

export function formatQuadraLote(quadra: string | null | undefined, lote: string | null | undefined): string {
  const q = (quadra ?? '').trim();
  const l = (lote ?? '').trim();
  if (q && l) return `${q} / ${l}`;
  return q || l || '—';
}
