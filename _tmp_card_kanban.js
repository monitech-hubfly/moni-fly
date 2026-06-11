const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:Moni%2Fcasa%402204@db.aydryzoxqnwnbybvgiug.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

async function main() {
  await client.connect()
  const { rows } = await client.query(`
    SELECT kc.titulo, kc.kanban_id, k.nome as kanban_nome
    FROM kanban_cards kc
    JOIN kanbans k ON k.id = kc.kanban_id
    WHERE kc.id = 'eb288523-43d7-410b-be0c-0e0e4f56eff2'
  `)
  console.table(rows)
  await client.end()
}

main().catch(err => { console.error(err); process.exit(1) })
