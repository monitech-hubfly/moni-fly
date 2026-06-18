'use client';

import type {
  PipelineEsteiraProgresso,
  PipelineStatusOperacional,
} from '@/lib/kanban/pipeline-progress-utils';

export type PipelineProgressBarProps = {
  progresso: PipelineEsteiraProgresso;
  statusOperacional: PipelineStatusOperacional;
  /** Nome da fase real no kanban atual (destaque na etapa corrente). */
  faseAtualNome: string;
  className?: string;
};

const STATUS_CORES: Record<
  PipelineStatusOperacional,
  { trilho: string; atual: string; texto: string; tag: string }
> = {
  em_dia: {
    trilho: 'var(--moni-kanban-portfolio, #2F4A3A)',
    atual: 'var(--moni-kanban-portfolio, #2F4A3A)',
    texto: 'var(--moni-text-primary)',
    tag: 'moni-tag-concluido',
  },
  atrasado: {
    trilho: 'var(--moni-status-overdue-text, #8b2942)',
    atual: 'var(--moni-status-overdue-text, #8b2942)',
    texto: 'var(--moni-status-overdue-text, #8b2942)',
    tag: 'moni-tag-atrasado',
  },
  vencendo_breve: {
    trilho: 'var(--moni-gold-400, #D4AD68)',
    atual: 'var(--moni-gold-400, #D4AD68)',
    texto: 'var(--moni-text-primary)',
    tag: 'moni-tag-atencao',
  },
  sem_movimentacao: {
    trilho: 'var(--moni-text-tertiary)',
    atual: 'var(--moni-text-secondary)',
    texto: 'var(--moni-text-secondary)',
    tag: '',
  },
};

function segmentFill(estado: 'concluida' | 'atual' | 'futura', progressoIntrafase: number): string {
  if (estado === 'concluida') return '100%';
  if (estado === 'atual') return `${Math.round(Math.max(0.12, progressoIntrafase) * 100)}%`;
  return '0%';
}

export function PipelineProgressBar({
  progresso,
  statusOperacional,
  faseAtualNome,
  className,
}: PipelineProgressBarProps) {
  const cores = STATUS_CORES[statusOperacional];

  return (
    <div className={className}>
      <div className="hidden sm:grid sm:grid-cols-4 sm:gap-2">
        {progresso.etapas.map((etapa, idx) => {
          const isAtual = etapa.estado === 'atual';
          const isConcluida = etapa.estado === 'concluida';
          const fill = segmentFill(etapa.estado, etapa.progressoIntrafase);

          return (
            <div key={etapa.id} className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{
                    border: '0.5px solid var(--moni-border-default)',
                    background: isAtual
                      ? cores.atual
                      : isConcluida
                        ? 'var(--moni-kanban-portfolio, #2F4A3A)'
                        : 'var(--moni-surface-100)',
                    color: isAtual || isConcluida ? 'var(--moni-text-inverse, #fff)' : 'var(--moni-text-tertiary)',
                  }}
                >
                  {idx + 1}
                </span>
                <span
                  className="truncate text-xs font-medium"
                  style={{
                    color: isAtual ? cores.texto : 'var(--moni-text-secondary)',
                    fontFamily: isAtual ? 'var(--moni-font-display)' : 'var(--moni-font-sans)',
                  }}
                >
                  {etapa.label}
                </span>
              </div>

              <div
                className="h-1.5 overflow-hidden rounded-full"
                style={{ background: 'var(--moni-rede-chart-track, #ece7e0)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: fill,
                    background: isAtual ? cores.trilho : isConcluida ? 'var(--moni-kanban-portfolio, #2F4A3A)' : 'transparent',
                  }}
                />
              </div>

              {isAtual ? (
                <p className="mt-1.5 truncate text-[11px] font-medium" style={{ color: cores.texto }}>
                  {faseAtualNome}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Mobile: barra contínua com marcadores */}
      <div className="sm:hidden">
        <div className="relative h-2 overflow-hidden rounded-full" style={{ background: 'var(--moni-rede-chart-track, #ece7e0)' }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${Math.round(((progresso.indiceAtual + progresso.etapas[progresso.indiceAtual]?.progressoIntrafase) / 3) * 100)}%`,
              background: cores.trilho,
            }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          {progresso.etapas.map((etapa) => (
            <span
              key={etapa.id}
              style={{
                color: etapa.estado === 'atual' ? cores.texto : 'var(--moni-text-tertiary)',
                fontWeight: etapa.estado === 'atual' ? 600 : 400,
              }}
            >
              {etapa.label}
            </span>
          ))}
        </div>
        <p className="mt-1 text-xs font-medium" style={{ color: cores.texto }}>
          {faseAtualNome}
        </p>
      </div>

      {progresso.funilParalelo ? (
        <p className="mt-2 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Funil atual: {progresso.funilAtualNome} (paralelo à esteira principal)
        </p>
      ) : null}
    </div>
  );
}
