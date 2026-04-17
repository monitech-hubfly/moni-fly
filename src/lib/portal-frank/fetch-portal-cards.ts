import type { SupabaseClient } from '@supabase/supabase-js';

export type PortalFrankCardRow = {
  id: string;
  titulo: string;
  kanban_id: string;
  kanban_nome: string;
  fase_id: string;
  created_at: string;
  origem: 'nativo' | 'legado';
  arquivado?: boolean;
  concluido?: boolean;
};

/**
 * Cards do franqueado em todos os funis nativos + legado (view), filtrando por `auth.uid()`.
 */
export async function fetchPortalFrankCards(
  supabase: SupabaseClient,
  userId: string,
): Promise<PortalFrankCardRow[]> {
  const out: PortalFrankCardRow[] = [];

  const { data: nativos, error: e1 } = await supabase
    .from('kanban_cards')
    .select('id, titulo, fase_id, kanban_id, created_at, arquivado, concluido, kanbans(nome)')
    .eq('franqueado_id', userId)
    .eq('status', 'ativo')
    .order('created_at', { ascending: false });

  if (!e1 && nativos?.length) {
    for (const row of nativos) {
      const r = row as {
        id: string;
        titulo: string | null;
        fase_id: string;
        kanban_id: string;
        created_at: string;
        arquivado?: boolean | null;
        concluido?: boolean | null;
        kanbans?: { nome?: string | null } | { nome?: string | null }[] | null;
      };
      const kn = r.kanbans;
      const nome = Array.isArray(kn) ? kn[0]?.nome : kn?.nome;
      out.push({
        id: String(r.id),
        titulo: (r.titulo ?? '').trim() || '(sem título)',
        kanban_id: String(r.kanban_id),
        kanban_nome: String(nome ?? '').trim() || 'Kanban',
        fase_id: String(r.fase_id ?? ''),
        created_at: String(r.created_at ?? ''),
        origem: 'nativo',
        arquivado: Boolean(r.arquivado),
        concluido: Boolean(r.concluido),
      });
    }
  }

  const { data: legados, error: e2 } = await supabase
    .from('v_processo_como_kanban_cards')
    .select('id, titulo, fase_id, kanban_id, criado_em, kanbans(nome)')
    .eq('responsavel_id', userId)
    .order('criado_em', { ascending: false });

  if (!e2 && legados?.length) {
    for (const row of legados) {
      const r = row as {
        id: string;
        titulo: string | null;
        fase_id: string;
        kanban_id: string;
        criado_em: string;
        kanbans?: { nome?: string | null } | { nome?: string | null }[] | null;
      };
      const kn = r.kanbans;
      const nome = Array.isArray(kn) ? kn[0]?.nome : kn?.nome;
      out.push({
        id: String(r.id),
        titulo: (r.titulo ?? '').trim() || '(sem título)',
        kanban_id: String(r.kanban_id),
        kanban_nome: String(nome ?? '').trim() || 'Kanban',
        fase_id: String(r.fase_id ?? ''),
        created_at: String(r.criado_em ?? ''),
        origem: 'legado',
      });
    }
  }

  out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return out;
}

/** Períodos com validação já concluída (`validado_em` preenchido). */
export async function fetchPeriodosValidadosFrank(
  supabase: SupabaseClient,
  frankId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('frank_validacoes_dados')
    .select('periodo')
    .eq('frank_id', frankId)
    .not('validado_em', 'is', null);

  const s = new Set<string>();
  if (error || !data?.length) return s;
  for (const row of data) {
    const p = (row as { periodo?: string | null }).periodo;
    if (p) s.add(String(p));
  }
  return s;
}
