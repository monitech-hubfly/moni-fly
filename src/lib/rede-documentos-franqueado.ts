/** Documentos do franqueado (seção 0) — anexo e, para estado civil, justificativa opcional. */

import { isRedeDocSlotCompleto } from '@/lib/rede-documentos-franquia';

export type RedeAnexoDocFranqueadoTipo =
  | 'cnh'
  | 'rg'
  | 'passaporte'
  | 'comprovante_endereco'
  | 'estado_civil'
  | 'irpf';

export const REDE_FRANQUEADO_ANEXO_PATH_COLUNA = {
  cnh: 'anexo_cnh_path',
  rg: 'anexo_rg_path',
  passaporte: 'anexo_passaporte_path',
  comprovante_endereco: 'anexo_comprovante_endereco_path',
  estado_civil: 'anexo_estado_civil_path',
  irpf: 'anexo_irpf_path',
} as const;

export const REDE_FRANQUEADO_ANEXO_JUSTIFICATIVA_COLUNA = {
  estado_civil: 'anexo_estado_civil_justificativa',
} as const;

export type RedeDocFranqueadoSlot = {
  tipo: RedeAnexoDocFranqueadoTipo;
  titulo: string;
  pathKey:
    | 'anexo_cnh_path'
    | 'anexo_rg_path'
    | 'anexo_passaporte_path'
    | 'anexo_comprovante_endereco_path'
    | 'anexo_estado_civil_path'
    | 'anexo_irpf_path';
  justificativaKey: 'anexo_estado_civil_justificativa' | null;
};

export const REDE_DOCS_FRANQUEADO_SLOTS: readonly RedeDocFranqueadoSlot[] = [
  {
    tipo: 'cnh',
    titulo: 'CNH',
    pathKey: 'anexo_cnh_path',
    justificativaKey: null,
  },
  {
    tipo: 'rg',
    titulo: 'RG',
    pathKey: 'anexo_rg_path',
    justificativaKey: null,
  },
  {
    tipo: 'passaporte',
    titulo: 'Passaporte',
    pathKey: 'anexo_passaporte_path',
    justificativaKey: null,
  },
  {
    tipo: 'comprovante_endereco',
    titulo: 'Comprovante de endereço',
    pathKey: 'anexo_comprovante_endereco_path',
    justificativaKey: null,
  },
  {
    tipo: 'estado_civil',
    titulo: 'Comprovante de estado civil',
    pathKey: 'anexo_estado_civil_path',
    justificativaKey: 'anexo_estado_civil_justificativa',
  },
  {
    tipo: 'irpf',
    titulo: 'Declaração de IRPF',
    pathKey: 'anexo_irpf_path',
    justificativaKey: null,
  },
] as const;

export type RedeFranqueadoDocsRow = {
  anexo_cnh_path?: string | null;
  anexo_rg_path?: string | null;
  anexo_passaporte_path?: string | null;
  anexo_comprovante_endereco_path?: string | null;
  anexo_estado_civil_path?: string | null;
  anexo_irpf_path?: string | null;
  anexo_estado_civil_justificativa?: string | null;
};

function norm(s: string | null | undefined): string {
  return (s ?? '').toString().trim();
}

export function pickRedeFranqueadoDocsFromRow(r: Record<string, unknown>): RedeFranqueadoDocsRow {
  return {
    anexo_cnh_path: (r.anexo_cnh_path as string | null) ?? null,
    anexo_rg_path: (r.anexo_rg_path as string | null) ?? null,
    anexo_passaporte_path: (r.anexo_passaporte_path as string | null) ?? null,
    anexo_comprovante_endereco_path: (r.anexo_comprovante_endereco_path as string | null) ?? null,
    anexo_estado_civil_path: (r.anexo_estado_civil_path as string | null) ?? null,
    anexo_irpf_path: (r.anexo_irpf_path as string | null) ?? null,
    anexo_estado_civil_justificativa: (r.anexo_estado_civil_justificativa as string | null) ?? null,
  };
}

export function getRedeDocFranqueadoSlotValues(
  row: RedeFranqueadoDocsRow,
  slot: RedeDocFranqueadoSlot,
): { path: string | null; justificativa: string | null } {
  return {
    path: norm(row[slot.pathKey]) || null,
    justificativa: slot.justificativaKey ? norm(row[slot.justificativaKey]) || null : null,
  };
}

/** Rótulos de documentos do franqueado pendentes (sem anexo e, se aplicável, sem justificativa). */
export function pendenciasDocsFranqueadoRede(row: RedeFranqueadoDocsRow): string[] {
  const out: string[] = [];
  for (const slot of REDE_DOCS_FRANQUEADO_SLOTS) {
    const { path, justificativa } = getRedeDocFranqueadoSlotValues(row, slot);
    const aceitaJustificativa = slot.justificativaKey !== null;
    if (!isRedeDocSlotCompleto(path, aceitaJustificativa ? justificativa : null)) {
      out.push(slot.titulo);
    }
  }
  return out;
}
