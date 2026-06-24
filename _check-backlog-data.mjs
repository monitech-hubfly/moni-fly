import pg from 'pg';
const client = new pg.Client({
  host: 'db.bgaadvfucnrkpimaszjv.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: 'Moni/casa@2204dev', ssl: { rejectUnauthorized: false },
});
await client.connect();

const q1 = await client.query(
  `SELECT COUNT(*) AS total FROM sirene_topicos WHERE arquivado = false AND status IN ('nao_iniciado','em_andamento')`
);
console.log(`\nTópicos abertos (não arquivados): ${q1.rows[0].total}`);

const q2 = await client.query(
  `SELECT COUNT(*) AS com_responsavel FROM sirene_topicos WHERE responsavel_id IS NOT NULL`
);
console.log(`Tópicos com responsavel_id preenchido: ${q2.rows[0].com_responsavel}`);

const q3 = await client.query(
  `SELECT DISTINCT responsavel_id FROM sirene_topicos WHERE arquivado = false LIMIT 5`
);
console.log(`\nresponsavel_id distintos (até 5):`);
if (q3.rows.length === 0) {
  console.log('  (nenhum)');
} else {
  q3.rows.forEach(r => console.log(`  ${r.responsavel_id}`));
}

const q4 = await client.query(
  `SELECT id, email FROM auth.users ORDER BY created_at LIMIT 5`
);
console.log(`\nUsuários em auth.users (até 5):`);
q4.rows.forEach(r => console.log(`  ${r.id}  ${r.email}`));

await client.end();
