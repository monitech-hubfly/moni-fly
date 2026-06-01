'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export type AlertaKanbanAtividadeTipo =
  | 'kanban_atividade_criada'
  | 'kanban_atividade_atualizada'
  | 'kanban_atividade_redirecionada';

type NotificarParams = {
  userIds: string[];
  tipo: AlertaKanbanAtividadeTipo;
  mensagem: string;
  cardId: string;
  basePath: string;
  /** Não notificar quem executou a ação. */
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

  const rows = dest.map((user_id) => ({
    user_id,
    tipo: params.tipo,
    mensagem: params.mensagem,
    referencia_card_id: params.cardId,
    referencia_path: params.basePath,
    lido: false,
  }));

  const { error } = await admin.from('alertas').insert(rows as never);
  if (error) console.error('[chamados-notificacoes]', error.message);

  revalidatePath('/alertas');
}

export async function buscarMetaCardParaNotificacao(
  admin: ReturnType<typeof createAdminClient>,
  cardId: string,
  origem: 'nativo' | 'legado',
): Promise<{ titulo: string; basePath: string } | null> {
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
    };
  }
  const { data: card } = await admin
    .from('kanban_cards')
    .select('titulo, kanban_id')
    .eq('id', cardId)
    .maybeSingle();
  if (!card) return null;
  const kid = String((card as { kanban_id?: string }).kanban_id ?? '');
  const { data: kb2 } = await admin.from('kanbans').select('nome').eq('id', kid).maybeSingle();
  const nome = String((kb2 as { nome?: string } | null)?.nome ?? '');
  return {
    titulo: String((card as { titulo?: string | null }).titulo ?? 'Card'),
    basePath: rotaPorNomeKanban(nome),
  };
}

function rotaPorNomeKanban(nome: string): string {
  const n = nome.trim().toLowerCase();
  if (n.includes('portfólio') || n.includes('portfolio')) return '/portfolio';
  if (n.includes('step one') || n.includes('step-one')) return '/step-one';
  if (n.includes('acoplamento')) return '/acoplamento';
  if (n.includes('novos franqueados')) return '/novos-franqueados';
  return '/';
}
