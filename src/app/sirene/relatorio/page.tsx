import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RelatorioConteudo } from './RelatorioConteudo';

export const dynamic = 'force-dynamic';

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams?: { visao?: string; funil?: string; card?: string; prazo?: string; tag?: string; resp?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  guardLoginRequired(user);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const { data: atividades } = await supabase
    .from('v_atividades_unificadas')
    .select('id, card_id, chamado_numero, card_titulo, kanban_nome, kanban_id, responsavel_id, responsavel_nome, tipo, titulo, descricao, atividade_status, data_vencimento, time_nome, franqueado_nome, criado_em, sla_status, fase_nome')
    .order('data_vencimento', { ascending: true, nullsFirst: false });

  // kanban_tags tem uma linha por funil — busca todos os IDs da tag "⭐Especial"
  const { data: tagRows } = await supabase
    .from('kanban_tags')
    .select('id')
    .eq('nome', '⭐Especial');

  const tagIds = (tagRows ?? []).map((t) => t.id);

  const { data: cardTagRows } = tagIds.length > 0
    ? await supabase.from('kanban_card_tags').select('card_id').in('tag_id', tagIds)
    : { data: [] };

  const tagSet = new Set((cardTagRows ?? []).map((t) => t.card_id));

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const atividadesComPrazo = (atividades ?? []).map((a) => {
    const prazo = a.data_vencimento ? new Date(a.data_vencimento) : null;
    if (prazo) prazo.setHours(0, 0, 0, 0);
    const diffDias = prazo ? Math.round((prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const urgencia = (diffDias === null ? 'sem_prazo' : diffDias < 0 ? 'atrasado' : diffDias <= 3 ? 'alerta' : 'ok') as 'atrasado' | 'alerta' | 'ok' | 'sem_prazo';
    return { ...a, diffDias, urgencia, especial: tagSet.has(a.card_id ?? '') };
  });

  const stats = {
    atrasadas: atividadesComPrazo.filter((a) => a.urgencia === 'atrasado').length,
    alerta: atividadesComPrazo.filter((a) => a.urgencia === 'alerta').length,
    total: atividadesComPrazo.length,
    especial: atividadesComPrazo.filter((a) => a.especial).length,
  };

  return (
    <RelatorioConteudo
      atividades={atividadesComPrazo}
      stats={stats}
      currentUserId={user.id}
      isAdmin={profile?.role === 'admin'}
      searchParams={searchParams}
    />
  );
}
