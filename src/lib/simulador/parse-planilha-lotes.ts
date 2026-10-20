import * as XLSX from 'xlsx';
import { parseMoneyText } from '@/lib/dashboard-novos-negocios/parseMoney';

export type LotePlanilhaLinha = {
  codigo: string;
  quadra: string | null;
  lote: string | null;
  valor: number;
  valorAcoplamento: number;
  /** Sem coluna Disponível → true (planilhas antigas). */
  disponivel: boolean;
  frente_m: number | null;
  fundo_m: number | null;
  lateral1_m: number | null;
  lateral2_m: number | null;
  area_m2: number | null;
};

function chaveHeader(h: string): string {
  return String(h ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function findKey(keys: string[], pred: (k: string) => boolean): string | undefined {
  return keys.find((k) => pred(chaveHeader(k)));
}

function isQuadraKey(k: string): boolean {
  return k === 'quadra' || k === 'qd' || k === 'quadraid';
}

function isLoteKey(k: string): boolean {
  return (
    k === 'lote' ||
    k === 'nrolote' ||
    k === 'numerolote' ||
    k === 'numerodolote' ||
    k === 'nrlote'
  );
}

function isCodigoKey(k: string): boolean {
  return (
    isLoteKey(k) ||
    k === 'codigo' ||
    k === 'codigodolote' ||
    k === 'identificador' ||
    k === 'quadralote' ||
    k === 'unidade' ||
    k === 'id'
  );
}

function isValorKey(k: string): boolean {
  return (
    k === 'valor' ||
    k === 'valortotal' ||
    k === 'valorlote' ||
    k === 'valordolote' ||
    k === 'valortotaldolote' ||
    k === 'preco' ||
    k === 'precodolote' ||
    k === 'vlr' ||
    k === 'price' ||
    k === 'valorvenda'
  );
}

function isAcoplamentoKey(k: string): boolean {
  return (
    k === 'acoplamento' ||
    k === 'valoracoplamento' ||
    k === 'classificacaoacoplamento' ||
    k === 'classificacaodoacoplamento'
  );
}

function isDisponivelKey(k: string): boolean {
  return k === 'disponivel' || k === 'disponibilidade' || k === 'disponivelparavenda';
}

function isFrenteKey(k: string): boolean {
  return k === 'frente' || k === 'frentem';
}

function isFundoKey(k: string): boolean {
  return k === 'fundo' || k === 'fundom';
}

function isLateral1Key(k: string): boolean {
  return k === 'lateral1' || k === 'lateralesq' || k === 'lateralesquerda';
}

function isLateral2Key(k: string): boolean {
  return k === 'lateral2' || k === 'lateraldireita' || k === 'laterald';
}

function isAreaKey(k: string): boolean {
  return k === 'area' || k === 'aream2' || k === 'aream' || k === 'metragem';
}

function textoCelula(raw: unknown): string {
  return String(raw ?? '').trim();
}

/** Quadra/lote como texto, sem casa decimal quando o Excel guarda o número como 1.0 ou "1,00". */
function identificadorCelula(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Number.isInteger(raw) ? String(raw) : String(raw).replace('.', ',');
  }
  const t = textoCelula(raw);
  const m = /^(\d+)[.,]0+$/.exec(t);
  return m ? m[1]! : t;
}

function valorCelula(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return parseMoneyText(String(raw ?? ''));
}

function dimCelula(raw: unknown): number | null {
  const n = valorCelula(raw);
  return n != null && Number.isFinite(n) && n >= 0 ? n : null;
}

function flagDisponivel(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw;
  const t = textoCelula(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!t) return null;
  if (t === 'sim' || t === 's' || t === 'yes' || t === 'true' || t === '1') return true;
  if (t === 'nao' || t === 'n' || t === 'no' || t === 'false' || t === '0') return false;
  return null;
}

function montarCodigo(
  rec: Record<string, unknown>,
  quadraKey: string | undefined,
  loteKey: string | undefined,
  codigoKey: string | undefined,
): string {
  const lote = loteKey ? identificadorCelula(rec[loteKey]) : '';
  const quadra = quadraKey ? identificadorCelula(rec[quadraKey]) : '';
  if (quadra && lote) return `${quadra}-${lote}`;
  if (lote) return lote;
  if (codigoKey) return identificadorCelula(rec[codigoKey]);
  return '';
}

function parseRecords(records: Record<string, unknown>[]): LotePlanilhaLinha[] {
  if (records.length === 0) {
    console.error('[planilha-lotes] planilha sem linhas de dados');
    return [];
  }
  const keys = Object.keys(records[0] ?? {});
  const quadraKey = findKey(keys, isQuadraKey);
  const loteKey = findKey(keys, isLoteKey);
  const codigoKey = findKey(keys, isCodigoKey);
  const valorKey = findKey(keys, isValorKey);
  const acoplKey = findKey(keys, isAcoplamentoKey);
  const dispKey = findKey(keys, isDisponivelKey);
  const frenteKey = findKey(keys, isFrenteKey);
  const fundoKey = findKey(keys, isFundoKey);
  const lat1Key = findKey(keys, isLateral1Key);
  const lat2Key = findKey(keys, isLateral2Key);
  const areaKey = findKey(keys, isAreaKey);

  if (!valorKey || (!loteKey && !codigoKey)) {
    console.error('[planilha-lotes] cabeçalhos insuficientes', {
      keys,
      valorKey: valorKey ?? null,
      loteKey: loteKey ?? null,
      codigoKey: codigoKey ?? null,
    });
    return [];
  }

  const out: LotePlanilhaLinha[] = [];
  for (const rec of records) {
    const codigo = montarCodigo(rec, quadraKey, loteKey, codigoKey);
    if (!codigo) continue;
    const valor = valorCelula(rec[valorKey]);
    if (valor == null || !Number.isFinite(valor) || valor < 0) continue;
    const acoplRaw = acoplKey ? valorCelula(rec[acoplKey]) : null;
    const valorAcoplamento =
      acoplRaw != null && Number.isFinite(acoplRaw) && acoplRaw >= 0 ? acoplRaw : 0;
    const flag = dispKey ? flagDisponivel(rec[dispKey]) : true;
    if (dispKey && flag == null) continue;
    out.push({
      codigo,
      quadra: quadraKey ? identificadorCelula(rec[quadraKey]) || null : null,
      lote: loteKey ? identificadorCelula(rec[loteKey]) || null : null,
      valor,
      valorAcoplamento,
      disponivel: flag === true,
      frente_m: frenteKey ? dimCelula(rec[frenteKey]) : null,
      fundo_m: fundoKey ? dimCelula(rec[fundoKey]) : null,
      lateral1_m: lat1Key ? dimCelula(rec[lat1Key]) : null,
      lateral2_m: lat2Key ? dimCelula(rec[lat2Key]) : null,
      area_m2: areaKey ? dimCelula(rec[areaKey]) : null,
    });
  }
  if (out.length === 0) {
    console.error('[planilha-lotes] nenhum lote válido após o parse', {
      keys,
      linhas: records.length,
      valorKey,
      loteKey,
      dispKey: dispKey ?? null,
    });
  }
  return out;
}

/**
 * Lê .csv ou .xlsx pelos cabeçalhos (Quadra, Lote, Valor total, Disponível, …).
 */
export function parsePlanilhaLotesBuffer(buffer: ArrayBuffer, filename: string): LotePlanilhaLinha[] {
  try {
    const lower = String(filename ?? '').toLowerCase();
    let wb: XLSX.WorkBook;
    if (lower.endsWith('.csv')) {
      const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
      const first = text.split(/\r?\n/, 1)[0] ?? '';
      const fs = first.split(';').length > first.split(',').length ? ';' : ',';
      wb = XLSX.read(text, { type: 'string', FS: fs });
    } else {
      wb = XLSX.read(buffer, { type: 'array' });
    }
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      console.error('[planilha-lotes] arquivo sem abas', { filename });
      return [];
    }
    const sheet = wb.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: true,
    });
    return parseRecords(records);
  } catch (err) {
    console.error('[planilha-lotes] falha ao ler arquivo', { filename, err });
    return [];
  }
}
