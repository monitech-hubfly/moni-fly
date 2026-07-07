'use server';

import { montarPathAlertaAtividade } from '@/lib/kanban/alerta-atividade-path';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export type AlertaKanbanAtividadeTipo =
  | 'kanban_atividade_criada'
  | 'kanban_atividade_atualizada'
  | 'kanban_atividade_redirecionada'
  | 'sla_atividade_atencao'
  | 'sla_atividade_atrasado';

export { montarPathAlertaAtividade };

type NotificarParams = {
  userIds: string[];
  tipo: AlertaKanbanAtividadeTipo;
  mensagem: string;
  cardId?: string | null;
  basePath?: string;
  interacaoId?: string | null;
  excluirUserId?: string | null;
};

export async function notificarAlertasKanbanAtividade(params: NotificarParams): Promise<void> {
  const dest = [...new Set(params.userIds.map((x) => String(x ?? '').trim()).filter(Boolean))].filter(
    (id) => id !== (params.excluirUserId ?? '').trim(),
  );
  if (dest.length === 0) return;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }

  const cardId = (params.cardId ?? '').trim() || null;
  const interacaoId = (params.interacaoId ?? '').trim() || null;
  const basePath =
    (params.basePath ?? '').trim() ||
    (interacaoId ? `/sirene/chamados?interacao=${encodeURIComponent(interacaoId)}` : '/');

  const rows = dest.map((user_id) => ({
    user_id,
    tipo: params.tipo,
    mensagem: params.mensagem,
    referencia_card_id: cardId,
    referencia_path:
      interacaoId && !cardId
        ? `/sirene/chamados?interacao=${encodeURIComponent(interacaoId)}`
        : basePath,
    lido: false,
  }));

  const { error } = await admin.from('alertas').insert(rows as never);
  if (error) console.error('[chamados-notificacoes]', error.message);

  revalidatePath('/alertas');
}

/** Resolve meta para notificação: card funil ou chamado Sirene sem card. */
export async function buscarMetaNotificacaoChamado(
  admin: ReturnType<typeof createAdminClient>,
  interacaoId: string,
): Promise<{ titulo: string; cardId: string | null; basePath: string; interacaoId: string; origemLegado: boolean } | null> {
  const { data: row } = await admin
    .from('kanban_atividades')
    .select('titulo, card_id, origem')
    .eq('id', interacaoId)
    .maybeSingle();
  if (!row) return null;
  const titulo = String((row as { titulo?: string }).titulo ?? 'Chamado').trim() || 'Chamado';
  const cardId = String((row as { card_id?: string | null }).card_id ?? '').trim() || null;
  const origem = (row as { origem?: string }).origem === 'legado' ? 'legado' : 'nativo';
  if (cardId) {
    const meta = await buscarMetaCardParaNotificacao(admin, cardId, origem);
    if (meta) {
      return { titulo: meta.titulo, cardId, basePath: meta.basePath, interacaoId, origemLegado: meta.origemLegado };
    }
  }
  return {
    titulo,
    cardId: null,
    basePath: `/sirene/chamados?interacao=${encodeURIComponent(interacaoId)}`,
    interacaoId,
    origemLegado: false,
  };
}

export async function buscarMetaCardParaNotificacao(
  admin: ReturnType<typeof createAdminClient>,
  cardId: string,
  origem: 'nativo' | 'legado',
): Promise<{ titulo: string; basePath: string; origemLegado: boolean } | null> {
  if (origem === 'legado') {
    const { data: v } = await admin
      .from('v_processo_como_kanban_cards')
      .select('titulo, kanban_id')
      .eq('id', cardId)
      .maybeSingle();
    if (!v) return null;
    const kid = String((v as { kanban_id?: string }).kanban_id ?? '');
    const { data: kb } = await admin.from('kanbans').select('nome').eq('id', kid).maybeSingle();
    const nome = String((kb as { nome?: string } | null)?.nome ?? '');
    return {
      titulo: String((v as { titulo?: string | null }).titulo ?? 'Card'),
      basePath: rotaPorNomeKanban(nome),
      origemLegado: true,
    };
  }
  const { data: card } = await admin
    .from('kanban_cards')
    .select('titulo, kanban_id')
    .eq('id', cardId)
    .eq('arquivado', false)
    .maybeSingle();
  if (!card) return null;
  const kid = String((card as { kanban_id?: string }).kanban_id ?? '');
  const { data: kb2 } = await admin.from('kanbans').select('nome').eq('id', kid).maybeSingle();
  const nome = String((kb2 as { nome?: string } | null)?.nome ?? '');
  return {
    titulo: String((card as { titulo?: string | null }).titulo ?? 'Card'),
    basePath: rotaPorNomeKanban(nome),
    origemLegado: false,
  };
}

function rotaPorNomeKanban(nome: string): string {
  const n = nome.trim().toLowerCase();
  if (n.includes('portfólio') || n.includes('portfolio')) return '/portfolio';
  if (n.includes('step one') || n.includes('step-one')) return '/step-one';
  if (n.includes('acoplamento')) return '/acoplamento';
  if (n.includes('novos franqueados')) return '/novos-franqueados';
  if (n.includes('operações') || n.includes('operacoes')) return '/operacoes';
  if (n.includes('jurídico') || n.includes('juridico')) return '/juridico';
  if (n.includes('homologações') || n.includes('homologacoes')) return '/homologacoes';
  if (n.includes('crédito obra') || n.includes('credito obra')) return '/credito-obra';
  if (n.includes('contabilidade')) return '/contabilidade';
  if (n.includes('contratações') || n.includes('contratacoes')) return '/contratacoes';
  if (n.includes('modelo virtual')) return '/modelo-virtual';
  if (n.includes('capital')) return '/moni-capital';
  if (n.includes('produto')) return '/produto';
  if (n.includes('projeto legal') || n.includes('projetos legais') || n.includes('projetos locais')) return '/projetos';
  if (n.includes('loteadores')) return '/loteadores';
  return '/sirene/chamados';
}
