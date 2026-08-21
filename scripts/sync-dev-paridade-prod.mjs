/**
 * Aplica migrations numeradas pendentes no banco DEV (paridade com PROD).
 *
 * Uso:
 *   node --env-file=.env.local scripts/sync-dev-paridade-prod.mjs
 *   node --env-file=.env.local scripts/sync-dev-paridade-prod.mjs --from=269
 *   node --env-file=.env.local scripts/sync-dev-paridade-prod.mjs --dry-run
 */
import pg from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePostgresUrl } from './pg-dev-client.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const migrationsDir = join(root, 'supabase', 'migrations');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fromArg = args.find((a) => a.startsWith('--from='));
const minVersion = fromArg ? parseInt(fromArg.split('=')[1], 10) : 269;

const url = (process.env.DEV_DB_URL || '').trim();
if (!url && !dryRun) {
  console.error('DEV_DB_URL não definida em .env.local');
  process.exit(1);
}

function listMigrations(from) {
  return readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_/.test(f) && f.endsWith('.sql'))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    .filter((f) => parseInt(f, 10) >= from);
}

const extraScripts = [
  'scripts/fix-dev-funil-stepone.sql',
  'scripts/fix-dev-checklist-mapa-competidores.sql',
  'scripts/fix-dev-listings-casas.sql',
];

const migrations = listMigrations(minVersion);

console.log(`Sync DEV ← PROD (migrations >= ${minVersion}): ${migrations.length} ficheiro(s)\n`);

if (dryRun) {
  for (const file of migrations) console.log(`[dry-run] supabase/migrations/${file}`);
  for (const rel of extraScripts) console.log(`[dry-run] ${rel}`);
  process.exit(0);
}

const cfg = parsePostgresUrl(url);
const client = new pg.Client({
  host: cfg.host,
  port: cfg.port,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
} catch (err) {
  console.error('Não foi possível conectar ao DEV_DB_URL:', err instanceof Error ? err.message : err);
  console.error('\nAlternativa: cole no Supabase SQL Editor:');
  console.error('  scripts/fix-dev-funil-stepone.sql');
  console.error('  scripts/fix-dev-checklist-mapa-competidores.sql');
  console.error('  scripts/fix-dev-listings-casas.sql');
  process.exit(1);
}

async function runSqlFile(relPath) {
  const sqlPath = resolve(root, relPath);
  const sql = readFileSync(sqlPath, 'utf8');
  await client.query(sql);
}

let failed = false;
for (const file of migrations) {
  const rel = join('supabase', 'migrations', file);
  process.stdout.write(`→ ${file} ... `);
  try {
    await runSqlFile(rel);
    console.log('ok');
  } catch (err) {
    console.log('FALHOU');
    console.error(err instanceof Error ? err.message : err);
    failed = true;
    break;
  }
}

if (!failed) {
  console.log('\n→ Scripts de paridade adicionais');
  for (const rel of extraScripts) {
    process.stdout.write(`→ ${rel} ... `);
    try {
      await runSqlFile(rel);
      console.log('ok');
    } catch (err) {
      console.log('FALHOU');
      console.error(err instanceof Error ? err.message : err);
      failed = true;
      break;
    }
  }
}

await client.end();

if (!failed) {
  console.log('\n✓ Sync DEV concluído. Rode: npm run db:check-dev');
  process.exit(0);
}

console.error('\nCorrija o erro acima ou aplique manualmente via Supabase SQL Editor.');
process.exit(1);
