/**
 * PROD — alinha Datas reais (kanban_cards) com fim de fase concluída na Calculadora
 * para cards do Funil Operações.
 *
 * Fonte autoritativa (mesma regra do modal):
 * - kanban_calculadora_fase_datas.data_fim quando a fase já foi superada (ordem atual > ordem fase)
 * - fallback: saída da fase via kanban_historico (fase_avancada / fase_retrocedida com from_slug)
 *
 * Uso:
 *   node --env-file=.env.local scripts/backfill-datas-reais-operacoes-calculadora.mjs --dry-run
 *   node --env-file=.env.local scripts/backfill-datas-reais-operacoes-calculadora.mjs --confirm-prod
 *   node --env-file=.env.local scripts/backfill-datas-reais-operacoes-calculadora.mjs --confirm-prod --card-id=UUID
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { parsePostgresUrl } from './pg-dev-client.mjs';

const KANBAN_OPERACOES = 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636';
const SLUGS = ['aprovacao_condominio', 'aprovacao_prefeitura'];

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
const cardIdArg = process.argv.find((a) => a.startsWith('--card-id='))?.split('=')[1]?.trim() || null;

function ymdFromTs(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function tsNoonUtc(ymd) {
  return `${ymd}T12:00:00.000Z`;
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
    const cardsRes = await client.query(
      `SELECT c.id, c.titulo, c.fase_id, c.condominio_aprovada_em, c.prefeitura_aprovada_em,
              fa.ordem AS ordem_atual
       FROM kanban_cards c
       JOIN kanban_fases fa ON fa.id = c.fase_id
       WHERE c.kanban_id = $1
         AND c.status = 'ativo'
         AND COALESCE(c.arquivado, false) = false
         ${cardIdArg ? 'AND c.id = $2::uuid' : ''}
       ORDER BY c.titulo`,
      cardIdArg ? [KANBAN_OPERACOES, cardIdArg] : [KANBAN_OPERACOES],
    );

    const fasesRes = await client.query(
      `SELECT id, slug, ordem FROM kanban_fases
       WHERE kanban_id = $1 AND slug = ANY($2::text[]) AND ativo = true`,
      [KANBAN_OPERACOES, SLUGS],
    );
    const fasePorSlug = new Map(fasesRes.rows.map((r) => [r.slug, r]));

    let corrigidos = 0;
    const detalhes = [];

    for (const card of cardsRes.rows) {
      const targets = {};

      for (const slug of SLUGS) {
        const fase = fasePorSlug.get(slug);
        if (!fase) continue;
        if (Number(card.ordem_atual) <= Number(fase.ordem)) continue;

        const ov = await client.query(
          `SELECT data_fim::date AS data_fim
           FROM kanban_calculadora_fase_datas
           WHERE card_id = $1 AND fase_id = $2 AND data_fim IS NOT NULL
           LIMIT 1`,
          [card.id, fase.id],
        );
        let ymd = ymdFromTs(ov.rows[0]?.data_fim);

        if (!ymd) {
          const hist = await client.query(
            `SELECT criado_em::date AS saiu
             FROM kanban_historico
             WHERE card_id = $1
               AND acao IN ('fase_avancada', 'fase_retrocedida')
               AND (detalhe->>'from_slug') = $2
             ORDER BY criado_em DESC
             LIMIT 1`,
            [card.id, slug],
          );
          ymd = ymdFromTs(hist.rows[0]?.saiu);
        }

        if (!ymd) continue;
        targets[slug] = ymd;
      }

      const campoMap = {
        aprovacao_condominio: 'condominio_aprovada_em',
        aprovacao_prefeitura: 'prefeitura_aprovada_em',
      };

      const patch = {};
      for (const [slug, ymd] of Object.entries(targets)) {
        const col = campoMap[slug];
        const atual = ymdFromTs(card[col]);
        if (atual !== ymd) patch[col] = ymd;
      }

      if (Object.keys(patch).length === 0) continue;

      detalhes.push({
        id: card.id,
        titulo: card.titulo,
        antes: {
          condominio: ymdFromTs(card.condominio_aprovada_em),
          prefeitura: ymdFromTs(card.prefeitura_aprovada_em),
        },
        depois: {
          condominio: patch.condominio_aprovada_em ?? ymdFromTs(card.condominio_aprovada_em),
          prefeitura: patch.prefeitura_aprovada_em ?? ymdFromTs(card.prefeitura_aprovada_em),
        },
        patch,
      });

      if (!dryRun) {
        const sets = [];
        const vals = [card.id];
        let i = 2;
        if (patch.condominio_aprovada_em) {
          sets.push(`condominio_aprovada_em = $${i++}::timestamptz`);
          vals.push(tsNoonUtc(patch.condominio_aprovada_em));
        }
        if (patch.prefeitura_aprovada_em) {
          sets.push(`prefeitura_aprovada_em = $${i++}::timestamptz`);
          vals.push(tsNoonUtc(patch.prefeitura_aprovada_em));
          sets.push('prefeitura_aprovada = true');
        }
        sets.push('updated_at = now()');
        await client.query(
          `UPDATE kanban_cards SET ${sets.join(', ')} WHERE id = $1`,
          vals,
        );
      }
      corrigidos += 1;
    }

    console.log(`\nModo: ${dryRun ? 'DRY-RUN' : 'PROD'}`);
    console.log(`Cards analisados: ${cardsRes.rows.length}`);
    console.log(`Cards ${dryRun ? 'a corrigir' : 'corrigidos'}: ${corrigidos}`);
    if (detalhes.length) {
      console.log('\nDetalhes:');
      for (const d of detalhes) {
        console.log(`- ${d.titulo} (${d.id})`);
        console.log(`  antes: condo=${d.antes.condominio ?? '∅'} pref=${d.antes.prefeitura ?? '∅'}`);
        console.log(`  depois: condo=${d.depois.condominio ?? '∅'} pref=${d.depois.prefeitura ?? '∅'}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
