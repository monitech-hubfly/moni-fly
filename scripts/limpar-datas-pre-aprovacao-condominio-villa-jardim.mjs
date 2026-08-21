/**
 * FK0002 Villa Jardim — limpa datas das fases anteriores a "Aprovação no Condomínio"
 * na Calculadora de Fases (card Operações + vínculos do sync group).
 *
 * Mecanismo (produto):
 * - `processo_step_one.calculadora_ancora_fase_slug` + `calculadora_ancora_data_fim`
 *   → `aplicarAncoraCalculadoraLinhas` zera datas das fases anteriores e marca-as concluídas.
 * - Remove overrides manuais em `kanban_calculadora_fase_datas` das fases anteriores
 *   (no sync group), sem tocar em "Aprovação no Condomínio" nem fases posteriores.
 *
 * Uso:
 *   node --env-file=.env.local scripts/limpar-datas-pre-aprovacao-condominio-villa-jardim.mjs
 *   node --env-file=.env.local scripts/limpar-datas-pre-aprovacao-condominio-villa-jardim.mjs --prod --confirm-prod
 *
 * Padrão: só DEV. PROD exige `--prod --confirm-prod`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { parsePostgresUrl } from './pg-dev-client.mjs';

const CARD_ID = 'eb288523-43d7-410b-be0c-0e0e4f56eff2';
const ANCORA_SLUG = 'aprovacao_condominio';
/** Fallback se não houver override manual da fase âncora. */
const ANCORA_FIM_FALLBACK = '2025-09-02';

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
  } catch (_) {
    /* .env.local opcional se --env-file já injetou */
  }
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

/** Expande sync group: origem_card_id (pai/filhos) + kanban_card_vinculos. */
async function listarSyncGroupIds(client, startId) {
  const ids = new Set([startId]);
  for (let round = 0; round < 16; round++) {
    const before = ids.size;
    const list = [...ids];

    const cadeia = await client.query(
      `SELECT id, origem_card_id
       FROM kanban_cards
       WHERE id = ANY($1::uuid[]) OR origem_card_id = ANY($1::uuid[])`,
      [list],
    );
    for (const row of cadeia.rows) {
      ids.add(row.id);
      if (row.origem_card_id) ids.add(row.origem_card_id);
    }

    const vins = await client.query(
      `SELECT card_origem_id, card_destino_id
       FROM kanban_card_vinculos
       WHERE card_origem_id = ANY($1::uuid[]) OR card_destino_id = ANY($1::uuid[])`,
      [list],
    );
    for (const row of vins.rows) {
      if (row.card_origem_id) ids.add(row.card_origem_id);
      if (row.card_destino_id) ids.add(row.card_destino_id);
    }

    if (ids.size === before) break;
  }

  const real = await client.query(
    `SELECT id FROM kanban_cards WHERE id = ANY($1::uuid[])`,
    [[...ids]],
  );
  return real.rows.map((r) => r.id);
}

async function main() {
  const wantProd = process.argv.includes('--prod');
  const confirmProd = process.argv.includes('--confirm-prod');
  const dryRun = process.argv.includes('--dry-run');

  if (wantProd && !dryRun && !confirmProd) {
    console.error(
      'PROD bloqueado: passe --prod --confirm-prod para alterar o banco de produção (ou --prod --dry-run para inspecionar).',
    );
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
  if (!wantProd && !String(cfg.host).includes('bgaadvfucnrkpimaszjv')) {
    console.error(`Abortado: DEV_DB_URL não aponta para DEV (${cfg.host}).`);
    process.exit(1);
  }
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

  console.log(`=== ${label} host=${cfg.host} dryRun=${dryRun} ===\n`);

  const cardRes = await client.query(
    `SELECT c.id, c.titulo, c.kanban_id, c.fase_id, c.processo_step_one_id, c.projeto_id,
            f.slug AS fase_slug, f.nome AS fase_nome, k.nome AS kanban_nome
     FROM kanban_cards c
     LEFT JOIN kanban_fases f ON f.id = c.fase_id
     LEFT JOIN kanbans k ON k.id = c.kanban_id
     WHERE c.id = $1`,
    [CARD_ID],
  );

  if (!cardRes.rows.length) {
    console.log(`Card ${CARD_ID} não encontrado em ${label}.`);
    console.log('Nenhuma alteração feita.');
    await client.end();
    process.exit(0);
  }

  const card = cardRes.rows[0];
  console.log('Card alvo:');
  console.log(
    `  ${card.id} | ${card.kanban_nome} | ${card.fase_slug} | ${card.titulo}`,
  );

  const syncIds = await listarSyncGroupIds(client, CARD_ID);
  const syncRows = await client.query(
    `SELECT c.id, c.titulo, k.nome AS kanban_nome, f.slug AS fase_slug, c.processo_step_one_id
     FROM kanban_cards c
     LEFT JOIN kanbans k ON k.id = c.kanban_id
     LEFT JOIN kanban_fases f ON f.id = c.fase_id
     WHERE c.id = ANY($1::uuid[])
     ORDER BY k.nome, c.titulo`,
    [syncIds],
  );
  console.log(`\nSync group (${syncRows.rows.length}):`);
  for (const r of syncRows.rows) {
    console.log(
      `  ${r.id} | ${r.kanban_nome} | ${r.fase_slug} | proc=${r.processo_step_one_id ?? '—'}`,
    );
  }

  const processoId =
    String(card.processo_step_one_id ?? '').trim() ||
    String(card.projeto_id ?? '').trim() ||
    null;

  if (!processoId) {
    console.error('Card sem processo_step_one_id/projeto_id — não é possível gravar âncora.');
    await client.end();
    process.exit(1);
  }

  const procCheck = await client.query(
    `SELECT id, calculadora_ancora_fase_slug, calculadora_ancora_data_fim
     FROM processo_step_one WHERE id = $1`,
    [processoId],
  );
  if (!procCheck.rows.length) {
    console.error(`processo_step_one ${processoId} não encontrado.`);
    await client.end();
    process.exit(1);
  }

  const ancoraAtual = procCheck.rows[0];
  console.log('\nÂncora atual:', {
    slug: ancoraAtual.calculadora_ancora_fase_slug,
    fim: ymd(ancoraAtual.calculadora_ancora_data_fim),
  });

  // Fase âncora + fases anteriores (Operações e eventuais slugs espelhados na esteira)
  const faseAncora = await client.query(
    `SELECT id, ordem, slug, nome, kanban_id
     FROM kanban_fases
     WHERE slug = $1
     ORDER BY (kanban_id = $2) DESC, ordem
     LIMIT 1`,
    [ANCORA_SLUG, card.kanban_id],
  );
  if (!faseAncora.rows.length) {
    console.error(`Fase slug=${ANCORA_SLUG} não encontrada.`);
    await client.end();
    process.exit(1);
  }
  const ancoraFase = faseAncora.rows[0];
  console.log(
    `\nFase âncora: ${ancoraFase.nome} (${ancoraFase.slug}) ordem=${ancoraFase.ordem} id=${ancoraFase.id}`,
  );

  // Data fim da âncora: preferir override manual existente no sync group
  const fimOverride = await client.query(
    `SELECT data_fim, card_id, editado_em
     FROM kanban_calculadora_fase_datas
     WHERE card_id = ANY($1::uuid[]) AND fase_id = $2 AND data_fim IS NOT NULL
     ORDER BY editado_em DESC NULLS LAST
     LIMIT 1`,
    [syncIds, ancoraFase.id],
  );
  const ancoraFim =
    ymd(fimOverride.rows[0]?.data_fim) || ANCORA_FIM_FALLBACK;
  console.log(`Data fim âncora: ${ancoraFim}`);

  // Fases anteriores (mesmo kanban_id da âncora Operações + slugs conhecidos pré-aprovação)
  const fasesAnteriores = await client.query(
    `SELECT id, slug, nome, ordem, kanban_id
     FROM kanban_fases
     WHERE (
       kanban_id = $1 AND ordem < $2
     ) OR slug IN ('planialtimetrico', 'sondagem', 'projeto_legal')
     ORDER BY ordem, slug`,
    [ancoraFase.kanban_id, ancoraFase.ordem],
  );
  const faseIdsAnteriores = [...new Set(fasesAnteriores.rows.map((r) => r.id))];
  console.log(`\nFases anteriores (${faseIdsAnteriores.length}):`);
  for (const f of fasesAnteriores.rows) {
    console.log(`  ${String(f.ordem).padStart(2)} ${f.slug.padEnd(28)} ${f.nome}`);
  }

  const datasAntes = await client.query(
    `SELECT d.card_id, f.slug, d.data_inicio, d.data_fim
     FROM kanban_calculadora_fase_datas d
     JOIN kanban_fases f ON f.id = d.fase_id
     WHERE d.card_id = ANY($1::uuid[]) AND d.fase_id = ANY($2::uuid[])
     ORDER BY f.ordem`,
    [syncIds, faseIdsAnteriores],
  );
  console.log(`\nOverrides a limpar nas fases anteriores: ${datasAntes.rows.length}`);
  for (const r of datasAntes.rows) {
    console.log(
      `  card=${r.card_id.slice(0, 8)}… ${r.slug} ${ymd(r.data_inicio) ?? '—'} → ${ymd(r.data_fim) ?? '—'}`,
    );
  }

  const precisaAncora =
    String(ancoraAtual.calculadora_ancora_fase_slug ?? '').trim() !== ANCORA_SLUG ||
    ymd(ancoraAtual.calculadora_ancora_data_fim) !== ancoraFim;

  if (dryRun) {
    console.log('\n[dry-run] Nenhuma escrita. Resumo do que seria feito:');
    if (precisaAncora) {
      console.log(
        `  UPDATE processo_step_one SET ancora=${ANCORA_SLUG} / ${ancoraFim} WHERE id=${processoId}`,
      );
    } else {
      console.log('  Âncora já correta — sem update.');
    }
    console.log(
      `  DELETE kanban_calculadora_fase_datas fases anteriores em ${syncIds.length} card(s)`,
    );
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    if (precisaAncora) {
      await client.query(
        `UPDATE processo_step_one
         SET calculadora_ancora_fase_slug = $1,
             calculadora_ancora_data_fim = $2::date,
             updated_at = NOW()
         WHERE id = $3`,
        [ANCORA_SLUG, ancoraFim, processoId],
      );
      console.log(
        `\nÂncora gravada: ${ANCORA_SLUG} / ${ancoraFim} (processo ${processoId})`,
      );
    } else {
      console.log('\nÂncora já estava correta — sem update.');
    }

    if (faseIdsAnteriores.length > 0) {
      const del = await client.query(
        `DELETE FROM kanban_calculadora_fase_datas
         WHERE card_id = ANY($1::uuid[])
           AND fase_id = ANY($2::uuid[])
         RETURNING card_id, fase_id`,
        [syncIds, faseIdsAnteriores],
      );
      console.log(`Overrides removidos (fases anteriores): ${del.rowCount}`);
    }

    // Garante que vínculo Cash Me (se no grupo) também aponte ao mesmo processo (leitura âncora)
    const semProc = syncRows.rows.filter(
      (r) => r.id !== card.id && !String(r.processo_step_one_id ?? '').trim(),
    );
    for (const peer of semProc) {
      await client.query(
        `UPDATE kanban_cards
         SET processo_step_one_id = $1
         WHERE id = $2 AND processo_step_one_id IS NULL`,
        [processoId, peer.id],
      );
      console.log(`processo_step_one_id propagado para ${peer.id}`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  // Validação
  const ancoraPos = await client.query(
    `SELECT calculadora_ancora_fase_slug, calculadora_ancora_data_fim
     FROM processo_step_one WHERE id = $1`,
    [processoId],
  );
  const datasPos = await client.query(
    `SELECT f.slug, d.data_inicio, d.data_fim, d.card_id
     FROM kanban_calculadora_fase_datas d
     JOIN kanban_fases f ON f.id = d.fase_id
     WHERE d.card_id = ANY($1::uuid[])
     ORDER BY f.ordem, d.card_id`,
    [syncIds],
  );

  console.log('\n--- Validação ---');
  console.log('Âncora:', {
    slug: ancoraPos.rows[0]?.calculadora_ancora_fase_slug,
    fim: ymd(ancoraPos.rows[0]?.calculadora_ancora_data_fim),
  });
  console.log('Overrides restantes no sync group:');
  for (const r of datasPos.rows) {
    console.log(
      `  card=${r.card_id.slice(0, 8)}… ${String(r.slug).padEnd(28)} ${ymd(r.data_inicio) ?? '—'} → ${ymd(r.data_fim) ?? '—'}`,
    );
  }

  const aindaAnteriores = datasPos.rows.filter((r) =>
    ['planialtimetrico', 'sondagem', 'projeto_legal'].includes(String(r.slug)),
  );
  if (aindaAnteriores.length) {
    console.warn('AVISO: ainda há overrides em fases anteriores:', aindaAnteriores);
  } else {
    console.log('OK: nenhuma data manual em fases anteriores à âncora.');
  }

  console.log('\nConcluído.');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
