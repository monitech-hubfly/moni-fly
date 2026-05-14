/**
 * Executa um ficheiro .sql remoto usando psql + PGPASSWORD (evita URL com [ ] na password).
 * Uso: node --env-file=.env.local scripts/run-sql-seed.mjs DEV|PROD caminho/para/ficheiro.sql
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");

const [, , envName, relSql] = process.argv;
if (!envName || !relSql) {
  console.error("Uso: node --env-file=.env.local scripts/run-sql-seed.mjs DEV|PROD supabase/seed/arquivo.sql");
  process.exit(1);
}

const key = envName.toUpperCase() === "PROD" ? "PROD_DB_URL" : "DEV_DB_URL";
const raw = (process.env[key] || "").trim().replace(/^["']|["']$/g, "");
if (!raw) {
  console.error(`Variável ${key} não definida.`);
  process.exit(1);
}

let user;
let password;
let host;
let port;
let database = "postgres";

const pgUrlMatch = raw.match(
  /^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:\/?#]+)(?::(\d+))?\/([^?#]+)/i,
);
if (pgUrlMatch) {
  [, user, password, host, port = "5432", database] = pgUrlMatch;
  user = decodeURIComponent(user);
  password = decodeURIComponent(password);
  database = decodeURIComponent(database);
} else {
  try {
    const u = new URL(raw.replace(/^postgresql:/i, "http:"));
    user = decodeURIComponent(u.username || "postgres");
    password = decodeURIComponent(u.password || "");
    host = u.hostname;
    port = u.port || "5432";
    database = (u.pathname || "/postgres").replace(/^\//, "") || "postgres";
  } catch {
    console.error(`Não foi possível interpretar ${key} como URL de Postgres.`);
    process.exit(1);
  }
}

const psql = process.env.PSQL_EXE || "psql";

const sqlPath = resolve(root, relSql);
readFileSync(sqlPath, "utf8"); // fail early if missing

const r = spawnSync(
  psql,
  [
    "-h",
    host,
    "-p",
    String(port),
    "-U",
    user,
    "-d",
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    sqlPath,
  ],
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PGPASSWORD: password, PGSSLMODE: "require" },
    cwd: root,
  },
);

process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status === 0 ? 0 : 1);
