const { Client } = require('pg')

const DBS = [
  { label: 'DEV',  connectionString: 'postgresql://postgres:Moni%2Fcasa%402204dev@db.bgaadvfucnrkpimaszjv.supabase.co:5432/postgres' },
  { label: 'PROD', connectionString: 'postgresql://postgres:Moni%2Fcasa%402204@db.aydryzoxqnwnbybvgiug.supabase.co:5432/postgres' },
]

async function run(label, connectionString) {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query(`ALTER TABLE public.kanban_card_comentarios ALTER COLUMN card_id DROP NOT NULL`)
    await client.query(`NOTIFY pgrst, 'reload schema'`)
    console.log(`[${label}] OK`)
  } catch (err) {
    console.error(`[${label}] ERR:`, err.message)
  } finally {
    await client.end()
  }
}

async function main() {
  for (const db of DBS) {
    await run(db.label, db.connectionString)
  }
}

main()
