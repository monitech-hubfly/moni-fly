import type { FaseChecklistItem } from '@/lib/actions/candidato-actions';

export type ChecklistCompartilhadoRow = {
  chave: string;
  valor: unknown;
};

const TIPOS_ANEXO_UNICO = new Set(['anexo', 'anexo_template']);

export function parseChecklistCompartilhadoValor(
  tipo: FaseChecklistItem['tipo'],
  jsonb: unknown,
): { valor: string; arquivo_path: string | null } {
  if (jsonb === null || jsonb === undefined) {
    return { valor: '', arquivo_path: null };
  }

  if (tipo === 'anexo_multiplo') {
    const arr = Array.isArray(jsonb)
      ? jsonb
      : typeof jsonb === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(jsonb) as unknown;
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : [];
    return { valor: JSON.stringify(arr), arquivo_path: null };
  }

  if (TIPOS_ANEXO_UNICO.has(tipo)) {
    const path = typeof jsonb === 'string' ? jsonb.trim() : String(jsonb ?? '').trim();
    return { valor: '', arquivo_path: path || null };
  }

  return { valor: String(jsonb ?? ''), arquivo_path: null };
}

export function buildChecklistCompartilhadoJsonb(
  tipo: FaseChecklistItem['tipo'],
  valor: string | null,
  arquivo_path: string | null,
): unknown {
  if (tipo === 'anexo_multiplo') {
    try {
      const parsed = JSON.parse(valor ?? '[]') as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  if (TIPOS_ANEXO_UNICO.has(tipo)) {
    const path = (arquivo_path ?? valor ?? '').trim();
    return path || null;
  }

  return valor ?? null;
}

export function isCheckboxTrue(valor: string | null | undefined): boolean {
  return String(valor ?? '').trim().toLowerCase() === 'true';
}
