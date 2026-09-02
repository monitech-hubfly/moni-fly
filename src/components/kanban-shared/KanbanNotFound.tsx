import Link from 'next/link';

export function KanbanNotFound({ kanbanNomeDb }: { kanbanNomeDb: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-[var(--moni-surface-50)]">
      <div className="text-center">
        <h1 className="text-xl font-bold" style={{ color: 'var(--moni-text-primary)' }}>
          Kanban não encontrado
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          O kanban &ldquo;{kanbanNomeDb}&rdquo; ainda não está cadastrado (migration 111 ou seed).
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-moni-primary hover:underline">
          ← Voltar
        </Link>
      </div>
    </div>
  );
}
