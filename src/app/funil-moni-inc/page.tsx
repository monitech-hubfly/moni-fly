import { guardLoginRequired } from '@/lib/auth-guard';
import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { KanbanBoard } from '@/components/kanban-shared/KanbanBoard';
import { KanbanWrapper } from '@/components/kanban-shared/KanbanWrapper';
import { KanbanTabs } from './KanbanTabs';
import { PainelPerformance } from '@/components/kanban-shared/PainelPerformance';
import type { KanbanCardBrief, KanbanFase } from '@/components/kanban-shared/types';
import { parseKanbanFaseMateriais } from '@/lib/kanban/parse-kanban-fase-materiais';

export const dynamic = 'force-dynamic';

export default async function FunilMoniIncPage({
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

  const { data: kanbans, error: kanbanError } = await supabase
    .from('kanbans')
    .select('id, nome')
    .eq('nome', 'Funil Moní INC')
    .eq('ativo', true)
    .limit(1);

  if (kanbanError) {
    console.error('[FunilMoniInc] erro ao buscar kanban:', kanbanError);
  }

  const kanban = kanbans?.[0] ?? null;

  if (!kanban) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="text-center">
          <h1 className="text-xl font-bold text-stone-800">Kanban não encontrado</h1>
          <p className="mt-2 text-sm text-stone-600">
            O Kanban &ldquo;Funil Moní INC&rdquo; ainda não foi configurado.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-moni-primary hover:underline">
            ← Voltar
          </Link>
        </div>
      </div>
    );
  }

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

  const primeiraFaseContatoId =
    fases.find((f) => (f.slug ?? '').trim() === 'primeiro_contato_moni_inc')?.id ??
    fases.find((f) => f.ordem === 1)?.id ??
    null;

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

  if (cardsError) {
    console.error('[FunilMoniInc] Cards query error:', cardsError);
  }

  const franqueadoIds = [
    ...new Set([
      ...(cardsRaw?.map((c) => c.franqueado_id).filter(Boolean) || []),
      ...(conclRaw?.map((c) => c.franqueado_id).filter(Boolean) || []),
    ]),
  ];
  const profilesMap = new Map<string, { full_name: string | null }>();

  if (franqueadoIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', franqueadoIds);

    profiles?.forEach((p) => {
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

  const isAdmin = role === 'admin' || role === 'consultor' || role === 'supervisor' || role === 'team';

  return (
    <KanbanWrapper
      basePath="/funil-moni-inc"
      isAdmin={isAdmin}
      kanbanId={kanban.id}
      kanbanNome="Funil Moní INC"
      fases={fases}
    >
      <div className="min-h-screen bg-stone-50">
        <Suspense fallback={null}>
          <KanbanTabs
            kanbanId={String(kanban.id)}
            isAdmin={isAdmin}
            primeiraFaseContatoId={primeiraFaseContatoId}
          />
        </Suspense>

        {activeTab === 'kanban' && (
          <main className="mx-auto max-w-[1600px] overflow-x-auto px-6 py-8">
            <KanbanBoard
              fases={fases}
              cards={cards}
              cardsConcluidos={cardsConcluidos}
              basePath="/funil-moni-inc"
              userRole={role}
              columnAccent="var(--moni-kanban-stepone)"
              currentUserId={user.id}
              mostrarLinkNovoCard={Boolean(primeiraFaseContatoId)}
            />
          </main>
        )}

        {activeTab === 'painel' && (
          <main className="mx-auto max-w-[1600px] px-6 py-8">
            <PainelPerformance
              kanbanNome="Funil Moní INC"
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
