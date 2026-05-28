'use server';

import { revalidatePath } from 'next/cache';
import {
  extrairIdsMencoes,
  extrairNomesMencionados,
  htmlComentarioParaTextoPlano,
  type PerfilMencao,
} from '@/lib/kanban/mencao-comentario';
import { createClient } from '@/lib/supabase/server';

export type KanbanComentarioActionResult = { ok: true } | { ok: false; error: string };

/** Autocomplete @ — qualquer usuário com perfil na ferramenta. */
export async function buscarUsuariosParaMencao(
  query: string,
): Promise<{ id: string; nome: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const q = query.trim();
  if (q.length < 1) return [];

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('full_name', `%${q}%`)
    .order('full_name', { ascending: true })
    .limit(10);

  return (data ?? [])
    .map((p) => ({
      id: String(p.id),
      nome: String((p as { full_name?: string | null }).full_name ?? '').trim() || 'Sem nome',
    }))
    .filter((p) => p.nome !== 'Sem nome' || q.length >= 2);
}

async function buscarPerfisPorNomesMencionados(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nomes: string[],
): Promise<PerfilMencao[]> {
  if (nomes.length === 0) return [];

  const perfis = new Map<string, PerfilMencao>();
  for (const nome of nomes) {
    const { data: exatos } = await supabase
      .from('profiles')
      .select('id, full_name')
      .ilike('full_name', nome)
      .limit(5);
    for (const row of exatos ?? []) {
      const id = String(row.id);
      const n = String((row as { full_name?: string | null }).full_name ?? '').trim();
      if (n) perfis.set(id, { id, nome: n });
    }
  }

  return [...perfis.values()];
}

async function resolverCardParaNotificacao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<{ titulo: string; kanbanNome: string }> {
  const { data: nativo } = await supabase
    .from('kanban_cards')
    .select('titulo, kanbans(nome)')
    .eq('id', cardId)
    .maybeSingle();

  if (nativo) {
    const k = nativo.kanbans as { nome?: string } | { nome?: string }[] | null;
    const kn = Array.isArray(k) ? k[0] : k;
    return {
      titulo: String(nativo.titulo ?? 'Card').trim() || 'Card',
      kanbanNome: String(kn?.nome ?? 'Funil').trim() || 'Funil',
    };
  }

  const { data: legado } = await supabase
    .from('v_processo_como_kanban_cards')
    .select('titulo, kanbans(nome)')
    .eq('id', cardId)
    .maybeSingle();

  if (legado) {
    const k = legado.kanbans as { nome?: string } | { nome?: string }[] | null;
    const kn = Array.isArray(k) ? k[0] : k;
    return {
      titulo: String(legado.titulo ?? 'Card').trim() || 'Card',
      kanbanNome: String(kn?.nome ?? 'Funil').trim() || 'Funil',
    };
  }

  return { titulo: 'Card', kanbanNome: 'Funil' };
}

/** Publica comentário no card kanban; @menções geram alertas no sino. */
export async function publicarComentarioKanbanCard(input: {
  cardId: string;
  conteudo: string;
  faseId?: string | null;
  basePath?: string;
}): Promise<KanbanComentarioActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cardId = String(input.cardId ?? '').trim();
  const conteudo = String(input.conteudo ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };
  if (!conteudo) return { ok: false, error: 'Digite o comentário.' };

  const plain = htmlComentarioParaTextoPlano(conteudo);
  if (!plain) return { ok: false, error: 'Digite o comentário.' };

  const nomesMencionados = extrairNomesMencionados(plain);
  const perfis = await buscarPerfisPorNomesMencionados(supabase, nomesMencionados);
  const mencoesIds = extrairIdsMencoes(plain, perfis);

  const { data: comentario, error: insErr } = await supabase
    .from('kanban_card_comentarios')
    .insert({
      card_id: cardId,
      fase_id: input.faseId?.trim() || null,
      autor_id: user.id,
      conteudo,
    })
    .select('id')
    .single();

  if (insErr) return { ok: false, error: insErr.message };

  const { data: profAutor } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();
  const autorNome =
    String((profAutor as { full_name?: string | null } | null)?.full_name ?? '').trim() ||
    'Alguém';

  const { titulo: cardTitulo, kanbanNome } = await resolverCardParaNotificacao(supabase, cardId);
  const basePath = input.basePath?.trim() || '/';
  const preview = plain.length > 120 ? `${plain.slice(0, 120)}…` : plain;

  for (const uid of mencoesIds) {
    if (uid === user.id) continue;
    await supabase.from('alertas').insert({
      user_id: uid,
      tipo: 'mencao_kanban_card',
      mensagem: `${autorNome} mencionou você em "${cardTitulo}" (${kanbanNome}): "${preview}"`,
      referencia_card_id: cardId,
      referencia_path: basePath,
    });
  }

  void comentario;
  revalidatePath(basePath);
  revalidatePath('/alertas');
  return { ok: true };
}
