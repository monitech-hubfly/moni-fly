import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProximasAtividadesConteudo } from './ProximasAtividadesConteudo';

export const dynamic = 'force-dynamic';

export default async function ProximasAtividadesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  guardLoginRequired(user);

  const { data: cardsRaw } = await supabase
    .from('kanban_cards')
    .select('id, titulo, proxima_atividade, prazo_atividade, franqueado_id, kanban_id, fase_id')
    .eq('arquivado', false);

  const cardIdsAtivos = (cardsRaw ?? []).map((c: any) => c.id as string);
  const { data: atividadesAbertas } = cardIdsAtivos.length > 0
    ? await supabase
        .from('kanban_proximas_atividades')
        .select('id, card_id, descricao, prazo')
        .in('card_id', cardIdsAtivos)
        .is('concluido_em', null)
        .order('prazo', { ascending: true, nullsFirst: false })
    : { data: [] };

  const atividadesPorCard = new Map<string, { id: string; descricao: string; prazo: string | null }[]>();
  for (const a of (atividadesAbertas ?? []) as { id: string; card_id: string; descricao: string; prazo: string | null }[]) {
    const lista = atividadesPorCard.get(a.card_id) ?? [];
    lista.push({ id: a.id, descricao: a.descricao, prazo: a.prazo });
    atividadesPorCard.set(a.card_id, lista);
  }

  const cardsComAtividades = (cardsRaw ?? []).filter((c: any) =>
    atividadesPorCard.has(c.id as string) || Boolean(c.proxima_atividade)
  );

  const kanbanIds = [...new Set(cardsComAtividades.map((c: any) => c.kanban_id as string).filter(Boolean))];
  const { data: kanbanRows } = kanbanIds.length > 0
    ? await supabase.from('kanbans').select('id, nome').in('id', kanbanIds)
    : { data: [] };
  const kanbanNomePorId = new Map((kanbanRows ?? []).map((k: any) => [k.id as string, k.nome as string]));

  const faseIds = [...new Set(cardsComAtividades.map((c: any) => c.fase_id as string | null).filter(Boolean))] as string[];
  const { data: faseRows } = faseIds.length > 0
    ? await supabase.from('kanban_fases').select('id, nome').in('id', faseIds)
    : { data: [] };
  const faseNomePorId = new Map((faseRows ?? []).map((f: any) => [f.id as string, f.nome as string]));

  const franqIds = [...new Set(cardsComAtividades.map((c: any) => c.franqueado_id as string | null).filter(Boolean))] as string[];
  const { data: profileRows } = franqIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', franqIds)
    : { data: [] };
  const nomePorFranqId = new Map((profileRows ?? []).map((p: any) => [p.id as string, p.full_name as string | null]));

  const { data: tagRows } = await supabase.from('kanban_tags').select('id').eq('nome', '⭐Especial');
  const tagIds = (tagRows ?? []).map((t: any) => t.id as string);
  const { data: cardTagRows } = tagIds.length > 0
    ? await supabase.from('kanban_card_tags').select('card_id').in('tag_id', tagIds)
    : { data: [] };
  const tagSet = new Set((cardTagRows ?? []).map((t: any) => t.card_id as string));

  const cardIdsParaComentarios = cardsComAtividades.map((c: any) => c.id as string);
  const { data: comentariosRows } = cardIdsParaComentarios.length > 0
    ? await supabase
        .from('kanban_card_comentarios')
        .select('card_id')
        .in('card_id', cardIdsParaComentarios)
        .is('sirene_chamado_id', null)
    : { data: [] };
  const comentariosCountPorCard = new Map<string, number>();
  ((comentariosRows ?? []) as Array<{ card_id: string }>).forEach(r => {
    comentariosCountPorCard.set(r.card_id, (comentariosCountPorCard.get(r.card_id) ?? 0) + 1);
  });

  const { data: kanbanRows2 } = await supabase
    .from('kanbans')
    .select('nome')
    .eq('ativo', true)
    .order('nome', { ascending: true });
  const todosKanbanNames = (kanbanRows2 ?? []).map((k: any) => k.nome as string);

  const cards = cardsComAtividades.map((c: any) => ({
    id: c.id as string,
    titulo: (c.titulo as string | null) ?? '—',
    franqueado_id: (c.franqueado_id as string | null) ?? null,
    franqueado_nome: (c.franqueado_id ? (nomePorFranqId.get(c.franqueado_id as string) ?? null) : null) as string | null,
    kanban_id: (c.kanban_id as string) ?? '',
    kanban_nome: (c.kanban_id ? (kanbanNomePorId.get(c.kanban_id as string) ?? 'Funil') : 'Funil') as string,
    fase_nome: (c.fase_id ? (faseNomePorId.get(c.fase_id as string) ?? null) : null) as string | null,
    especial: tagSet.has(c.id as string),
    comentarios_count: comentariosCountPorCard.get(c.id as string) ?? 0,
    atividades: (() => {
      const lista = atividadesPorCard.get(c.id as string);
      if (lista && lista.length > 0) return lista;
      const proxLegado = (c.proxima_atividade as string | null);
      if (proxLegado) return [{ id: 'legado', descricao: proxLegado, prazo: (c.prazo_atividade as string | null) }];
      return [];
    })(),
  }));

  return <ProximasAtividadesConteudo cards={cards} kanbanNames={todosKanbanNames} />;
}
