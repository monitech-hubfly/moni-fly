import {
  REDE_EMPRESA_ANEXO_JUSTIFICATIVA_COLUNA,
  REDE_EMPRESA_ANEXO_PATH_COLUNA,
} from '@/lib/rede-documentos-empresas';
import {
  REDE_FRANQUEADO_ANEXO_JUSTIFICATIVA_COLUNA,
  REDE_FRANQUEADO_ANEXO_PATH_COLUNA,
} from '@/lib/rede-documentos-franqueado';

export const MAX_REDE_DOC_BYTES = 10 * 1024 * 1024;

const REDE_FRANQUIA_ANEXO_COLUNA = {
  cof: 'anexo_cof_path',
  contrato: 'anexo_contrato_path',
  numero_franquia: 'anexo_numero_franquia_path',
} as const;

const REDE_FRANQUIA_ANEXO_JUSTIFICATIVA_COLUNA = {
  cof: 'anexo_cof_justificativa',
  contrato: 'anexo_contrato_justificativa',
  numero_franquia: 'anexo_numero_franquia_justificativa',
} as const;

export const REDE_ANEXO_COLUNA = {
  ...REDE_FRANQUIA_ANEXO_COLUNA,
  ...REDE_FRANQUEADO_ANEXO_PATH_COLUNA,
  ...REDE_EMPRESA_ANEXO_PATH_COLUNA,
} as const;

export const REDE_ANEXO_JUSTIFICATIVA_COLUNA = {
  ...REDE_FRANQUIA_ANEXO_JUSTIFICATIVA_COLUNA,
  ...REDE_FRANQUEADO_ANEXO_JUSTIFICATIVA_COLUNA,
  ...REDE_EMPRESA_ANEXO_JUSTIFICATIVA_COLUNA,
} as const;

export type RedeAnexoTipo = keyof typeof REDE_ANEXO_COLUNA;

export function parseRedeAnexoTipo(tipoRaw: string): RedeAnexoTipo | null {
  if (tipoRaw in REDE_ANEXO_COLUNA) return tipoRaw as RedeAnexoTipo;
  return null;
}

/** Chaves do bucket Supabase só aceitam caracteres seguros no path do objeto. */
export function sanitizeRedeNomeArquivo(nome: string): string {
  const safe = String(nome ?? 'arquivo')
    .replace(/[/\\]/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return (safe || 'arquivo').slice(0, 180);
}

export function isRedeEmpresaDocColumn(column: string): boolean {
  return column.startsWith('anexo_emp_');
}

/** Caminho relativo no bucket `rede-attachments` (aceita legado com barra ou prefixo do bucket). */
export function normalizeRedeAnexoStoragePath(storagePath: string): string {
  let p = String(storagePath ?? '').trim();
  if (!p) return '';
  const fromUrl = p.match(/rede-attachments\/(.+)$/i);
  if (fromUrl) p = fromUrl[1]!;
  if (p.startsWith('rede-attachments/')) p = p.slice('rede-attachments/'.length);
  return p.replace(/^\/+/, '');
}
