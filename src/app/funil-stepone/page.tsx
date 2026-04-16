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
  const { data: fases } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias')
    .eq('kanban_id', kanban.id)
    .eq('ativo', true)
    .order('ordem');

  // Busca os cards (filtra por franqueado ou mostra todos para admin/consultor)
  let cardsQuery = supabase
    .from('kanban_cards')
    .select(
      `
      id,
      titulo,
      status,
      created_at,
      fase_id,
      franqueado_id
    `,
    )
    .eq('kanban_id', kanban.id)
    .eq('status', 'ativo')
    .order('created_at', { ascending: false });

  // Se não for admin/consultor, filtra apenas os próprios cards
  if (role !== 'admin' && role !== 'consultor') {
    cardsQuery = cardsQuery.eq('franqueado_id', user.id);
  }

  const { data: cardsRaw, error: cardsError } = await cardsQuery;
  
  console.log('[FunilStepOne] Cards query error:', cardsError);
  console.log('[FunilStepOne] Cards raw:', cardsRaw);
  console.log('[FunilStepOne] Total cards encontrados:', cardsRaw?.length || 0);

  // Busca os perfis dos franqueados dos cards encontrados
  const franqueadoIds = [...new Set(cardsRaw?.map(c => c.franqueado_id).filter(Boolean) || [])];
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

  // Normaliza os cards adicionando os perfis
  const cards =
    cardsRaw?.map((c) => ({
      ...c,
      profiles: profilesMap.get(c.franqueado_id) || null,
    })) || [];

  console.log('[FunilStepOne] Cards normalizados:', cards.length);

  const isAdmin = role === 'admin' || role === 'consultor';

  return (
    <KanbanWrapper
      basePath="/funil-stepone"
      isAdmin={isAdmin}
      kanbanId={kanban.id}
      kanbanNome="Funil Step One"
      fases={fases ?? []}
      legacyPanelHref="/painel-novos-negocios"
      enableNovoCardModal
    >
      <div className="min-h-screen bg-stone-50">
        {/* Header com breadcrumb e botão novo card */}
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-moni-primary hover:underline">
                ← Hub Fly
              </Link>
              <span className="text-stone-400">/</span>
              <h1 className="text-lg font-semibold text-stone-800">Funil Step One</h1>
            </div>
            <Link
              href="/funil-stepone?novo=true"
              className="rounded-lg px-4 py-2 text-sm font-medium transition hover:bg-stone-100"
              style={{
                background: 'var(--moni-surface-0)',
                color: 'var(--moni-text-primary)',
                border: '0.5px solid var(--moni-border-default)',
              }}
            >
              + Novo card
            </Link>
          </div>
        </header>

        {/* Abas: Kanban / Painel (Suspense por useSearchParams no cliente) */}
        <Suspense fallback={null}>
          <KanbanTabs />
        </Suspense>

        {/* Conteúdo da aba ativa */}
        {activeTab === 'kanban' && (
          <main className="mx-auto max-w-[1600px] overflow-x-auto px-6 py-8">
            <KanbanBoard
              fases={fases ?? []}
              cards={cards}
              basePath="/funil-stepone"
              userRole={role}
              columnAccent="var(--moni-kanban-stepone)"
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
