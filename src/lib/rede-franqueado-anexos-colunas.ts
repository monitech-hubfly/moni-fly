/**
 * Colunas de anexo/justificativa em `rede_franqueados` — fonte única para substituição e scripts.
 */

import { REDE_DOCS_EMPRESA_SLOTS } from '@/lib/rede-documentos-empresas';
import { REDE_DOCS_FRANQUEADO_SLOTS } from '@/lib/rede-documentos-franqueado';
import { REDE_DOCS_FRANQUIA_SLOTS } from '@/lib/rede-documentos-franquia';

function collectColunasAnexo(): { paths: string[]; justificativas: string[] } {
  const paths = new Set<string>();
  const justificativas = new Set<string>();

  for (const slot of REDE_DOCS_FRANQUIA_SLOTS) {
    paths.add(slot.pathKey);
    justificativas.add(slot.justificativaKey);
  }
  for (const slot of REDE_DOCS_FRANQUEADO_SLOTS) {
    paths.add(slot.pathKey);
    if (slot.justificativaKey) justificativas.add(slot.justificativaKey);
  }
  for (const slot of REDE_DOCS_EMPRESA_SLOTS) {
    paths.add(slot.pathKey);
    if (slot.justificativaKey) justificativas.add(slot.justificativaKey);
  }

  return {
    paths: [...paths],
    justificativas: [...justificativas],
  };
}

const { paths, justificativas } = collectColunasAnexo();

/** Paths de storage no bucket `rede-attachments` (seções 0, 1 e 2). */
export const REDE_FRANQUEADO_COLUNAS_ANEXO_PATH = paths as readonly string[];

/** Justificativas de ausência de documento (seções 0, 1 e 2). */
export const REDE_FRANQUEADO_COLUNAS_ANEXO_JUSTIFICATIVA = justificativas as readonly string[];

/** Todas as colunas de documento na linha `rede_franqueados`. */
export const REDE_FRANQUEADO_TODAS_COLUNAS_ANEXO = [
  ...REDE_FRANQUEADO_COLUNAS_ANEXO_PATH,
  ...REDE_FRANQUEADO_COLUNAS_ANEXO_JUSTIFICATIVA,
] as readonly string[];

/** Chave no snapshot JSONB para SPEs e empresas vinculadas ao franqueado substituído. */
export const REDE_SUBSTITUICAO_SNAPSHOT_VINCULOS_KEY = '_substituicao_vinculos' as const;

export type RedeSubstituicaoSnapshotVinculos = {
  franqueado_spe: Record<string, unknown>[];
  franqueado_empresas: Record<string, unknown>[];
};

/** Patch que zera todos os anexos/justificativas da linha operacional. */
export function patchLimparAnexosRedeFranqueado(): Record<string, null> {
  const out: Record<string, null> = {};
  for (const col of REDE_FRANQUEADO_TODAS_COLUNAS_ANEXO) {
    out[col] = null;
  }
  return out;
}

/** Extrai somente campos de documento de uma linha `rede_franqueados`. */
export function pickAnexosRedeFranqueadoFromRow(
  row: Record<string, unknown>,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const col of REDE_FRANQUEADO_TODAS_COLUNAS_ANEXO) {
    const v = row[col];
    out[col] = v == null || String(v).trim() === '' ? null : String(v);
  }
  return out;
}
