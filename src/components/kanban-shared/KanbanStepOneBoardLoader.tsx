import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { autoCurarCardsFunilStepOneAusentes } from '@/lib/kanban/ensure-funil-stepone-card-from-rede';
import { KanbanStepOneBoardCardsLoader } from './KanbanStepOneBoardCardsLoader';
import { KanbanWrapper } from './KanbanWrapper';
import { fetchKanbanBoardShell } from './fetchKanbanBoardSnapshot';

export async function KanbanStepOneBoardLoader({
  userId,
  activeTab,
}: {
  userId: string;
  activeTab: string;
}) {
  const supabase = await createClient();
  const shell = await fetchKanbanBoardShell(supabase, 'Funil Step One', userId);

  const isStaff =
    shell.role === 'admin' ||
    shell.role === 'team' ||
    shell.role === 'consultor' ||
    shell.role === 'supervisor';
  if (isStaff) {
    await autoCurarCardsFunilStepOneAusentes(userId);
  }

  if (!shell.kanban) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[var(--moni-surface-50)]">
        <div className="text-center">
          <h1 className="text-xl font-bold" style={{ color: 'var(--moni-text-primary)' }}>
            Kanban não encontrado
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            O Kanban &ldquo;Funil Step One&rdquo; ainda não foi configurado.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-moni-primary hover:underline">
            ← Voltar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <KanbanWrapper
      basePath="/funil-stepone"
      isAdmin={shell.isAdmin}
      kanbanId={shell.kanban.id}
      kanbanNome="Funil Step One"
      fases={shell.fases}
      enableNovoCardModal
    >
      <Suspense fallback={null}>
        <KanbanStepOneBoardCardsLoader
          userId={userId}
          activeTab={activeTab}
          kanbanId={shell.kanban.id}
          fases={shell.fases}
          role={shell.role}
          isAdmin={shell.isAdmin}
        />
      </Suspense>
    </KanbanWrapper>
  );
}
