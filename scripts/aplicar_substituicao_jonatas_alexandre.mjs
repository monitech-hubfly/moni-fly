/**
 * Aplica substituição Jonatas (FK0040) → Alexandre (FK0024).
 * Uso:
 *   node --env-file=.env.local scripts/aplicar_substituicao_jonatas_alexandre.mjs
 *   node --env-file=.env.local scripts/aplicar_substituicao_jonatas_alexandre.mjs --prod --confirm-prod
 */
import { connectDevPg, parsePostgresUrl } from './pg-dev-client.mjs';

const args = process.argv.slice(2);
const wantProd = args.includes('--prod');
const confirmProd = args.includes('--confirm-prod');
if (wantProd && !confirmProd) {
  console.error('PROD bloqueado: passe --prod --confirm-prod.');
  process.exit(1);
}

const envKey = wantProd ? 'PROD_DB_URL' : 'DEV_DB_URL';
const raw = (process.env[envKey] || '').trim().replace(/^["']|["']$/g, '');
if (!raw) {
  console.error(`Defina ${envKey} no .env.local`);
  process.exit(1);
}

const cfg = parsePostgresUrl(raw);
if (!wantProd && !String(cfg.host).includes('bgaadvfucnrkpimaszjv')) {
  console.error(`Abortado: DEV_DB_URL não aponta para DEV (${cfg.host}).`);
  process.exit(1);
}
if (wantProd && !String(cfg.host).includes('aydryzoxqnwnbybvgiug')) {
  console.error(`Abortado: PROD_DB_URL não aponta para PROD (${cfg.host}).`);
  process.exit(1);
}

console.log(`Ambiente: ${wantProd ? 'PROD' : 'DEV'} (${cfg.host})`);
const client = await connectDevPg(envKey);

function normFk(v) {
  const m = String(v ?? '').match(/(\d+)/);
  return m ? `FK${String(parseInt(m[1], 10)).padStart(4, '0')}` : '';
}

function isTransferencia(status) {
  const n = String(status ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
  return n.includes('transferencia');
}

const COLS = [
  'modalidade', 'nome_completo', 'status_franquia', 'classificacao_franqueado',
  'data_ass_cof', 'data_ass_contrato', 'data_expiracao_franquia', 'regional', 'area_atuacao',
  'email_frank', 'responsavel_comercial', 'telefone_frank', 'cpf_frank', 'data_nasc_frank',
  'endereco_casa_frank', 'endereco_casa_frank_numero', 'endereco_casa_frank_complemento',
  'cep_casa_frank', 'estado_casa_frank', 'cidade_casa_frank', 'tamanho_camisa_frank', 'socios',
  'data_recebimento_kit_boas_vindas',
  // Seção 1 — Documentos da Franquia
  'anexo_cof_path', 'anexo_contrato_path', 'anexo_numero_franquia_path',
  'anexo_cof_justificativa', 'anexo_contrato_justificativa', 'anexo_numero_franquia_justificativa',
  // Seção 0 — Documentos do Franqueado
  'anexo_cnh_path', 'anexo_rg_path', 'anexo_passaporte_path', 'anexo_comprovante_endereco_path',
  'anexo_estado_civil_path', 'anexo_irpf_path', 'anexo_estado_civil_justificativa',
  // Seção 2 — Documentos das Empresas (Incorporadora + Gestora na linha rede)
  'anexo_emp_incorp_contrato_social_path', 'anexo_emp_incorp_contrato_social_justificativa',
  'anexo_emp_incorp_cnpj_path', 'anexo_emp_incorp_cnpj_justificativa',
  'anexo_emp_incorp_inscricao_municipal_path', 'anexo_emp_incorp_inscricao_municipal_justificativa',
  'anexo_emp_incorp_certidao_junta_path', 'anexo_emp_incorp_certidao_junta_justificativa',
  'anexo_emp_incorp_conta_bancaria_path', 'anexo_emp_incorp_conta_bancaria_justificativa',
  'anexo_emp_incorp_inscricao_estadual_path',
  'anexo_emp_gest_contrato_social_path', 'anexo_emp_gest_contrato_social_justificativa',
  'anexo_emp_gest_cnpj_path', 'anexo_emp_gest_cnpj_justificativa',
  'anexo_emp_gest_inscricao_municipal_path', 'anexo_emp_gest_inscricao_municipal_justificativa',
  'anexo_emp_gest_certidao_junta_path', 'anexo_emp_gest_certidao_junta_justificativa',
  'anexo_emp_gest_conta_bancaria_path', 'anexo_emp_gest_conta_bancaria_justificativa',
  'anexo_emp_gest_inscricao_estadual_path',
];

try {
  await client.query('BEGIN');

  const { rows: todos } = await client.query(
    `SELECT * FROM rede_franqueados WHERE n_franquia ILIKE '%0040%' OR n_franquia ILIKE '%0024%' OR nome_completo ILIKE '%Jonatas%' OR nome_completo ILIKE '%Alexandre%Thielo%'`,
  );

  const jonatas = todos.find((r) => normFk(r.n_franquia) === 'FK0040');
  const alexandre = todos.find((r) => normFk(r.n_franquia) === 'FK0024');

  if (!jonatas) throw new Error('Linha Jonatas (FK0040) não encontrada.');
  if (!alexandre) throw new Error('Linha Alexandre (FK0024) não encontrada.');
  if (jonatas.id === alexandre.id) throw new Error('Jonatas e Alexandre são a mesma linha.');

  if (!isTransferencia(alexandre.status_franquia)) {
    console.warn('Aviso: Alexandre não está Em Transferência — continuando mesmo assim.');
  }

  const { rows: spesAlexandre } = await client.query(
    `SELECT * FROM franqueado_spe WHERE rede_franqueado_id = $1`,
    [alexandre.id],
  );
  const { rows: empresasAlexandre } = await client.query(
    `SELECT * FROM franqueado_empresas WHERE rede_franqueado_id = $1`,
    [alexandre.id],
  );

  const snapshot = {
    ...alexandre,
    _substituicao_vinculos: {
      franqueado_spe: spesAlexandre,
      franqueado_empresas: empresasAlexandre,
    },
  };
  const subRes = await client.query(
    `INSERT INTO rede_franqueado_substituicoes (rede_franqueado_id, snapshot, processo_step_one_id, nome_anterior, n_franquia_anterior)
     VALUES ($1, $2::jsonb, $3, $4, $5) RETURNING id`,
    [
      alexandre.id,
      JSON.stringify(snapshot),
      alexandre.processo_id,
      alexandre.nome_completo,
      alexandre.n_franquia,
    ],
  );
  const subId = subRes.rows[0].id;

  const cardsAlex = await client.query(
    `UPDATE kanban_cards
     SET rede_substituicao_id = $1,
         arquivado = true,
         arquivado_em = now(),
         motivo_arquivamento = 'Franquia transferida'
     WHERE rede_franqueado_id = $2
       AND rede_substituicao_id IS NULL
     RETURNING id`,
    [subId, alexandre.id],
  );

  if (spesAlexandre.length) {
    await client.query(`DELETE FROM franqueado_spe WHERE rede_franqueado_id = $1`, [alexandre.id]);
  }
  if (empresasAlexandre.length) {
    await client.query(`DELETE FROM franqueado_empresas WHERE rede_franqueado_id = $1`, [alexandre.id]);
  }

  const sets = [];
  const vals = [];
  let i = 1;
  for (const col of COLS) {
    if (col === 'status_franquia') continue;
    const v = jonatas[col];
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      sets.push(`${col} = $${i++}`);
      vals.push(v);
    } else if (col.startsWith('anexo_')) {
      sets.push(`${col} = NULL`);
    }
  }
  sets.push(`status_franquia = $${i++}`);
  vals.push('Em Operação');
  sets.push(`processo_id = $${i++}`);
  vals.push(jonatas.processo_id ?? alexandre.processo_id);
  sets.push(`updated_at = now()`);

  vals.push(alexandre.id);
  await client.query(
    `UPDATE rede_franqueados SET ${sets.join(', ')} WHERE id = $${i}`,
    vals,
  );

  if (jonatas.processo_id) {
    await client.query(
      `UPDATE processo_step_one SET origem_rede_franqueados_id = $1 WHERE id = $2`,
      [alexandre.id, jonatas.processo_id],
    );
  }
  await client.query(
    `UPDATE processo_step_one SET origem_rede_franqueados_id = $1 WHERE origem_rede_franqueados_id = $2`,
    [alexandre.id, jonatas.id],
  );

  const cardsJonatas = await client.query(
    `UPDATE kanban_cards SET rede_franqueado_id = $1 WHERE rede_franqueado_id = $2 AND rede_substituicao_id IS NULL RETURNING id`,
    [alexandre.id, jonatas.id],
  );

  await client.query(
    `UPDATE franqueado_spe SET rede_franqueado_id = $1 WHERE rede_franqueado_id = $2`,
    [alexandre.id, jonatas.id],
  );
  await client.query(
    `UPDATE franqueado_empresas SET rede_franqueado_id = $1 WHERE rede_franqueado_id = $2`,
    [alexandre.id, jonatas.id],
  );

  await client.query(`DELETE FROM rede_franqueados WHERE id = $1`, [jonatas.id]);

  await client.query(`NOTIFY pgrst, 'reload schema'`);
  await client.query('COMMIT');

  console.log('OK: Jonatas removido; FK0024 atualizado com dados de Jonatas.');
  console.log(`  Ambiente: ${wantProd ? 'PROD' : 'DEV'}`);
  console.log(`  FK0024 id: ${alexandre.id}`);
  console.log(`  Histórico substituicao: ${subId}`);
  console.log(`  Cards Alexandre arquivados: ${cardsAlex.rowCount}`);
  console.log(`  Cards Jonatas remapeados: ${cardsJonatas.rowCount}`);
  console.log(`  Jonatas removido id: ${jonatas.id}`);
} catch (e) {
  await client.query('ROLLBACK');
  console.error(e);
  process.exit(1);
} finally {
  await client.end();
}
