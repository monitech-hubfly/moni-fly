/**
 * Verifica colunas/policies críticas no DEV vs expectativa PROD.
 * Uso: node --env-file=.env.local scripts/check-dev-schema-paridade.mjs
 */
import { connectDevPg } from './pg-dev-client.mjs';

if (!process.env.DEV_DB_URL?.trim()) {
  console.error('DEV_DB_URL não definida em .env.local');
  process.exit(1);
}

const CHECKS = [
  { table: 'kanban_cards', column: 'processo_step_one_id' },
  { table: 'kanban_cards', column: 'hora_reuniao' },
  { table: 'kanban_cards', column: 'ordem_coluna' },
  { table: 'kanban_cards', column: 'rede_franqueado_id' },
  { table: 'kanban_fase_checklist_itens', column: 'campo_slug' },
  { table: 'kanban_fase_checklist_itens', column: 'config_json' },
];

const client = await connectDevPg();

console.log('=== Paridade DEV — colunas críticas ===\n');
let missing = 0;

for (const { table, column } of CHECKS) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  const ok = (r.rowCount ?? 0) > 0;
  console.log(`${ok ? 'OK' : 'FALTA'}  ${table}.${column}`);
  if (!ok) missing += 1;
}

const mapa = await client.query(
  `SELECT COUNT(*)::int AS n
   FROM public.kanban_fase_checklist_itens i
   JOIN public.kanban_fases f ON f.id = i.fase_id
   JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
   WHERE f.slug IN ('mapa_competidores', 'stepone_mapa')
     AND i.tipo = 'listagem_casas_zap'`,
);
const mapaOk = (mapa.rows[0]?.n ?? 0) > 0;
console.log(`${mapaOk ? 'OK' : 'FALTA'}  checklist mapa_competidores.listagem_casas_zap`);
if (!mapaOk) missing += 1;

const selectPol = await client.query(
  `SELECT 1 FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'kanban_cards' AND policyname = 'kanban_cards_select'`,
);
const polOk = (selectPol.rowCount ?? 0) > 0;
console.log(`${polOk ? 'OK' : 'FALTA'}  RLS kanban_cards_select (staff)`);
if (!polOk) missing += 1;

const listingsGrant = await client.query(
  `SELECT has_table_privilege('service_role', 'public.listings_casas', 'SELECT') AS ok`,
);
const listingsOk = listingsGrant.rows[0]?.ok === true;
console.log(`${listingsOk ? 'OK' : 'FALTA'}  GRANT service_role ON listings_casas`);
if (!listingsOk) missing += 1;

const listingsPol = await client.query(
  `SELECT 1 FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'listings_casas' AND policyname = 'Staff listings_casas'`,
);
const listingsPolOk = (listingsPol.rowCount ?? 0) > 0;
console.log(`${listingsPolOk ? 'OK' : 'FALTA'}  RLS Staff listings_casas`);
if (!listingsPolOk) missing += 1;

console.log(`\n${missing === 0 ? 'DEV alinhado com PROD (checks críticos).' : `${missing} item(ns) pendente(s). Rode: npm run db:sync-dev`}`);

await client.end();
process.exit(missing > 0 ? 1 : 0);
