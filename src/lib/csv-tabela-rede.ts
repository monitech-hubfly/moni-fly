/** Parse e export CSV simples para tabelas da Rede (delimitador vírgula, aspas RFC4180 básico). */

export function escapeCsvCell(val: string | null | undefined): string {
  const s = (val ?? '').toString().trim();
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function linhasParaCsv(headers: readonly string[], rows: Record<string, string>[]): string {
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h] ?? '')).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

export type ParseCsvResult =
  | { ok: true; headers: string[]; rows: Record<string, string>[] }
  | { ok: false; error: string };

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseCsvTexto(csvText: string): ParseCsvResult {
  const raw = csvText.replace(/^\uFEFF/, '').trim();
  if (!raw) return { ok: false, error: 'Arquivo CSV vazio.' };

  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { ok: false, error: 'CSV inválido ou sem linhas de dados. Use cabeçalho na primeira linha.' };
  }

  const headers = parseCsvLine(lines[0]!).map((h) => h.trim());
  if (headers.length <= 1) {
    return {
      ok: false,
      error:
        'CSV parece estar com delimitador diferente (ex.: ";" em vez de ","). Reexporte como CSV com vírgula.',
    };
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    if (cells.every((c) => !c.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim();
    });
    rows.push(row);
  }

  if (rows.length === 0) {
    return { ok: false, error: 'Nenhuma linha de dados encontrada no CSV.' };
  }

  return { ok: true, headers, rows };
}

export function exigirColunas(headers: string[], required: readonly string[]): string | null {
  const set = new Set(headers.map((h) => h.toLowerCase()));
  for (const col of required) {
    if (!set.has(col.toLowerCase())) {
      return `Coluna obrigatória ausente no cabeçalho: ${col}`;
    }
  }
  return null;
}

export function valorCsv(row: Record<string, string>, key: string): string {
  const hit = Object.entries(row).find(([k]) => k.toLowerCase() === key.toLowerCase());
  return (hit?.[1] ?? '').trim();
}

export function patchCsvNaoVazio(row: Record<string, string>, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = valorCsv(row, k);
    if (v) out[k] = v;
  }
  return out;
}
