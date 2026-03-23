import { promises as fs } from 'node:fs';
import { parseCSV } from '@/lib/import-rede-csv';

type FixOptions = {
  /**
   * Caminho de saída. Se omitido, sobrescreve o arquivo de entrada.
   */
  outputPath?: string;
  /**
   * Colunas 1-indexed para corrigir (padrão: 23..28).
   */
  startColumn?: number;
  endColumn?: number;
};

function detectLineBreak(text: string): '\r\n' | '\n' {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function detectDelimiterFromHeaderLine(line: string): ',' | ';' | '\t' {
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  let tabs = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    if (inQuotes) continue;
    if (c === ',') commas++;
    else if (c === ';') semis++;
    else if (c === '\t') tabs++;
  }
  if (semis > commas && semis >= tabs) return ';';
  if (tabs > commas && tabs > semis) return '\t';
  return ',';
}

function csvEscape(value: string, delimiter: ',' | ';' | '\t'): string {
  const needsQuotes =
    value.includes('"') || value.includes('\n') || value.includes('\r') || value.includes(delimiter);
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function rewriteHeaderColumns23to28(headers: string[], startCol: number, endCol: number): string[] {
  // Mapeia os nomes esperados exatamente como no template original (com espaço inicial)
  const expectedWithLeadingSpace = new Map<string, string>([
    ['Nascimento', ' Nascimento'],
    ['Telefone', ' Telefone'],
    ['E-mail', ' E-mail'],
    ['Email', ' E-mail'],
    ['CPF', ' CPF'],
    ['Endereço Completo', ' Endereço Completo'],
    ['Endereco Completo', ' Endereço Completo'],
    ['Tamanho da camisa)', ' Tamanho da camisa)'],
  ]);

  const out = [...headers];
  for (let col = startCol; col <= endCol; col++) {
    const idx = col - 1; // 1-indexed -> 0-indexed
    const h = out[idx];
    if (h == null) continue;

    // Se já tem espaço inicial, ok
    if (/^\s/.test(h)) continue;

    const fixed = expectedWithLeadingSpace.get(h);
    if (fixed) out[idx] = fixed;
  }
  return out;
}

export function normalizeRedeCsvHeadersFromSheets(csvText: string): { ok: true; csvText: string; changed: boolean } | { ok: false; error: string } {
  if (!csvText || !csvText.trim()) return { ok: false, error: 'CSV vazio.' };
  const eol = detectLineBreak(csvText);
  const firstBreakIdx = csvText.indexOf('\n');
  const headerLineRaw =
    firstBreakIdx === -1 ? csvText.replace(/\r$/, '') : csvText.slice(0, firstBreakIdx).replace(/\r$/, '');
  const delimiter = detectDelimiterFromHeaderLine(headerLineRaw);

  const parsed = parseCSV(csvText, delimiter);
  if (!parsed || parsed.length === 0) return { ok: false, error: 'Não foi possível ler o cabeçalho do CSV.' };

  const headers = parsed[0].map((h) => (h ?? '').toString());

  // Canoniza por trim: se bater após trim, usa o nome esperado (incluindo espaço inicial quando necessário).
  const canonicalByTrim = new Map<string, string>();
  for (const h of headers) canonicalByTrim.set(h.trim(), h);

  // Correções conhecidas do template "Sócios" (Sheets remove espaço inicial)
  const mustHaveLeadingSpace = new Map<string, string>([
    ['Nascimento', ' Nascimento'],
    ['Telefone', ' Telefone'],
    ['E-mail', ' E-mail'],
    ['Email', ' E-mail'],
    ['CPF', ' CPF'],
    ['Endereço Completo', ' Endereço Completo'],
    ['Endereco Completo', ' Endereço Completo'],
    ['Tamanho da camisa)', ' Tamanho da camisa)'],
  ]);

  const outHeaders = [...headers].map((h) => {
    const t = h.trim();
    const fixed = mustHaveLeadingSpace.get(t);
    return fixed ?? h;
  });

  const changed = outHeaders.some((h, i) => h !== headers[i]);
  if (!changed) return { ok: true, csvText, changed: false };

  const newHeaderLine = outHeaders.map((v) => csvEscape(v, delimiter)).join(delimiter);
  const rest = firstBreakIdx === -1 ? '' : csvText.slice(firstBreakIdx + 1);
  return { ok: true, csvText: `${newHeaderLine}${eol}${rest}`, changed: true };
}

export function fixRedeCsvSociosHeadersTextFromSheets(
  csvText: string,
  options: { startColumn?: number; endColumn?: number } = {},
): { ok: true; csvText: string; changed: boolean } | { ok: false; error: string } {
  const startColumn = options.startColumn ?? 23;
  const endColumn = options.endColumn ?? 28;
  if (startColumn < 1 || endColumn < startColumn) return { ok: false, error: 'Intervalo de colunas inválido.' };
  if (!csvText || !csvText.trim()) return { ok: false, error: 'CSV vazio.' };

  const eol = detectLineBreak(csvText);
  const firstBreakIdx = csvText.indexOf('\n');
  const headerLineRaw =
    firstBreakIdx === -1 ? csvText.replace(/\r$/, '') : csvText.slice(0, firstBreakIdx).replace(/\r$/, '');
  const delimiter = detectDelimiterFromHeaderLine(headerLineRaw);

  const parsed = parseCSV(csvText, delimiter);
  if (!parsed || parsed.length === 0) return { ok: false, error: 'Não foi possível ler o cabeçalho do CSV.' };

  const headers = parsed[0].map((h) => (h ?? '').toString());
  const fixedHeaders = rewriteHeaderColumns23to28(headers, startColumn, endColumn);
  const changed = fixedHeaders.some((h, i) => h !== headers[i]);
  if (!changed) return { ok: true, csvText, changed: false };

  const newHeaderLine = fixedHeaders.map((v) => csvEscape(v, delimiter)).join(delimiter);
  const rest = firstBreakIdx === -1 ? '' : csvText.slice(firstBreakIdx + 1);
  return { ok: true, csvText: `${newHeaderLine}${eol}${rest}`, changed: true };
}

export async function fixRedeCsvSociosHeadersFromSheets(
  inputPath: string,
  options: FixOptions = {},
): Promise<{ ok: true; inputPath: string; outputPath: string; changed: boolean } | { ok: false; error: string }> {
  const startColumn = options.startColumn ?? 23;
  const endColumn = options.endColumn ?? 28;
  if (startColumn < 1 || endColumn < startColumn) {
    return { ok: false, error: 'Intervalo de colunas inválido.' };
  }

  const original = await fs.readFile(inputPath, 'utf8');
  if (!original.trim()) return { ok: false, error: 'Arquivo CSV vazio.' };

  const eol = detectLineBreak(original);
  const firstBreakIdx = original.indexOf('\n');
  const headerLineRaw =
    firstBreakIdx === -1 ? original.replace(/\r$/, '') : original.slice(0, firstBreakIdx).replace(/\r$/, '');

  const delimiter = detectDelimiterFromHeaderLine(headerLineRaw);
  const parsed = parseCSV(original, delimiter);
  if (!parsed || parsed.length === 0) return { ok: false, error: 'Não foi possível ler o cabeçalho do CSV.' };

  const headers = parsed[0].map((h) => (h ?? '').toString());
  const fixedHeaders = rewriteHeaderColumns23to28(headers, startColumn, endColumn);

  const changed = fixedHeaders.some((h, i) => h !== headers[i]);
  if (!changed) {
    const outputPath = options.outputPath ?? inputPath;
    if (outputPath !== inputPath) await fs.writeFile(outputPath, original, 'utf8');
    return { ok: true, inputPath, outputPath, changed: false };
  }

  // Recompõe somente a primeira linha; mantém o resto do arquivo intacto
  const newHeaderLine = fixedHeaders.map((v) => csvEscape(v, delimiter)).join(delimiter);
  const rest = firstBreakIdx === -1 ? '' : original.slice(firstBreakIdx + 1);
  const rebuilt = `${newHeaderLine}${eol}${rest}`;

  const outputPath = options.outputPath ?? inputPath;
  await fs.writeFile(outputPath, rebuilt, 'utf8');
  return { ok: true, inputPath, outputPath, changed: true };
}

