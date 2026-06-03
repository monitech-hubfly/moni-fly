'use server';

import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { createAdminClient } from '@/lib/supabase/admin';
import { MONI_EMAIL_POR_NOME, RESPONSAVEIS_POR_TIME } from '@/lib/times-responsaveis';
import { revalidatePath } from 'next/cache';

const TIME_ACOPLAMENTO = 'Acoplamento';
const FASE_NOVO_PROJETO_SLUG = 'modelagem_terreno';

/** Notifica o time Acoplamento no sininho quando entra card novo em Modelagem do Terreno. */
export async function notificarTimeAcoplamentoNovoProjeto(input: {
  cardFilhoId: string;
  tituloCard: string;
  basePath?: string;
  excluirUserId?: string | null;
}): Promise<void> {
  const cardId = String(input.cardFilhoId ?? '').trim();
  if (!cardId) return;

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error('[notificarTimeAcoplamentoNovoProjeto] admin:', e);
    return;
  }

  const { data: filho } = await db
    .from('kanban_cards')
    .select('kanban_id, fase_id')
    .eq('id', cardId)
    .maybeSingle();

  if (String((filho as { kanban_id?: string } | null)?.kanban_id ?? '') !== KANBAN_IDS.ACOPLAMENTO) {
    return;
  }

  const faseId = String((filho as { fase_id?: string } | null)?.fase_id ?? '').trim();
  if (faseId) {
    const { data: faseRow } = await db.from('kanban_fases').select('slug').eq('id', faseId).maybeSingle();
    const slug = String((faseRow as { slug?: string | null } | null)?.slug ?? '').trim();
    if (slug && slug !== FASE_NOVO_PROJETO_SLUG) return;
  }

  const userIds = new Set<string>();
  const { data: porTime } = await db.from('profiles').select('id').eq('time', TIME_ACOPLAMENTO);
  for (const row of porTime ?? []) {
    const id = String((row as { id?: string }).id ?? '').trim();
    if (id) userIds.add(id);
  }

  const emails = new Set<string>();
  for (const nome of RESPONSAVEIS_POR_TIME[TIME_ACOPLAMENTO] ?? []) {
    const em = MONI_EMAIL_POR_NOME[nome];
    if (em) emails.add(em.trim().toLowerCase());
  }
  if (emails.size > 0) {
    const { data: porEmail } = await db
      .from('profiles')
      .select('id')
      .in('email', [...emails]);
    for (const row of porEmail ?? []) {
      const id = String((row as { id?: string }).id ?? '').trim();
      if (id) userIds.add(id);
    }
  }

  const excluir = String(input.excluirUserId ?? '').trim();
  const dest = [...userIds].filter((id) => id && id !== excluir);
  if (dest.length === 0) return;

  const titulo = String(input.tituloCard ?? '').trim() || 'Novo projeto';
  const basePath = (input.basePath ?? '/funil-acoplamento').trim() || '/funil-acoplamento';
  const mensagem = `Novo Projeto para Acoplamento: ${titulo}`;

  const rows = dest.map((user_id) => ({
    user_id,
    tipo: 'acoplamento_novo_projeto',
    mensagem,
    referencia_card_id: cardId,
    referencia_path: `${basePath}?card=${encodeURIComponent(cardId)}`,
    lido: false,
  }));

  const { error } = await db.from('alertas').insert(rows as never);
  if (error) console.error('[notificarTimeAcoplamentoNovoProjeto]', error.message);

  revalidatePath('/alertas');
}
