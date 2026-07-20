/**
 * Sync DADOS PROD → DEV (schema já sincronizado — somente dados).
 *
 * Uso:
 *   # 1. Defina PROD_DB_URL no terminal (NÃO em .env.local):
 *   $env:PROD_DB_URL = "postgresql://postgres:<SENHA>@db.aydryzoxqnwnbybvgiug.supabase.co:5432/postgres"
 *
 *   # 2. Rode:
 *   node --env-file=.env.local scripts/sync-prod-to-dev-data.mjs
 *
 * Garantias:
 *   - PROD_DB_URL lida SOMENTE de process.env (defina no terminal, não em arquivo).
 *   - DEV_DB_URL lida de .env.local via --env-file.
 *   - session_replication_role = replica durante todo o processo (desabilita FK triggers).
 *   - DELETE (não TRUNCATE CASCADE) para não afetar tabelas DEV-only com FK cruzado.
 *   - Para imediatamente em caso de erro — não continua para a próxima tabela.
 *   - As 9 tabelas DEV-only em DEV_ONLY_TABLES nunca são tocadas (verificação ativa).
 */

import pg from 'pg';
import { resolve4 } from 'node:dns/promises';
import { parsePostgresUrl } from './pg-dev-client.mjs';

// ============================================================
// TABELAS DEV-ONLY — NUNCA TOCADAS (verificação de segurança)
// ============================================================
const DEV_ONLY_TABLES = new Set([
  'card_arquivamento',
  'card_vinculos',
  'community_comments',
  'community_likes',
  'community_posts',
  'document_instances',
  'document_templates',
  'permissoes_perfil',
  'team_members',
]);

// ============================================================
// TABELAS A SINCRONIZAR — ordem respeita dependências FK
// ============================================================
const TABLES = [
  // Camada 0 — sem dependências externas
  'feriados_nacionais',
  'periodos',
  'areas',
  'kanbans',
  'repositorio_secoes',
  'sirene_pericias',
  'kanban_tags',

  // Camada 1 — dependem de camada 0
  'kanban_fases',
  'kanban_times',
  'objetivos',            // auto-ref (parent_id)
  'tarefas',
  'fase_sla',

  // Camada 2 — dependem de camada 1
  'rede_franqueados',
  'indicadores',
  'acoes',
  'kanban_fase_checklist_itens',

  // Camada 3 — dependem de camada 2
  'profiles',             // auto-ref (invited_by) + rede_franqueados
  'indicador_conquistas',
  'indicador_lancamentos',
  'recorrencias_metas',
  'cronograma',
  'registros_resultados',
  'carometro',

  // Camada 4 — dependem de profiles
  'processo_step_one',    // auto-ref (origem_card_id) + profiles + rede_franqueados

  // Camada 5 — dependem de processo_step_one
  'condominios',
  'condominios_etapa2',
  'condominios_lotes',
  'listings_casas',
  'listings_lotes',
  'checklist_condominios',
  'checklist_credito',
  'etapa_progresso',
  'processo_card_checklist',
  'processo_card_eventos',
  'processo_card_comite',
  'processo_card_documentos',
  'processo_card_comentarios',
  'processo_etapa_topicos',
  'processo_step1_area_checklist',
  'processo_condominios',

  // Camada 6 — kanban_cards e dependentes
  // (circular: moni_capital_cadastros ↔ kanban_cards — resolvido pelo session_replication_role)
  'moni_capital_cadastros',
  'kanban_cards',
  'franqueado_spe',
  'kanban_card_vinculos',
  'kanban_historico',
  'kanban_aprovacoes_fase',
  'calculadora_share_tokens',
  'kanban_calculadora_fase_datas',
  'kanban_fase_checklist_respostas',
  'kanban_checklist_itens',
  'kanban_card_sla_justificativas',
  'kanban_card_atas_reuniao',

  // Camada 7 — Sirene (dependem de kanban_cards e entre si)
  'sirene_chamados',
  'sirene_topicos',
  'sirene_mensagens',
  'kanban_atividades',
  'kanban_card_comentarios',
  'kanban_card_comentario_anexos',
  'sirene_anexos',
  'subchamado_anexos',
  'chamado_mencoes',
  'sirene_notificacoes',
  'sirene_pericia_chamados',
  'sirene_pastelaria_vinculos',

  // Camada 8 — terminais
  'alertas',
  'gantt_planejamento',   // auto-ref (parent_id)
  'carometro_semana',
  'carometro_status_diario',
  'bone_day_fechamento',
  'bone_day_blockers',
  'pastelaria_cards',
  'pastelaria_horas',
  'pastelaria_log',
  'pastelaria_reclassificacoes',
  'processo_card_checklist_legal',
  'processo_card_checklist_pareceres',
  'processo_etapa_topicos_anexos',
  'rede_contatos',
  'juridico_tickets',
  'juridico_ticket_comentarios',
  'juridico_ticket_anexos',
];

// ============================================================
// VERIFICAÇÃO DE SEGURANÇA — antes de qualquer conexão
// ============================================================
for (const t of TABLES) {
  if (DEV_ONLY_TABLES.has(t)) {
    console.error(`\nERRO FATAL: tabela DEV-only "${t}" está na lista de sync. Abortando.`);
    process.exit(1);
  }
}

// ============================================================
// CONEXÕES
// ============================================================
const devUrl = (process.env.DEV_DB_URL || '').trim();
if (!devUrl) {
  console.error([
    '\nERRO: DEV_DB_URL não definida.',
    'Rode com: node --env-file=.env.local scripts/sync-prod-to-dev-data.mjs',
  ].join('\n'));
  process.exit(1);
}

const prodUrl = (process.env.PROD_DB_URL || '').trim();
if (!prodUrl) {
  console.error([
    '\nERRO: PROD_DB_URL não definida.',
    'Defina no terminal ANTES de rodar:',
    '',
    '  $env:PROD_DB_URL = "postgresql://postgres:<SENHA>@db.aydryzoxqnwnbybvgiug.supabase.co:5432/postgres"',
    '',
    'Depois rode:',
    '  node --env-file=.env.local scripts/sync-prod-to-dev-data.mjs',
  ].join('\n'));
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

const devCfg  = parsePostgresUrl(devUrl);
const prodCfg = parsePostgresUrl(prodUrl);

const devClient  = new pg.Client({ ...devCfg,  ssl: { rejectUnauthorized: false } });
let prodHost = prodCfg.host;
try {
  const [ipv4] = await resolve4(prodCfg.host);
  prodHost = ipv4;
} catch { /* usa hostname original se resolve4 falhar */ }

const prodClient = new pg.Client({
  host: prodHost, port: prodCfg.port,
  user: prodCfg.user, password: prodCfg.password, database: prodCfg.database,
  ssl: { rejectUnauthorized: false },
});

if (!DRY_RUN) await devClient.connect();
await prodClient.connect();

if (DRY_RUN) {
  console.log(`\n[DRY-RUN] Contando linhas em PROD — nenhuma escrita em DEV\n`);
} else {
  console.log(`\nSync PROD → DEV: ${TABLES.length} tabelas\n`);
}

// ============================================================
// INSERÇÃO EM LOTE
// ============================================================
const BATCH_SIZE = 500;

async function bulkInsert(client, table, columns, colTypes, rows) {
  const n = columns.length;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const placeholders = batch
      .map((_, rowIdx) =>
        `(${columns.map((_, colIdx) => `$${rowIdx * n + colIdx + 1}`).join(', ')})`
      )
      .join(', ');
    const values = batch.flatMap(row =>
      columns.map(col => {
        const v = row[col];
        if (v === undefined) return null;
        if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
          const udt = colTypes[col] ?? '';
          // PostgreSQL array types have udt_name starting with '_' — pass as-is for pg to encode
          if (Array.isArray(v) && udt.startsWith('_')) return v;
          return JSON.stringify(v);
        }
        return v;
      })
    );
    // pg serializa automaticamente: jsonb (objeto JS), arrays (array JS), null, Date, string, number
    await client.query(
      `INSERT INTO public."${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      values
    );
  }
}

// ============================================================
// EXECUÇÃO PRINCIPAL
// ============================================================
try {
  if (DRY_RUN) {
    // ── DRY-RUN: só conta linhas em PROD, sem tocar DEV ──
    let totalLinhas = 0;
    for (const table of TABLES) {
      process.stdout.write(`  ${table.padEnd(42)}`);
      const { rows } = await prodClient.query(
        `SELECT COUNT(*)::int AS n FROM public."${table}"`
      );
      const n = rows[0]?.n ?? 0;
      totalLinhas += n;
      console.log(`${String(n).padStart(7)} linhas`);
    }
    console.log(`\n  ${'TOTAL'.padEnd(42)}${String(totalLinhas).padStart(7)} linhas`);
    console.log('\n[DRY-RUN] Nenhuma escrita realizada. Rode sem --dry-run para executar.');
    process.exit(0);
  }

  // ── EXECUÇÃO REAL ──
  await devClient.query('SET session_replication_role = replica');
  console.log('FK triggers desabilitados (session_replication_role = replica)\n');

  for (const table of TABLES) {
    process.stdout.write(`→ ${table.padEnd(42)}`);

    // 1. Colunas da tabela em DEV (ordem ordinal + tipo)
    const colRes = await devClient.query(
      `SELECT column_name, udt_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );
    if (colRes.rows.length === 0) {
      console.log('AVISO: não encontrada em DEV — pulando');
      continue;
    }
    const columns = colRes.rows.map(r => r.column_name);
    const colTypes = Object.fromEntries(colRes.rows.map(r => [r.column_name, r.udt_name]));

    // 2. SELECT * de PROD
    const { rows } = await prodClient.query(`SELECT * FROM public."${table}"`);

    // 3. DELETE em DEV
    // (não TRUNCATE CASCADE — evita afetar tabelas DEV-only com FK cruzado)
    await devClient.query(`DELETE FROM public."${table}"`);

    // 4. INSERT em DEV — apenas colunas presentes em PROD (colunas DEV-only usam DEFAULT)
    if (rows.length > 0) {
      const prodCols = new Set(Object.keys(rows[0]));
      const insertCols = columns.filter(c => prodCols.has(c));
      const insertColTypes = Object.fromEntries(insertCols.map(c => [c, colTypes[c]]));
      await bulkInsert(devClient, table, insertCols, insertColTypes, rows);
    }

    console.log(`${String(rows.length).padStart(6)} linhas`);
  }

  console.log('\n✓ Sync concluído com sucesso.');
  process.exit(0);
} catch (err) {
  console.log('\nFALHOU');
  console.error(err instanceof Error ? `${err.message}\n${err.stack}` : String(err));
  process.exit(1);
} finally {
  if (!DRY_RUN) {
    await devClient.query('RESET session_replication_role').catch(() => {});
    await devClient.end().catch(() => {});
  }
  await prodClient.end().catch(() => {});
}
