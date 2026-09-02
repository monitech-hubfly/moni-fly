/**
 * PROD — garante vínculos do card Pré Obra FK0002 Villa Jardim
 * (eb288523-43d7-410b-be0c-0e0e4f56eff2) com:
 *   - Funil Acoplamento (já existe)
 *   - Funil Cash Me (já existe)
 *   - Funil Projeto Legal (religa card existente do stub FK0002)
 *   - Funil Projetos Locais (cria filho se ausente)
 *
 * Uso:
 *   node --env-file=.env.local scripts/garantir-vinculos-villa-jardim-preobra.mjs --dry-run
 *   node --env-file=.env.local scripts/garantir-vinculos-villa-jardim-preobra.mjs --confirm-prod
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { parsePostgresUrl } from './pg-dev-client.mjs';

const CARD_ID = 'eb288523-43d7-410b-be0c-0e0e4f56eff2';
const STUB_OPS_ID = '321fa6d8-9cec-4882-a0fa-4f30837c03fe';
const PL_CARD_ID = 'b1f22328-1f8b-4d27-b530-e09b952f71a5';

const KANBAN = {
  ACOPLAMENTO: '15847602-231d-4937-a06f-82027eb87ef3',
  PROJETOS_LOCAIS: 'c2ab09bd-4bd6-491e-8734-281d7678a6ad',
  PROJETO_LEGAL: '39de341d-aebf-481c-9118-ce6fc6574187',
  CREDITO_OBRA: '6463af1d-850d-4958-b74c-404f8d668e21',
};

const PLOC_FASE_SLUG = 'pl_000_novo_projeto';

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

async function statusVinculos(client) {
  const filhos = await client.query(
    `SELECT c.id, k.nome AS kanban, f.slug AS fase, c.arquivado, c.origem_card_id, c.titulo
     FROM kanban_cards c
     JOIN kanbans k ON k.id = c.kanban_id
     LEFT JOIN kanban_fases f ON f.id = c.fase_id
     WHERE c.origem_card_id = $1
       AND c.kanban_id = ANY($2::uuid[])
     ORDER BY k.nome`,
    [CARD_ID, Object.values(KANBAN)],
  );
  const vins = await client.query(
    `SELECT v.id, v.tipo_vinculo, ko.nome AS origem, kd.nome AS destino,
            v.card_origem_id, v.card_destino_id
     FROM kanban_card_vinculos v
     LEFT JOIN kanban_cards co ON co.id = v.card_origem_id
     LEFT JOIN kanban_cards cd ON cd.id = v.card_destino_id
     LEFT JOIN kanbans ko ON ko.id = co.kanban_id
     LEFT JOIN kanbans kd ON kd.id = cd.kanban_id
     WHERE v.card_origem_id = $1 OR v.card_destino_id = $1`,
    [CARD_ID],
  );
  return { filhos: filhos.rows, vins: vins.rows };
}

function summarize(rows) {
  const by = {
    Acoplamento: false,
    'Projetos Locais': false,
    'Projeto Legal': false,
    'Cash Me': false,
  };
  for (const r of rows) {
    const n = String(r.kanban ?? '');
    if (n.includes('Acoplamento')) by.Acoplamento = true;
    if (n.includes('Projetos Locais')) by['Projetos Locais'] = true;
    if (n.includes('Projeto Legal')) by['Projeto Legal'] = true;
    if (n.includes('Cash Me') || n.includes('Crédito Obra')) by['Cash Me'] = true;
  }
  return by;
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
    const pai = await client.query(
      `SELECT id, titulo, franqueado_id, rede_franqueado_id, nome_condominio, quadra, lote, condominio_id
       FROM kanban_cards WHERE id = $1`,
      [CARD_ID],
    );
    if (!pai.rows[0]) throw new Error('Card pai não encontrado');
    const p = pai.rows[0];
    console.log('Pai:', p.titulo, p.id);

    const before = await statusVinculos(client);
    console.log('\n=== ANTES (filhos origem_card_id) ===');
    console.log(JSON.stringify(before.filhos, null, 2));
    console.log('Resumo filhos:', summarize(before.filhos));
    console.log('Vínculos:', before.vins.length);

    if (dryRun) {
      console.log('\n[dry-run] Nenhuma mutação. Planejado:');
      console.log('- Religar Projeto Legal', PL_CARD_ID, '→ origem', CARD_ID);
      console.log('- Criar Projetos Locais se ausente');
      return;
    }

    await client.query('BEGIN');

    // 1) Religar Projeto Legal existente ao card Villa Jardim
    const pl = await client.query(
      `SELECT id, origem_card_id, titulo FROM kanban_cards WHERE id = $1 FOR UPDATE`,
      [PL_CARD_ID],
    );
    if (!pl.rows[0]) throw new Error('Card Projeto Legal não encontrado');
    console.log('\nPL atual:', pl.rows[0]);

    await client.query(
      `UPDATE kanban_cards
       SET origem_card_id = $1,
           titulo = $2,
           rede_franqueado_id = COALESCE(rede_franqueado_id, $3),
           nome_condominio = COALESCE(nome_condominio, $4),
           quadra = COALESCE(quadra, $5),
           lote = COALESCE(lote, $6),
           condominio_id = COALESCE(condominio_id, $7),
           updated_at = now()
       WHERE id = $8`,
      [
        CARD_ID,
        p.titulo,
        p.rede_franqueado_id,
        p.nome_condominio,
        p.quadra,
        p.lote,
        p.condominio_id,
        PL_CARD_ID,
      ],
    );

    // Atualiza vínculo stub→PL para pai→PL (ou cria se faltar)
    const vincPl = await client.query(
      `SELECT id, card_origem_id, card_destino_id
       FROM kanban_card_vinculos
       WHERE card_destino_id = $1 OR vinculado_a = $1
       ORDER BY created_at
       FOR UPDATE`,
      [PL_CARD_ID],
    );
    if (vincPl.rows.length > 0) {
      for (const v of vincPl.rows) {
        await client.query(
          `UPDATE kanban_card_vinculos
           SET card_origem_id = $1,
               card_id = $1,
               card_destino_id = $2,
               vinculado_a = $2,
               tipo_vinculo = COALESCE(tipo_vinculo, 'originou')
           WHERE id = $3`,
          [CARD_ID, PL_CARD_ID, v.id],
        );
      }
      console.log('Vínculos PL atualizados:', vincPl.rows.length);
    } else {
      await client.query(
        `INSERT INTO kanban_card_vinculos
           (card_origem_id, card_destino_id, card_id, vinculado_a, tipo_vinculo, criado_por)
         VALUES ($1, $2, $1, $2, 'originou', $3)`,
        [CARD_ID, PL_CARD_ID, p.franqueado_id],
      );
      console.log('Vínculo PL criado');
    }

    // Remove vínculo residual do stub se ainda apontar para PL com origem errada (já atualizado)
    // Garante que stub não fique como origem do PL
    const stubStill = await client.query(
      `SELECT id FROM kanban_cards WHERE id = $1 AND origem_card_id = $2`,
      [PL_CARD_ID, STUB_OPS_ID],
    );
    if (stubStill.rows.length > 0) {
      throw new Error('Falha ao religar PL: origem ainda é o stub');
    }

    // 2) Projetos Locais — cria se não houver filho ativo
    const plocExist = await client.query(
      `SELECT id, arquivado FROM kanban_cards
       WHERE origem_card_id = $1 AND kanban_id = $2
       ORDER BY arquivado ASC, created_at DESC`,
      [CARD_ID, KANBAN.PROJETOS_LOCAIS],
    );

    let plocId = plocExist.rows.find((r) => !r.arquivado)?.id ?? null;
    if (!plocId && plocExist.rows[0]) {
      plocId = plocExist.rows[0].id;
      const fase = await client.query(
        `SELECT id FROM kanban_fases
         WHERE kanban_id = $1 AND slug = $2 AND ativo = true
         ORDER BY ordem LIMIT 1`,
        [KANBAN.PROJETOS_LOCAIS, PLOC_FASE_SLUG],
      );
      if (!fase.rows[0]) throw new Error('Fase Projetos Locais não encontrada');
      await client.query(
        `UPDATE kanban_cards
         SET arquivado = false, arquivado_em = null, arquivado_por = null,
             motivo_arquivamento = null, status = 'ativo',
             fase_id = $1, titulo = $2, franqueado_id = $3,
             rede_franqueado_id = $4, nome_condominio = $5, quadra = $6, lote = $7,
             condominio_id = $8, updated_at = now()
         WHERE id = $9`,
        [
          fase.rows[0].id,
          p.titulo,
          p.franqueado_id,
          p.rede_franqueado_id,
          p.nome_condominio,
          p.quadra,
          p.lote,
          p.condominio_id,
          plocId,
        ],
      );
      console.log('Projetos Locais reativado:', plocId);
    } else if (!plocId) {
      const fase = await client.query(
        `SELECT id FROM kanban_fases
         WHERE kanban_id = $1 AND slug = $2 AND ativo = true
         ORDER BY ordem LIMIT 1`,
        [KANBAN.PROJETOS_LOCAIS, PLOC_FASE_SLUG],
      );
      if (!fase.rows[0]) throw new Error('Fase Projetos Locais não encontrada');
      const ins = await client.query(
        `INSERT INTO kanban_cards (
           kanban_id, fase_id, titulo, origem_card_id, franqueado_id,
           rede_franqueado_id, nome_condominio, quadra, lote, condominio_id, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ativo')
         RETURNING id`,
        [
          KANBAN.PROJETOS_LOCAIS,
          fase.rows[0].id,
          p.titulo,
          CARD_ID,
          p.franqueado_id,
          p.rede_franqueado_id,
          p.nome_condominio,
          p.quadra,
          p.lote,
          p.condominio_id,
        ],
      );
      plocId = ins.rows[0].id;
      console.log('Projetos Locais criado:', plocId);
    } else {
      console.log('Projetos Locais já existia:', plocId);
    }

    const vincPloc = await client.query(
      `SELECT id FROM kanban_card_vinculos
       WHERE (card_origem_id = $1 AND card_destino_id = $2)
          OR (card_origem_id = $2 AND card_destino_id = $1)
       LIMIT 1`,
      [CARD_ID, plocId],
    );
    if (vincPloc.rows.length === 0) {
      await client.query(
        `INSERT INTO kanban_card_vinculos
           (card_origem_id, card_destino_id, card_id, vinculado_a, tipo_vinculo, criado_por)
         VALUES ($1, $2, $1, $2, 'originou', $3)`,
        [CARD_ID, plocId, p.franqueado_id],
      );
      console.log('Vínculo Projetos Locais criado');
    }

    await client.query('COMMIT');

    const after = await statusVinculos(client);
    console.log('\n=== DEPOIS (filhos origem_card_id) ===');
    console.log(JSON.stringify(after.filhos, null, 2));
    console.log('Resumo filhos:', summarize(after.filhos));
    console.log('Vínculos:', after.vins.length);
    for (const v of after.vins) {
      console.log(`  ${v.origem} → ${v.destino} (${v.tipo_vinculo})`);
    }
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
