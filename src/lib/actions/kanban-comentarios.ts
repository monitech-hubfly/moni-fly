'use server';

import { revalidatePath } from 'next/cache';
import {
  extrairIdsMencoes,
  extrairNomesMencionados,
  htmlComentarioParaTextoPlano,
  type PerfilMencao,
} from '@/lib/kanban/mencao-comentario';
import { createClient } from '@/lib/supabase/server';

export type KanbanComentarioActionResult = { ok: true; comentarioId: string } | { ok: false; error: string };

export type KanbanComentarioListItem = {
  id: string;
  conteudo: string;
  created_at: string;
  autor_id: string | null;
  autor_nome: string | null;
};

type ComentarioDbRow = {
  id: string;
  conteudo?: string | null;
  texto?: string | null;
  created_at: string;
  autor_id?: string | null;
  autor_nome?: string | null;
};

function mapComentarioDbRow(
  row: ComentarioDbRow,
  nomePorId: Map<string, string>,
): KanbanComentarioListItem {
  const autorId = row.autor_id ? String(row.autor_id) : null;
  const nomeSalvo = String(row.autor_nome ?? '').trim();
  const nomeResolvido = autorId ? nomePorId.get(autorId)?.trim() : undefined;
  return {
    id: String(row.id),
    conteudo: String(row.conteudo ?? row.texto ?? ''),
    created_at: String(row.created_at),
    autor_id: autorId,
    autor_nome: nomeSalvo || nomeResolvido || null,
  };
}

async function resolverNomesAutoresComentarios(
  db: Awaited<ReturnType<typeof dbParaMencoes>>,
  rows: ComentarioDbRow[],
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      rows
        .filter((r) => r.autor_id && !String(r.autor_nome ?? '').trim())
        .map((r) => String(r.autor_id)),
    ),
  ];
  const nomePorId = new Map<string, string>();
  if (ids.length === 0) return nomePorId;

  const { data: profs } = await db.from('profiles').select('id, full_name, email').in('id', ids);
  for (const p of profs ?? []) {
    const id = String(p.id);
    const nome =
      String((p as { full_name?: string | null }).full_name ?? '').trim() ||
      String((p as { email?: string | null }).email ?? '').split('@')[0]?.trim() ||
      '';
    if (nome) nomePorId.set(id, nome);
  }
  return nomePorId;
}

/** Lista comentários do card com nomes de autor (service role contorna RLS de profiles). */
export async function listarComentariosKanbanCard(
  cardId: string,
): Promise<{ ok: true; items: KanbanComentarioListItem[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const id = String(cardId ?? '').trim();
  if (!id) return { ok: false, error: 'Card inválido.' };

  const { data: rows, error } = await supabase
    .from('kanban_card_comentarios')
    .select('id, conteudo, created_at, autor_id, autor_nome')
    .eq('card_id', id)
    .is('sirene_chamado_id', null)
    .order('created_at', { ascending: false });

  if (error) return { ok: false, error: error.message };

  const db = await dbParaMencoes(supabase);
  const nomePorId = await resolverNomesAutoresComentarios(db, (rows ?? []) as ComentarioDbRow[]);
  const items = ((rows ?? []) as ComentarioDbRow[]).map((r) => mapComentarioDbRow(r, nomePorId));

  return { ok: true, items };
}

async function dbParaMencoes(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    return createAdminClient();
  } catch {
    return supabase;
  }
}

/** Autocomplete @ — qualquer usuário com perfil na ferramenta (service role para contornar RLS de leitura). */
export async function buscarUsuariosParaMencao(
  query: string,
): Promise<{ id: string; nome: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const q = query.trim();
  const db = await dbParaMencoes(supabase);

  let request = db.from('profiles').select('id, full_name').order('full_name', { ascending: true }).limit(10);

  if (q.length >= 1) {
    request = request.ilike('full_name', `%${q}%`);
  } else {
    request = request.not('full_name', 'is', null).neq('full_name', '');
  }

  const { data } = await request;

  return (data ?? [])
    .map((p) => ({
      id: String(p.id),
      nome: String((p as { full_name?: string | null }).full_name ?? '').trim(),
    }))
    .filter((p) => p.nome.length > 0);
}

async function buscarPerfisPorNomesMencionados(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nomes: string[],
): Promise<PerfilMencao[]> {
  if (nomes.length === 0) return [];

  const db = await dbParaMencoes(supabase);
  const perfis = new Map<string, PerfilMencao>();
  for (const nome of nomes) {
    // Usa as primeiras 2 palavras com wildcard de prefixo — evita falha quando o regex
    // capturou palavras extras além do nome (ex: "Elisabete Nucci verificar" → busca "Elisabete Nucci%")
    const prefixoBusca = nome.split(/\s+/).slice(0, 2).join(' ');
    const { data: exatos } = await db
      .from('profiles')
      .select('id, full_name')
      .ilike('full_name', `${prefixoBusca}%`)
      .limit(10);
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

  const db = await dbParaMencoes(supabase);
  const { data: profAutor } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle();
  const autorNomePersist =
    String((profAutor as { full_name?: string | null } | null)?.full_name ?? '').trim() ||
    user.email?.split('@')[0]?.trim() ||
    null;
  const autorNome = autorNomePersist || 'Alguém';

  const { data: comentario, error: insErr } = await supabase
    .from('kanban_card_comentarios')
    .insert({
      card_id: cardId,
      autor_id: user.id,
      conteudo,
      autor_nome: autorNomePersist,
    })
    .select('id')
    .single();

  if (insErr) return { ok: false, error: insErr.message };

  const { titulo: cardTitulo, kanbanNome } = await resolverCardParaNotificacao(supabase, cardId);
  const basePath = input.basePath?.trim() || '/';
  const preview = plain.length > 120 ? `${plain.slice(0, 120)}…` : plain;

  // Resolve participantes adicionais do card (franqueado + responsáveis de atividades)
  const participantesExtras: string[] = [];
  try {
    // 1. Dono do card (franqueado_id) — se arquivado, interrompe notificações
    const { data: cardRow } = await supabase
      .from('kanban_cards')
      .select('franqueado_id, arquivado')
      .eq('id', cardId)
      .maybeSingle();
    if ((cardRow as { arquivado?: boolean | null })?.arquivado) {
      // Card arquivado — salva o comentário mas não notifica ninguém
      revalidatePath(input.basePath?.trim() || '/');
      revalidatePath('/alertas');
      return { ok: true, comentarioId: String(comentario.id) };
    }
    const fid = String((cardRow as { franqueado_id?: string | null })?.franqueado_id ?? '').trim();
    if (fid) participantesExtras.push(fid);

    // 2. Responsáveis das atividades abertas do card (responsavel_id + responsaveis_ids[])
    const { data: ativRows } = await supabase
      .from('kanban_atividades')
      .select('responsavel_id, responsaveis_ids')
      .eq('card_id', cardId)
      .not('status', 'in', '("concluida","cancelada")');
    for (const atv of (ativRows ?? []) as { responsavel_id?: string | null; responsaveis_ids?: string[] | null }[]) {
      const rid = String(atv.responsavel_id ?? '').trim();
      if (rid) participantesExtras.push(rid);
      for (const r of atv.responsaveis_ids ?? []) {
        const rs = String(r ?? '').trim();
        if (rs) participantesExtras.push(rs);
      }
    }
  } catch { /* participantes extras não bloqueiam */ }

  // Deduplicação: @mencionados têm prioridade; participantes extras recebem alerta separado
  const mencionadosSemAutor = mencoesIds.filter(uid => uid !== user.id);
  const mencionadosSet = new Set(mencionadosSemAutor);
  const extrasSemAutor = participantesExtras.filter(uid => uid !== user.id && !mencionadosSet.has(uid));

  // Alertas por @menção
  for (const uid of mencionadosSemAutor) {
    await supabase.from('alertas').insert({
      user_id: uid,
      tipo: 'mencao_kanban_card',
      mensagem: `${autorNome} mencionou você em "${cardTitulo}" (${kanbanNome}): "${preview}"`,
      referencia_card_id: cardId,
      referencia_path: basePath,
    });
  }

  // Alertas para demais participantes (sem @menção)
  for (const uid of extrasSemAutor) {
    await supabase.from('alertas').insert({
      user_id: uid,
      tipo: 'kanban_atividade_atualizada',
      mensagem: `${autorNome} comentou em "${cardTitulo}" (${kanbanNome}): "${preview}"`,
      referencia_card_id: cardId,
      referencia_path: basePath,
    });
  }

  if (mencionadosSemAutor.length > 0) {
    const { enviarEmailsMencaoUsuarios } = await import('@/lib/mencoes/enviar-email-mencao');
    const linkPath = `${basePath}?card=${encodeURIComponent(cardId)}`;
    void enviarEmailsMencaoUsuarios({
      userIds: mencionadosSemAutor,
      autorId: user.id,
      cardTitulo,
      autorNome,
      comentarioPreview: preview,
      linkPath,
    }).catch((err) => console.error('[kanban-comentarios] email menção', err));
  }

  revalidatePath(basePath);
  revalidatePath('/alertas');
  return { ok: true, comentarioId: String(comentario.id) };
}
