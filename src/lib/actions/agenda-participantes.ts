'use server';

import { createClient } from '@/lib/supabase/server';

export type ParticipanteStatus = {
  profile_id: string;
  nome: string | null;
  status: 'pendente' | 'aceito' | 'recusado' | 'proposta_horario';
  proposta_data: string | null;
  proposta_hora_inicio: string | null;
  proposta_hora_fim: string | null;
  respondido_em: string | null;
};

// ── Enviar convites internos ────────────────────────────────────────────────
// Chama depois de inserir novos participantes.
export async function enviarConvitesInternos(
  ganttId: string,
  participanteIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (participanteIds.length === 0) return { ok: true };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado' };

  try {
    // Buscar dados do evento
    const { data: gantt } = await supabase
      .from('gantt_planejamento')
      .select('titulo, data, hora_inicio, hora_fim, acoes(tipo_atividade)')
      .eq('id', ganttId)
      .maybeSingle();

    const acao = gantt?.acoes
      ? (Array.isArray(gantt.acoes) ? gantt.acoes[0] : gantt.acoes)
      : null;
    const titulo = (acao as { tipo_atividade?: string } | null)?.tipo_atividade
      ?? (gantt?.titulo as string | null)
      ?? '(sem título)';

    // Buscar nome do organizador
    const { data: orgProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    const organizadorNome = (orgProfile as { full_name?: string | null } | null)?.full_name ?? user.email ?? 'Alguém';

    const data = (gantt?.data as string | null) ?? '';
    const horaInicio = (gantt?.hora_inicio as string | null) ?? '';
    const dataFormatada = data
      ? new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      : '';

    // Enviar alerta para cada convidado via admin client
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminDb = createAdminClient();

    const alertas = participanteIds.map(profileId => ({
      user_id: profileId,
      tipo: 'convite_agenda_interno',
      mensagem: `Convite: ${organizadorNome} convidou você para "${titulo}"${dataFormatada ? ` em ${dataFormatada}` : ''}${horaInicio ? ` às ${horaInicio}` : ''}.`,
      referencia_path: `/carometro/todo-planning`,
    }));

    const { error } = await adminDb.from('alertas').insert(alertas);
    if (error) {
      console.error('[enviarConvitesInternos] erro alertas:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[enviarConvitesInternos]', msg);
    return { ok: false, error: msg };
  }
}

// ── Responder convite ───────────────────────────────────────────────────────
export async function responderConvite(
  ganttId: string,
  novoStatus: 'aceito' | 'recusado' | 'proposta_horario',
  proposta?: {
    data: string;
    hora_inicio: string;
    hora_fim: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado' };

  const update: Record<string, unknown> = {
    status: novoStatus,
    respondido_em: new Date().toISOString(),
  };

  if (novoStatus === 'proposta_horario' && proposta) {
    update.proposta_data        = proposta.data;
    update.proposta_hora_inicio = proposta.hora_inicio;
    update.proposta_hora_fim    = proposta.hora_fim;
  } else {
    update.proposta_data        = null;
    update.proposta_hora_inicio = null;
    update.proposta_hora_fim    = null;
  }

  // Usar admin client para contornar ausência de UPDATE policy em gantt_agenda_participantes
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminDb = createAdminClient();

  const { error } = await adminDb
    .from('gantt_agenda_participantes')
    .update(update)
    .eq('gantt_id', ganttId)
    .eq('profile_id', user.id);

  if (error) return { ok: false, error: error.message };

  // Se proposta de horário: notificar organizador
  if (novoStatus === 'proposta_horario' && proposta) {
    await notificarOrganizerProposta(ganttId, user.id, proposta);
  }

  // Se aceitou ou recusou: marcar alertas de convite como lidos
  if (novoStatus === 'aceito' || novoStatus === 'recusado') {
    await supabase
      .from('alertas')
      .update({ lido: true })
      .eq('user_id', user.id)
      .eq('tipo', 'convite_agenda_interno')
      .eq('lido', false);
  }

  return { ok: true };
}

// ── Notificar organizador sobre proposta de novo horário ───────────────────
async function notificarOrganizerProposta(
  ganttId: string,
  proponenteId: string,
  proposta: { data: string; hora_inicio: string; hora_fim: string },
): Promise<void> {
  const supabase = await createClient();

  try {
    // Buscar organizador do evento
    const { data: gantt } = await supabase
      .from('gantt_planejamento')
      .select('profile_id, titulo, acoes(tipo_atividade)')
      .eq('id', ganttId)
      .maybeSingle();

    const organizadorId = (gantt?.profile_id as string | null);
    if (!organizadorId) return;

    const acao = gantt?.acoes
      ? (Array.isArray(gantt.acoes) ? gantt.acoes[0] : gantt.acoes)
      : null;
    const titulo = (acao as { tipo_atividade?: string } | null)?.tipo_atividade
      ?? (gantt?.titulo as string | null)
      ?? '(sem título)';

    // Buscar nome do proponente
    const { data: profData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', proponenteId)
      .maybeSingle();
    const proponenteNome = (profData as { full_name?: string | null } | null)?.full_name ?? 'Um participante';

    const dataFormatada = new Date(proposta.data + 'T12:00:00')
      .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminDb = createAdminClient();

    await adminDb.from('alertas').insert({
      user_id: organizadorId,
      tipo: 'proposta_horario_agenda',
      mensagem: `Proposta: ${proponenteNome} sugeriu novo horário para "${titulo}": ${dataFormatada} ${proposta.hora_inicio}–${proposta.hora_fim}.`,
      referencia_path: `/carometro/todo-planning`,
    });
  } catch (e) {
    console.error('[notificarOrganizerProposta]', e);
  }
}

// ── Buscar status dos participantes internos de um evento ──────────────────
export async function buscarStatusParticipantes(
  ganttId: string,
): Promise<{ ok: true; participantes: ParticipanteStatus[] } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('gantt_agenda_participantes')
    .select('profile_id, status, proposta_data, proposta_hora_inicio, proposta_hora_fim, respondido_em')
    .eq('gantt_id', ganttId);

  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as {
    profile_id: string;
    status: string | null;
    proposta_data: string | null;
    proposta_hora_inicio: string | null;
    proposta_hora_fim: string | null;
    respondido_em: string | null;
  }[];

  if (rows.length === 0) return { ok: true, participantes: [] };

  // Buscar nomes
  const ids = rows.map(r => r.profile_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', ids);

  const nomeMap = new Map<string, string>();
  for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
    nomeMap.set(p.id, p.full_name ?? '');
  }

  const participantes: ParticipanteStatus[] = rows.map(r => ({
    profile_id: r.profile_id,
    nome: nomeMap.get(r.profile_id) ?? null,
    status: (r.status ?? 'aceito') as ParticipanteStatus['status'],
    proposta_data: r.proposta_data,
    proposta_hora_inicio: r.proposta_hora_inicio,
    proposta_hora_fim: r.proposta_hora_fim,
    respondido_em: r.respondido_em,
  }));

  return { ok: true, participantes };
}

// ── Aceitar proposta de horário (pelo organizador) ─────────────────────────
export async function aceitarPropostaHorario(
  ganttId: string,
  participanteId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado' };

  // Buscar proposta
  const { data: part } = await supabase
    .from('gantt_agenda_participantes')
    .select('proposta_data, proposta_hora_inicio, proposta_hora_fim')
    .eq('gantt_id', ganttId)
    .eq('profile_id', participanteId)
    .maybeSingle();

  if (!part?.proposta_data) return { ok: false, error: 'Nenhuma proposta encontrada' };

  // Atualizar horário do evento
  const { error: errGantt } = await supabase
    .from('gantt_planejamento')
    .update({
      data:        part.proposta_data,
      hora_inicio: part.proposta_hora_inicio,
      hora_fim:    part.proposta_hora_fim,
    })
    .eq('id', ganttId);

  if (errGantt) return { ok: false, error: errGantt.message };

  // Atualizar status do participante para aceito (admin client: sem UPDATE policy)
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminDb2 = createAdminClient();

  await adminDb2
    .from('gantt_agenda_participantes')
    .update({
      status: 'aceito',
      proposta_data: null,
      proposta_hora_inicio: null,
      proposta_hora_fim: null,
      respondido_em: new Date().toISOString(),
    })
    .eq('gantt_id', ganttId)
    .eq('profile_id', participanteId);

  // Notificar participante
  try {
    const { data: gantt } = await supabase
      .from('gantt_planejamento')
      .select('titulo, acoes(tipo_atividade)')
      .eq('id', ganttId)
      .maybeSingle();
    const acao = gantt?.acoes
      ? (Array.isArray(gantt.acoes) ? gantt.acoes[0] : gantt.acoes)
      : null;
    const titulo = (acao as { tipo_atividade?: string } | null)?.tipo_atividade
      ?? (gantt?.titulo as string | null) ?? '(sem título)';

    await adminDb2.from('alertas').insert({
      user_id: participanteId,
      tipo: 'convite_agenda_interno',
      mensagem: `Proposta aceita: o organizador aceitou seu novo horário para "${titulo}".`,
      referencia_path: `/carometro/todo-planning`,
    });
  } catch { /* silencioso */ }

  return { ok: true };
}
