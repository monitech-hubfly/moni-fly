/**
 * PROD — garante filhos paralelos (Acoplamento, Projetos Locais, Projeto Legal, Cash Me, Divify)
 * para card pai Portfolio / Operações / Loteadores.
 *
 * Uso:
 *   node --env-file=.env.local scripts/garantir-vinculos-paralelas-card.mjs --card-id=<uuid> --dry-run
 *   node --env-file=.env.local scripts/garantir-vinculos-paralelas-card.mjs --card-id=<uuid> --confirm-prod
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { parsePostgresUrl } from './pg-dev-client.mjs';
import { garantirShadowKanbanCardLegadoPg } from './pg-garantir-shadow-legado.mjs';

const KANBAN = {
  OPERACOES: 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636',
  PORTFOLIO: 'c57120a0-991c-422b-8def-4d16a9411d45',
  ACOPLAMENTO: '15847602-231d-4937-a06f-82027eb87ef3',
  PROJETOS_LOCAIS: 'c2ab09bd-4bd6-491e-8734-281d7678a6ad',
  PROJETO_LEGAL: '39de341d-aebf-481c-9118-ce6fc6574187',
  CREDITO_OBRA: '6463af1d-850d-4958-b74c-404f8d668e21',
  MONI_CAPITAL: '724aef36-37de-4454-bf6f-ec481693aeeb',
};

const DESTINOS = [
  { key: 'Acoplamento', kanbanId: KANBAN.ACOPLAMENTO, faseSlug: 'modelagem_terreno', match: /Acoplamento/i },
  { key: 'Projetos Locais', kanbanId: KANBAN.PROJETOS_LOCAIS, faseSlug: 'pl_000_novo_projeto', match: /Projetos Locais/i },
  { key: 'Projeto Legal', kanbanId: KANBAN.PROJETO_LEGAL, faseSlug: 'pl_nova_demanda', match: /Projeto Legal/i },
  { key: 'Cash Me', kanbanId: KANBAN.CREDITO_OBRA, faseSlug: 'co_novo_projeto', match: /Cash Me|Crédito Obra/i },
  { key: 'Divify', kanbanId: KANBAN.MONI_CAPITAL, faseSlug: 'capital_recebimento', match: /Divify|Moní Capital/i },
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

function argValue(name) {
  const eq = process.argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return null;
}

const dryRun = process.argv.includes('--dry-run');
const confirmProd = process.argv.includes('--confirm-prod');
const cardId = (argValue('--card-id') || '').trim();

async function faseId(client, kanbanId, slug) {
  const r = await client.query(
    `SELECT id FROM kanban_fases
     WHERE kanban_id = $1 AND slug = $2 AND ativo = true
     ORDER BY ordem LIMIT 1`,
    [kanbanId, slug],
  );
  if (!r.rows[0]) throw new Error(`Fase ${slug} não encontrada em ${kanbanId}`);
  return r.rows[0].id;
}

async function statusFilhos(client, paiId) {
  const r = await client.query(
    `SELECT c.id, k.nome AS kanban, c.arquivado
     FROM kanban_cards c
     JOIN kanbans k ON k.id = c.kanban_id
     WHERE c.origem_card_id = $1
       AND c.kanban_id = ANY($2::uuid[])
     ORDER BY k.nome, c.arquivado, c.created_at`,
    [paiId, DESTINOS.map((d) => d.kanbanId)],
  );
  return r.rows;
}

function resumo(filhos) {
  const map = Object.fromEntries(DESTINOS.map((d) => [d.key, null]));
  for (const f of filhos) {
    const n = String(f.kanban ?? '');
    for (const d of DESTINOS) {
      if (d.match.test(n) && !f.arquivado) map[d.key] = f.id;
    }
  }
  return map;
}

async function garantirVinculo(client, paiId, filhoId, franqueadoId) {
  const v = await client.query(
    `SELECT id FROM kanban_card_vinculos
     WHERE (card_origem_id = $1 AND card_destino_id = $2)
        OR (card_origem_id = $2 AND card_destino_id = $1)
     LIMIT 1`,
    [paiId, filhoId],
  );
  if (v.rows.length > 0) return false;
  await client.query(
    `INSERT INTO kanban_card_vinculos
       (card_origem_id, card_destino_id, card_id, vinculado_a, tipo_vinculo, criado_por)
     VALUES ($1, $2, $1, $2, 'originou', $3)`,
    [paiId, filhoId, franqueadoId],
  );
  return true;
}

async function criarFilho(client, pai, destino) {
  const fase_id = await faseId(client, destino.kanbanId, destino.faseSlug);
  const cols = [
    'kanban_id', 'fase_id', 'titulo', 'origem_card_id', 'franqueado_id',
    'rede_franqueado_id', 'nome_condominio', 'quadra', 'lote', 'condominio_id', 'status',
  ];
  const vals = [
    destino.kanbanId, fase_id, pai.titulo, pai.id, pai.franqueado_id,
    pai.rede_franqueado_id, pai.nome_condominio, pai.quadra, pai.lote, pai.condominio_id, 'ativo',
  ];
  if (destino.kanbanId === KANBAN.ACOPLAMENTO) {
    cols.push('origem_kanban_id', 'origem_kanban_nome');
    vals.push(pai.kanban_id, pai.kanban_nome ?? 'Funil Portfólio');
  }
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const ins = await client.query(
    `INSERT INTO kanban_cards (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
    vals,
  );
  return ins.rows[0].id;
}

async function main() {
  if (!cardId) {
    console.error('Uso: --card-id=<uuid> (--dry-run | --confirm-prod)');
    process.exit(1);
  }
  if (!dryRun && !confirmProd) {
    console.error('Use --dry-run ou --confirm-prod');
    process.exit(1);
  }

  const url = process.env.PROD_DB_URL;
  if (!url) throw new Error('PROD_DB_URL ausente');
  const cfg = parsePostgresUrl(url);
  if (!String(cfg.host).includes('aydryzoxqnwnbybvgiug')) {
    throw new Error(`Host inesperado (não é PROD): ${cfg.host}`);
  }

  const client = new pg.Client({ ...cfg, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    if (!dryRun) await client.query('BEGIN');

    let paiRes = await client.query(
      `SELECT c.id, c.titulo, c.franqueado_id, c.rede_franqueado_id, c.nome_condominio,
              c.quadra, c.lote, c.condominio_id, c.kanban_id, k.nome AS kanban_nome
       FROM kanban_cards c
       JOIN kanbans k ON k.id = c.kanban_id
       WHERE c.id = $1`,
      [cardId],
    );
    if (!paiRes.rows[0]) {
      const shadowOk = await garantirShadowKanbanCardLegadoPg(client, cardId);
      if (!shadowOk) throw new Error(`Card ${cardId} não encontrado`);
      paiRes = await client.query(
        `SELECT c.id, c.titulo, c.franqueado_id, c.rede_franqueado_id, c.nome_condominio,
                c.quadra, c.lote, c.condominio_id, c.kanban_id, k.nome AS kanban_nome
         FROM kanban_cards c
         JOIN kanbans k ON k.id = c.kanban_id
         WHERE c.id = $1`,
        [cardId],
      );
    }
    const pai = paiRes.rows[0];
    console.log(`\n${pai.titulo} (${cardId}) — ${pai.kanban_nome}`);

    const beforeRows = await statusFilhos(client, cardId);
    const before = resumo(beforeRows);
    console.log('ANTES:', before);

    if (dryRun) {
      const plan = DESTINOS.filter((d) => !before[d.key]).map((d) => d.key);
      console.log('[dry-run]', plan.length ? `criar ${plan.join(', ')}` : 'nada a fazer');
      return;
    }

    const afterMap = { ...before };
    for (const destino of DESTINOS) {
      if (afterMap[destino.key]) {
        await garantirVinculo(client, cardId, afterMap[destino.key], pai.franqueado_id);
        continue;
      }
      const filhoId = await criarFilho(client, pai, destino);
      await garantirVinculo(client, cardId, filhoId, pai.franqueado_id);
      afterMap[destino.key] = filhoId;
      console.log(`Criado ${destino.key}:`, filhoId);
    }

    await client.query(
      `UPDATE kanban_cards
       SET acoplamento_concluido = true,
           updated_at = now()
       WHERE id = $1`,
      [cardId],
    );

    const afterRows = await statusFilhos(client, cardId);
    console.log('DEPOIS:', resumo(afterRows));

    await client.query('COMMIT');
  } catch (e) {
    if (!dryRun) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
    }
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
