/**
 * Exclui (hard delete) TODOS os cards do Funil Step One — somente esse kanban.
 *
 * Funil (KANBAN_IDS canônico):
 *   STEP_ONE = 4d89f111-cef6-48aa-93ff-72d6406f0a32
 *
 * NÃO apaga fases, checklist itens, nem o registro em `kanbans`.
 * NÃO apaga cards de outros funis (Portfólio, Operações, etc.).
 *
 * Cascata DB típica ao apagar kanban_cards:
 *   comentários, checklists respostas, atividades, vinculos → CASCADE
 *   origem_card_id / referências em outros cards → SET NULL (quando configurado)
 *
 * Uso:
 *   node --env-file=.env.local scripts/excluir-cards-funil-step-one.mjs --dry-run
 *   node --env-file=.env.local scripts/excluir-cards-funil-step-one.mjs
 *   node --env-file=.env.local scripts/excluir-cards-funil-step-one.mjs --prod --dry-run
 *   node --env-file=.env.local scripts/excluir-cards-funil-step-one.mjs --prod --confirm-prod
 *
 * Padrão: só DEV. PROD exige `--prod --confirm-prod` para escrita.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { parsePostgresUrl } from './pg-dev-client.mjs';

const STEP_ONE_ID = '4d89f111-cef6-48aa-93ff-72d6406f0a32';
const NOMES_ESPERADOS = ['Funil Step One', 'Funil StepOne', 'Step One'];

/** Kanbans que NÃO devem ser tocados — checagem de sanidade pós-delete. */
const OUTROS_KANBANS_REF = {
  PORTFOLIO: 'c57120a0-991c-422b-8def-4d16a9411d45',
  OPERACOES: 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636',
  LOTEADORES: '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c',
};

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

function parseArgs(argv) {
  return {
    wantProd: argv.includes('--prod'),
    confirmProd: argv.includes('--confirm-prod'),
    dryRun: argv.includes('--dry-run'),
  };
}

async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return rows.length > 0;
}

async function confirmarKanban(client) {
  const { rows } = await client.query(
    `SELECT id, nome FROM public.kanbans WHERE id = $1::uuid`,
    [STEP_ONE_ID],
  );
  if (!rows.length) {
    throw new Error(`Funil Step One: kanban_id ${STEP_ONE_ID} não encontrado em kanbans.`);
  }
  const nome = String(rows[0].nome ?? '').trim();
  if (!NOMES_ESPERADOS.includes(nome)) {
    console.warn(
      `  AVISO: nome no banco é "${nome}" (esperado um de: ${NOMES_ESPERADOS.join(', ')}). Continuando com o UUID canônico.`,
    );
  }
  return nome;
}

async function contarCards(client, kanbanId) {
  const { rows } = await client.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE COALESCE(arquivado, false) = false)::int AS ativos,
       COUNT(*) FILTER (WHERE COALESCE(arquivado, false) = true)::int AS arquivados
     FROM public.kanban_cards
     WHERE kanban_id = $1::uuid`,
    [kanbanId],
  );
  return rows[0];
}

async function listarResumoCards(client, kanbanId, limit = 20) {
  const { rows } = await client.query(
    `SELECT c.id, c.titulo, c.arquivado, c.origem_card_id, f.slug AS fase_slug
     FROM public.kanban_cards c
     LEFT JOIN public.kanban_fases f ON f.id = c.fase_id
     WHERE c.kanban_id = $1::uuid
     ORDER BY c.created_at NULLS LAST, c.titulo
     LIMIT $2`,
    [kanbanId, limit],
  );
  return rows;
}

async function main() {
  const { wantProd, confirmProd, dryRun } = parseArgs(process.argv.slice(2));

  if (wantProd && !confirmProd && !dryRun) {
    console.error(
      'PROD exige --confirm-prod para escrita.\n' +
        '  Ex.: node --env-file=.env.local scripts/excluir-cards-funil-step-one.mjs --prod --confirm-prod\n' +
        '  Ou dry-run: ... --prod --dry-run',
    );
    process.exit(1);
  }

  const envKey = wantProd ? 'PROD_DB_URL' : 'DEV_DB_URL';
  const rawUrl = process.env[envKey];
  if (!rawUrl) {
    console.error(`Variável ${envKey} ausente. Defina em .env.local.`);
    process.exit(1);
  }

  const cfg = parsePostgresUrl(rawUrl);
  const client = new pg.Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`Ambiente: ${wantProd ? 'PROD' : 'DEV'} | host=${cfg.host} | db=${cfg.database}`);
  console.log(`Modo: ${dryRun ? 'DRY-RUN (sem delete)' : 'HARD DELETE'}`);
  console.log(`Alvo: Funil Step One (${STEP_ONE_ID})`);

  await client.connect();
  try {
    const nomeKanban = await confirmarKanban(client);
    console.log(`Kanban confirmado: "${nomeKanban}"`);

    const antes = await contarCards(client, STEP_ONE_ID);
    console.log(
      `Cards Step One: total=${antes.total} ativos=${antes.ativos} arquivados=${antes.arquivados}`,
    );

    let vinculosAntes = 0;
    if (await tableExists(client, 'kanban_card_vinculos')) {
      const vq = await client.query(
        `SELECT COUNT(*)::int AS n FROM public.kanban_card_vinculos v
         WHERE EXISTS (
           SELECT 1 FROM public.kanban_cards c
           WHERE c.kanban_id = $1::uuid
             AND (c.id = v.card_origem_id OR c.id = v.card_destino_id)
         )`,
        [STEP_ONE_ID],
      );
      vinculosAntes = vq.rows[0].n;
      console.log(`kanban_card_vinculos envolvendo esses cards: ${vinculosAntes}`);
    }

    const filhosOutrosFunis = await client.query(
      `SELECT COUNT(*)::int AS n
       FROM public.kanban_cards filho
       WHERE filho.origem_card_id IN (
         SELECT id FROM public.kanban_cards WHERE kanban_id = $1::uuid
       )
         AND filho.kanban_id IS DISTINCT FROM $1::uuid`,
      [STEP_ONE_ID],
    );
    console.log(
      `Cards de OUTROS funis com origem_card_id apontando para Step One: ${filhosOutrosFunis.rows[0].n} (não serão apagados; origem deve SET NULL)`,
    );

    for (const [label, id] of Object.entries(OUTROS_KANBANS_REF)) {
      const c = await contarCards(client, id);
      console.log(`  (não tocado) ${label}: ${c.total} card(s)`);
    }

    const amostra = await listarResumoCards(client, STEP_ONE_ID);
    if (amostra.length) {
      console.log(`Amostra (até ${amostra.length}):`);
      for (const r of amostra) {
        console.log(
          `  - ${r.id} | ${r.arquivado ? 'ARQ' : 'ATV'} | ${r.fase_slug ?? '—'} | ${String(r.titulo ?? '').slice(0, 60)}`,
        );
      }
    }

    if (antes.total === 0) {
      console.log('Nada a excluir.');
      return;
    }

    if (dryRun) {
      console.log('[dry-run] Nenhuma alteração. Rode sem --dry-run para apagar.');
      return;
    }

    await client.query('BEGIN');
    try {
      const del = await client.query(
        `DELETE FROM public.kanban_cards
         WHERE kanban_id = $1::uuid
         RETURNING id`,
        [STEP_ONE_ID],
      );
      const deleted = del.rowCount ?? 0;

      // Sanidade: outros funis intactos
      for (const [label, id] of Object.entries(OUTROS_KANBANS_REF)) {
        const c = await contarCards(client, id);
        if (c.total < 0) throw new Error(`Contagem inválida em ${label}`);
        console.log(`  Pós-delete (não tocado) ${label}: ${c.total} card(s)`);
      }

      const depois = await contarCards(client, STEP_ONE_ID);
      if (depois.total !== 0) {
        throw new Error(`Falha: ainda restam ${depois.total} card(s) no Step One.`);
      }

      await client.query('COMMIT');
      console.log(`HARD DELETE concluído: ${deleted} card(s) do Funil Step One removidos.`);
      console.log(`Depois: total=${depois.total}`);
      await client.query(`NOTIFY pgrst, 'reload schema'`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
