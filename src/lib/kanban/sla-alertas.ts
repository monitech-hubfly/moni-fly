import { adicionarDiasUteis, calcularDiasUteis, calcularStatusSLA } from '@/lib/dias-uteis';
import { createAdminClient } from '@/lib/supabase/admin';

const TIPO_SLA_VENCIDO = 'sla_vencido';
const JANELA_DEDUPE_HORAS = 24;

type CardSlaRow = {
  id: string;
  titulo: string | null;
  franqueado_id: string | null;
  entered_fase_at: string | null;
  created_at: string;
  fase_id: string;
  kanban_fases: { nome?: string | null; sla_dias?: number | null } | { nome?: string | null; sla_dias?: number | null }[] | null;
};

function diasUteisAtraso(enteredAt: Date, slaDias: number): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const entrou = new Date(enteredAt);
  entrou.setHours(0, 0, 0, 0);
  const vencimento = adicionarDiasUteis(entrou, slaDias);
  vencimento.setHours(0, 0, 0, 0);
  if (vencimento >= hoje) return 0;
  return calcularDiasUteis(vencimento, hoje);
}

async function jaNotificadoNasUltimas24h(
  db: ReturnType<typeof createAdminClient>,
  cardId: string,
  userId: string,
): Promise<boolean> {
  const desde = new Date(Date.now() - JANELA_DEDUPE_HORAS * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from('sirene_notificacoes')
    .select('id')
    .eq('user_id', userId)
    .eq('tipo', TIPO_SLA_VENCIDO)
    .eq('referencia_card_id', cardId)
    .gte('created_at', desde)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

async function carregarSlaNotificadosRecentes(
  db: ReturnType<typeof createAdminClient>,
  cardIds: string[],
): Promise<Set<string> | null> {
  const ids = [...new Set(cardIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return new Set();
  const desde = new Date(Date.now() - JANELA_DEDUPE_HORAS * 60 * 60 * 1000).toISOString();
  const seen = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; from < 20000; from += pageSize) {
    const { data, error } = await db
      .from('sirene_notificacoes')
      .select('user_id, referencia_card_id')
      .eq('tipo', TIPO_SLA_VENCIDO)
      .in('referencia_card_id', ids)
      .gte('created_at', desde)
      .range(from, from + pageSize - 1);
    if (error) return null;
    const rows = data ?? [];
    for (const row of rows) {
      const uid = String((row as { user_id?: string }).user_id ?? '').trim();
      const cardId = String((row as { referencia_card_id?: string }).referencia_card_id ?? '').trim();
      if (uid && cardId) seen.add(`${uid}|${cardId}`);
    }
    if (rows.length < pageSize) break;
  }
  return seen;
}

/**
 * Notifica responsáveis (franqueado do card) quando o SLA da fase atual está vencido.
 * Deduplica por card + usuário + tipo nas últimas 24h.
 */
export async function notificarCardsComSlaVencido(): Promise<void> {
  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error('[sla-alertas] admin client:', e);
    return;
  }

  const { data: cards, error } = await db
    .from('kanban_cards')
    .select(
      'id, titulo, franqueado_id, entered_fase_at, created_at, fase_id, kanban_fases ( nome, sla_dias )',
    )
    .eq('status', 'ativo')
    .eq('arquivado', false)
    .not('entered_fase_at', 'is', null);

  if (error) {
    console.error('[sla-alertas] listagem cards:', error.message);
    return;
  }

  const pendentes: Array<{ row: CardSlaRow; faseNome: string; diasAtraso: number; responsavelId: string }> = [];
  for (const raw of cards ?? []) {
    const row = raw as CardSlaRow;
    const faseNode = Array.isArray(row.kanban_fases) ? row.kanban_fases[0] : row.kanban_fases;
    const slaDias = faseNode?.sla_dias;
    if (slaDias == null || slaDias <= 0) continue;

    const enteredIso = row.entered_fase_at ?? row.created_at;
    const enteredAt = new Date(enteredIso);
    if (Number.isNaN(enteredAt.getTime())) continue;

    const sla = calcularStatusSLA(enteredAt, slaDias);
    if (sla.status !== 'atrasado') continue;

    const responsavelId = String(row.franqueado_id ?? '').trim();
    if (!responsavelId) continue;

    pendentes.push({
      row,
      faseNome: String(faseNode?.nome ?? 'fase atual').trim(),
      diasAtraso: diasUteisAtraso(enteredAt, slaDias),
      responsavelId,
    });
  }

  const jaNotificados = await carregarSlaNotificadosRecentes(
    db,
    pendentes.map((p) => p.row.id),
  );

  for (const item of pendentes) {
    const { row, responsavelId } = item;
    const chave = `${responsavelId}|${row.id}`;
    const duplicada = jaNotificados
      ? jaNotificados.has(chave)
      : await jaNotificadoNasUltimas24h(db, row.id, responsavelId);
    if (duplicada) continue;

    const tituloCard = String(row.titulo ?? 'Sem título').trim() || 'Sem título';
    const texto = `Card ${tituloCard} está ${item.diasAtraso} dias úteis atrasado na fase ${item.faseNome}`;

    const { error: insErr } = await db.from('sirene_notificacoes').insert({
      user_id: responsavelId,
      chamado_id: null,
      tipo: TIPO_SLA_VENCIDO,
      titulo: 'SLA vencido',
      mensagem: texto,
      texto,
      referencia_card_id: row.id,
    } as never);

    if (insErr) {
      console.error('[sla-alertas] insert notificação:', insErr.message, row.id);
    } else {
      jaNotificados?.add(chave);
    }
  }
}
