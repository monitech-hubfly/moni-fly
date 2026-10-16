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
      resultado,
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
      juridico_bolinha_count,
      credito_obra_ok,
      projetos_legais_ok,
      projetos_locais_ok,
      projeto_id,
      processo_step_one_id,
      origem_card_id,
      ordem_coluna,
      alvara_url,
      docs_terreno_url,
      funding_tipo,
      funding_localizacao,
      funding_descritivo,
      nome_corretor,
      imobiliaria_corretor,
      empreendimento_interesse,
      tipologia_interesse,
      probabilidade_fechamento,
      orcamento_lead,
      cidade_interesse,
      telefone_lead,
      email_lead,
      mensagem_lead,
      proxima_atividade,
      prazo_atividade
    `;

export const KANBAN_CARD_SELECT_WITH_SLA = `${KANBAN_CARD_SELECT_BASE.trim()},
      sla_iniciado_em,
      entered_fase_at`;

/** Paint inicial rápido (Portfólio / Operações): colunas mínimas para coluna, título bruto e DnD. */
export const KANBAN_CARD_SELECT_BOARD_FAST = `
      id,
      titulo,
      status,
      created_at,
      fase_id,
      franqueado_id,
      ordem_coluna,
      arquivado,
      concluido,
      concluido_em,
      rede_franqueado_id,
      rede_loteador_id,
      condominio_id,
      nome_condominio,
      quadra,
      lote,
      projeto_id,
      processo_step_one_id,
      origem_card_id,
      data_reuniao,
      data_followup,
      proxima_atividade,
      prazo_atividade,
      sla_iniciado_em,
      entered_fase_at,
      nome_corretor,
      imobiliaria_corretor,
      empreendimento_interesse,
      tipologia_interesse,
      probabilidade_fechamento
    `;

export const KANBAN_CARD_SELECT_BOARD_FAST_WITH_SLA = `${KANBAN_CARD_SELECT_BOARD_FAST.trim()}`;

/**
 * Colunas que podem não existir ainda (Perda/Ganho, Corretores, etc.).
 * Se o SELECT as incluir e o banco não tiver, o PostgREST zera o board inteiro.
 */
const KANBAN_CARD_SELECT_OPTIONAL = [
  'resultado',
  'telefone_lead',
  'email_lead',
  'mensagem_lead',
  'nome_corretor',
  'imobiliaria_corretor',
  'empreendimento_interesse',
  'tipologia_interesse',
  'probabilidade_fechamento',
  'orcamento_lead',
  'cidade_interesse',
] as const;

function splitSelectCols(select: string): string[] {
  return select
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function joinSelectCols(cols: string[]): string {
  return cols.join(',\n      ');
}

function stripNamedColumn(select: string, col: string): string | null {
  const needle = col.trim().toLowerCase();
  if (!needle) return null;
  const cols = splitSelectCols(select);
  const next = cols.filter((c) => c.toLowerCase() !== needle);
  if (next.length === 0 || next.length === cols.length) return null;
  return joinSelectCols(next);
}

function stripOptionalBoardColumns(select: string): string {
  const skip = new Set(KANBAN_CARD_SELECT_OPTIONAL.map((c) => c.toLowerCase()));
  return joinSelectCols(splitSelectCols(select).filter((part) => !skip.has(part.toLowerCase())));
}

/** PostgREST: `column X does not exist` / PGRST204 schema cache. */
export function colunaAusenteDoErroSelect(message: string | undefined): string | null {
  if (!message) return null;
  const patterns = [
    /column\s+(?:[\w]+\.)?(\w+)\s+does not exist/i,
    /could not find the ['"](\w+)['"] column/i,
    /could not find ['"](\w+)['"] column of/i,
  ];
  for (const re of patterns) {
    const m = message.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

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

type SelectRun<T> = (select: string) => Promise<{
  data: T | null;
  error: { message: string } | null;
}>;

async function runSelectRetryingMissingColumns<T>(
  initialSelect: string,
  run: SelectRun<T>,
): Promise<{ data: T | null; error: { message: string } | null; slaColsAvailable: boolean }> {
  let select = initialSelect;
  let slaColsAvailable = /sla_iniciado_em/i.test(select);
  for (let i = 0; i < 8; i++) {
    const res = await run(select);
    if (!res.error) return { ...res, slaColsAvailable };
    if (!isSupabaseMissingColumnError(res.error.message)) {
      console.error('[kanban-card-select]', res.error.message);
      return { ...res, slaColsAvailable: false };
    }
    const named = colunaAusenteDoErroSelect(res.error.message);
    const next = named
      ? stripNamedColumn(select, named)
      : stripOptionalBoardColumns(select);
    if (!next || next === select) {
      console.error('[kanban-card-select] coluna ausente sem fallback:', res.error.message);
      return { ...res, slaColsAvailable: false };
    }
    slaColsAvailable = slaColsAvailable && /sla_iniciado_em/i.test(next);
    select = next;
  }
  const last = await run(select);
  if (last.error) console.error('[kanban-card-select]', last.error.message);
  return { ...last, slaColsAvailable: slaColsAvailable && !last.error };
}

export async function runKanbanCardSelectWithSlaFallback<T>(run: SelectRun<T>): Promise<{
  data: T | null;
  error: { message: string } | null;
  slaColsAvailable: boolean;
}> {
  return runSelectRetryingMissingColumns(KANBAN_CARD_SELECT_WITH_SLA, run);
}

export async function runKanbanCardSelectBoardFast<T>(run: SelectRun<T>): Promise<{
  data: T | null;
  error: { message: string } | null;
  slaColsAvailable: boolean;
}> {
  return runSelectRetryingMissingColumns(KANBAN_CARD_SELECT_BOARD_FAST_WITH_SLA, run);
}
