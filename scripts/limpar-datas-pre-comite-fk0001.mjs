/**
 * FK0001 Parque Ytu Xapada — zera datas da Calculadora de Fases ANTES de Comitê (step_5).
 *
 * Card alvo: 3c1c341e-48f7-4ad9-a836-d0740633584a (Funil Operações)
 *
 * Mecanismo:
 * 1. Grava âncora em processo_step_one (calculadora_ancora_fase_slug = step_5)
 * 2. UPSERT overrides NULL em kanban_calculadora_fase_datas para fases anteriores à âncora
 *    na esteira global (Step One + Portfólio), em todos os cards do sync group.
 *
 * Uso:
 *   node --env-file=.env.local scripts/limpar-datas-pre-comite-fk0001.mjs --prod --dry-run
 *   node --env-file=.env.local scripts/limpar-datas-pre-comite-fk0001.mjs --prod --confirm-prod
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { parsePostgresUrl } from './pg-dev-client.mjs';

const CARD_ID = '3c1c341e-48f7-4ad9-a836-d0740633584a';
const ANCORA_SLUG = 'step_5';
const STEP_ONE_KANBAN = '4d89f111-cef6-48aa-93ff-72d6406f0a32';
const PORTFOLIO_KANBAN = 'c57120a0-991c-422b-8def-4d16a9411d45';

/** Slugs omitidos da calculadora Step One (onboarding / candidato / removidas). */
const STEPONE_EXCLUDED_SLUGS = [
  'onboarding',
  'stepone_onboarding',
  'dados_candidato',
  'stepone_dados_candidato',
  'lista_condominios',
  'stepone_lista_cond',
  'pre_batalha',
  'stepone_pre_batalha',
];

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

  const client = new pg.Client({
    ...cfg,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 25000,
  });
  await client.connect();
  console.log(`=== ${label} host=${cfg.host} dryRun=${dryRun} card=${CARD_ID} ===\n`);

  const cardRes = await client.query(
    `SELECT c.id, c.titulo, c.kanban_id, c.processo_step_one_id, c.projeto_id,
            c.comite_aprovado_em, k.nome AS kanban_nome, f.slug AS fase_slug
     FROM kanban_cards c
     LEFT JOIN kanbans k ON k.id = c.kanban_id
     LEFT JOIN kanban_fases f ON f.id = c.fase_id
     WHERE c.id = $1`,
    [CARD_ID],
  );

  if (!cardRes.rows.length) {
    console.log(`Card ${CARD_ID} não encontrado.`);
    await client.end();
    process.exit(0);
  }

  const card = cardRes.rows[0];
  console.log('Card:', card.titulo, '|', card.kanban_nome, '|', card.fase_slug);

  const processoId =
    String(card.processo_step_one_id ?? '').trim() ||
    String(card.projeto_id ?? '').trim() ||
    null;
  if (!processoId) {
    console.error('Card sem processo_step_one_id — abortado.');
    await client.end();
    process.exit(1);
  }

  const syncIds = await listarSyncGroupIds(client, CARD_ID);
  console.log(`Sync group (${syncIds.length}):`, syncIds.join(', '));

  const ancoraFase = (
    await client.query(
      `SELECT id, slug, nome, ordem, kanban_id FROM kanban_fases
       WHERE kanban_id = $1 AND slug = $2 LIMIT 1`,
      [PORTFOLIO_KANBAN, ANCORA_SLUG],
    )
  ).rows[0];

  if (!ancoraFase) {
    console.error(`Fase ${ANCORA_SLUG} não encontrada no Portfólio.`);
    await client.end();
    process.exit(1);
  }
  console.log(`\nÂncora: ${ancoraFase.nome} (${ancoraFase.slug}) ordem=${ancoraFase.ordem}`);

  const ancoraFim =
    ymd(card.comite_aprovado_em) ||
    (
      await client.query(
        `SELECT comite_aprovado_em FROM kanban_cards
         WHERE id = ANY($1::uuid[]) AND comite_aprovado_em IS NOT NULL
         ORDER BY comite_aprovado_em DESC LIMIT 1`,
        [syncIds],
      )
    ).rows[0]?.comite_aprovado_em;

  const ancoraFimYmd = ymd(ancoraFim);
  if (!ancoraFimYmd) {
    console.error('Não foi possível resolver data fim do Comitê (comite_aprovado_em).');
    await client.end();
    process.exit(1);
  }
  console.log(`Data fim Comitê: ${ancoraFimYmd}`);

  const fasesAnteriores = await client.query(
    `SELECT id, slug, nome, ordem, kanban_id FROM kanban_fases
     WHERE (
       kanban_id = $1
       AND ordem < $2
       AND slug <> ALL($3::text[])
     ) OR (
       kanban_id = $4
       AND ordem < $5
     )
     ORDER BY kanban_id, ordem, slug`,
    [
      STEP_ONE_KANBAN,
      9999,
      STEPONE_EXCLUDED_SLUGS,
      PORTFOLIO_KANBAN,
      ancoraFase.ordem,
    ],
  );

  const faseIdsAnteriores = [...new Set(fasesAnteriores.rows.map((r) => r.id))];
  console.log(`\nFases anteriores a Comitê (${faseIdsAnteriores.length}):`);
  for (const f of fasesAnteriores.rows) {
    const seg = f.kanban_id === STEP_ONE_KANBAN ? 'StepOne' : 'Portfolio';
    console.log(`  ${seg} ${String(f.ordem).padStart(2)} ${f.slug} — ${f.nome}`);
  }

  const overridesAntes = await client.query(
    `SELECT d.card_id, f.slug, d.data_inicio, d.data_fim
     FROM kanban_calculadora_fase_datas d
     JOIN kanban_fases f ON f.id = d.fase_id
     WHERE d.card_id = ANY($1::uuid[]) AND d.fase_id = ANY($2::uuid[])
     ORDER BY f.ordem, f.slug, d.card_id`,
    [syncIds, faseIdsAnteriores],
  );
  console.log(`\nOverrides existentes a zerar: ${overridesAntes.rows.length}`);
  for (const r of overridesAntes.rows) {
    console.log(
      `  ${String(r.card_id).slice(0, 8)}… ${r.slug} ${ymd(r.data_inicio) ?? 'null'} → ${ymd(r.data_fim) ?? 'null'}`,
    );
  }

  const procAntes = (
    await client.query(
      `SELECT calculadora_ancora_fase_slug, calculadora_ancora_data_fim
       FROM processo_step_one WHERE id = $1`,
      [processoId],
    )
  ).rows[0];
  console.log('\nÂncora atual processo:', procAntes);

  if (dryRun) {
    console.log('\n[dry-run] Seria aplicado:');
    console.log(
      `  UPDATE processo_step_one SET ancora=${ANCORA_SLUG} / ${ancoraFimYmd} WHERE id=${processoId}`,
    );
    console.log(
      `  UPSERT NULL em ${faseIdsAnteriores.length} fase(s) × ${syncIds.length} card(s) = ${faseIdsAnteriores.length * syncIds.length} linhas`,
    );
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
      [ANCORA_SLUG, ancoraFimYmd, processoId],
    );
    console.log(`\nÂncora gravada no processo ${processoId}`);

    let upserts = 0;
    for (const cardId of syncIds) {
      for (const faseId of faseIdsAnteriores) {
        await client.query(
          `INSERT INTO kanban_calculadora_fase_datas (card_id, fase_id, data_inicio, data_fim, editado_em)
           VALUES ($1, $2, NULL, NULL, NOW())
           ON CONFLICT (card_id, fase_id)
           DO UPDATE SET data_inicio = NULL, data_fim = NULL, editado_em = NOW()`,
          [cardId, faseId],
        );
        upserts += 1;
      }
    }
    console.log(`Overrides NULL gravados: ${upserts}`);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  const procDepois = (
    await client.query(
      `SELECT calculadora_ancora_fase_slug, calculadora_ancora_data_fim
       FROM processo_step_one WHERE id = $1`,
      [processoId],
    )
  ).rows[0];
  const overridesDepois = await client.query(
    `SELECT d.card_id, f.slug, d.data_inicio, d.data_fim
     FROM kanban_calculadora_fase_datas d
     JOIN kanban_fases f ON f.id = d.fase_id
     WHERE d.card_id = ANY($1::uuid[]) AND d.fase_id = ANY($2::uuid[])
     ORDER BY f.ordem, f.slug`,
    [syncIds, faseIdsAnteriores],
  );

  console.log('\n--- Validação ---');
  console.log('Âncora:', procDepois);
  let ok = 0;
  let fail = 0;
  for (const r of overridesDepois.rows) {
    const valid = r.data_inicio == null && r.data_fim == null;
    if (valid) ok += 1;
    else fail += 1;
    console.log(
      `  ${valid ? 'OK' : 'FAIL'} ${String(r.card_id).slice(0, 8)}… ${r.slug}`,
    );
  }
  console.log(`Overrides anteriores a Comitê: ${ok} OK, ${fail} FAIL`);
  console.log(`Esperado ${faseIdsAnteriores.length * syncIds.length} linhas, obtido ${overridesDepois.rows.length}`);

  const posComite = await client.query(
    `SELECT f.slug, d.data_inicio, d.data_fim
     FROM kanban_calculadora_fase_datas d
     JOIN kanban_fases f ON f.id = d.fase_id
     WHERE d.card_id = $1 AND f.ordem >= $2 AND f.kanban_id = $3`,
    [CARD_ID, ancoraFase.ordem, PORTFOLIO_KANBAN],
  );
  console.log('\nOverrides Comitê e posteriores (Portfólio) no card alvo — não alterados:');
  for (const r of posComite.rows) {
    console.log(`  ${r.slug} ${ymd(r.data_inicio) ?? 'null'} → ${ymd(r.data_fim) ?? 'null'}`);
  }
  if (posComite.rows.length === 0) {
    console.log('  (nenhum — OK)');
  }

  console.log('\nConcluído.');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
