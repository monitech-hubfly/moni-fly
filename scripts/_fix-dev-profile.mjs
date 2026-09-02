import pg from '../node_modules/pg/lib/index.js';

const DEV = 'postgresql://postgres:Moni%2Fcasa%402204dev@db.bgaadvfucnrkpimaszjv.supabase.co:5432/postgres';
const PROFILE_ID = '23003ec1-b64f-47cc-baed-62c4c58035cb';

export async function fixDevProfile(client) {
  const { rows } = await client.query(
    `SELECT id, email, role FROM profiles WHERE id = $1`,
    [PROFILE_ID]
  );

  if (rows.length > 0) {
    console.log(`  profile já existe: ${rows[0].email} (role=${rows[0].role})`);
  } else {
    console.log(`  profile não encontrado — criando...`);
  }

  await client.query(`
    INSERT INTO profiles (id, email, full_name, role, departamento, created_at)
    VALUES ($1, 'danilo.n@moni.casa', 'Danilo Nyitray', 'admin', 'Marketing', now())
    ON CONFLICT (id) DO UPDATE SET role = 'admin', email = 'danilo.n@moni.casa'
  `, [PROFILE_ID]);

  console.log(`  ✓ profile ${PROFILE_ID} garantido no DEV (admin / danilo.n@moni.casa)`);
}

// Execução standalone
const c = new pg.Client({ connectionString: DEV, ssl: { rejectUnauthorized: false } });
await c.connect();
console.log('Fix profile DEV:');
await fixDevProfile(c);
await c.end();
