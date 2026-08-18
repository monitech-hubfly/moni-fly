'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { notificarAlertasKanbanAtividade } from '@/lib/kanban/chamados-notificacoes';

/** UUIDs que recebem Sininho em toda atualização do GBox */
const GBOX_NOTIFICAR_IDS = [
  '89ee0538-5a14-488c-8306-a2a8c580502e', // Helenna Luz
  'a6a687bd-1051-406a-8872-2b21d8e44332', // Renata Fernanda
];

export type GboxPatch = {
  status?: string;
  data?: string;
  link?: string;
};

/**
 * Persiste GBox de uma casa no Supabase e, quando notificar=true,
 * dispara o Sininho para Helenna e Renata.
 */
export async function salvarGbox(
  casaNome: string,
  patch: GboxPatch,
  userId: string,
  notificar: boolean,
): Promise<void> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }

  const { data: atual } = await admin
    .from('carometro_gbox')
    .select('status, data, link')
    .eq('casa_nome', casaNome)
    .maybeSingle();

  const novoStatus = patch.status ?? (atual as { status?: string } | null)?.status ?? 'N/ Revisado';
  const novaData = patch.data ?? (atual as { data?: string } | null)?.data ?? null;
  const novoLink = patch.link ?? (atual as { link?: string } | null)?.link ?? null;

  await admin.from('carometro_gbox').upsert(
    {
      casa_nome: casaNome,
      status: novoStatus,
      data: novaData || null,
      link: novoLink || null,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: 'casa_nome' },
  );

  if (!notificar) return;

  const dataFormatada = novaData
    ? new Date(novaData + 'T12:00:00').toLocaleDateString('pt-BR')
    : null;

  const partes = [`Casa ${casaNome}`];
  if (novoStatus && novoStatus !== 'N/ Revisado') partes.push(novoStatus);
  if (dataFormatada) partes.push(dataFormatada);
  if (novoLink) partes.push('Link disponível');
  const mensagem = `GBox atualizado — ${partes.join(' · ')}`;

  try {
    await notificarAlertasKanbanAtividade({
      userIds: GBOX_NOTIFICAR_IDS,
      tipo: 'gbox_atualizado',
      mensagem,
      basePath: '/carometro/dashboard-produtos',
      excluirUserId: userId,
    });
  } catch {
    /* notificação não deve bloquear o save */
  }
}

/**
 * Carrega todos os registros GBox do Supabase.
 * Usado na montagem inicial do Dashboard (admin client ignora RLS).
 */
export async function carregarGbox(): Promise<
  Record<string, { status: string; data: string; link: string }>
> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {};
  }

  const { data } = await admin
    .from('carometro_gbox')
    .select('casa_nome, status, data, link');

  const map: Record<string, { status: string; data: string; link: string }> = {};
  for (const row of (data ?? []) as {
    casa_nome: string;
    status: string | null;
    data: string | null;
    link: string | null;
  }[]) {
    map[row.casa_nome] = {
      status: row.status ?? 'N/ Revisado',
      data: row.data ?? '',
      link: row.link ?? '',
    };
  }
  return map;
}
