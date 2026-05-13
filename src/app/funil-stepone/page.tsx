import { guardLoginRequired } from '@/lib/auth-guard';
import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { KanbanBoard } from '@/components/kanban-shared/KanbanBoard';
import { KanbanWrapper } from '@/components/kanban-shared/KanbanWrapper';
import { KanbanTabs } from './KanbanTabs';
import { PainelPerformance } from '@/components/kanban-shared/PainelPerformance';
import type { KanbanCardBrief, KanbanFase } from '@/components/kanban-shared/types';
import { parseKanbanFaseMateriais } from '@/lib/kanban/parse-kanban-fase-materiais';

export const dynamic = 'force-dynamic';

export default async function FunilStepOnePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const activeTab = (searchParams.tab as string) || 'kanban';
  
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = (profile?.role as string) ?? 'frank';
  
  console.log('[FunilStepOne] User ID:', user.id);
  console.log('[FunilStepOne] Role:', role);

  // Busca o kanban "Funil Step One"
  const { data: kanbans, error: kanbanError } = await supabase
    .from('kanbans')
    .select('id, nome')
    .eq('nome', 'Funil Step One')
    .eq('ativo', true)
    .limit(1);

  if (kanbanError) {
    console.error('[FunilStepOne] erro ao buscar kanban:', kanbanError);
  }
  console.log('[FunilStepOne] kanbans encontrados:', kanbans);

  const kanban = kanbans?.[0] ?? null;

  if (!kanban) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="text-center">
          <h1 className="text-xl font-bold text-stone-800">Kanban não encontrado</h1>
          <p className="mt-2 text-sm text-stone-600">
            O Kanban &ldquo;Funil Step One&rdquo; ainda não foi configurado.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-moni-primary hover:underline">
            ← Voltar
          </Link>
        </div>
      </div>
    );
  }

  // Busca as fases deste kanban
  const { data: fasesRaw } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias, slug, instrucoes, materiais')
    .eq('kanban_id', kanban.id)
    .eq('ativo', true)
    .order('ordem');

  const fases: KanbanFase[] = (fasesRaw ?? []).map((row) => ({
    id: String(row.id),
    nome: String(row.nome ?? ''),
    ordem: Number(row.ordem ?? 0),
    sla_dias: row.sla_dias != null ? Number(row.sla_dias) : null,
    slug: (row as { slug?: string | null }).slug ?? null,
    instrucoes: (row as { instrucoes?: string | null }).instrucoes ?? null,
    materiais: parseKanbanFaseMateriais((row as { materiais?: unknown }).materiais),
  }));

  const selectCols = `
      id,
      titulo,
      status,
      created_at,
      fase_id,
      franqueado_id,
      arquivado,
      motivo_arquivamento,
      concluido,
      concluido_em
    `;

  let cardsQuery = supabase
    .from('kanban_cards')
    .select(selectCols)
    .eq('kanban_id', kanban.id)
    .eq('status', 'ativo')
    .eq('concluido', false)
    .order('created_at', { ascending: false });

  let concluidosQuery = supabase
    .from('kanban_cards')
    .select(selectCols)
    .eq('kanban_id', kanban.id)
    .eq('status', 'ativo')
    .eq('arquivado', false)
    .eq('concluido', true)
    .order('created_at', { ascending: false });

  const visaoAmplaCards =
    role === 'admin' || role === 'consultor' || role === 'supervisor' || role === 'team';
  if (!visaoAmplaCards) {
    cardsQuery = cardsQuery.eq('franqueado_id', user.id);
    concluidosQuery = concluidosQuery.eq('franqueado_id', user.id);
  }

  const [{ data: cardsRaw, error: cardsError }, { data: conclRaw }] = await Promise.all([
    cardsQuery,
    concluidosQuery,
  ]);
  
  console.log('[FunilStepOne] Cards query error:', cardsError);
  console.log('[FunilStepOne] Cards raw:', cardsRaw);
  console.log('[FunilStepOne] Total cards encontrados:', cardsRaw?.length || 0);

  const franqueadoIds = [
    ...new Set([
      ...(cardsRaw?.map((c) => c.franqueado_id).filter(Boolean) || []),
      ...(conclRaw?.map((c) => c.franqueado_id).filter(Boolean) || []),
    ]),
  ];
  let profilesMap = new Map<string, { full_name: string | null }>();
  
  if (franqueadoIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', franqueadoIds);
    
    profiles?.forEach(p => {
      profilesMap.set(p.id, { full_name: p.full_name });
    });
  }

  const mapCard = (c: NonNullable<typeof cardsRaw>[number]) => ({
    ...c,
    arquivado: Boolean((c as { arquivado?: boolean | null }).arquivado),
    motivo_arquivamento: (c as { motivo_arquivamento?: string | null }).motivo_arquivamento ?? null,
    concluido: Boolean((c as { concluido?: boolean | null }).concluido),
    concluido_em:
      (c as { concluido_em?: string | null }).concluido_em != null
        ? String((c as { concluido_em?: string | null }).concluido_em)
        : null,
    origem: 'nativo' as const,
    profiles: profilesMap.get(c.franqueado_id) || null,
  });

  const cards = cardsRaw?.map((c) => mapCard(c)) || [];
  const cardsConcluidos = conclRaw?.map((c) => mapCard(c)) || [];

  console.log('[FunilStepOne] Cards normalizados:', cards.length);

  const isAdmin = role === 'admin' || role === 'consultor' || role === 'supervisor' || role === 'team';

  return (
    <KanbanWrapper
      basePath="/funil-stepone"
      isAdmin={isAdmin}
      kanbanId={kanban.id}
      kanbanNome="Funil Step One"
      fases={fases}
      enableNovoCardModal
    >
      <div className="min-h-screen bg-stone-50">
        {/* Abas: Kanban / Painel (Suspense por useSearchParams no cliente) */}
        <Suspense fallback={null}>
          <KanbanTabs />
        </Suspense>

        {/* Conteúdo da aba ativa */}
        {activeTab === 'kanban' && (
          <main className="mx-auto max-w-[1600px] overflow-x-auto px-6 py-8">
            <KanbanBoard
              fases={fases}
              cards={cards}
              cardsConcluidos={cardsConcluidos}
              basePath="/funil-stepone"
              userRole={role}
              columnAccent="var(--moni-kanban-stepone)"
              currentUserId={user.id}
              mostrarLinkNovoCard
            />
          </main>
        )}

        {activeTab === 'painel' && (
          <main className="mx-auto max-w-[1600px] px-6 py-8">
            <PainelPerformance
              kanbanNome="Funil Step One"
              kanbanId={String(kanban.id)}
              fases={(fases ?? []) as KanbanFase[]}
              cards={cards as KanbanCardBrief[]}
              origemCards="nativo"
            />
          </main>
        )}
      </div>
    </KanbanWrapper>
  );
}
