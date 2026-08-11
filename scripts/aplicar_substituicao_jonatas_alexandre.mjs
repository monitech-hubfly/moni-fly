/**
 * Aplica substituição Jonatas (FK0040) → Alexandre (FK0024) no DEV.
 * Uso: node --env-file=.env.local scripts/aplicar_substituicao_jonatas_alexandre.mjs
 */
import pg from 'pg';

const raw = (process.env.DEV_DB_URL || '').trim().replace(/^["']|["']$/g, '');
if (!raw) {
  console.error('Defina DEV_DB_URL no .env.local');
  process.exit(1);
}

const client = new pg.Client({ connectionString: raw, ssl: { rejectUnauthorized: false } });

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
  'anexo_cof_path', 'anexo_contrato_path', 'anexo_numero_franquia_path',
  'anexo_cnh_path', 'anexo_rg_path', 'anexo_passaporte_path', 'anexo_comprovante_endereco_path',
  'anexo_estado_civil_path', 'anexo_irpf_path',
];

await client.connect();

try {
  await client.query('BEGIN');

  const { rows: todos } = await client.query(
    `SELECT * FROM rede_franqueados WHERE n_franquia ILIKE '%0040%' OR n_franquia ILIKE '%0024%' OR nome_completo ILIKE '%Jonatas%' OR nome_completo ILIKE '%Alexandre%Thielo%'`,
  );

  const jonatas = todos.find(
    (r) => normFk(r.n_franquia) === 'FK0040' || String(r.nome_completo ?? '').includes('Jonatas'),
  );
  const alexandre = todos.find(
    (r) => normFk(r.n_franquia) === 'FK0024' || String(r.nome_completo ?? '').includes('Alexandre'),
  );

  if (!jonatas) throw new Error('Linha Jonatas (FK0040) não encontrada.');
  if (!alexandre) throw new Error('Linha Alexandre (FK0024) não encontrada.');
  if (jonatas.id === alexandre.id) throw new Error('Jonatas e Alexandre são a mesma linha.');

  if (!isTransferencia(alexandre.status_franquia)) {
    console.warn('Aviso: Alexandre não está Em Transferência — continuando mesmo assim.');
  }

  const snapshot = { ...alexandre };
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

  await client.query(
    `UPDATE kanban_cards SET rede_substituicao_id = $1 WHERE rede_franqueado_id = $2 AND rede_substituicao_id IS NULL`,
    [subId, alexandre.id],
  );

  const sets = [];
  const vals = [];
  let i = 1;
  for (const col of COLS) {
    const v = jonatas[col];
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      sets.push(`${col} = $${i++}`);
      vals.push(v);
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
    `UPDATE kanban_cards SET rede_franqueado_id = $1 WHERE rede_franqueado_id = $2 AND rede_substituicao_id IS NULL`,
    [alexandre.id, jonatas.id],
  );

  await client.query(`DELETE FROM rede_franqueados WHERE id = $1`, [jonatas.id]);

  await client.query(`NOTIFY pgrst, 'reload schema'`);
  await client.query('COMMIT');

  console.log('OK: Jonatas removido; Alexandre atualizado com dados de Jonatas.');
  console.log(`  Alexandre id: ${alexandre.id} (${alexandre.n_franquia})`);
  console.log(`  Histórico substituicao: ${subId}`);
  console.log(`  Jonatas removido id: ${jonatas.id}`);
} catch (e) {
  await client.query('ROLLBACK');
  console.error(e);
  process.exit(1);
} finally {
  await client.end();
}
