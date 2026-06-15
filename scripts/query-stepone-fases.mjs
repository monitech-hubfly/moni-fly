import pg from 'pg';
import { parsePostgresUrl } from './pg-dev-client.mjs';

const envKey = process.argv[2] === '--prod' ? 'PROD_DB_URL' : 'DEV_DB_URL';
const forceSupabase = process.argv.includes('--supabase');
const url = forceSupabase ? '' : (process.env[envKey] || '').trim();
const useSupabase = !url || process.argv[2] !== '--prod';

if (useSupabase) {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_DEV_SERVICE_ROLE_KEY,
  );
  const { data: kb } = await sb.from('kanbans').select('id').eq('nome', 'Funil Step One').maybeSingle();
  const { data } = await sb
    .from('kanban_fases')
    .select('ordem, slug, nome, ativo')
    .eq('kanban_id', kb?.id ?? '4d89f111-cef6-48aa-93ff-72d6406f0a32')
    .order('ordem');
  console.log(`=== ${envKey || 'SUPABASE_DEV'} Funil Step One fases ===\n`);
  for (const f of data ?? []) {
    console.log(
      String(f.ordem).padStart(2),
      String(f.slug ?? '').padEnd(22),
      f.nome,
      f.ativo ? '' : '(inativo)',
    );
  }
  process.exit(0);
}

if (!url) {
  console.error(`${envKey} não definida`);
  process.exit(1);
}

const cfg = parsePostgresUrl(url);
const client = new pg.Client({ ...cfg, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
await client.connect();
const r = await client.query(`
  SELECT ordem, slug, nome, ativo FROM kanban_fases
  WHERE kanban_id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'
  ORDER BY ordem, slug`);
console.log(`=== ${envKey} Funil Step One fases ===\n`);
for (const f of r.rows) {
  console.log(
    String(f.ordem).padStart(2),
    String(f.slug ?? '').padEnd(22),
    f.nome,
    f.ativo ? '' : '(inativo)',
  );
}
await client.end();
