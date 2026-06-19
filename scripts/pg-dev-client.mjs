import pg from 'pg';

/** Remove delimitadores [senha] ou <senha> usados no .env.local por conter @ ou /. */
export function normalizePostgresPassword(rawPassword) {
  const decoded = decodeURIComponent(String(rawPassword ?? ''));
  if (decoded.length >= 2) {
    if (decoded.startsWith('[') && decoded.endsWith(']')) {
      return decoded.slice(1, -1);
    }
    if (decoded.startsWith('<') && decoded.endsWith('>')) {
      return decoded.slice(1, -1);
    }
  }
  return decoded;
}

/** Parse DEV_DB_URL / PROD_DB_URL com password entre colchetes. */
export function parsePostgresUrl(rawUrl) {
  const raw = String(rawUrl ?? '').trim().replace(/^["']|["']$/g, '');
  const pgUrlMatch = raw.match(
    /^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:\/?#]+)(?::(\d+))?\/([^?#]+)/i,
  );
  if (pgUrlMatch) {
    const [, user, password, host, port = '5432', database] = pgUrlMatch;
    return {
      user: decodeURIComponent(user),
      password: normalizePostgresPassword(password),
      host,
      port: Number(port),
      database: decodeURIComponent(database),
    };
  }
  const u = new URL(raw.replace(/^postgresql:/i, 'http:'));
  return {
    user: decodeURIComponent(u.username || 'postgres'),
    password: normalizePostgresPassword(u.password || ''),
    host: u.hostname,
    port: Number(u.port || 5432),
    database: (u.pathname || '/postgres').replace(/^\//, '') || 'postgres',
  };
}

export async function connectDevPg(envKey = 'DEV_DB_URL') {
  const cfg = parsePostgresUrl(process.env[envKey]);
  const client = new pg.Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}
