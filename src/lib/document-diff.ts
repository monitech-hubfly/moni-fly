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
    const mod = await import('pdf-parse');
    const pdfParse = (mod as { default?: (b: Buffer) => Promise<unknown> }).default ?? (mod as unknown as (b: Buffer) => Promise<unknown>);
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

/** Meses por extenso (PT) ignorados na comparação de checklist assinado vs modelo. */
const MESES_EXTENSO =
  /\b(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/giu;

/**
 * Mascara datas, CPF, anos isolados, meses por extenso e blocos de nome em MAIÚSCULAS
 * (2+ palavras só com letras maiúsculas/acentos) para comparar modelo vs assinado.
 */
export function maskIgnorableContent(s: string): string {
  let out = s;
  out = out.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/gi, '__CPF__');
  out = out.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '__DATA__');
  out = out.replace(/\b\d{1,2}-\d{1,2}-\d{2,4}\b/g, '__DATA__');
  out = out.replace(/\b(19|20)\d{2}\b/g, '__ANO__');
  out = out.replace(MESES_EXTENSO, '__MES__');
  out = out.replace(/\b[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{2,}(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{2,})+\b/g, '__NOME__');
  return out;
}

function normalizeForChecklistCompare(line: string): string {
  return maskIgnorableContent(line).replace(/\s+/g, ' ').trim().toLowerCase();
}

function slicesEquivalentForChecklist(a: string, b: string): boolean {
  return normalizeForChecklistCompare(a) === normalizeForChecklistCompare(b);
}

function truncateDiffSnippet(s: string, max = 140): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * Após `computeDiff`, mantém só alterações que não se explicam apenas por
 * datas, meses, anos, CPF ou nomes em maiúsculas.
 */
export function filterRelevantChecklistDiff(templateText: string, documentText: string): {
  diferencas: string[];
  temDiferencasRelevantes: boolean;
} {
  const { changes } = computeDiff(templateText, documentText);
  const diferencas: string[] = [];
  for (const ch of changes) {
    const tl = ch.type === 'add' ? '' : (ch.templateSlice ?? '').trim();
    const dl = ch.type === 'remove' ? '' : (ch.documentSlice ?? '').trim();
    if (slicesEquivalentForChecklist(tl, dl)) continue;
    const ctx = ch.context ?? 'Trecho';
    if (ch.type === 'replace') {
      diferencas.push(
        `${ctx}: no modelo «${truncateDiffSnippet(tl)}» — no documento assinado «${truncateDiffSnippet(dl)}»`,
      );
    } else if (ch.type === 'add') {
      diferencas.push(`${ctx}: adicionado «${truncateDiffSnippet(dl)}»`);
    } else {
      diferencas.push(`${ctx}: removido em relação ao modelo «${truncateDiffSnippet(tl)}»`);
    }
  }
  return { diferencas, temDiferencasRelevantes: diferencas.length > 0 };
}
