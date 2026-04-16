import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAppFullyPublic } from '@/lib/public-rede-novos';
import type { ProcessoCard } from '@/app/steps-viabilidade/StepsKanbanColumn';
import type { PainelColumnKey } from '@/app/steps-viabilidade/painelColumns';
import { PainelCreditoClient } from '@/app/painel-credito/PainelCreditoClient';
import { CreditoModalWrapper } from '@/app/painel-credito/CreditoModalWrapper';
import { PainelKanbanTabs } from '@/app/steps-viabilidade/PainelKanbanTabs';
import { buildChecklistAtrasoByCardId } from '@/lib/painel-checklist-atraso';
import { sortProcessosPorOrdemColuna } from '@/lib/painel-coluna-ordem';
import { KanbanBoard } from '@/components/kanban-shared/KanbanBoard';
import { KanbanWrapper } from '@/components/kanban-shared/KanbanWrapper';
import { fetchKanbanBoardSnapshot } from '@/components/kanban-shared/fetchKanbanBoardSnapshot';
import { PainelPerformance } from '@/components/kanban-shared/PainelPerformance';

export default async function PainelCreditoPage({
  searchParams,
}: {
  searchParams?: {
    card?: string | string[];
    kanbanCard?: string | string[];
    abrir?: string | string[];
    tab?: string | string[];
  };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && !isAppFullyPublic()) redirect('/login');

  let db = supabase;
  if (!user && isAppFullyPublic()) {
    try {
      db = createAdminClient();
    } catch {
      /* RLS */
    }
  }

  const snapshot = await fetchKanbanBoardSnapshot(db, 'Funil Crédito', user?.id ?? null);

  const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const modalOuProcessoAberto = Boolean(
    primeiro(searchParams?.kanbanCard) ||
      primeiro(searchParams?.card) ||
      primeiro(searchParams?.abrir),
  );
  const tabParam = searchParams?.tab;
  const activeTab =
    primeiro(tabParam) === 'painel' && !modalOuProcessoAberto ? 'painel' : 'kanban';

  if (snapshot.kanban) {
    return (
      <KanbanWrapper
        basePath="/painel-credito"
        isAdmin={snapshot.isAdmin}
        kanbanId={snapshot.kanban.id}
        kanbanNome="Funil Crédito"
        fases={snapshot.fases}
        cardQueryParam="kanbanCard"
        enableNovoCardModal
      >
        <div className="min-h-screen bg-[var(--moni-surface-50)]">
          <header
            className="border-b bg-white"
            style={{ borderColor: 'var(--moni-border-default)' }}
          >
            <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <Link href="/" className="text-sm text-moni-primary hover:underline">
                  ← Hub Fly
                </Link>
                <span className="text-stone-400">/</span>
                <h1 className="text-lg font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                  Crédito
                </h1>
              </div>
              <Link
                href="/painel-credito?novo=true"
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

          <Suspense fallback={null}>
            <PainelKanbanTabs basePath="/painel-credito" variant="credito" />
          </Suspense>

          {activeTab === 'kanban' ? (
            <main className="mx-auto max-w-[1600px] overflow-x-auto px-6 py-8">
              <KanbanBoard
                fases={snapshot.fases}
                cards={snapshot.cards}
                basePath="/painel-credito"
                userRole={snapshot.role}
                columnAccent="var(--moni-kanban-stepone)"
                cardQueryParam="kanbanCard"
              />
            </main>
          ) : (
            <main className="mx-auto max-w-[1600px] px-6 py-8">
              <PainelPerformance
                kanbanNome="Funil Crédito"
                kanbanId={snapshot.kanban.id}
                fases={snapshot.fases}
                cards={snapshot.cards}
                origemCards={snapshot.cards.some((c) => c.origem === 'legado') ? 'legado' : 'nativo'}
              />
            </main>
          )}
        </div>
      </KanbanWrapper>
    );
  }

  const { data: rows } = await db
    .from('processo_step_one')
    .select(
      'id, cidade, estado, status, etapa_atual, created_at, updated_at, user_id, step_atual, cancelado_em, removido_em, cancelado_motivo, removido_motivo, etapa_painel, trava_painel, tipo_aquisicao_terreno, numero_franquia, nome_franqueado, nome_condominio, quadra_lote, historico_base_id, ordem_coluna_painel',
    )
    ;

  const rowsTodos = rows ?? [];

  const creditoKeys: Array<'credito_terreno' | 'credito_obra'> = ['credito_terreno', 'credito_obra'];
  const creditoProcessos = rowsTodos.filter((r) => creditoKeys.includes(r.etapa_painel as any));

  const processIds = creditoProcessos.map((r) => r.user_id).filter(Boolean) as string[];
  let profiles: { id: string; full_name: string | null }[] = [];
  if (processIds.length > 0) {
    const { data: prof } = await db
      .from('profiles')
      .select('id, full_name')
      .in('id', [...new Set(processIds)]);
    profiles = prof ?? [];
  }
  const profileByUserId = Object.fromEntries(profiles.map((p) => [p.id, p.full_name ?? null]));

  const baseProcessoIds = Array.from(
    new Set(creditoProcessos.map((r) => (r.historico_base_id as string | null | undefined) ?? r.id)),
  );
  let checklistAtrasoByCardId = new Map<string, { hasAtrasado: boolean; hasAtencao: boolean }>();
  if (baseProcessoIds.length > 0) {
    const { data: checklistRows } = await db
      .from('processo_card_checklist')
      .select('processo_id, etapa_painel, prazo, status, concluido')
      .in('processo_id', baseProcessoIds);

    checklistAtrasoByCardId = buildChecklistAtrasoByCardId(
      creditoProcessos.map((r) => ({
        id: r.id,
        historico_base_id: (r as { historico_base_id?: string | null }).historico_base_id ?? null,
        etapa_painel: (r as { etapa_painel?: string | null }).etapa_painel ?? null,
      })),
      checklistRows ?? [],
      { defaultEtapaPainel: 'credito_terreno' },
    );
  }

  const processos: ProcessoCard[] = creditoProcessos.map((r) => {
    const raw = r as {
      etapa_painel?: string | null;
      trava_painel?: boolean | null;
      tipo_aquisicao_terreno?: string | null;
      observacoes?: string | null;
    };
    const st = String(r.status ?? '').toLowerCase();
    const isCancelado = st === 'cancelado' || Boolean((r as any).cancelado_em);
    const isRemovido = st === 'removido' || Boolean((r as any).removido_em);
    return {
      id: r.id,
      cidade: r.cidade ?? '',
      estado: r.estado ?? null,
      status: r.status ?? 'rascunho',
      cancelado_motivo: (r as any).cancelado_motivo ?? null,
      removido_motivo: (r as any).removido_motivo ?? null,
      cancelado_em: (r as any).cancelado_em ?? null,
      removido_em: (r as any).removido_em ?? null,
      etapa_atual: r.etapa_atual ?? 1,
      created_at: (r as { created_at?: string | null }).created_at ?? null,
      updated_at: r.updated_at ?? null,
      franqueado_nome: (r as { nome_franqueado?: string | null }).nome_franqueado ?? profileByUserId[r.user_id] ?? null,
      numero_franquia: (r as { numero_franquia?: string | null }).numero_franquia ?? null,
      nome_condominio: (r as { nome_condominio?: string | null }).nome_condominio ?? null,
      quadra_lote: (r as { quadra_lote?: string | null }).quadra_lote ?? null,
      step_atual: (r as { step_atual?: number }).step_atual ?? 1,
      etapa_painel: (raw.etapa_painel ?? 'credito_terreno') as PainelColumnKey | string,
      trava_painel: raw.trava_painel ?? false,
      tipo_aquisicao_terreno: raw.tipo_aquisicao_terreno ?? null,
      observacoes: raw.observacoes ?? null,
      has_atividade_atrasada:
        isCancelado || isRemovido ? false : checklistAtrasoByCardId.get(r.id)?.hasAtrasado ?? false,
      has_atividade_atencao:
        isCancelado || isRemovido ? false : checklistAtrasoByCardId.get(r.id)?.hasAtencao ?? false,
      ordem_coluna_painel: ((r as { ordem_coluna_painel?: number | null }).ordem_coluna_painel ?? 0) as number,
    };
  });

  const byEtapa = {
    credito_terreno: sortProcessosPorOrdemColuna(processos.filter((p) => p.etapa_painel === 'credito_terreno')),
    credito_obra: sortProcessosPorOrdemColuna(processos.filter((p) => p.etapa_painel === 'credito_obra')),
  };

  const cardParam = searchParams?.card;
  const abrirParam = searchParams?.abrir;
  const initialOpenProcessId =
    (Array.isArray(cardParam) ? cardParam[0] : cardParam) ??
    (Array.isArray(abrirParam) ? abrirParam[0] : abrirParam);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-6">
          <Link href="/" className="text-sm text-moni-primary hover:underline">
            ← Hub Fly
          </Link>
          <span className="text-stone-400">/</span>
          <h1 className="text-lg font-semibold text-stone-800">Crédito</h1>
        </div>
      </header>

      <Suspense fallback={null}>
        <PainelKanbanTabs basePath="/painel-credito" variant="credito" />
      </Suspense>

      {activeTab === 'kanban' ? (
        <main className="mx-auto max-w-[1600px] overflow-x-auto px-6 py-8">
          <Suspense fallback={null}>
            <CreditoModalWrapper>
              <PainelCreditoClient byEtapa={byEtapa} initialOpenProcessId={initialOpenProcessId} />
            </CreditoModalWrapper>
          </Suspense>
        </main>
      ) : (
        <main className="mx-auto max-w-[1600px] px-6 py-8">
          <p className="mb-4 text-sm text-stone-600">
            O painel de performance do kanban fica disponível quando o funil Crédito estiver cadastrado em{' '}
            <code className="rounded bg-stone-100 px-1">kanbans</code>. Use{' '}
            <Link href="/sirene/interacoes" className="font-medium text-moni-primary hover:underline">
              Ver no Sirene →
            </Link>{' '}
            para interações centralizadas.
          </p>
        </main>
      )}
    </div>
  );
}

