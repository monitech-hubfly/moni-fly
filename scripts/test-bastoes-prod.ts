/**
 * Valida bastões automáticos em PROD usando `executarBastoes` (mesmo código da app).
 * Uso: npx tsx scripts/test-bastoes-prod.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { FASE_SLUGS, KANBAN_IDS } from '../src/lib/constants/kanban-ids';

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

if (process.env.SUPABASE_PROD_URL?.trim()) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_PROD_URL.trim();
}
if (process.env.SUPABASE_PROD_SERVICE_ROLE_KEY?.trim()) {
  const prodKey = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY.trim();
  process.env.SUPABASE_SERVICE_ROLE_KEY = prodKey;
  process.env.SUPABASE_DEV_SERVICE_ROLE_KEY = prodKey;
}

const FASE_IDS = {
  PORTFOLIO_PASSAGEM_WAYSER: '5f48a367-699b-4dc4-a310-377fc7d0ff88',
};

const BASTOES_ESPERADOS: Record<
  string,
  { kanbanId: string; faseSlug: string; kanbanNome: string }[]
> = {
  passagem_wayser: [
    {
      kanbanId: KANBAN_IDS.OPERACOES,
      faseSlug: 'planialtimetrico',
      kanbanNome: 'Funil Operações',
    },
  ],
  prod_publicado: [
    {
      kanbanId: KANBAN_IDS.HDM_MODELO_VIRTUAL,
      faseSlug: 'mv_recebimento',
      kanbanNome: 'Funil Modelo Virtual',
    },
  ],
  aprovacao_condominio: [
    {
      kanbanId: KANBAN_IDS.PROJETOS_LOCAIS,
      faseSlug: 'projetos_locais_briefing',
      kanbanNome: 'Funil Projetos Locais',
    },
  ],
  projeto_legal: [
    {
      kanbanId: KANBAN_IDS.PROJETO_LEGAL,
      faseSlug: FASE_SLUGS.PL_NOVA_DEMANDA,
      kanbanNome: 'Funil Projeto Legal',
    },
  ],
};

const TESTS = [
  {
    id: 1,
    label: 'passagem_wayser → Operações / planialtimetrico',
    kanbanId: KANBAN_IDS.PORTFOLIO,
    kanbanNome: 'Funil Portfólio',
    faseAnteriorSlug: 'step_7',
    faseGatilhoSlug: 'passagem_wayser',
    completarChecklistPassagemWayser: true,
  },
  {
    id: 2,
    label: 'prod_publicado → Modelo Virtual / mv_recebimento',
    kanbanId: KANBAN_IDS.HDM_PRODUTO,
    kanbanNome: 'Funil Produto',
    faseAnteriorSlug: null as string | null,
    faseGatilhoSlug: 'prod_publicado',
  },
  {
    id: 3,
    label: 'aprovacao_condominio → Projetos Locais / projetos_locais_briefing',
    kanbanId: KANBAN_IDS.OPERACOES,
    kanbanNome: 'Funil Operações',
    faseAnteriorSlug: 'planialtimetrico',
    faseGatilhoSlug: 'aprovacao_condominio',
  },
  {
    id: 4,
    label: `projeto_legal → Projeto Legal / ${FASE_SLUGS.PL_NOVA_DEMANDA}`,
    kanbanId: KANBAN_IDS.OPERACOES,
    kanbanNome: 'Funil Operações',
    faseAnteriorSlug: 'sondagem',
    faseGatilhoSlug: 'projeto_legal',
  },
];

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('Configure SUPABASE_PROD_URL e SUPABASE_PROD_SERVICE_ROLE_KEY em .env.local');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getFaseId(
  db: ReturnType<typeof admin>,
  kanbanId: string,
  slug: string,
) {
  const { data, error } = await db
    .from('kanban_fases')
    .select('id, nome, slug, ativo')
    .eq('kanban_id', kanbanId)
    .eq('slug', slug)
    .order('ativo', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error(`Fase "${slug}" não encontrada no kanban ${kanbanId}`);
  return data;
}

async function pickFranqueadoId(db: ReturnType<typeof admin>) {
  const { data, error } = await db
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'team'])
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error('Nenhum perfil admin/team');
  return data.id;
}

async function completarChecklistPassagemWayser(db: ReturnType<typeof admin>, cardId: string) {
  const { data: itens, error } = await db
    .from('kanban_fase_checklist_itens')
    .select('id')
    .eq('fase_id', FASE_IDS.PORTFOLIO_PASSAGEM_WAYSER)
    .eq('obrigatorio', true);
  if (error) throw new Error(error.message);
  for (const item of itens ?? []) {
    const { error: upErr } = await db.from('kanban_fase_checklist_respostas').upsert(
      { card_id: cardId, item_id: item.id, valor: 'true' },
      { onConflict: 'card_id,item_id' },
    );
    if (upErr) throw new Error(upErr.message);
  }
}

async function verificarFilho(
  db: ReturnType<typeof admin>,
  cardPaiId: string,
  kanbanDestinoId: string,
  faseSlugEsperada: string,
) {
  const { data: filho, error } = await db
    .from('kanban_cards')
    .select('id, titulo, origem_card_id, fase_id')
    .eq('origem_card_id', cardPaiId)
    .eq('kanban_id', kanbanDestinoId)
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };
  if (!filho?.id) return { ok: false, erro: 'Nenhum card filho' };

  const { data: fase } = await db
    .from('kanban_fases')
    .select('slug, nome, ativo')
    .eq('id', filho.fase_id)
    .maybeSingle();

  const origemOk = String(filho.origem_card_id) === String(cardPaiId);
  const slugOk = fase?.slug === faseSlugEsperada;

  return {
    ok: origemOk && slugOk,
    filhoId: filho.id,
    origem_card_id: filho.origem_card_id,
    faseSlug: fase?.slug ?? null,
    faseNome: fase?.nome ?? null,
    origemOk,
    slugOk,
  };
}

async function runTest(
  db: ReturnType<typeof admin>,
  test: (typeof TESTS)[number],
  franqueadoId: string,
  stamp: string,
  executarBastoes: (cardId: string, novaFaseSlug: string) => Promise<void>,
) {
  const titulo = `[TESTE BASTÃO ${test.id}] ${test.faseGatilhoSlug} — ${stamp}`;
  console.log(`\n━━━ Teste ${test.id}: ${test.label} ━━━`);

  let faseInicialSlug = test.faseAnteriorSlug;
  if (!faseInicialSlug) {
    const { data: fases } = await db
      .from('kanban_fases')
      .select('slug, ordem')
      .eq('kanban_id', test.kanbanId)
      .eq('ativo', true)
      .order('ordem', { ascending: true });
    const idx = (fases ?? []).findIndex((f) => f.slug === test.faseGatilhoSlug);
    if (idx < 0) {
      return { testId: test.id, ok: false, erro: `Gatilho ${test.faseGatilhoSlug} inexistente` };
    }
    faseInicialSlug = idx > 0 ? fases![idx - 1].slug : test.faseGatilhoSlug;
  }

  const faseInicial = await getFaseId(db, test.kanbanId, faseInicialSlug);
  const faseGatilho = await getFaseId(db, test.kanbanId, test.faseGatilhoSlug);

  const { data: card, error: insErr } = await db
    .from('kanban_cards')
    .insert({
      kanban_id: test.kanbanId,
      fase_id: faseInicial.id,
      titulo,
      franqueado_id: franqueadoId,
      status: 'ativo',
    })
    .select('id')
    .single();
  if (insErr) return { testId: test.id, ok: false, erro: insErr.message };

  const cardId = card.id;
  console.log(`  Card pai: ${cardId} (${test.kanbanNome}, ${faseInicial.slug} → ${faseGatilho.slug})`);

  if (test.completarChecklistPassagemWayser) {
    await completarChecklistPassagemWayser(db, cardId);
    console.log('  Checklist passagem_wayser: OK');
  }

  const { error: updErr } = await db
    .from('kanban_cards')
    .update({ fase_id: faseGatilho.id })
    .eq('id', cardId);
  if (updErr) return { testId: test.id, ok: false, erro: updErr.message };

  await executarBastoes(cardId, test.faseGatilhoSlug);
  console.log('  executarBastoes() chamado');

  const destinos = BASTOES_ESPERADOS[test.faseGatilhoSlug] ?? [];
  const verificacoes = [];
  for (const dest of destinos) {
    const v = await verificarFilho(db, cardId, dest.kanbanId, dest.faseSlug);
    verificacoes.push({ destino: dest, ...v });
    console.log(
      `  → ${dest.kanbanNome} / ${dest.faseSlug}: ${v.ok ? 'OK' : 'FALHOU'} (filho=${v.filhoId ?? '—'})`,
    );
  }

  return {
    testId: test.id,
    label: test.label,
    ok: verificacoes.length > 0 && verificacoes.every((v) => v.ok),
    cardPaiId: cardId,
    titulo,
    verificacoes,
  };
}

async function main() {
  const { executarBastoes } = await import('../src/lib/actions/kanban-bastoes');
  const db = admin();
  const franqueadoId = await pickFranqueadoId(db);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  console.log('Validação bastões PROD (executarBastoes real)');
  console.log(`Franqueado: ${franqueadoId}`);

  const results = [];
  for (const test of TESTS) {
    try {
      results.push(await runTest(db, test, franqueadoId, stamp, executarBastoes));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ testId: test.id, label: test.label, ok: false, erro: msg });
      console.error(`  ERRO: ${msg}`);
    }
  }

  console.log('\n════════ RESUMO ════════');
  for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} Teste ${r.testId}: ${r.label}`);
    if ('cardPaiId' in r && r.cardPaiId) console.log(`   Card pai: ${r.cardPaiId}`);
    if ('erro' in r && r.erro) console.log(`   Erro: ${r.erro}`);
  }

  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
