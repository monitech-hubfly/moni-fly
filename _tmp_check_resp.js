const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:Moni%2Fcasa%402204@db.aydryzoxqnwnbybvgiug.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

async function main() {
  await client.connect()
  const { rows } = await client.query(`
    SELECT ka.id, ka.titulo, ka.origem, sc.abertura_responsavel_nome, sc.numero
    FROM kanban_atividades ka
    LEFT JOIN sirene_chamados sc ON sc.id = ka.sirene_chamado_id
    WHERE ka.id = '5d12cdf6-9052-455c-a0d8-f4319ad9376a'
  `)
  console.table(rows)
  await client.end()
}

main().catch(err => { console.error(err); process.exit(1) })
