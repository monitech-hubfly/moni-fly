import * as XLSX from 'xlsx';
import { parseMoneyText } from '@/lib/dashboard-novos-negocios/parseMoney';

/**
 * FUTURO — última coluna da planilha:
 * Valor de Acoplamento daquele lote. Vai compor a customização da casa
 * (`valor_customizacao`) quando a tela da Ingrid (definição do valor da casa)
 * alimentar a tela do corretor. Não usar agora: não preencher valor da casa
 * nem valor da customização no simulador a partir desta coluna.
 */
export type LotePlanilhaLinha = {
  codigo: string;
  valor: number;
  /** Reservado. Última coluna = Acoplamento. Não enviar à tela do corretor. */
  valorAcoplamento: number;
};

function chaveHeader(h: string): string {
  return String(h ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function isCodigoKey(k: string): boolean {
  return (
    k === 'codigo' ||
    k === 'codigodolote' ||
    k === 'lote' ||
    k === 'identificador' ||
    k === 'nrolote' ||
    k === 'numerolote' ||
    k === 'numerodolote' ||
    k === 'quadralote' ||
    k === 'unidade' ||
    k === 'id'
  );
}

const CODIGO_HEADER_ORDEM = [
  'codigo',
  'codigodolote',
  'lote',
  'identificador',
  'nrolote',
  'numerolote',
  'numerodolote',
  'quadralote',
  'unidade',
  'id',
] as const;

function isValorKey(k: string): boolean {
  return (
    k === 'valor' ||
    k === 'valorlote' ||
    k === 'valordolote' ||
    k === 'preco' ||
    k === 'precodolote' ||
    k === 'vlr' ||
    k === 'price' ||
    k === 'valorvenda'
  );
}

function isAcoplamentoKey(k: string): boolean {
  return k === 'acoplamento' || k === 'valoracoplamento';
}

function valorCelula(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return parseMoneyText(String(raw ?? ''));
}

function parseRecords(records: Record<string, unknown>[]): LotePlanilhaLinha[] {
  if (records.length === 0) return [];
  const keys = Object.keys(records[0] ?? {});
  const lastKey = keys[keys.length - 1];
  const ultimaEhAcoplamento =
    Boolean(lastKey) &&
    (keys.length >= 3 || isAcoplamentoKey(chaveHeader(lastKey ?? '')));
  const keysSemUltima = ultimaEhAcoplamento ? keys.slice(0, -1) : keys;

  const codigoKey =
    CODIGO_HEADER_ORDEM.map((pref) => keysSemUltima.find((k) => chaveHeader(k) === pref)).find(
      Boolean,
    ) ?? keysSemUltima.find((k) => isCodigoKey(chaveHeader(k)));
  const valorKey = keysSemUltima.find((k) => isValorKey(chaveHeader(k)));
  const ck = codigoKey ?? keysSemUltima[0];
  const vk = valorKey ?? keysSemUltima[1];
  if (!ck || !vk || ck === vk) return [];

  const out: LotePlanilhaLinha[] = [];
  for (const rec of records) {
    const codigo = String(rec[ck] ?? '').trim();
    if (!codigo) continue;
    const valor = valorCelula(rec[vk]);
    if (valor == null || !Number.isFinite(valor) || valor < 0) continue;
    const acoplRaw = ultimaEhAcoplamento && lastKey ? valorCelula(rec[lastKey]) : 0;
    const valorAcoplamento =
      acoplRaw != null && Number.isFinite(acoplRaw) && acoplRaw >= 0 ? acoplRaw : 0;
    out.push({ codigo, valor, valorAcoplamento });
  }
  return out;
}

/**
 * Lê .csv ou .xlsx → codigo + valor do lote.
 * A última coluna (Acoplamento) é lida só para não confundir com valor de lote.
 * Não deve alimentar valor da casa nem valor da customização no simulador.
 */
export function parsePlanilhaLotesBuffer(buffer: ArrayBuffer, filename: string): LotePlanilhaLinha[] {
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
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
  return parseRecords(records);
}
