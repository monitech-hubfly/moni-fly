#!/usr/bin/env node
/**
 * Stub de importação CSV → checklist_legal_condominio.
 * Uso: node scripts/import-checklist-legal-google-forms.mjs --csv respostas.csv [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const csvIdx = args.indexOf('--csv');
const dryRun = args.includes('--dry-run');
const csvPath = csvIdx >= 0 ? args[csvIdx + 1] : null;

if (!csvPath) {
  console.error('Informe --csv caminho/respostas.csv');
  process.exit(1);
}

const abs = path.resolve(csvPath);
if (!fs.existsSync(abs)) {
  console.error('Arquivo não encontrado:', abs);
  process.exit(1);
}

console.log('[checklist-legal import] Stub — leitura apenas.');
console.log('  CSV:', abs);
console.log('  dry-run:', dryRun);
console.log('');
console.log('Próximos passos de implementação:');
console.log('  1. Parse CSV (encoding UTF-8) e normalizar cabeçalhos do Google Forms');
console.log('  2. Conectar Supabase service role (SUPABASE_SERVICE_ROLE_KEY)');
console.log('  3. Upsert checklist_legal_condominio (versao++, status=concluido)');
console.log('  4. Insert checklist_legal_log (acao=import_csv)');
console.log('');
console.log('Documentação: docs/import-checklist-legal-google-forms.md');

const preview = fs.readFileSync(abs, 'utf8').split(/\r?\n/).slice(0, 3);
console.log('Prévia do CSV:');
preview.forEach((line) => console.log(' ', line.slice(0, 120)));
