/**
 * Aplica 549 no DEV e insere lotes de exemplo.
 * Uso: node --env-file=.env.local scripts/aplicar-549-lotes-template.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDevPg, parsePostgresUrl } from './pg-dev-client.mjs';

const DEV_REF = 'bgaadvfucnrkpimaszjv';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const sqlPath = resolve(root, 'supabase/migrations/549_lotes_template_simulador.sql');

const raw = (process.env.DEV_DB_URL || '').trim();
if (!raw) {
  console.error('DEV_DB_URL não definida.');
  process.exit(1);
}

const cfg = parsePostgresUrl(raw);
if (!String(cfg.host).includes(DEV_REF)) {
  console.error(`Abortado: DEV_DB_URL não aponta para DEV (${cfg.host}).`);
  process.exit(1);
}

const client = await connectDevPg('DEV_DB_URL');
try {
  const sql = readFileSync(sqlPath, 'utf8');
  await client.query(sql);
  console.log('Migration 549 aplicada.');

  const tpl = await client.query(`
    SELECT id, nome, link_token
    FROM public.loteamento_simulador_templates
    WHERE link_token IS NOT NULL AND btrim(link_token) <> ''
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1
  `);
  if (!tpl.rows[0]) {
    console.log('Nenhum template com link_token no DEV — seed de lotes pulado.');
    process.exit(0);
  }

  const templateId = tpl.rows[0].id;
  const existing = await client.query(
    `SELECT count(*)::int AS n FROM public.lotes_template WHERE template_id = $1`,
    [templateId],
  );
  if (existing.rows[0].n > 0) {
    console.log(`Template ${templateId} já tem ${existing.rows[0].n} lote(s). Seed pulado.`);
  } else {
    await client.query(
      `
      INSERT INTO public.lotes_template (template_id, codigo, valor) VALUES
        ($1, 'LOT-001', 180000),
        ($1, 'LOT-002', 195000),
        ($1, 'LOT-003', 210000),
        ($1, 'LOT-004', 175000)
      ON CONFLICT (template_id, codigo) DO NOTHING
      `,
      [templateId],
    );
    console.log(`4 lotes de exemplo inseridos no template ${templateId}.`);
  }

  console.log('Template de teste:');
  console.log(`  id:    ${templateId}`);
  console.log(`  nome:  ${tpl.rows[0].nome ?? '(sem nome)'}`);
  console.log(`  token: ${tpl.rows[0].link_token}`);
  console.log(`  url:   /simulador/${tpl.rows[0].link_token}`);
} finally {
  await client.end();
}
