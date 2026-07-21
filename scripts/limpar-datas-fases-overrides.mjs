/**
 * Grava overrides manuais (início/fim null) nas fases indicadas,
 * para a Calculadora exibir «—» + Concluída (mesmo mecanismo de «Editar datas»).
 * Propaga ao sync group (vínculos Cash Me etc.).
 *
 * Uso:
 *   node --env-file=.env.local scripts/limpar-datas-fases-overrides.mjs \
 *     --card-id=<uuid> --slugs=revisao_bca --prod --dry-run
 *
 *   node --env-file=.env.local scripts/limpar-datas-fases-overrides.mjs \
 *     --card-id=<uuid> --antes-de-contrato --prod --dry-run
 *
 *   node --env-file=.env.local scripts/limpar-datas-fases-overrides.mjs \
 *     --card-id=<uuid> --slugs=revisao_bca --prod --confirm-prod
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { parsePostgresUrl } from './pg-dev-client.mjs';

const KANBAN_IDS = {
  STEP_ONE: '4d89f111-cef6-48aa-93ff-72d6406f0a32',
  PORTFOLIO: 'c57120a0-991c-422b-8def-4d16a9411d45',
  OPERACOES: 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636',
};

const CALCULADORA_ESTEIRA_FUNIS = [
  { kanbanId: KANBAN_IDS.STEP_ONE, label: 'Funil Step One' },
  { kanbanId: KANBAN_IDS.PORTFOLIO, label: 'Funil Portfólio' },
  { kanbanId: KANBAN_IDS.OPERACOES, label: 'Funil Pré Obra e Obra' },
];

const STEPONE_EXCLUDED = new Set([
  'onboarding',
  'dados_candidato',
  'stepone_onboarding',
  'stepone_dados_candidato',
]);
const STEPONE_REMOVED = new Set([
  'lista_condominios',
  'stepone_lista_cond',
  'pre_batalha',
  'stepone_pre_batalha',
]);
const PORTFOLIO_EXCLUDED = new Set(['captacao_moni_capital']);
const OPERACOES_REMOVED = new Set(['moni_care', 'operacoes_habite_se']);

const NEGOCIACAO_RE = /negociac[aã]o/i;

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

function argValue(name) {
  const eq = process.argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return null;
}

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

function faseIncluidaCalculadora(kanbanId, slug) {
  const s = String(slug ?? '').trim();
  if (kanbanId === KANBAN_IDS.STEP_ONE) {
    if (STEPONE_EXCLUDED.has(s) || STEPONE_REMOVED.has(s)) return false;
  }
  if (kanbanId === KANBAN_IDS.PORTFOLIO) {
    if (PORTFOLIO_EXCLUDED.has(s)) return false;
  }
  if (kanbanId === KANBAN_IDS.OPERACOES) {
    if (OPERACOES_REMOVED.has(s)) return false;
  }
  return true;
}

function isFaseNegociacao(slug, nome) {
  return NEGOCIACAO_RE.test(String(slug ?? '')) || NEGOCIACAO_RE.test(String(nome ?? ''));
}

function isFaseContrato(slug, nome, contratoSlug) {
  const s = String(slug ?? '').trim();
  const n = String(nome ?? '').trim();
  if (contratoSlug && s === contratoSlug) return true;
  return s === 'step_7' || /^contrato$/i.test(n);
}

async function montarMetaCalculadoraEsteira(client) {
  const kanbanIds = CALCULADORA_ESTEIRA_FUNIS.map((f) => f.kanbanId);
  const fasesRes = await client.query(
    `SELECT id, slug, nome, ordem, kanban_id FROM kanban_fases
     WHERE kanban_id = ANY($1::uuid[]) AND ativo = true
     ORDER BY kanban_id, ordem`,
    [kanbanIds],
  );

  const meta = [];
  let ordemGlobal = 0;
  for (const funil of CALCULADORA_ESTEIRA_FUNIS) {
    const fases = fasesRes.rows
      .filter((f) => f.kanban_id === funil.kanbanId && faseIncluidaCalculadora(funil.kanbanId, f.slug))
      .sort((a, b) => a.ordem - b.ordem);
    for (const fase of fases) {
      ordemGlobal += 1;
      meta.push({
        ...fase,
        funilLabel: funil.label,
        ordemGlobal,
      });
    }
  }
  return meta;
}

async function resolverSlugsAntesDeContrato(client, opts = {}) {
  const contratoSlug = String(opts.contratoSlug ?? 'step_7').trim();
  const excluirNegociacao = opts.excluirNegociacao !== false;
  const meta = await montarMetaCalculadoraEsteira(client);

  const contrato = meta.find((m) => isFaseContrato(m.slug, m.nome, contratoSlug));
  if (!contrato) {
    throw new Error(`Fase Contrato não encontrada (slug=${contratoSlug}).`);
  }

  const antesContrato = meta.filter((m) => m.ordemGlobal < contrato.ordemGlobal);
  const excluidasNegociacao = excluirNegociacao
    ? antesContrato.filter((m) => isFaseNegociacao(m.slug, m.nome))
    : [];
  const alvo = excluirNegociacao
    ? antesContrato.filter((m) => !isFaseNegociacao(m.slug, m.nome))
    : antesContrato;

  return {
    contrato,
    meta,
    excluidasNegociacao,
    alvo,
    slugs: alvo.map((m) => m.slug),
    fasesPorSlug: new Map(alvo.map((m) => [m.slug, m])),
  };
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

async function resolverFasesPorSlug(client, slugs, cardKanbanId, fasesPrecarregadas) {
  if (fasesPrecarregadas) return fasesPrecarregadas;

  const fases = await client.query(
    `SELECT id, slug, nome, kanban_id, ordem FROM kanban_fases
     WHERE slug = ANY($1::text[])
     ORDER BY slug, (kanban_id = $2) DESC, ordem`,
    [slugs, cardKanbanId],
  );

  /** Uma fase por slug (preferindo kanban do card). */
  const porSlug = new Map();
  for (const f of fases.rows) {
    if (!porSlug.has(f.slug)) porSlug.set(f.slug, f);
  }
  return porSlug;
}

async function main() {
  const cardId = (argValue('--card-id') || '').trim();
  const antesDeContrato = process.argv.includes('--antes-de-contrato');
  const incluirNegociacao = process.argv.includes('--incluir-negociacao');
  const contratoSlug = (argValue('--contrato-slug') || 'step_7').trim();
  const slugsRaw = (argValue('--slugs') || argValue('--slug') || '').trim();

  if (!cardId) {
    console.error(
      'Uso: --card-id=<uuid> (--slugs=slug1,slug2 | --antes-de-contrato) [--prod] [--dry-run|--confirm-prod]',
    );
    process.exit(1);
  }

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
  console.log(`=== ${label} host=${cfg.host} dryRun=${dryRun} ===`);

  const cardRes = await client.query(
    `SELECT c.id, c.titulo, c.kanban_id, c.processo_step_one_id, k.nome AS kanban_nome, f.slug AS fase_slug
     FROM kanban_cards c
     LEFT JOIN kanbans k ON k.id = c.kanban_id
     LEFT JOIN kanban_fases f ON f.id = c.fase_id
     WHERE c.id = $1`,
    [cardId],
  );
  if (!cardRes.rows.length) {
    console.log('Card não encontrado.');
    await client.end();
    process.exit(0);
  }
  const card = cardRes.rows[0];
  console.log('Card:', card.id, card.kanban_nome, card.fase_slug, card.titulo);

  let SLUGS = slugsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let porSlugPrecarregado = null;
  let excluidasNegociacao = [];

  if (antesDeContrato) {
    const resolved = await resolverSlugsAntesDeContrato(client, {
      contratoSlug,
      excluirNegociacao: !incluirNegociacao,
    });
    SLUGS = resolved.slugs;
    porSlugPrecarregado = resolved.fasesPorSlug;
    excluidasNegociacao = resolved.excluidasNegociacao;
    console.log(`\nModo --antes-de-contrato`);
    console.log(
      `Contrato: ordem=${resolved.contrato.ordemGlobal} slug=${resolved.contrato.slug} nome=${resolved.contrato.nome}`,
    );
    console.log(
      `Excluídas (negociação): ${excluidasNegociacao.map((m) => m.slug).join(', ') || '(nenhuma)'}`,
    );
  }

  if (SLUGS.length === 0) {
    console.error('Nenhum slug alvo.');
    await client.end();
    process.exit(1);
  }

  console.log(`\ncard=${cardId} slugs (${SLUGS.length}): ${SLUGS.join(',')}`);

  const syncIds = await listarSyncGroupIds(client, cardId);
  console.log('Sync group:', syncIds);

  const porSlug = await resolverFasesPorSlug(client, SLUGS, card.kanban_id, porSlugPrecarregado);
  console.log('\nFases alvo:');
  for (const slug of SLUGS) {
    const f = porSlug.get(slug);
    if (!f) console.log(`  MISSING ${slug}`);
    else console.log(`  ${slug} → ${f.id} | ${f.nome}`);
  }

  const faseIds = [...porSlug.values()].map((f) => f.id);
  if (faseIds.length === 0) {
    console.error('Nenhuma fase encontrada.');
    await client.end();
    process.exit(1);
  }

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
      `\n[dry-run] UPSERT data_inicio=NULL data_fim=NULL em ${faseIds.length} fase(s) × ${syncIds.length} card(s) = ${faseIds.length * syncIds.length} linhas`,
    );
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    let n = 0;
    for (const cid of syncIds) {
      for (const fase of porSlug.values()) {
        await client.query(
          `INSERT INTO kanban_calculadora_fase_datas (card_id, fase_id, data_inicio, data_fim, editado_em)
           VALUES ($1, $2, NULL, NULL, NOW())
           ON CONFLICT (card_id, fase_id)
           DO UPDATE SET data_inicio = NULL, data_fim = NULL, editado_em = NOW()`,
          [cid, fase.id],
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
  let okCount = 0;
  let failCount = 0;
  for (const r of depois.rows) {
    const ok = r.data_inicio == null && r.data_fim == null;
    if (ok) okCount += 1;
    else failCount += 1;
    console.log(
      `  ${ok ? 'OK' : 'FAIL'} ${r.card_id.slice(0, 8)} ${r.slug} ${ymd(r.data_inicio) ?? 'null'} → ${ymd(r.data_fim) ?? 'null'}`,
    );
  }
  const expected = faseIds.length * syncIds.length;
  console.log(`\nValidação: ${okCount}/${expected} OK, ${failCount} FAIL`);
  console.log('Concluído.');
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
