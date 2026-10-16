import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import {
  isTipoSolicitacaoComercial,
  JURIDICO_ORIGEM_COMERCIAL,
  mensagemConclusaoSolicitacaoComercial,
  TIPO_NOTIFICACAO_SOLICITACAO_COMERCIAL,
} from '@/lib/kanban/juridico-solicitacao-comercial';
import { createAdminClient } from '@/lib/supabase/admin';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Db = ReturnType<typeof createAdminClient>;

function uuidOuNull(valor: string | null | undefined): string | null {
  const v = String(valor ?? '').trim();
  return UUID_RE.test(v) ? v : null;
}

async function reverterFase(
  db: Db,
  cardId: string,
  faseAnteriorId: string | null | undefined,
): Promise<string | null> {
  const faseId = String(faseAnteriorId ?? '').trim();
  if (!faseId) return null;
  const { error } = await db.from('kanban_cards').update({ fase_id: faseId }).eq('id', cardId);
  return error?.message ?? null;
}

/**
 * Na entrada de Atendimentos Concluídos, avisa quem abriu a solicitação Comercial.
 * Portfólio e Loteadores não passam por aqui: a origem deles não é `comercial`.
 * Reprocessar a mesma conclusão não insere outra notificação.
 */
export async function notificarConclusaoSolicitacaoComercial(input: {
  cardId: string;
  faseAnteriorId?: string | null;
  jaNotificou: (userId: string) => Promise<boolean>;
  inserirNotificacao: (row: Record<string, unknown>) => Promise<string | null>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: true };

  let db: Db;
  try {
    db = createAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Serviço indisponível.' };
  }

  const { data: card, error: errCard } = await db
    .from('kanban_cards')
    .select(
      'id, kanban_id, fase_id, franqueado_id, juridico_origem, juridico_tipo_contrato, juridico_nome_candidato, titulo',
    )
    .eq('id', cardId)
    .maybeSingle();
  if (errCard) return { ok: false, error: errCard.message };
  if (!card) return { ok: true };

  const row = card as {
    kanban_id?: string | null;
    fase_id?: string | null;
    franqueado_id?: string | null;
    juridico_origem?: string | null;
    juridico_tipo_contrato?: string | null;
    juridico_nome_candidato?: string | null;
    titulo?: string | null;
  };

  if (String(row.kanban_id ?? '') !== KANBAN_IDS.JURIDICO) return { ok: true };
  if (String(row.juridico_origem ?? '').trim() !== JURIDICO_ORIGEM_COMERCIAL) return { ok: true };
  if (!isTipoSolicitacaoComercial(row.juridico_tipo_contrato)) return { ok: true };

  const { data: fase } = await db
    .from('kanban_fases')
    .select('slug')
    .eq('id', String(row.fase_id ?? ''))
    .maybeSingle();
  if (String((fase as { slug?: string | null } | null)?.slug ?? '').trim() !== FASE_SLUGS.JURIDICO_ATENDIMENTOS_CONCLUIDOS) {
    return { ok: true };
  }

  const criadorId = uuidOuNull(row.franqueado_id);
  const falha = async (error: string) => {
    const revertErr = await reverterFase(db, cardId, input.faseAnteriorId);
    if (revertErr) {
      return {
        ok: false as const,
        error: `${error} Além disso, não foi possível devolver o atendimento à fase anterior: ${revertErr}`,
      };
    }
    return { ok: false as const, error };
  };

  if (!criadorId) {
    return falha(
      'Solicitação comercial concluída sem criador identificável. O atendimento voltou para a fase anterior.',
    );
  }

  let ja: boolean;
  try {
    ja = await input.jaNotificou(criadorId);
  } catch (e) {
    return falha(
      e instanceof Error ? e.message : 'Não foi possível verificar a notificação já enviada.',
    );
  }
  if (ja) return { ok: true };

  const candidato =
    String(row.juridico_nome_candidato ?? '').trim() || String(row.titulo ?? '').trim() || 'candidato';
  const mensagem = mensagemConclusaoSolicitacaoComercial(row.juridico_tipo_contrato, candidato);
  const href = hrefAbrirCardKanban('Funil Jurídico', cardId);
  const notifErr = await input.inserirNotificacao({
    user_id: criadorId,
    chamado_id: null,
    tipo: TIPO_NOTIFICACAO_SOLICITACAO_COMERCIAL,
    titulo: 'Solicitação jurídica concluída',
    mensagem,
    texto: `${mensagem} Abrir: ${href}`,
    referencia_card_id: cardId,
  });
  if (notifErr) {
    return falha(
      `A notificação ao criador da solicitação falhou (${notifErr}). O atendimento voltou para a fase anterior.`,
    );
  }

  return { ok: true };
}
