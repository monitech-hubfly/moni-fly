import type { SupabaseClient } from '@supabase/supabase-js';

/** Sub-atividade considerada encerrada para o criador poder concluir o chamado. */
export function topicoStatusFechado(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim();
  return s === 'concluido' || s === 'aprovado';
}

export function todosTopicosFechados(
  topicos: Array<{ status?: string | null }>,
): boolean {
  return topicos.length > 0 && topicos.every((t) => topicoStatusFechado(t.status));
}

/** Status dos tópicos: fluxo legado (`chamado_id`) ou card/Sirene (`interacao_id` via `kanban_atividades`). */
export async function buscarTopicosStatusChamado(
  supabase: SupabaseClient,
  chamadoId: number,
): Promise<Array<{ status?: string | null }>> {
  const { data: direct } = await supabase
    .from('sirene_topicos')
    .select('status')
    .eq('chamado_id', chamadoId)
    .eq('arquivado', false);
  if (direct && direct.length > 0) return direct;

  const { data: interacoes } = await supabase
    .from('kanban_atividades')
    .select('id')
    .eq('sirene_chamado_id', chamadoId);
  const interacaoIds = (interacoes ?? []).map((r) => String((r as { id: string }).id));
  if (interacaoIds.length === 0) return [];

  const { data: viaInteracao } = await supabase
    .from('sirene_topicos')
    .select('status')
    .in('interacao_id', interacaoIds)
    .eq('arquivado', false);
  return viaInteracao ?? [];
}

/** Resolve `sirene_chamados.id` a partir de `sirene_topicos.chamado_id` ou `kanban_atividades`. */
export async function resolverSireneChamadoId(
  supabase: SupabaseClient,
  opts: { chamadoId?: number | null; interacaoId?: string | null },
): Promise<number | null> {
  if (opts.chamadoId != null && Number.isFinite(Number(opts.chamadoId))) {
    return Number(opts.chamadoId);
  }
  const iid = String(opts.interacaoId ?? '').trim();
  if (!iid) return null;
  const { data } = await supabase
    .from('kanban_atividades')
    .select('sirene_chamado_id')
    .eq('id', iid)
    .maybeSingle();
  const sid = (data as { sirene_chamado_id?: number | null } | null)?.sirene_chamado_id;
  return sid != null && Number.isFinite(Number(sid)) ? Number(sid) : null;
}

/** Primeiro atendimento: primeira vez que qualquer atividade vai para em_andamento. */
export async function registrarPrimeiroAtendimentoSeNecessario(
  supabase: SupabaseClient,
  chamadoId: number,
): Promise<void> {
  const { data } = await supabase
    .from('sirene_chamados')
    .select('data_inicio_atendimento, status')
    .eq('id', chamadoId)
    .maybeSingle();
  if (!data) return;

  const patch: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };
  let needsUpdate = false;

  if (!data.data_inicio_atendimento) {
    patch.data_inicio_atendimento = new Date().toISOString();
    needsUpdate = true;
  }

  const st = String((data as { status?: string }).status ?? '');
  if (st === 'nao_iniciado') {
    patch.status = 'em_andamento';
    needsUpdate = true;
  }

  if (!needsUpdate) return;

  await supabase.from('sirene_chamados').update(patch).eq('id', chamadoId);
}
