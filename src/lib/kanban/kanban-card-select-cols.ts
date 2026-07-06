/** Colunas de kanban_cards usadas no board/modal (sem campos de SLA opcionais). */
export const KANBAN_CARD_SELECT_BASE = `
      id,
      titulo,
      status,
      created_at,
      fase_id,
      franqueado_id,
      arquivado,
      motivo_arquivamento,
      concluido,
      concluido_em,
      rede_franqueado_id,
      rede_loteador_id,
      condominio_id,
      nome_condominio,
      quadra,
      lote,
      data_reuniao,
      data_followup,
      acoplamento_concluido,
      acoplamento_filho_fase_nome,
      acoplamento_filho_fase_slug,
      credito_terreno_ok,
      contabilidade_ok,
      capital_ok,
      juridico_ok,
      credito_obra_ok,
      projeto_id,
      origem_card_id,
      ordem_coluna,
      alvara_url,
      docs_terreno_url,
      funding_tipo,
      funding_localizacao,
      funding_descritivo,
      proxima_atividade,
      prazo_atividade
    `;

export const KANBAN_CARD_SELECT_WITH_SLA = `${KANBAN_CARD_SELECT_BASE.trim()},
      sla_iniciado_em,
      entered_fase_at`;

export function isSupabaseMissingColumnError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('pgrst204')
  );
}

export async function runKanbanCardSelectWithSlaFallback<T>(run: (select: string) => Promise<{
  data: T | null;
  error: { message: string } | null;
}>): Promise<{ data: T | null; error: { message: string } | null; slaColsAvailable: boolean }> {
  const withSla = await run(KANBAN_CARD_SELECT_WITH_SLA);
  if (!withSla.error) return { ...withSla, slaColsAvailable: true };
  if (!isSupabaseMissingColumnError(withSla.error?.message)) {
    return { ...withSla, slaColsAvailable: false };
  }
  const base = await run(KANBAN_CARD_SELECT_BASE);
  return { ...base, slaColsAvailable: false };
}
