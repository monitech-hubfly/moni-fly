'use server';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Após mover card nativo para a fase Step 2 do Funil Step One: avisa o franqueado se a Casa 2 da Universidade não estiver concluída.
 * Não lança erro (não bloqueia o kanban).
 */
export async function notificarUniversidadeSeAvancoStep2(input: {
  cardId: string;
  newFaseId: string;
  kanbanNombre: string;
}): Promise<void> {
  try {
    if ((input.kanbanNombre ?? '').trim() !== 'Funil Step One') return;

    const admin = createAdminClient();
    const { data: fase } = await admin
      .from('kanban_fases')
      .select('id, slug')
      .eq('id', input.newFaseId)
      .maybeSingle();
    if (!fase || String((fase as { slug?: string | null }).slug ?? '').trim() !== 'step_2') return;

    const { data: card } = await admin
      .from('kanban_cards')
      .select('franqueado_id')
      .eq('id', input.cardId)
      .maybeSingle();
    const frankId = String((card as { franqueado_id?: string | null } | null)?.franqueado_id ?? '').trim();
    if (!frankId) return;

    const { data: casa } = await admin.from('uni_casas').select('id').eq('slug', 'step-one').maybeSingle();
    if (!casa?.id) return;

    const { data: mods } = await admin
      .from('uni_modulos')
      .select('id')
      .eq('casa_id', (casa as { id: string }).id)
      .eq('obrigatorio', true);
    const mids = (mods ?? []).map((m) => String((m as { id: string }).id));
    if (mids.length === 0) return;

    const { data: prog } = await admin
      .from('uni_progresso')
      .select('modulo_id')
      .eq('user_id', frankId)
      .in('modulo_id', mids)
      .eq('status', 'concluido');
    const done = new Set((prog ?? []).map((p) => String((p as { modulo_id: string }).modulo_id)));
    if (mids.every((id) => done.has(id))) return;

    const texto =
      'Para avançar para o Step 2, complete a Casa 2 — Step One na Universidade Moní.';
    await admin.from('sirene_notificacoes').insert({
      user_id: frankId,
      tipo: 'universidade_aviso',
      texto,
      titulo: 'Universidade Moní',
      mensagem: texto,
    });
  } catch {
    // silencioso
  }
}
