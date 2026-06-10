/** Lotes vinculados ao cadastro em `condominios_lotes`. */

/** Colunas boolean de atributos em `condominios_lotes` (nomenclatura legada no Postgres). */
export type CondominioLoteColunaAtributo =
  | 'vista_privilegiada'
  | 'terreno_plano'
  | 'terreno_aclive'
  | 'terreno_aclive_acentuado'
  | 'terreno_declive'
  | 'terreno_declive_acentuado'
  | 'fundo_mata'
  | 'frente_mata'
  | 'perto_area_verde'
  | 'perto_lago'
  | 'fundo_lago'
  | 'frente_lago'
  | 'perto_area_convivencia'
  | 'perto_lixeira'
  | 'perto_portaria'
  | 'muro_rodovia'
  | 'muro_comunidade'
  | 'muro_vegetacao';

/** Colunas boolean existentes em `condominios_lotes` (migrations 260, 283, 288, 318). */
export const COLUNAS_ATRIBUTO_CONDOMINIOS_LOTES = [
  'vista_privilegiada',
  'terreno_plano',
  'terreno_aclive',
  'terreno_aclive_acentuado',
  'terreno_declive',
  'terreno_declive_acentuado',
  'fundo_mata',
  'frente_mata',
  'perto_area_verde',
  'perto_lago',
  'fundo_lago',
  'frente_lago',
  'perto_area_convivencia',
  'perto_lixeira',
  'perto_portaria',
  'muro_rodovia',
  'muro_comunidade',
  'muro_vegetacao',
] as const satisfies readonly CondominioLoteColunaAtributo[];

const COLUNAS_ATRIBUTO_CONDOMINIOS_LOTES_SET = new Set<string>(COLUNAS_ATRIBUTO_CONDOMINIOS_LOTES);

export function isColunaAtributoCondominioLote(
  coluna: string,
): coluna is CondominioLoteColunaAtributo {
  return COLUNAS_ATRIBUTO_CONDOMINIOS_LOTES_SET.has(coluna);
}

export type CondominioLoteAtributos = Partial<Record<CondominioLoteColunaAtributo, boolean>>;

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
} & CondominioLoteAtributos;

export function formatQuadraLote(quadra: string | null | undefined, lote: string | null | undefined): string {
  const q = (quadra ?? '').trim();
  const l = (lote ?? '').trim();
  if (q && l) return `${q} / ${l}`;
  return q || l || '—';
}
