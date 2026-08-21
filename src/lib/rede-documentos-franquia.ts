/** Documentos obrigatórios da franquia (seção 1) — anexo ou justificativa. */

export type RedeAnexoDocTipo = 'cof' | 'contrato' | 'numero_franquia';

export type RedeDocFranquiaSlot = {
  tipo: RedeAnexoDocTipo;
  titulo: string;
  pathKey: 'anexo_cof_path' | 'anexo_contrato_path' | 'anexo_numero_franquia_path';
  justificativaKey:
    | 'anexo_cof_justificativa'
    | 'anexo_contrato_justificativa'
    | 'anexo_numero_franquia_justificativa';
};

export const REDE_SECAO_DOCS_FRANQUEADO = {
  id: '0',
  titulo: '0 - Documentos do Franqueado',
} as const;

export const REDE_SECAO_DOCS_FRANQUIA = {
  id: '1',
  titulo: '1 - Documentos da Franquia',
} as const;

export const REDE_SECAO_DOCS_EMPRESAS = {
  id: '2',
  titulo: '2 - Documentos das Empresas',
} as const;

export const REDE_DOCS_FRANQUIA_SLOTS: readonly RedeDocFranquiaSlot[] = [
  {
    tipo: 'cof',
    titulo: 'COF assinado',
    pathKey: 'anexo_cof_path',
    justificativaKey: 'anexo_cof_justificativa',
  },
  {
    tipo: 'contrato',
    titulo: 'Contrato assinado',
    pathKey: 'anexo_contrato_path',
    justificativaKey: 'anexo_contrato_justificativa',
  },
  {
    tipo: 'numero_franquia',
    titulo: 'Documento de número de franquia',
    pathKey: 'anexo_numero_franquia_path',
    justificativaKey: 'anexo_numero_franquia_justificativa',
  },
] as const;

export type RedeFranquiaDocsRow = {
  anexo_cof_path?: string | null;
  anexo_contrato_path?: string | null;
  anexo_numero_franquia_path?: string | null;
  anexo_cof_justificativa?: string | null;
  anexo_contrato_justificativa?: string | null;
  anexo_numero_franquia_justificativa?: string | null;
};

function norm(s: string | null | undefined): string {
  return (s ?? '').toString().trim();
}

export function isRedeDocSlotCompleto(
  path: string | null | undefined,
  justificativa: string | null | undefined,
): boolean {
  return Boolean(norm(path)) || Boolean(norm(justificativa));
}

/** Rótulos de documentos da franquia pendentes (sem anexo e sem justificativa). */
export function pendenciasDocsFranquiaRede(row: RedeFranquiaDocsRow): string[] {
  const out: string[] = [];
  for (const slot of REDE_DOCS_FRANQUIA_SLOTS) {
    const path = row[slot.pathKey];
    const justificativa = row[slot.justificativaKey];
    if (!isRedeDocSlotCompleto(path, justificativa)) {
      out.push(slot.titulo);
    }
  }
  return out;
}

export function getRedeDocSlotValues(
  row: RedeFranquiaDocsRow,
  slot: RedeDocFranquiaSlot,
): { path: string | null; justificativa: string | null } {
  return {
    path: norm(row[slot.pathKey]) || null,
    justificativa: norm(row[slot.justificativaKey]) || null,
  };
}
