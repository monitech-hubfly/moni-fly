/**
 * Villa Jardim — garante âncora + remove overrides manuais das fases anteriores
 * a "Aprovação no Condomínio" (Planialtimétrico, Projeto Legal, Sondagem).
 *
 * A UI oculta datas via overlay `aplicarOverlayAncoraOcultarFasesAnteriores`
 * (não apaga histórico/visitas). Este script limpa overrides residuais no sync group.
 *
 * Uso:
 *   node --env-file=.env.local scripts/ocultar-datas-pre-condominio-villa-jardim.mjs --prod --dry-run
 *   node --env-file=.env.local scripts/ocultar-datas-pre-condominio-villa-jardim.mjs --prod --confirm-prod
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { parsePostgresUrl } from './pg-dev-client.mjs';

const CARD_ID = 'eb288523-43d7-410b-be0c-0e0e4f56eff2';
const ANCORA_SLUG = 'aprovacao_condominio';
const ANCORA_FIM_FALLBACK = '2025-09-02';
const SLUGS_ANTERIORES = ['planialtimetrico', 'sondagem', 'projeto_legal'];

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
    console.error(`Defina ${envKey} em .env.local`);
    process.exit(1);
  }

  const cfg = parsePostgresUrl(raw);
  if (wantProd && !String(cfg.host).includes('aydryzoxqnwnbybvgiug')) {
    console.error(`Abortado: PROD_DB_URL não aponta para PROD (${cfg.host}).`);
    process.exit(1);
  }
  if (!wantProd && !String(cfg.host).includes('bgaadvfucnrkpimaszjv')) {
    console.error(`Abortado: DEV_DB_URL não aponta para DEV (${cfg.host}).`);
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
    `SELECT c.id, c.titulo, c.kanban_id, c.processo_step_one_id, c.projeto_id,
            k.nome AS kanban_nome, f.slug AS fase_slug
     FROM kanban_cards c
     LEFT JOIN kanbans k ON k.id = c.kanban_id
     LEFT JOIN kanban_fases f ON f.id = c.fase_id
     WHERE c.id = $1`,
    [CARD_ID],
  );
  if (!cardRes.rows.length) {
    console.log(`Card ${CARD_ID} não encontrado em ${label}.`);
    await client.end();
    process.exit(0);
  }
  const card = cardRes.rows[0];
  console.log('Card:', card.id, '|', card.kanban_nome, '|', card.fase_slug, '|', card.titulo);

  const syncIds = await listarSyncGroupIds(client, CARD_ID);
  console.log('Sync group:', syncIds.length, syncIds);

  const processoId =
    String(card.processo_step_one_id ?? '').trim() ||
    String(card.projeto_id ?? '').trim() ||
    null;
  if (!processoId) {
    console.error('Sem processo_step_one_id.');
    await client.end();
    process.exit(1);
  }

  const proc = await client.query(
    `SELECT id, calculadora_ancora_fase_slug, calculadora_ancora_data_fim
     FROM processo_step_one WHERE id = $1`,
    [processoId],
  );
  console.log('Âncora atual:', {
    slug: proc.rows[0]?.calculadora_ancora_fase_slug,
    fim: ymd(proc.rows[0]?.calculadora_ancora_data_fim),
  });

  const faseAncora = await client.query(
    `SELECT id, ordem, slug, nome, kanban_id FROM kanban_fases
     WHERE slug = $1 ORDER BY (kanban_id = $2) DESC, ordem LIMIT 1`,
    [ANCORA_SLUG, card.kanban_id],
  );
  if (!faseAncora.rows.length) {
    console.error(`Fase ${ANCORA_SLUG} não encontrada`);
    await client.end();
    process.exit(1);
  }
  const ancoraFase = faseAncora.rows[0];

  const fimOverride = await client.query(
    `SELECT data_fim FROM kanban_calculadora_fase_datas
     WHERE card_id = ANY($1::uuid[]) AND fase_id = $2 AND data_fim IS NOT NULL
     ORDER BY editado_em DESC NULLS LAST LIMIT 1`,
    [syncIds, ancoraFase.id],
  );
  const ancoraFim = ymd(fimOverride.rows[0]?.data_fim) || ANCORA_FIM_FALLBACK;

  const fasesAnteriores = await client.query(
    `SELECT id, slug, nome, ordem FROM kanban_fases
     WHERE (kanban_id = $1 AND ordem < $2) OR slug = ANY($3::text[])
     ORDER BY ordem, slug`,
    [ancoraFase.kanban_id, ancoraFase.ordem, SLUGS_ANTERIORES],
  );
  const faseIdsAnteriores = [...new Set(fasesAnteriores.rows.map((r) => r.id))];
  console.log('\nFases anteriores alvo:');
  for (const f of fasesAnteriores.rows) {
    console.log(`  ${String(f.ordem).padStart(2)} ${f.slug} ${f.nome}`);
  }

  const overrides = await client.query(
    `SELECT d.card_id, f.slug, d.data_inicio, d.data_fim
     FROM kanban_calculadora_fase_datas d
     JOIN kanban_fases f ON f.id = d.fase_id
     WHERE d.card_id = ANY($1::uuid[]) AND d.fase_id = ANY($2::uuid[])
     ORDER BY f.ordem, d.card_id`,
    [syncIds, faseIdsAnteriores],
  );
  console.log(`\nOverrides a remover: ${overrides.rows.length}`);
  for (const r of overrides.rows) {
    console.log(
      `  ${r.card_id.slice(0, 8)} ${r.slug} ${ymd(r.data_inicio) ?? '—'} → ${ymd(r.data_fim) ?? '—'}`,
    );
  }

  // Cronologia (visitas) — só leitura; não apagamos histórico
  const cronCols = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='kanban_card_cronologia'
     ORDER BY ordinal_position`,
  );
  console.log(
    '\nCronologia cols:',
    cronCols.rows.map((r) => r.column_name).join(', ') || '(sem tabela)',
  );

  if (dryRun) {
    console.log('\n[dry-run] Escritas previstas:');
    console.log(`  UPDATE processo_step_one ancora=${ANCORA_SLUG}/${ancoraFim}`);
    console.log(`  DELETE overrides fases anteriores em ${syncIds.length} card(s)`);
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    await client.query(
      `UPDATE processo_step_one
       SET calculadora_ancora_fase_slug = $1,
           calculadora_ancora_data_fim = $2::date,
           updated_at = NOW()
       WHERE id = $3`,
      [ANCORA_SLUG, ancoraFim, processoId],
    );
    console.log(`\nÂncora gravada: ${ANCORA_SLUG} / ${ancoraFim}`);

    if (faseIdsAnteriores.length > 0) {
      const del = await client.query(
        `DELETE FROM kanban_calculadora_fase_datas
         WHERE card_id = ANY($1::uuid[]) AND fase_id = ANY($2::uuid[])
         RETURNING card_id, fase_id`,
        [syncIds, faseIdsAnteriores],
      );
      console.log(`Overrides removidos: ${del.rowCount}`);
    }

    // Propaga processo aos vínculos sem processo
    await client.query(
      `UPDATE kanban_cards
       SET processo_step_one_id = $1
       WHERE id = ANY($2::uuid[]) AND processo_step_one_id IS NULL`,
      [processoId, syncIds],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  const pos = await client.query(
    `SELECT calculadora_ancora_fase_slug, calculadora_ancora_data_fim
     FROM processo_step_one WHERE id = $1`,
    [processoId],
  );
  const ovPos = await client.query(
    `SELECT f.slug, d.data_inicio, d.data_fim, d.card_id
     FROM kanban_calculadora_fase_datas d
     JOIN kanban_fases f ON f.id = d.fase_id
     WHERE d.card_id = ANY($1::uuid[]) AND f.slug = ANY($2::text[])`,
    [syncIds, SLUGS_ANTERIORES],
  );

  console.log('\n--- Validação ---');
  console.log('Âncora:', {
    slug: pos.rows[0]?.calculadora_ancora_fase_slug,
    fim: ymd(pos.rows[0]?.calculadora_ancora_data_fim),
  });
  console.log(
    'Overrides restantes em planialtimetrico/sondagem/projeto_legal:',
    ovPos.rows.length,
  );
  for (const r of ovPos.rows) {
    console.log(`  AINDA: ${r.slug} ${ymd(r.data_inicio)} → ${ymd(r.data_fim)}`);
  }
  if (ovPos.rows.length === 0) {
    console.log('OK: sem overrides manuais nas fases anteriores.');
  }
  console.log(
    'Nota: datas de histórico/cronologia podem existir no banco; a UI as oculta via overlay da âncora.',
  );
  console.log('\nConcluído.');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
