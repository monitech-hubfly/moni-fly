/**
 * PROD — garante os 4 vínculos (Acoplamento, Projetos Locais, Projeto Legal, Cash Me)
 * para cards Pré Obra em Operações.
 *
 * Uso:
 *   node --env-file=.env.local scripts/garantir-vinculos-preobra-operacoes.mjs --dry-run
 *   node --env-file=.env.local scripts/garantir-vinculos-preobra-operacoes.mjs --confirm-prod
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { parsePostgresUrl } from './pg-dev-client.mjs';

/** Cards alvo padrão (batch) */
const CARD_IDS_DEFAULT = [
  'd58bc8ec-1b7f-4732-81c5-aff61f412b9a', // FK0012 Genesis II
  '17b5aef3-aab9-410a-b0d2-8ebcdca71c50', // Artesano Galleria
  'ca66b708-bba0-41f2-85c0-b1963bd05af6',
  '0824cdc0-8163-4a42-b385-e95c0c98e761',
  '6b419ba4-7f55-4ef9-ae5d-51060edf398f',
];

function argValue(name) {
  const eq = process.argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return null;
}

function resolverCardIds() {
  const raw = (argValue('--card-id') || argValue('--card-ids') || '').trim();
  if (!raw) return CARD_IDS_DEFAULT;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const KANBAN = {
  OPERACOES: 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636',
  ACOPLAMENTO: '15847602-231d-4937-a06f-82027eb87ef3',
  PROJETOS_LOCAIS: 'c2ab09bd-4bd6-491e-8734-281d7678a6ad',
  PROJETO_LEGAL: '39de341d-aebf-481c-9118-ce6fc6574187',
  CREDITO_OBRA: '6463af1d-850d-4958-b74c-404f8d668e21',
};

const FASE_DESTINO = {
  ACOPLAMENTO: 'modelagem_terreno',
  PROJETOS_LOCAIS: 'pl_000_novo_projeto',
  PROJETO_LEGAL: 'pl_nova_demanda',
  CREDITO_OBRA: 'co_novo_projeto',
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
  } catch (_) {}
}

loadEnvLocal();

const dryRun = process.argv.includes('--dry-run');
const confirmProd = process.argv.includes('--confirm-prod');

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

async function statusFilhos(client, cardId) {
  const r = await client.query(
    `SELECT c.id, k.nome AS kanban, f.slug AS fase, c.arquivado, c.origem_card_id
     FROM kanban_cards c
     JOIN kanbans k ON k.id = c.kanban_id
     LEFT JOIN kanban_fases f ON f.id = c.fase_id
     WHERE c.origem_card_id = $1
       AND c.kanban_id = ANY($2::uuid[])
     ORDER BY k.nome, c.arquivado, c.created_at`,
    [cardId, Object.values(KANBAN).filter((id) => id !== KANBAN.OPERACOES)],
  );
  return r.rows;
}

function resumo(filhos) {
  const map = {
    Acoplamento: null,
    'Projetos Locais': null,
    'Projeto Legal': null,
    'Cash Me': null,
  };
  for (const f of filhos) {
    const n = String(f.kanban ?? '');
    if (n.includes('Acoplamento') && !f.arquivado) map.Acoplamento = f.id;
    if (n.includes('Projetos Locais') && !f.arquivado) map['Projetos Locais'] = f.id;
    if (n.includes('Projeto Legal') && !f.arquivado) map['Projeto Legal'] = f.id;
    if ((n.includes('Cash Me') || n.includes('Crédito Obra')) && !f.arquivado) map['Cash Me'] = f.id;
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

async function criarFilho(client, pai, kanbanId, faseSlug, extra = {}) {
  const fase_id = await faseId(client, kanbanId, faseSlug);
  const cols = [
    'kanban_id', 'fase_id', 'titulo', 'origem_card_id', 'franqueado_id',
    'rede_franqueado_id', 'nome_condominio', 'quadra', 'lote', 'condominio_id', 'status',
  ];
  const vals = [
    kanbanId, fase_id, pai.titulo, pai.id, pai.franqueado_id,
    pai.rede_franqueado_id, pai.nome_condominio, pai.quadra, pai.lote, pai.condominio_id, 'ativo',
  ];

  if (extra.origem_kanban_id) {
    cols.push('origem_kanban_id', 'origem_kanban_nome');
    vals.push(extra.origem_kanban_id, extra.origem_kanban_nome ?? 'Funil Operações');
  }

  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const ins = await client.query(
    `INSERT INTO kanban_cards (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
    vals,
  );
  return ins.rows[0].id;
}

async function processarCard(client, cardId) {
  const paiRes = await client.query(
    `SELECT id, titulo, franqueado_id, rede_franqueado_id, nome_condominio, quadra, lote, condominio_id, kanban_id
     FROM kanban_cards WHERE id = $1`,
    [cardId],
  );
  const pai = paiRes.rows[0];
  if (!pai) {
    console.log(`\nSKIP: card ${cardId} não encontrado em PROD`);
    return { cardId, before: null, after: null, created: [], notFound: true };
  }

  console.log(`\n${'='.repeat(60)}\n${pai.titulo} (${cardId})`);
  const before = await statusFilhos(client, cardId);
  console.log('ANTES:', resumo(before));

  if (dryRun) {
    const plan = [];
    const r = resumo(before);
    if (!r.Acoplamento) plan.push('criar Acoplamento');
    if (!r['Projetos Locais']) plan.push('criar Projetos Locais');
    if (!r['Projeto Legal']) plan.push('criar Projeto Legal');
    if (!r['Cash Me']) plan.push('criar Cash Me');
    console.log('[dry-run]', plan.length ? plan.join(', ') : 'nada a fazer');
    return { cardId, before: r, after: r, created: [] };
  }

  const created = [];

  async function ensure(kanbanKey, faseKey, label) {
    const kid = KANBAN[kanbanKey];
    const exist = before.find((f) => String(f.kanban).includes(label) && !f.arquivado);
    if (exist) {
      await garantirVinculo(client, cardId, exist.id, pai.franqueado_id);
      return exist.id;
    }
    const extra =
      kanbanKey === 'ACOPLAMENTO'
        ? { origem_kanban_id: KANBAN.OPERACOES, origem_kanban_nome: 'Funil Operações' }
        : {};
    const filhoId = await criarFilho(client, pai, kid, FASE_DESTINO[faseKey], extra);
    await garantirVinculo(client, cardId, filhoId, pai.franqueado_id);
    created.push({ label, id: filhoId });
    console.log(`Criado ${label}:`, filhoId);
    return filhoId;
  }

  await ensure('ACOPLAMENTO', 'ACOPLAMENTO', 'Acoplamento');
  await ensure('PROJETOS_LOCAIS', 'PROJETOS_LOCAIS', 'Projetos Locais');
  await ensure('PROJETO_LEGAL', 'PROJETO_LEGAL', 'Projeto Legal');
  await ensure('CREDITO_OBRA', 'CREDITO_OBRA', 'Cash Me');

  const afterRows = await statusFilhos(client, cardId);
  const after = resumo(afterRows);
  console.log('DEPOIS:', after);
  return { cardId, before: resumo(before), after, created };
}

async function main() {
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
    const cardIds = resolverCardIds();
    console.log('Cards alvo:', cardIds);
    const results = [];
    for (const id of cardIds) {
      results.push(await processarCard(client, id));
    }
    if (!dryRun) await client.query('COMMIT');
    console.log('\n=== RESUMO ===');
    console.log(JSON.stringify(results, null, 2));
  } catch (e) {
    if (!dryRun) {
      try { await client.query('ROLLBACK'); } catch (_) {}
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
