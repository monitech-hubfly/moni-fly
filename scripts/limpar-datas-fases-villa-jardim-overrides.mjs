/**
 * Villa Jardim — grava overrides manuais (início/fim null) nas fases pedidas,
 * para a Calculadora exibir «—» + Concluída (mesmo mecanismo de «Editar datas»).
 *
 * Fases:
 *   - passagem_wayser (Passagem para Wayser)
 *   - planialtimetrico
 *   - projeto_legal
 *   - revisao_bca (Revisão BCA + Instrumento Garantidor)
 *
 * Uso:
 *   node --env-file=.env.local scripts/limpar-datas-fases-villa-jardim-overrides.mjs --prod --dry-run
 *   node --env-file=.env.local scripts/limpar-datas-fases-villa-jardim-overrides.mjs --prod --confirm-prod
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { parsePostgresUrl } from './pg-dev-client.mjs';

const CARD_ID = 'eb288523-43d7-410b-be0c-0e0e4f56eff2';
const SLUGS = ['passagem_wayser', 'planialtimetrico', 'projeto_legal', 'revisao_bca'];

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (_) {}
}

loadEnvLocal();

function ymd(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const head = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

async function listarSyncGroupIds(client, startId) {
  const ids = new Set([startId]);
  for (let round = 0; round < 16; round++) {
    const before = ids.size;
    const list = [...ids];
    const cadeia = await client.query(
      `SELECT id, origem_card_id FROM kanban_cards
       WHERE id = ANY($1::uuid[]) OR origem_card_id = ANY($1::uuid[])`,
      [list],
    );
    for (const row of cadeia.rows) {
      ids.add(row.id);
      if (row.origem_card_id) ids.add(row.origem_card_id);
    }
    const vins = await client.query(
      `SELECT card_origem_id, card_destino_id FROM kanban_card_vinculos
       WHERE card_origem_id = ANY($1::uuid[]) OR card_destino_id = ANY($1::uuid[])`,
      [list],
    );
    for (const row of vins.rows) {
      if (row.card_origem_id) ids.add(row.card_origem_id);
      if (row.card_destino_id) ids.add(row.card_destino_id);
    }
    if (ids.size === before) break;
  }
  const real = await client.query(`SELECT id FROM kanban_cards WHERE id = ANY($1::uuid[])`, [
    [...ids],
  ]);
  return real.rows.map((r) => r.id);
}

async function main() {
  const wantProd = process.argv.includes('--prod');
  const confirmProd = process.argv.includes('--confirm-prod');
  const dryRun = process.argv.includes('--dry-run');

  if (wantProd && !dryRun && !confirmProd) {
    console.error('PROD bloqueado: passe --prod --confirm-prod (ou --prod --dry-run).');
    process.exit(1);
  }

  const envKey = wantProd ? 'PROD_DB_URL' : 'DEV_DB_URL';
  const label = wantProd ? 'PROD' : 'DEV';
  const raw = (process.env[envKey] || '').trim();
  if (!raw) {
    console.error(`Defina ${envKey}`);
    process.exit(1);
  }

  const cfg = parsePostgresUrl(raw);
  if (wantProd && !String(cfg.host).includes('aydryzoxqnwnbybvgiug')) {
    console.error(`Abortado: host não é PROD (${cfg.host})`);
    process.exit(1);
  }

  const client = new pg.Client({
    ...cfg,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 25000,
  });
  await client.connect();
  console.log(`=== ${label} host=${cfg.host} dryRun=${dryRun} ===\n`);

  const cardRes = await client.query(
    `SELECT c.id, c.titulo, c.kanban_id, c.processo_step_one_id, k.nome AS kanban_nome, f.slug AS fase_slug
     FROM kanban_cards c
     LEFT JOIN kanbans k ON k.id = c.kanban_id
     LEFT JOIN kanban_fases f ON f.id = c.fase_id
     WHERE c.id = $1`,
    [CARD_ID],
  );
  if (!cardRes.rows.length) {
    console.log('Card não encontrado.');
    await client.end();
    process.exit(0);
  }
  const card = cardRes.rows[0];
  console.log('Card:', card.id, card.kanban_nome, card.fase_slug, card.titulo);

  const syncIds = await listarSyncGroupIds(client, CARD_ID);
  console.log('Sync group:', syncIds);

  const fases = await client.query(
    `SELECT id, slug, nome, kanban_id, ordem FROM kanban_fases
     WHERE slug = ANY($1::text[])
     ORDER BY slug, (kanban_id = $2) DESC, ordem`,
    [SLUGS, card.kanban_id],
  );

  /** Uma fase por slug (preferindo kanban do card). */
  const porSlug = new Map();
  for (const f of fases.rows) {
    if (!porSlug.has(f.slug)) porSlug.set(f.slug, f);
  }
  console.log('\nFases alvo:');
  for (const slug of SLUGS) {
    const f = porSlug.get(slug);
    if (!f) console.log(`  MISSING ${slug}`);
    else console.log(`  ${slug} → ${f.id} | ${f.nome}`);
  }

  const faseIds = [...porSlug.values()].map((f) => f.id);
  const antes = await client.query(
    `SELECT d.card_id, f.slug, d.data_inicio, d.data_fim
     FROM kanban_calculadora_fase_datas d
     JOIN kanban_fases f ON f.id = d.fase_id
     WHERE d.card_id = ANY($1::uuid[]) AND d.fase_id = ANY($2::uuid[])
     ORDER BY f.slug, d.card_id`,
    [syncIds, faseIds],
  );
  console.log(`\nOverrides atuais: ${antes.rows.length}`);
  for (const r of antes.rows) {
    console.log(
      `  ${r.card_id.slice(0, 8)} ${r.slug} ${ymd(r.data_inicio) ?? 'null'} → ${ymd(r.data_fim) ?? 'null'}`,
    );
  }

  if (dryRun) {
    console.log(
      `\n[dry-run] UPSERT data_inicio=NULL data_fim=NULL em ${faseIds.length} fase(s) × ${syncIds.length} card(s)`,
    );
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    let n = 0;
    for (const cardId of syncIds) {
      for (const fase of porSlug.values()) {
        await client.query(
          `INSERT INTO kanban_calculadora_fase_datas (card_id, fase_id, data_inicio, data_fim, editado_em)
           VALUES ($1, $2, NULL, NULL, NOW())
           ON CONFLICT (card_id, fase_id)
           DO UPDATE SET data_inicio = NULL, data_fim = NULL, editado_em = NOW()`,
          [cardId, fase.id],
        );
        n += 1;
      }
    }
    await client.query('COMMIT');
    console.log(`\nUpserts: ${n}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  const depois = await client.query(
    `SELECT d.card_id, f.slug, d.data_inicio, d.data_fim
     FROM kanban_calculadora_fase_datas d
     JOIN kanban_fases f ON f.id = d.fase_id
     WHERE d.card_id = ANY($1::uuid[]) AND f.slug = ANY($2::text[])
     ORDER BY f.slug, d.card_id`,
    [syncIds, SLUGS],
  );
  console.log('\n--- Validação ---');
  for (const r of depois.rows) {
    const ok = r.data_inicio == null && r.data_fim == null;
    console.log(
      `  ${ok ? 'OK' : 'FAIL'} ${r.card_id.slice(0, 8)} ${r.slug} ${ymd(r.data_inicio) ?? 'null'} → ${ymd(r.data_fim) ?? 'null'}`,
    );
  }
  console.log('Concluído.');
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
