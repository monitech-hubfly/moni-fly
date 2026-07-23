/**
 * Garante linha espelho em kanban_cards para processo legado (v_processo_como_kanban_cards).
 * Retorna true se criou ou já existia; false se não encontrado na view.
 */
export async function garantirShadowKanbanCardLegadoPg(client, cardId) {
  const cid = String(cardId ?? '').trim();
  if (!cid) return false;

  const exists = await client.query(`SELECT id FROM kanban_cards WHERE id = $1`, [cid]);
  if (exists.rows.length) return true;

  const v = await client.query(
    `SELECT v.id, v.kanban_id, v.fase_id, v.titulo, v.responsavel_id,
            p.nome_condominio, p.quadra, p.lote
     FROM v_processo_como_kanban_cards v
     JOIN processo_step_one p ON p.id = v.id
     WHERE v.id = $1`,
    [cid],
  );
  const row = v.rows[0];
  if (!row) return false;

  await client.query(
    `INSERT INTO kanban_cards
       (id, kanban_id, fase_id, franqueado_id, titulo, status, concluido,
        processo_step_one_id, nome_condominio, quadra, lote)
     VALUES ($1,$2,$3,$4,$5,'ativo',false,$1,$6,$7,$8)
     ON CONFLICT (id) DO NOTHING`,
    [
      row.id,
      row.kanban_id,
      row.fase_id,
      row.responsavel_id,
      row.titulo,
      row.nome_condominio,
      row.quadra,
      row.lote,
    ],
  );
  console.log(`[shadow] criado kanban_cards para legado ${cid.slice(0, 8)} (${row.titulo})`);
  return true;
}
