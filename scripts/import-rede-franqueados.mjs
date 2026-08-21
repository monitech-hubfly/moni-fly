/**
 * Importa franqueados de um arquivo CSV para a tabela rede_franqueados no Supabase.
 *
 * Uso:
 *   npm run rede-franqueados:import -- seu-arquivo.csv
 *
 * CSV: primeira linha = cabeçalho. Colunas aceitas (nome exato ou similar):
 *   N de Franquia, Nome Completo do Franqueado, Status da Franquia, Classificação do Franqueado,
 *   Data de Ass. COF, Data de Ass. Contrato, Data de Expiração da Franquia, Regional,
 *   Área de Atuação da Franquia, E-mail do Frank, Telefone do Frank, CPF do Frank,
 *   Data de Nasc. Frank, Endereço Casa do Frank, CEP Casa Frank, Estado Casa Frank, Cidade Casa Frank,
 *   Tamanho da Camiseta do Frank, Sócios, Ordem
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  try {
    const path = resolve(process.cwd(), '.env.local');
    const content = readFileSync(path, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (_) {}
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_DEV_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    'Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_DEV_SERVICE_ROLE_KEY ou SUPABASE_SERVICE_ROLE_KEY no .env.local (ou no ambiente).',
  );
  console.error(
    'Service role: Supabase Dashboard → Project Settings → API → service_role (secret).',
  );
  process.exit(1);
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error(
    'Uso: node --env-file=.env.local scripts/import-rede-franqueados.mjs <arquivo.csv>',
  );
  process.exit(1);
}

function parseCSV(text) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
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
    if (c === ',') {
      current.push(field.trim());
      field = '';
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
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

// Converte dd/mm/yyyy ou dd-mm-yyyy para yyyy-mm-dd (para DATE no Postgres)
function toISODate(val) {
  if (!val || typeof val !== 'string') return null;
  const v = val.trim();
  if (!v) return null;
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, d, month, y] = m;
    const year = y.length === 2 ? '20' + y : y;
    return `${year}-${month.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return v;
}

const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();

const COL_MAP = [
  ['n_franquia', ['n de franquia', 'n de franquia_1', 'n franquia', 'numero franquia', 'franquia']],
  ['nome_completo', ['nome completo', 'nome completo do franqueado', 'nome']],
  ['status_franquia', ['status da franquia', 'status franquia', 'status']],
  ['classificacao_franqueado', ['classificacao do franqueado', 'classificacao', 'classificação']],
  ['data_ass_cof', ['data de ass. cof', 'data ass cof', 'data cof']],
  ['data_ass_contrato', ['data de ass. contrato', 'data ass contrato', 'data contrato']],
  ['data_expiracao_franquia', ['data de expiracao da franquia', 'data expiracao', 'expiracao']],
  ['regional', ['regional']],
  [
    'area_atuacao',
    [
      'area de atuacao da franquia',
      'area de atuacao',
      'area atuacao',
      'área de atuação',
      'unidade',
    ],
  ],
  ['email_frank', ['e-mail do frank', 'email do frank', 'email frank', 'e-mail', 'email']],
  ['telefone_frank', ['telefone do frank', 'telefone frank', 'telefone']],
  ['cpf_frank', ['cpf do frank', 'cpf frank', 'cpf']],
  ['data_nasc_frank', ['data de nasc. frank', 'data nasc frank', 'data nascimento']],
  [
    'endereco_casa_frank',
    [
      'endereco casa do frank',
      'endereco casa frank',
      'endereço casa',
      'rua',
      'endereco',
      'complemento',
    ],
  ],
  ['cep_casa_frank', ['cep casa frank', 'cep casa', 'cep']],
  ['estado_casa_frank', ['estado casa frank', 'estado casa', 'estado']],
  ['cidade_casa_frank', ['cidade casa frank', 'cidade casa', 'cidade']],
  [
    'tamanho_camisa_frank',
    ['tamanho da camiseta do frank', 'tamanho camiseta', 'tamanho camisa', 'camiseta'],
  ],
  ['socios', ['socios', 'sócios', 'listar nome nascimento']],
  [
    'data_recebimento_kit_boas_vindas',
    ['data de recebimento do kit de boas vindas', 'kit de boas vindas', 'recebimento kit'],
  ],
  ['ordem', ['ordem', 'order']],
];

function mapRow(headers, row) {
  const out = {
    ordem: 0,
    n_franquia: null,
    nome_completo: null,
    status_franquia: null,
    classificacao_franqueado: null,
    data_ass_cof: null,
    data_ass_contrato: null,
    data_expiracao_franquia: null,
    regional: null,
    area_atuacao: null,
    email_frank: null,
    telefone_frank: null,
    cpf_frank: null,
    data_nasc_frank: null,
    endereco_casa_frank: null,
    cep_casa_frank: null,
    estado_casa_frank: null,
    cidade_casa_frank: null,
    tamanho_camisa_frank: null,
    socios: null,
    data_recebimento_kit_boas_vindas: null,
  };
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (!h) continue;
    const val = (row[i] ?? '').trim() || null;
    for (const [col, aliases] of COL_MAP) {
      if (aliases.some((a) => h === a || h.includes(a))) {
        if (col === 'ordem') {
          out.ordem = parseInt(val, 10) || 0;
        } else if (col.startsWith('data_') && val) {
          out[col] = toISODate(val);
        } else {
          out[col] = val;
        }
        break;
      }
    }
  }
  return out;
}

async function main() {
  let csvContent;
  try {
    csvContent = readFileSync(resolve(process.cwd(), csvPath), 'utf8');
  } catch (e) {
    console.error('Erro ao ler arquivo:', csvPath, e.message);
    process.exit(1);
  }

  csvContent = csvContent.replace(/^\uFEFF/, '');
  const rows = parseCSV(csvContent);
  if (rows.length < 2) {
    console.error('CSV precisa de cabeçalho + pelo menos uma linha de dados.');
    process.exit(1);
  }

  const headers = rows[0].map((h) => (h || '').trim());
  const dataRows = rows.slice(1);
  const records = dataRows.map((row) => mapRow(headers, row));

  const supabase = createClient(url, serviceKey);
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { data, error } = await supabase.from('rede_franqueados').insert(batch).select('id');
    if (error) {
      console.error('Erro ao inserir:', error.message);
      process.exit(1);
    }
    inserted += (data || []).length;
    console.log('Inseridos', inserted, '/', records.length);
  }

  console.log('Concluído. Total inserido:', inserted);
}

main();
