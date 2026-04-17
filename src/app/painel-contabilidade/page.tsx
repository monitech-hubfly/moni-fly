import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAppFullyPublic } from '@/lib/public-rede-novos';
import type { ProcessoCard } from '@/app/steps-viabilidade/StepsKanbanColumn';
import type { PainelColumnKey } from '@/app/steps-viabilidade/painelColumns';
import { PainelContabilidadeClient } from '@/app/painel-contabilidade/PainelContabilidadeClient';
import { PainelCardQueryModalWrapper } from '@/app/steps-viabilidade/PainelCardQueryModalWrapper';
import { PainelKanbanTabs } from '@/app/steps-viabilidade/PainelKanbanTabs';
import { dayStartLocal, parsePrazoBrOrIso } from '@/lib/painel-checklist-atraso';
import { sortProcessosPorOrdemColuna } from '@/lib/painel-coluna-ordem';
import { KanbanBoard } from '@/components/kanban-shared/KanbanBoard';
import { KanbanWrapper } from '@/components/kanban-shared/KanbanWrapper';
import { fetchKanbanBoardSnapshot } from '@/components/kanban-shared/fetchKanbanBoardSnapshot';
import { PainelPerformance } from '@/components/kanban-shared/PainelPerformance';

export default async function PainelContabilidadePage({
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

  const snapshot = await fetchKanbanBoardSnapshot(db, 'Funil Contabilidade', user?.id ?? null);

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
        basePath="/painel-contabilidade"
        isAdmin={snapshot.isAdmin}
        kanbanId={snapshot.kanban.id}
        kanbanNome="Funil Contabilidade"
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
                  Contabilidade
                </h1>
              </div>
              <Link
                href="/painel-contabilidade?novo=true"
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
            <PainelKanbanTabs basePath="/painel-contabilidade" variant="contabilidade" />
          </Suspense>

          {activeTab === 'kanban' ? (
            <main className="mx-auto max-w-[1600px] overflow-x-auto px-6 py-8">
              <KanbanBoard
                fases={snapshot.fases}
                cards={snapshot.cards}
                cardsConcluidos={snapshot.cardsConcluidos}
                basePath="/painel-contabilidade"
                userRole={snapshot.role}
                columnAccent="var(--moni-kanban-stepone)"
                cardQueryParam="kanbanCard"
              />
            </main>
          ) : (
            <main className="mx-auto max-w-[1600px] px-6 py-8">
              <PainelPerformance
                kanbanNome="Funil Contabilidade"
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
    );

  const rowsTodos = rows ?? [];
  const contabKeys: Array<'contabilidade_incorporadora' | 'contabilidade_spe' | 'contabilidade_gestora'> = [
    'contabilidade_incorporadora',
    'contabilidade_spe',
    'contabilidade_gestora',
  ];
  const contabProcessos = rowsTodos.filter((r) => contabKeys.includes(r.etapa_painel as any));

  const processIds = contabProcessos.map((r) => r.user_id).filter(Boolean) as string[];
  let profiles: { id: string; full_name: string | null }[] = [];
  if (processIds.length > 0) {
    const { data: prof } = await db.from('profiles').select('id, full_name').in('id', [...new Set(processIds)]);
    profiles = prof ?? [];
  }
  const profileByUserId = Object.fromEntries(profiles.map((p) => [p.id, p.full_name ?? null]));

  const baseProcessoIds = Array.from(new Set(contabProcessos.map((r) => (r.historico_base_id as string | null | undefined) ?? r.id)));
  let checklistByProcesso = new Map<string, { hasAtrasado: boolean; hasAtencao: boolean }>();
  if (baseProcessoIds.length > 0) {
    const { data: checklistRows } = await db
      .from('processo_card_checklist')
      .select('processo_id, prazo, status, concluido')
      .in('processo_id', baseProcessoIds);

    const hoje = dayStartLocal(new Date());
    const amanha = dayStartLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1));
    checklistByProcesso = (checklistRows ?? []).reduce((acc, row) => {
      const processoId = String((row as { processo_id?: string | null }).processo_id ?? '');
      if (!processoId) return acc;
      const status = String((row as { status?: string | null }).status ?? '').trim().toLowerCase();
      const concluido = Boolean((row as { concluido?: boolean | null }).concluido);
      if (concluido || status === 'concluido' || status === 'concluida') return acc;
      const prazo = parsePrazoBrOrIso((row as { prazo?: string | null }).prazo ?? null);
      if (!prazo) return acc;
      const prazoDia = dayStartLocal(prazo);
      const current = acc.get(processoId) ?? { hasAtrasado: false, hasAtencao: false };
      if (prazoDia.getTime() < hoje.getTime()) current.hasAtrasado = true;
      if (prazoDia.getTime() === amanha.getTime()) current.hasAtencao = true;
      acc.set(processoId, current);
      return acc;
    }, new Map<string, { hasAtrasado: boolean; hasAtencao: boolean }>());
  }

  const processos: ProcessoCard[] = contabProcessos.map((r) => {
    const st = String(r.status ?? '').toLowerCase();
    const isCancelado = st === 'cancelado' || Boolean((r as any).cancelado_em);
    const isRemovido = st === 'removido' || Boolean((r as any).removido_em);
    const baseChecklistId = String((r.historico_base_id as string | null | undefined) ?? r.id);
    const checklistFlags = checklistByProcesso.get(baseChecklistId);
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
      etapa_painel: ((r as any).etapa_painel ?? 'contabilidade_incorporadora') as PainelColumnKey | string,
      trava_painel: ((r as any).trava_painel ?? false) as boolean,
      tipo_aquisicao_terreno: ((r as any).tipo_aquisicao_terreno ?? null) as string | null,
      observacoes: ((r as any).observacoes ?? null) as string | null,
      has_atividade_atrasada:
        isCancelado || isRemovido ? false : checklistFlags?.hasAtrasado ?? false,
      has_atividade_atencao:
        isCancelado || isRemovido ? false : checklistFlags?.hasAtencao ?? false,
      ordem_coluna_painel: ((r as { ordem_coluna_painel?: number | null }).ordem_coluna_painel ?? 0) as number,
    };
  });

  const byEtapa = {
    contabilidade_incorporadora: sortProcessosPorOrdemColuna(
      processos.filter((p) => p.etapa_painel === 'contabilidade_incorporadora'),
    ),
    contabilidade_spe: sortProcessosPorOrdemColuna(processos.filter((p) => p.etapa_painel === 'contabilidade_spe')),
    contabilidade_gestora: sortProcessosPorOrdemColuna(
      processos.filter((p) => p.etapa_painel === 'contabilidade_gestora'),
    ),
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
          <h1 className="text-lg font-semibold text-stone-800">Contabilidade</h1>
        </div>
      </header>

      <Suspense fallback={null}>
        <PainelKanbanTabs basePath="/painel-contabilidade" variant="contabilidade" />
      </Suspense>

      {activeTab === 'kanban' ? (
        <main className="mx-auto max-w-[1600px] overflow-x-auto px-6 py-8">
          <Suspense fallback={null}>
            <PainelCardQueryModalWrapper basePath="/painel-contabilidade" board="contabilidade">
              <PainelContabilidadeClient byEtapa={byEtapa} initialOpenProcessId={initialOpenProcessId} />
            </PainelCardQueryModalWrapper>
          </Suspense>
        </main>
      ) : (
        <main className="mx-auto max-w-[1600px] px-6 py-8">
          <p className="mb-4 text-sm text-stone-600">
            O painel de performance do kanban fica disponível quando o funil Contabilidade estiver cadastrado em{' '}
            <code className="rounded bg-stone-100 px-1">kanbans</code>. Use{' '}
            <Link href="/sirene/interacoes" className="font-medium text-moni-primary hover:underline">
              Ver no Sirene →
            </Link>{' '}
            para chamados centralizados.
          </p>
        </main>
      )}
    </div>
  );
}

