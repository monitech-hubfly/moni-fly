/**
 * Exclui (hard delete) todos os cards do Funil Cash Me e/ou Funil Projeto Legal,
 * limpa vínculos/flags dos pais para permitir recriar abertura automática.
 *
 * Funis (KANBAN_IDS canônicos):
 *   Cash Me      = CREDITO_OBRA   6463af1d-850d-4958-b74c-404f8d668e21
 *   Projeto Legal = PROJETO_LEGAL 39de341d-aebf-481c-9118-ce6fc6574187
 *   (NÃO confundir com PROJETOS_LEGAIS — plural.)
 *
 * Por que hard delete (não arquivar):
 *   - Produto UI arquiva (`arquivado`), mas abertura automática Cash Me
 *     (`credito-obra-abertura-automatica`) bloqueia se existir qualquer filho
 *     com origem_card_id + kanban CREDITO_OBRA (inclui arquivados).
 *   - `zerar-esteiras-paralelas-card.ts` já usa hard delete + zera flags no pai.
 *   - Cascata DB: comentários, checklists, atividades, kanban_card_vinculos → CASCADE.
 *     origem_card_id de outros cards → SET NULL.
 *
 * Limpeza extra (mínimo seguro):
 *   Cash Me:
 *     - zera `credito_obra_ok` nos cards pai (origem_card_id)
 *     - apaga `kanban_operacoes_tranche_vinculos` dos pais Operações (não cascata
 *       ao apagar o filho Cash Me; FK aponta para o card de Operações)
 *   Projeto Legal:
 *     - sem flag de retorno dedicada (bastão usa flag: null)
 *     - vinculos em kanban_card_vinculos caem por CASCADE
 *
 * Uso:
 *   node --env-file=.env.local scripts/excluir-cards-funil-cash-me-projeto-legal.mjs --dry-run
 *   node --env-file=.env.local scripts/excluir-cards-funil-cash-me-projeto-legal.mjs --funil=ambos
 *   node --env-file=.env.local scripts/excluir-cards-funil-cash-me-projeto-legal.mjs --funil=cash-me --dry-run
 *   node --env-file=.env.local scripts/excluir-cards-funil-cash-me-projeto-legal.mjs --funil=projeto-legal --dry-run
 *   node --env-file=.env.local scripts/excluir-cards-funil-cash-me-projeto-legal.mjs --prod --dry-run
 *   node --env-file=.env.local scripts/excluir-cards-funil-cash-me-projeto-legal.mjs --prod --confirm-prod --funil=ambos
 *
 * Padrão: só DEV. PROD exige `--prod --confirm-prod` para escrita.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { parsePostgresUrl } from './pg-dev-client.mjs';

const KANBAN_IDS = {
  CREDITO_OBRA: '6463af1d-850d-4958-b74c-404f8d668e21',
  PROJETO_LEGAL: '39de341d-aebf-481c-9118-ce6fc6574187',
  /** Referência — NÃO usar neste script */
  PROJETOS_LEGAIS: '23ad5ce1-59f8-4e74-acb8-69aa61228cd8',
};

const FUNIS = {
  'cash-me': {
    key: 'cash-me',
    label: 'Funil Cash Me (CREDITO_OBRA)',
    kanbanId: KANBAN_IDS.CREDITO_OBRA,
    nomesEsperados: ['Funil Cash Me', 'Funil Crédito Obra', 'Funil Crédito'],
  },
  'projeto-legal': {
    key: 'projeto-legal',
    label: 'Funil Projeto Legal (PROJETO_LEGAL)',
    kanbanId: KANBAN_IDS.PROJETO_LEGAL,
    nomesEsperados: ['Funil Projeto Legal'],
  },
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
  const wantProd = argv.includes('--prod');
  const confirmProd = argv.includes('--confirm-prod');
  const dryRun = argv.includes('--dry-run');
  let funilRaw = 'ambos';
  for (const a of argv) {
    if (a.startsWith('--funil=')) funilRaw = a.slice('--funil='.length).trim().toLowerCase();
  }
  return { wantProd, confirmProd, dryRun, funilRaw };
}

function resolverFunis(funilRaw) {
  if (funilRaw === 'ambos' || funilRaw === 'all' || funilRaw === 'both') {
    return [FUNIS['cash-me'], FUNIS['projeto-legal']];
  }
  if (funilRaw === 'cash-me' || funilRaw === 'cashme' || funilRaw === 'credito-obra') {
    return [FUNIS['cash-me']];
  }
  if (funilRaw === 'projeto-legal' || funilRaw === 'projetolegal') {
    return [FUNIS['projeto-legal']];
  }
  console.error(
    `Funil inválido: "${funilRaw}". Use --funil=cash-me | projeto-legal | ambos`,
  );
  process.exit(1);
}

async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return rows.length > 0;
}

async function confirmarKanban(client, funil) {
  const { rows } = await client.query(
    `SELECT id, nome FROM public.kanbans WHERE id = $1::uuid`,
    [funil.kanbanId],
  );
  if (!rows.length) {
    throw new Error(`${funil.label}: kanban_id ${funil.kanbanId} não encontrado em kanbans.`);
  }
  const nome = String(rows[0].nome ?? '').trim();
  if (!funil.nomesEsperados.includes(nome)) {
    console.warn(
      `  AVISO: nome no banco é "${nome}" (esperado um de: ${funil.nomesEsperados.join(', ')}). Continuando com o UUID canônico.`,
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

async function listarResumoCards(client, kanbanId, limit = 15) {
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

async function processarCashMe(client, { dryRun }) {
  const kanbanId = KANBAN_IDS.CREDITO_OBRA;
  const antes = await contarCards(client, kanbanId);

  const pais = await client.query(
    `SELECT DISTINCT origem_card_id AS id
     FROM public.kanban_cards
     WHERE kanban_id = $1::uuid AND origem_card_id IS NOT NULL`,
    [kanbanId],
  );
  const paiIds = pais.rows.map((r) => r.id).filter(Boolean);

  let flagsOkAntes = 0;
  if (paiIds.length) {
    const flagQ = await client.query(
      `SELECT COUNT(*)::int AS n FROM public.kanban_cards
       WHERE id = ANY($1::uuid[]) AND COALESCE(credito_obra_ok, false) = true`,
      [paiIds],
    );
    flagsOkAntes = flagQ.rows[0].n;
  }

  let trancheAntes = 0;
  const hasTranche = await tableExists(client, 'kanban_operacoes_tranche_vinculos');
  if (hasTranche && paiIds.length) {
    const tq = await client.query(
      `SELECT COUNT(*)::int AS n FROM public.kanban_operacoes_tranche_vinculos
       WHERE operacoes_card_id = ANY($1::uuid[])`,
      [paiIds],
    );
    trancheAntes = tq.rows[0].n;
  }

  let vinculosAntes = 0;
  const hasVinculos = await tableExists(client, 'kanban_card_vinculos');
  if (hasVinculos) {
    const vq = await client.query(
      `SELECT COUNT(*)::int AS n FROM public.kanban_card_vinculos v
       WHERE EXISTS (
         SELECT 1 FROM public.kanban_cards c
         WHERE c.kanban_id = $1::uuid
           AND (c.id = v.card_origem_id OR c.id = v.card_destino_id)
       )`,
      [kanbanId],
    );
    vinculosAntes = vq.rows[0].n;
  }

  console.log(`  Cards: total=${antes.total} ativos=${antes.ativos} arquivados=${antes.arquivados}`);
  console.log(`  Pais com origem_card_id: ${paiIds.length}`);
  console.log(`  Pais com credito_obra_ok=true: ${flagsOkAntes}`);
  console.log(`  Tranche vínculos (pais Operações): ${trancheAntes}`);
  console.log(`  kanban_card_vinculos envolvendo esses cards: ${vinculosAntes}`);

  const amostra = await listarResumoCards(client, kanbanId);
  if (amostra.length) {
    console.log(`  Amostra (até ${amostra.length}):`);
    for (const r of amostra) {
      console.log(
        `    - ${r.id} | ${r.arquivado ? 'ARQ' : 'ATV'} | ${r.fase_slug ?? '—'} | ${String(r.titulo ?? '').slice(0, 60)}`,
      );
    }
  }

  if (dryRun) {
    console.log('  [dry-run] Nenhuma alteração.');
    return { antes, depois: antes, deleted: 0, flagsReset: 0, trancheDeleted: 0 };
  }

  let trancheDeleted = 0;
  if (hasTranche && paiIds.length) {
    const delT = await client.query(
      `DELETE FROM public.kanban_operacoes_tranche_vinculos
       WHERE operacoes_card_id = ANY($1::uuid[])
       RETURNING id`,
      [paiIds],
    );
    trancheDeleted = delT.rowCount ?? 0;
  }

  let flagsReset = 0;
  if (paiIds.length) {
    const upd = await client.query(
      `UPDATE public.kanban_cards
       SET credito_obra_ok = false
       WHERE id = ANY($1::uuid[]) AND COALESCE(credito_obra_ok, false) = true
       RETURNING id`,
      [paiIds],
    );
    flagsReset = upd.rowCount ?? 0;
  }

  const del = await client.query(
    `DELETE FROM public.kanban_cards
     WHERE kanban_id = $1::uuid
     RETURNING id`,
    [kanbanId],
  );
  const deleted = del.rowCount ?? 0;
  const depois = await contarCards(client, kanbanId);

  console.log(`  Soft/hard: HARD DELETE de ${deleted} card(s).`);
  console.log(`  Flags credito_obra_ok zeradas: ${flagsReset}`);
  console.log(`  Tranche vínculos removidos: ${trancheDeleted}`);
  console.log(`  Depois: total=${depois.total}`);

  return { antes, depois, deleted, flagsReset, trancheDeleted };
}

async function processarProjetoLegal(client, { dryRun }) {
  const kanbanId = KANBAN_IDS.PROJETO_LEGAL;
  const antes = await contarCards(client, kanbanId);

  const pais = await client.query(
    `SELECT COUNT(DISTINCT origem_card_id)::int AS n
     FROM public.kanban_cards
     WHERE kanban_id = $1::uuid AND origem_card_id IS NOT NULL`,
    [kanbanId],
  );

  let vinculosAntes = 0;
  const hasVinculos = await tableExists(client, 'kanban_card_vinculos');
  if (hasVinculos) {
    const vq = await client.query(
      `SELECT COUNT(*)::int AS n FROM public.kanban_card_vinculos v
       WHERE EXISTS (
         SELECT 1 FROM public.kanban_cards c
         WHERE c.kanban_id = $1::uuid
           AND (c.id = v.card_origem_id OR c.id = v.card_destino_id)
       )`,
      [kanbanId],
    );
    vinculosAntes = vq.rows[0].n;
  }

  // Segurança: garantir que NÃO tocamos PROJETOS_LEGAIS
  const outros = await contarCards(client, KANBAN_IDS.PROJETOS_LEGAIS);

  console.log(`  Cards: total=${antes.total} ativos=${antes.ativos} arquivados=${antes.arquivados}`);
  console.log(`  Pais distintos (origem_card_id): ${pais.rows[0].n}`);
  console.log(`  kanban_card_vinculos envolvendo esses cards: ${vinculosAntes}`);
  console.log(
    `  (não tocado) Funil Projetos Legais plural: ${outros.total} card(s) — kanban ${KANBAN_IDS.PROJETOS_LEGAIS}`,
  );

  const amostra = await listarResumoCards(client, kanbanId);
  if (amostra.length) {
    console.log(`  Amostra (até ${amostra.length}):`);
    for (const r of amostra) {
      console.log(
        `    - ${r.id} | ${r.arquivado ? 'ARQ' : 'ATV'} | ${r.fase_slug ?? '—'} | ${String(r.titulo ?? '').slice(0, 60)}`,
      );
    }
  }

  if (dryRun) {
    console.log('  [dry-run] Nenhuma alteração.');
    return { antes, depois: antes, deleted: 0 };
  }

  const del = await client.query(
    `DELETE FROM public.kanban_cards
     WHERE kanban_id = $1::uuid
     RETURNING id`,
    [kanbanId],
  );
  const deleted = del.rowCount ?? 0;
  const depois = await contarCards(client, kanbanId);
  const outrosDepois = await contarCards(client, KANBAN_IDS.PROJETOS_LEGAIS);

  console.log(`  Soft/hard: HARD DELETE de ${deleted} card(s).`);
  console.log(`  Depois: total=${depois.total}`);
  console.log(`  Projetos Legais (plural) intacto: ${outrosDepois.total} card(s)`);

  return { antes, depois, deleted };
}

async function main() {
  const { wantProd, confirmProd, dryRun, funilRaw } = parseArgs(process.argv.slice(2));
  const funis = resolverFunis(funilRaw);

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

  console.log('=== Excluir cards Cash Me / Projeto Legal ===');
  console.log(`Ambiente: ${label} (${cfg.host})`);
  console.log(`Modo: ${dryRun ? 'DRY-RUN' : 'EXECUÇÃO'}`);
  console.log(`Funis: ${funis.map((f) => f.key).join(', ')}`);
  console.log('');

  const client = new pg.Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const results = {};

  try {
    await client.query('BEGIN');

    for (const funil of funis) {
      console.log(`--- ${funil.label} ---`);
      console.log(`  kanban_id: ${funil.kanbanId}`);
      const nome = await confirmarKanban(client, funil);
      console.log(`  nome no banco: ${nome}`);

      if (funil.key === 'cash-me') {
        results['cash-me'] = await processarCashMe(client, { dryRun });
      } else {
        results['projeto-legal'] = await processarProjetoLegal(client, { dryRun });
      }
      console.log('');
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('DRY-RUN: ROLLBACK (nenhuma escrita).');
    } else {
      await client.query('COMMIT');
      console.log('COMMIT ok.');
    }
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error('Erro:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }

  console.log('');
  console.log('=== Resumo ===');
  for (const [k, r] of Object.entries(results)) {
    console.log(
      `${k}: antes=${r.antes?.total ?? '?'} depois=${r.depois?.total ?? '?'} deleted=${r.deleted ?? 0}`,
    );
  }

  if (wantProd && dryRun) {
    console.log('');
    console.log('Para executar em PROD (confirmação explícita necessária):');
    console.log(
      `  node --env-file=.env.local scripts/excluir-cards-funil-cash-me-projeto-legal.mjs --prod --confirm-prod --funil=${funilRaw}`,
    );
  }
}

void main();
