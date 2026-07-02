import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
    .select('id, card_id, chamado_numero, card_titulo, kanban_nome, kanban_id, responsavel_id, responsaveis_ids, responsavel_nome, tipo, titulo, descricao, atividade_status, data_vencimento, time_nome, franqueado_nome, criado_em, sla_status, fase_nome, origem')
    .order('data_vencimento', { ascending: true, nullsFirst: false });

  const adminClient = createAdminClient();

  const CHAMADO_SELECT = 'id, numero, tipo, incendio, arquivado, card_id, processo_id, processo_titulo, processo_kanban_nome, aberto_por_nome';

  // Caminho (a): tópicos com chamado_id preenchido — join direto
  // Caminho (b): tópicos com chamado_id NULL — busca em paralelo, resolve via interacao_id
  const [{ data: topicosComChamadoId }, { data: topicosInteracaoRaw }] = await Promise.all([
    adminClient
      .from('sirene_topicos')
      .select(`id, nome, status, data_fim, responsavel_id, responsaveis_ids, chamado:sirene_chamados!inner(${CHAMADO_SELECT})`)
      .eq('chamado.arquivado', false),
    adminClient
      .from('sirene_topicos')
      .select('id, nome, status, data_fim, responsavel_id, responsaveis_ids, interacao_id')
      .is('chamado_id', null)
      .not('interacao_id', 'is', null),
  ]);

  // Resolve interacao_id → sirene_chamado_id → sirene_chamados para o caminho (b)
  const interacaoIds = (topicosInteracaoRaw ?? []).map((t: any) => String(t.interacao_id));
  const { data: kaRows } = interacaoIds.length > 0
    ? await adminClient
        .from('kanban_atividades')
        .select('id, sirene_chamado_id')
        .in('id', interacaoIds)
        .not('sirene_chamado_id', 'is', null)
    : { data: [] };

  const chamadoIdPorInteracaoId = new Map((kaRows ?? []).map((ka: any) => [String(ka.id), Number(ka.sirene_chamado_id)]));
  const sireneIdsCaminhoB = [...new Set((kaRows ?? []).map((ka: any) => Number(ka.sirene_chamado_id)))];

  const { data: chamadosCaminhoB } = sireneIdsCaminhoB.length > 0
    ? await adminClient
        .from('sirene_chamados')
        .select(CHAMADO_SELECT)
        .in('id', sireneIdsCaminhoB)
        .eq('arquivado', false)
    : { data: [] };

  const chamadoPorId = new Map((chamadosCaminhoB ?? []).map((c: any) => [Number(c.id), c]));

  // Normaliza caminho (b) para a mesma forma do caminho (a): { ...topico, chamado }
  const topicosViaCaminhoB = (topicosInteracaoRaw ?? [])
    .map((t: any) => {
      const sireneId = chamadoIdPorInteracaoId.get(String(t.interacao_id));
      if (!sireneId) return null;
      const chamado = chamadoPorId.get(sireneId);
      if (!chamado) return null;
      return { id: t.id, nome: t.nome, status: t.status, data_fim: t.data_fim, responsavel_id: t.responsavel_id, responsaveis_ids: (t.responsaveis_ids as string[] | null) ?? [], chamado };
    })
    .filter((t: any): t is NonNullable<typeof t> => t !== null);

  // Mescla ambos os caminhos
  const topicosSirene = [...(topicosComChamadoId ?? []), ...topicosViaCaminhoB];

  // Resolve kanban_nome via card_id → kanban_cards → kanbans
  const cardIds = topicosSirene
    .map((t: any) => t.chamado?.card_id)
    .filter(Boolean);

  const processoIds = topicosSirene
    .map((t: any) => t.chamado?.processo_id)
    .filter(Boolean);

  const { data: kanbanCards } = cardIds.length > 0
    ? await adminClient
        .from('kanban_cards')
        .select('id, kanban_id, titulo')
        .in('id', cardIds)
    : { data: [] };

  const kanbanIds = [...new Set((kanbanCards ?? []).map((c: any) => c.kanban_id))];

  const { data: kanbanRows } = kanbanIds.length > 0
    ? await adminClient
        .from('kanbans')
        .select('id, nome')
        .in('id', kanbanIds)
    : { data: [] };

  const kanbanNomePorId = new Map((kanbanRows ?? []).map((k: any) => [k.id, k.nome]));
  const kanbanPorCardId = new Map(
    (kanbanCards ?? []).map((c: any) => [c.id, kanbanNomePorId.get(c.kanban_id) ?? null])
  );
  const tituloPorCardId = new Map(
    (kanbanCards ?? []).map((c: any) => [String(c.id), (c.titulo as string | null) ?? null])
  );

  // Mantém resolução via processo_id como fallback
  const kanbanPorProcessoId = new Map<string, string | null>();

  const { data: responsaveisTopicos } = await supabase
    .from('profiles')
    .select('id, full_name');

  const nomePorId = new Map((responsaveisTopicos ?? []).map((p) => [p.id, p.full_name]));

  const topicosNormalizados = (topicosSirene ?? [])
    .map((t: any) => ({
      id: `topico-${t.id}`,
      card_id: t.chamado.card_id ?? t.chamado.processo_id ?? null,
      chamado_numero: t.chamado.numero,
      card_titulo: (t.chamado.card_id ? tituloPorCardId.get(t.chamado.card_id) : null) ?? t.chamado.processo_titulo ?? null,
      kanban_nome: t.chamado.processo_kanban_nome
        ?? (t.chamado.card_id ? kanbanPorCardId.get(t.chamado.card_id) : null)
        ?? (t.chamado.processo_id ? kanbanPorProcessoId.get(t.chamado.processo_id) : null)
        ?? 'Sirene',
      kanban_id: '',
      responsavel_id: t.responsavel_id,
      responsaveis_ids: (t.responsaveis_ids as string[] | null) ?? [],
      responsavel_nome: t.responsavel_id ? nomePorId.get(t.responsavel_id) ?? null : null,
      tipo: t.chamado.tipo ?? 'sirene',
      titulo: t.nome ?? t.descricao ?? (t.chamado.incendio as string | null) ?? (t.chamado.tipo as string | null) ?? 'Atividade sem nome',
      descricao: null,
      atividade_status: t.status,
      data_vencimento: t.data_fim,
      time_nome: null,
      franqueado_nome: t.chamado.aberto_por_nome ?? null,
      criado_em: '',
      sla_status: null,
      fase_nome: null,
      origemDado: 'sirene' as const,
      chamado_titulo: (t.chamado.incendio as string | null) ?? (t.chamado.tipo as string | null) ?? null,
    }));

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

  const atividadesBase = [
    // Exclui origem='sirene' da view — esses registros são cabeçalhos de chamado,
    // não atividades individuais. A granularidade correta vem de topicosNormalizados.
    ...(atividades ?? [])
      .filter((a) => (a as { origem?: string }).origem !== 'sirene')
      .map((a) => ({ ...a, origemDado: 'kanban' as const, chamado_titulo: null })),
    ...topicosNormalizados,
  ];

  const atividadesComPrazo = atividadesBase.map((a) => {
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
