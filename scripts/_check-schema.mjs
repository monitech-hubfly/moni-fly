import pg from '../node_modules/pg/lib/index.js';

const PROD = 'postgresql://postgres:Moni%2Fcasa%402204@db.aydryzoxqnwnbybvgiug.supabase.co:5432/postgres';
const c = new pg.Client({ connectionString: PROD, ssl: { rejectUnauthorized: false } });
await c.connect();

// Estrutura da tabela
const cols = await c.query(
  `SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema='supabase_migrations' AND table_name='schema_migrations'
   ORDER BY ordinal_position`
);
console.log('=== Colunas de schema_migrations ===');
cols.rows.forEach(r => console.log(r.column_name, '-', r.data_type));

// Amostra de 1 migration com timestamp para ver se tem SQL
const sample = await c.query(
  `SELECT version, statements IS NOT NULL as has_statements, array_length(statements,1) as stmt_count
   FROM supabase_migrations.schema_migrations
   WHERE version LIKE '2026%'
   ORDER BY version LIMIT 3`
);
console.log('\n=== Amostra (3 migrations timestamp) ===');
sample.rows.forEach(r => console.log(JSON.stringify(r)));

await c.end();
