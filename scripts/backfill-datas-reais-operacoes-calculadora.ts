/**
 * Alinha kanban_cards.condominio/prefeitura_aprovada_em com datas efetivas da Calculadora
 * (Funil Operações) — mesma regra do modal após fix de dataFimRealAprovacaoConcluida.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/backfill-datas-reais-operacoes-calculadora.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/backfill-datas-reais-operacoes-calculadora.ts --confirm-dev
 *   npx tsx --env-file=.env.local scripts/backfill-datas-reais-operacoes-calculadora.ts --confirm-prod
 *   npx tsx --env-file=.env.local scripts/backfill-datas-reais-operacoes-calculadora.ts --confirm-prod --card-id=UUID
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { parsePostgresUrl } from './pg-dev-client.mjs';
import { KANBAN_IDS } from '../src/lib/constants/kanban-ids';
import {
  CALCULADORA_ESTEIRA_KANBAN_IDS,
  calcularLinhasCalculadoraFasesEsteira,
} from '../src/lib/kanban/calculadora-fases-esteira';
import {
  extrairDatasAprovacaoPreObraDaCalculadora,
  aplicarEncadeamentoMarcoContratoNasLinhas,
  aplicarDatasManuaisCalculadoraLinhas,
  sincronizarEstimativasFuturasAPartirFaseAtual,
  aplicarOverlayAncoraOcultarFasesAnteriores,
  normalizarIntervaloDatasCalculadoraLinhas,
  type CalculadoraFaseDataManualOverride,
} from '../src/lib/kanban/calculadora-fases';
import { mapKanbanFaseRow } from '../src/lib/kanban/fetch-kanban-fases';
import { filterOperacoesCalculadoraFases } from '../src/lib/kanban/operacoes-fase-slugs';
import { filterStepOneCalculadoraFases } from '../src/lib/kanban/stepone-fase-slugs';
import { filterPortfolioCalculadoraFases } from '../src/lib/kanban/portfolio-fase-slugs';
import type { KanbanFase } from '../src/components/kanban-shared/types';

const KANBAN_OPERACOES = KANBAN_IDS.OPERACOES;

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
const confirmDev = process.argv.includes('--confirm-dev');
const confirmProd = process.argv.includes('--confirm-prod');
const cardIdArg = process.argv.find((a) => a.startsWith('--card-id='))?.split('=')[1]?.trim() || null;

function ymdFromTs(v: unknown): string | null {
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

function tsNoonUtc(ymd: string) {
  return `${ymd}T12:00:00.000Z`;
}

function filtrarFasesKanban(kanbanId: string, fases: KanbanFase[]): KanbanFase[] {
  if (kanbanId === KANBAN_IDS.STEP_ONE) return filterStepOneCalculadoraFases(fases);
  if (kanbanId === KANBAN_IDS.PORTFOLIO) return filterPortfolioCalculadoraFases(fases);
  if (kanbanId === KANBAN_IDS.OPERACOES) return filterOperacoesCalculadoraFases(fases);
  return fases;
}

async function carregarFasesMap(client: pg.Client): Promise<Map<string, KanbanFase[]>> {
  const map = new Map<string, KanbanFase[]>();
  const res = await client.query(
    `SELECT id, nome, ordem, sla_dias, sla_tipo, slug, instrucoes, materiais, fase_conversao, ativo, kanban_id
     FROM kanban_fases
     WHERE kanban_id = ANY($1::uuid[]) AND ativo = true
     ORDER BY kanban_id, ordem`,
    [CALCULADORA_ESTEIRA_KANBAN_IDS],
  );
  for (const row of res.rows) {
    const kid = String(row.kanban_id);
    const list = map.get(kid) ?? [];
    list.push(mapKanbanFaseRow(row as Record<string, unknown>));
    map.set(kid, list);
  }
  for (const kid of CALCULADORA_ESTEIRA_KANBAN_IDS) {
    map.set(kid, filtrarFasesKanban(kid, map.get(kid) ?? []));
  }
  return map;
}

async function carregarOverrides(
  client: pg.Client,
  cardId: string,
): Promise<Map<string, CalculadoraFaseDataManualOverride>> {
  const out = new Map<string, CalculadoraFaseDataManualOverride>();
  const res = await client.query(
    `SELECT fase_id, data_inicio, data_fim
     FROM kanban_calculadora_fase_datas
     WHERE card_id = $1::uuid`,
    [cardId],
  );
  for (const row of res.rows) {
    const faseId = String(row.fase_id ?? '').trim();
    if (!faseId) continue;
    out.set(faseId, {
      dataInicio: ymdFromTs(row.data_inicio),
      dataFim: ymdFromTs(row.data_fim),
    });
  }
  return out;
}

/** Espelha `calculadoraLinhasSemPreObra` do modal (sem overlay Pré Obra). */
function linhasCalculadoraSemPreObra(
  fasesMap: Map<string, KanbanFase[]>,
  card: {
    kanban_id: string;
    fase_id: string;
    fase_slug: string;
    created_at: string;
    entered_fase_at: string | null;
    concluido: boolean | null;
    concluido_em: string | null;
  },
  overrides: Map<string, CalculadoraFaseDataManualOverride>,
) {
  const cardCalc = {
    fase_id: card.fase_id,
    created_at: card.created_at,
    entered_fase_at: card.entered_fase_at,
    concluido: card.concluido,
    concluido_em: card.concluido_em,
  };

  const base = calcularLinhasCalculadoraFasesEsteira({
    fasesPorKanban: fasesMap,
    cardKanbanId: card.kanban_id,
    cardFaseSlug: card.fase_slug,
    card: cardCalc,
    visits: [],
    overrides,
  });

  const fasesFlat: KanbanFase[] = [];
  for (const kid of CALCULADORA_ESTEIRA_KANBAN_IDS) {
    fasesFlat.push(...(fasesMap.get(kid) ?? []));
  }

  const encadeadas = aplicarEncadeamentoMarcoContratoNasLinhas(
    base,
    fasesFlat,
    { contrato_assinado_em: null },
    cardCalc,
    [],
    undefined,
    overrides,
  );
  const comOverrides =
    overrides.size > 0
      ? aplicarDatasManuaisCalculadoraLinhas(encadeadas, overrides, cardCalc)
      : encadeadas;
  const sincronizadas = sincronizarEstimativasFuturasAPartirFaseAtual(
    comOverrides,
    cardCalc,
    undefined,
    overrides,
  );
  const comOverridesFinais =
    overrides.size > 0
      ? aplicarDatasManuaisCalculadoraLinhas(sincronizadas, overrides, cardCalc)
      : sincronizadas;
  const comOverlay = aplicarOverlayAncoraOcultarFasesAnteriores(comOverridesFinais, null);
  const comOverridesPosOverlay =
    overrides.size > 0
      ? aplicarDatasManuaisCalculadoraLinhas(comOverlay, overrides, cardCalc)
      : comOverlay;
  return normalizarIntervaloDatasCalculadoraLinhas(comOverridesPosOverlay, cardCalc);
}

async function main() {
  if (!dryRun && !confirmDev && !confirmProd) {
    console.error('Use --dry-run, --confirm-dev ou --confirm-prod');
    process.exit(1);
  }

  const envKey = confirmProd ? 'PROD_DB_URL' : 'DEV_DB_URL';
  const url = process.env[envKey];
  if (!url) throw new Error(`${envKey} ausente`);

  const cfg = parsePostgresUrl(url);
  const hostEsperado = confirmProd ? 'aydryzoxqnwnbybvgiug' : 'bgaadvfucnrkpimaszjv';
  if (!String(cfg.host).includes(hostEsperado)) {
    throw new Error(`Host inesperado para ${confirmProd ? 'PROD' : 'DEV'}: ${cfg.host}`);
  }

  const client = new pg.Client({ ...cfg, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const fasesMap = await carregarFasesMap(client);

    const cardsRes = await client.query(
      `SELECT c.id, c.titulo, c.kanban_id, c.fase_id, c.created_at, c.entered_fase_at,
              c.concluido, c.concluido_em, c.condominio_aprovada_em, c.prefeitura_aprovada_em,
              f.slug AS fase_slug
       FROM kanban_cards c
       JOIN kanban_fases f ON f.id = c.fase_id
       WHERE c.kanban_id = $1
         AND c.status = 'ativo'
         AND COALESCE(c.arquivado, false) = false
         ${cardIdArg ? 'AND c.id = $2::uuid' : ''}
       ORDER BY c.titulo`,
      cardIdArg ? [KANBAN_OPERACOES, cardIdArg] : [KANBAN_OPERACOES],
    );

    let corrigidos = 0;
    const detalhes: Array<Record<string, unknown>> = [];

    for (const card of cardsRes.rows) {
      const overrides = await carregarOverrides(client, card.id);
      const linhas = linhasCalculadoraSemPreObra(fasesMap, card, overrides);

      const daCalc = extrairDatasAprovacaoPreObraDaCalculadora(linhas);
      const patch: Record<string, string> = {};

      if (daCalc.dataAprovacaoCondominio) {
        const atual = ymdFromTs(card.condominio_aprovada_em) ?? '';
        if (atual !== daCalc.dataAprovacaoCondominio) {
          patch.condominio_aprovada_em = daCalc.dataAprovacaoCondominio;
        }
      }
      if (daCalc.dataAprovacaoPrefeitura) {
        const atual = ymdFromTs(card.prefeitura_aprovada_em) ?? '';
        if (atual !== daCalc.dataAprovacaoPrefeitura) {
          patch.prefeitura_aprovada_em = daCalc.dataAprovacaoPrefeitura;
        }
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
        calc: daCalc,
      });

      if (!dryRun) {
        const sets: string[] = [];
        const vals: unknown[] = [card.id];
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
        await client.query(`UPDATE kanban_cards SET ${sets.join(', ')} WHERE id = $1`, vals);
      }
      corrigidos += 1;
    }

    const modo = dryRun ? 'DRY-RUN' : confirmProd ? 'PROD' : 'DEV';
    console.log(`\nModo: ${modo}`);
    console.log(`Cards analisados: ${cardsRes.rows.length}`);
    console.log(`Cards ${dryRun ? 'a corrigir' : 'corrigidos'}: ${corrigidos}`);
    if (detalhes.length) {
      console.log('\nDetalhes:');
      for (const d of detalhes) {
        console.log(`- ${d.titulo} (${d.id})`);
        console.log(`  calc: ${JSON.stringify(d.calc)}`);
        console.log(
          `  antes: condo=${(d.antes as { condominio: string | null }).condominio ?? '∅'} pref=${(d.antes as { prefeitura: string | null }).prefeitura ?? '∅'}`,
        );
        console.log(
          `  depois: condo=${(d.depois as { condominio: string | null }).condominio ?? '∅'} pref=${(d.depois as { prefeitura: string | null }).prefeitura ?? '∅'}`,
        );
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
