/**
 * Helpers para importar CSV de rede_franqueados.
 * O CSV usa cabeçalhos snake_case e é mapeado 1:1 por coluna.
 */

export function parseCSV(text: string, delimiter: ',' | ';' | '\t' = ','): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  const t = text.replace(/^\uFEFF/, '');
  const sep = delimiter;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === sep) {
      current.push(field.trim());
      field = '';
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      current.push(field.trim());
      field = '';
      if (current.some((cell) => cell !== '')) rows.push(current);
      current = [];
      continue;
    }
    field += c;
  }
  if (field !== '' || current.length > 0) {
    current.push(field.trim());
    if (current.some((cell) => cell !== '')) rows.push(current);
  }
  return rows;
}

function normalizeFK(val: string | null): string | null {
  if (!val) return val;
  const v = String(val).trim();
  if (!v) return null;
  const m = v.match(/fk\s*0*(\d+)/i);
  if (!m) return v;
  const n = parseInt(m[1] ?? '', 10);
  if (!Number.isFinite(n) || n < 0) return v;
  return `FK${String(n).padStart(4, '0')}`;
}

function toISODate(val: string | null | undefined): string | null {
  if (!val || typeof val !== 'string') return null;
  const v = val.trim();
  if (!v) return null;
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, d, month, y] = m;
    const year = y!.length === 2 ? '20' + y : y;
    return `${year}-${month!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return v;
}

const COL_MAP: [string, string[]][] = [
  ['n_franquia', []],
  ['modalidade', []],
  ['nome_completo', []],
  ['status_franquia', []],
  ['classificacao_franqueado', []],
  ['data_ass_cof', []],
  ['data_ass_contrato', []],
  ['data_expiracao_franquia', []],
  ['regional', []],
  ['area_atuacao', []],
  ['email_frank', []],
  ['telefone_frank', []],
  ['cpf_frank', []],
  ['data_nasc_frank', []],
  ['endereco_casa_frank', []],
  ['endereco_casa_frank_numero', []],
  ['endereco_casa_frank_complemento', []],
  ['cep_casa_frank', []],
  ['estado_casa_frank', []],
  ['cidade_casa_frank', []],
  ['tamanho_camisa_frank', []],
  ['socios', []],
  ['data_recebimento_kit_boas_vindas', []],
  ['modalidade', []],
  ['responsavel_comercial', []],
  ['ordem', []],
];

export type RedeFranqueadoRow = Record<string, string | number | null>;

export function mapCSVRowToRede(headers: string[], row: string[]): RedeFranqueadoRow {
  const out: RedeFranqueadoRow = {
    ordem: 0,
    n_franquia: null,
    modalidade: null,
    nome_completo: null,
    status_franquia: null,
    classificacao_franqueado: null,
    data_ass_cof: null,
    data_ass_contrato: null,
    data_expiracao_franquia: null,
    regional: null,
    area_atuacao: null,
    email_frank: null,
    responsavel_comercial: null,
    telefone_frank: null,
    cpf_frank: null,
    data_nasc_frank: null,
    endereco_casa_frank: null,
    endereco_casa_frank_numero: null,
    endereco_casa_frank_complemento: null,
    cep_casa_frank: null,
    estado_casa_frank: null,
    cidade_casa_frank: null,
    tamanho_camisa_frank: null,
    socios: null,
    data_recebimento_kit_boas_vindas: null,
  };

  for (let i = 0; i < headers.length; i++) {
    const rawHeader = headers[i] ?? '';
    if (!rawHeader) continue;
    const val = (row[i] ?? '').trim() || null;

    const key = rawHeader as keyof RedeFranqueadoRow;
    if (!(key in out)) continue;

    if (key === 'ordem') {
      out.ordem = typeof val === 'string' ? parseInt(val, 10) || 0 : 0;
    } else if (key.startsWith('data_') && val) {
      out[key] = toISODate(val);
    } else if (key === 'n_franquia') {
      out.n_franquia = normalizeFK(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

export function parseAndMapRedeCSV(
  csvText: string,
):
  | { headers: string[]; records: RedeFranqueadoRow[]; meta: { headerLen: number; minLen: number; maxLen: number; badRows: number[] } }
  | null {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return null;
  const headers = rows[0].map((h) => (h ?? '').trim());
  const headerLen = headers.length;

  let minLen = Number.POSITIVE_INFINITY;
  let maxLen = 0;
  const badRows: number[] = [];

  // valida alinhamento: se alguma linha tiver mais/menos colunas que o cabeçalho,
  // geralmente é porque existe vírgula dentro de um valor sem aspas.
  for (let i = 1; i < rows.length; i++) {
    const len = rows[i]?.length ?? 0;
    minLen = Math.min(minLen, len);
    maxLen = Math.max(maxLen, len);
    if (len !== headerLen) badRows.push(i + 1); // +1 para linha do CSV (1-index)
  }

  const records = rows.slice(1).map((row) => mapCSVRowToRede(headers, row));
  return {
    headers,
    records,
    meta: { headerLen, minLen: minLen === Number.POSITIVE_INFINITY ? 0 : minLen, maxLen, badRows: badRows.slice(0, 10) },
  };
}
