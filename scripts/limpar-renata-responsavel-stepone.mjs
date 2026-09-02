/**
 * Remove Renata Bendassi (renata.silva@moni.casa) do campo «Responsável do card»
 * (campo_slug = responsavel_fase) em todos os cards do Funil Step One.
 *
 * Uso:
 *   node --env-file=.env.local scripts/limpar-renata-responsavel-stepone.mjs --env=dev
 *   node --env-file=.env.local scripts/limpar-renata-responsavel-stepone.mjs --env=prod
 *   node --env-file=.env.local scripts/limpar-renata-responsavel-stepone.mjs --env=prod --apply
 */
import { createClient } from '@supabase/supabase-js';

const STEP_ONE = '4d89f111-cef6-48aa-93ff-72d6406f0a32';
const SLUGS = ['responsavel_fase', 'responsavel_da_fase_usuario'];

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const envArg = [...args].find((a) => a.startsWith('--env='))?.split('=')[1] || 'dev';

function clientFor(env) {
  if (env === 'prod') {
    const url = (process.env.SUPABASE_PROD_URL || '').trim();
    const key = (process.env.SUPABASE_PROD_SERVICE_ROLE_KEY || '').trim();
    if (!url || !key) throw new Error('Faltam SUPABASE_PROD_URL / SUPABASE_PROD_SERVICE_ROLE_KEY');
    if (!url.includes('aydryzoxqnwnbybvgiug')) {
      throw new Error(`URL PROD inesperada: ${url}`);
    }
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  const url = (process.env.SUPABASE_DEV_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (
    process.env.SUPABASE_DEV_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
  if (!url || !key) throw new Error('Faltam URL/service role DEV');
  if (!url.includes('bgaadvfucnrkpimaszjv')) {
    throw new Error(`URL DEV inesperada: ${url}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchAll(sb, table, select, filter) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(select).range(from, from + 999);
    q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

console.log(`Ambiente: ${envArg} | apply=${APPLY}`);
const sb = clientFor(envArg);

const { data: profiles, error: errP } = await sb
  .from('profiles')
  .select('id, full_name, email')
  .or('full_name.ilike.%bendassi%,email.eq.renata.silva@moni.casa');
if (errP) throw new Error(errP.message);

const renata =
  (profiles ?? []).find((p) => String(p.full_name ?? '').toLowerCase().includes('bendassi')) ||
  (profiles ?? []).find((p) => String(p.email ?? '').toLowerCase() === 'renata.silva@moni.casa');

if (!renata) {
  console.error('Profile Renata Bendassi / renata.silva@moni.casa não encontrado.');
  process.exit(1);
}
console.log(`Alvo: ${renata.full_name} <${renata.email}> ${renata.id}`);

const cards = await fetchAll(sb, 'kanban_cards', 'id, titulo, fase_id', (q) =>
  q.eq('kanban_id', STEP_ONE),
);
console.log(`Cards Step One: ${cards.length}`);
const cardIds = cards.map((c) => c.id);
if (!cardIds.length) {
  console.log('Nenhum card.');
  process.exit(0);
}

const { data: fases } = await sb.from('kanban_fases').select('id').eq('kanban_id', STEP_ONE);
const faseIds = (fases ?? []).map((f) => f.id);
const { data: itens } = await sb
  .from('kanban_fase_checklist_itens')
  .select('id, campo_slug, label, fase_id')
  .in('fase_id', faseIds)
  .in('campo_slug', SLUGS);
const itemIds = (itens ?? []).map((i) => i.id);
console.log(`Itens checklist alvo: ${itemIds.length}`);

const hits = [];
for (let i = 0; i < cardIds.length; i += 150) {
  const slice = cardIds.slice(i, i + 150);
  const { data, error } = await sb
    .from('kanban_fase_checklist_respostas')
    .select('id, card_id, item_id, valor')
    .in('card_id', slice)
    .in('item_id', itemIds)
    .eq('valor', renata.id);
  if (error) throw new Error(error.message);
  hits.push(...(data ?? []));
}

const bySlug = {};
for (const h of hits) {
  const slug = (itens ?? []).find((it) => it.id === h.item_id)?.campo_slug ?? '?';
  bySlug[slug] = (bySlug[slug] ?? 0) + 1;
}
const distinctCards = new Set(hits.map((h) => h.card_id));
console.log(`Hits: ${hits.length} respostas em ${distinctCards.size} cards`);
console.log('Por slug:', bySlug);
console.log(
  'Amostra títulos:',
  [...distinctCards]
    .slice(0, 15)
    .map((id) => cards.find((c) => c.id === id)?.titulo)
    .filter(Boolean),
);

if (!APPLY) {
  console.log('\nDry-run. Reexecute com --apply para limpar (valor/preenchido_em = null).');
  process.exit(0);
}

let ok = 0;
let fail = 0;
for (const h of hits) {
  const { error } = await sb
    .from('kanban_fase_checklist_respostas')
    .update({ valor: null, preenchido_em: null })
    .eq('id', h.id);
  if (error) {
    fail += 1;
    console.error(h.id, error.message);
  } else {
    ok += 1;
  }
}
console.log(`\nLimpeza concluída: ${ok} ok, ${fail} falhas.`);
