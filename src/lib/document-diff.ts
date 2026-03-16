/**
 * Extração de texto de DOCX/PDF e comparação com template para document_instances.
 * Usado após upload em Step 3 e Step 7.
 */

export type DiffChange = {
  type: 'add' | 'remove' | 'replace';
  templateSlice?: string;
  documentSlice?: string;
  context?: string;
};

export type DiffResult = {
  changes: DiffChange[];
  summary: { total: number; templateLength: number; documentLength: number };
};

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_PDF = 'application/pdf';

function normalizeText(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\s+/g, ' ').trim();
}

/** Extrai texto de um buffer DOCX (Node apenas). */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return normalizeText(result.value ?? '');
  } catch {
    return '';
  }
}

/** Extrai texto de um buffer PDF (Node apenas). */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return normalizeText((data as { text?: string }).text ?? '');
  } catch {
    return '';
  }
}

/** Extrai texto conforme o tipo do arquivo. */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename?: string,
): Promise<string> {
  const ext = filename?.split('.').pop()?.toLowerCase();
  if (mimeType === MIME_DOCX || ext === 'docx' || ext === 'doc') {
    return extractTextFromDocx(buffer);
  }
  if (mimeType === MIME_PDF || ext === 'pdf') {
    return extractTextFromPdf(buffer);
  }
  return '';
}

/**
 * Compara texto do template com o do documento e retorna lista de diferenças.
 * Comparação por linhas (normalizadas por linha).
 */
export function computeDiff(templateText: string, documentText: string): DiffResult {
  const normalizeLine = (s: string) => s.replace(/\s+/g, ' ').trim();
  const tLines = templateText.split(/\r?\n/);
  const dLines = documentText.split(/\r?\n/);
  const changes: DiffChange[] = [];
  const maxLines = Math.max(tLines.length, dLines.length);

  for (let i = 0; i < maxLines; i++) {
    const tl = normalizeLine(tLines[i] ?? '');
    const dl = normalizeLine(dLines[i] ?? '');
    if (tl !== dl) {
      const templateSlice = (tLines[i] ?? '').trim().slice(0, 200);
      const documentSlice = (dLines[i] ?? '').trim().slice(0, 200);
      if (!tl && dl) {
        changes.push({ type: 'add', documentSlice, context: `Linha ${i + 1}` });
      } else if (tl && !dl) {
        changes.push({ type: 'remove', templateSlice, context: `Linha ${i + 1}` });
      } else {
        changes.push({
          type: 'replace',
          templateSlice,
          documentSlice,
          context: `Linha ${i + 1}`,
        });
      }
    }
  }

  const t = normalizeText(templateText);
  const d = normalizeText(documentText);
  return {
    changes,
    summary: {
      total: changes.length,
      templateLength: t.length,
      documentLength: d.length,
    },
  };
}
