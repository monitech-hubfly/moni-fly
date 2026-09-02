/**
 * Aplica migration da coluna anexo_numero_franquia_path no banco remoto.
 * Uso: node --env-file=.env.local scripts/ensure-rede-anexo-numero-franquia.mjs PROD
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const envName = (process.argv[2] || 'PROD').toUpperCase();
const key = envName === 'PROD' ? 'PROD_DB_URL' : 'DEV_DB_URL';
const raw = (process.env[key] || '').trim().replace(/^["']|["']$/g, '');

if (!raw) {
  console.error(`Defina ${key} no .env.local`);
  process.exit(1);
}

const sqlPath = resolve(__dirname, '../supabase/migrations/199_rede_ensure_anexo_numero_franquia.sql');
const sql = readFileSync(sqlPath, 'utf8');

const ssl = { rejectUnauthorized: false };
let config = { connectionString: raw, ssl };
const pgUrlMatch = raw.match(/^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:/?#]+)(?::(\d+))?\/([^?#]+)/i);
if (pgUrlMatch) {
  const [, user, password, host, port = '5432', database] = pgUrlMatch;
  config = {
    user: decodeURIComponent(user),
    password: decodeURIComponent(password),
    host,
    port: Number(port),
    database: decodeURIComponent(database),
    ssl,
  };
}

const client = new pg.Client(config);
await client.connect();
await client.query(sql);
await client.end();
console.log('OK: anexo_numero_franquia_path + RPC ensure_rede_anexo_numero_franquia_column');
