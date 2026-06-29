import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: 'db.bgaadvfucnrkpimaszjv.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Moni/casa@2204dev',
  ssl: { rejectUnauthorized: false },
});

const CHECKS = [
  {
    table: 'sirene_topicos',
    cols: ['arquivado', 'responsavel_id', 'prioridade', 'data_fim', 'prazo_proposto'],
  },
  {
    table: 'gantt_planejamento',
    cols: ['profile_id', 'semana_ano_fim', 'hora_inicio', 'hora_fim'],
  },
  {
    table: 'periodos',
    cols: ['ano', 'semana_inicio', 'semana_fim'],
  },
];

await client.connect();

let totalFaltando = 0;

for (const { table, cols } of CHECKS) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
       AND column_name = ANY($2::text[])
     ORDER BY column_name`,
    [table, cols],
  );

  const encontradas = new Set(rows.map(r => r.column_name));
  const faltando    = cols.filter(c => !encontradas.has(c));

  console.log(`\n${'─'.repeat(52)}`);
  console.log(` ${table}`);
  console.log('─'.repeat(52));
  for (const c of cols) {
    const ok = encontradas.has(c);
    console.log(`  ${ok ? '✓' : '✗'} ${c}`);
  }
  if (faltando.length === 0) {
    console.log('  → Todas as colunas existem.');
  } else {
    console.log(`\n  FALTANDO: ${faltando.join(', ')}`);
    totalFaltando += faltando.length;
  }
}

console.log(`\n${'='.repeat(52)}`);
console.log(totalFaltando === 0
  ? ' Resultado: todas as colunas verificadas existem.'
  : ` Resultado: ${totalFaltando} coluna(s) ausente(s) — ver acima.`);

await client.end();
