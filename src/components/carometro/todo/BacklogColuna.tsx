'use client';

import { ExternalLink } from 'lucide-react';

export type StatusPrazo = 'atrasado' | 'esta_semana' | 'futuro' | 'sem_prazo';

type BacklogColunaProps = {
  tipo: 'sirene' | 'atividade' | 'kanban';
  titulo: string;
  prazo: string | null;
  prioridade?: string | null;
  numeroChamado?: string | null;
  status: StatusPrazo;
  origemBadge?: string;
  href?: string;
};

const BORDER_COLOR: Record<StatusPrazo, string> = {
  atrasado:    '#dc2626',
  esta_semana: '#f59e0b',
  futuro:      '#6b7280',
  sem_prazo:   '#9ca3af',
};

const DOT_COR: Record<StatusPrazo, string> = {
  atrasado:    'bg-red-500',
  esta_semana: 'bg-green-500',
  futuro:      'bg-gray-400',
  sem_prazo:   'bg-gray-400',
};

const BADGE_BG: Record<string, string> = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-yellow-100 text-yellow-700',
  P4: 'bg-blue-100 text-blue-700',
  P5: 'bg-gray-100 text-gray-600',
  P6: 'bg-gray-50 text-gray-500',
};

function formatarPrazo(prazo: string | null, status: StatusPrazo): string {
  if (!prazo) return 'Sem prazo';

  // Semana no formato "S25" ou número
  if (/^S?\d+$/i.test(prazo)) {
    const num = prazo.replace(/^S/i, '');
    return `S${num}`;
  }

  // ISO date
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazoDate = new Date(`${prazo}T00:00:00`);
  if (isNaN(prazoDate.getTime())) return prazo;

  if (status === 'atrasado') {
    const diff = Math.round((hoje.getTime() - prazoDate.getTime()) / 86400000);
    if (diff === 1) return 'Atrasado 1 dia';
    if (diff > 1) return `Atrasado ${diff} dias`;
    return 'Atrasado';
  }

  const dd = String(prazoDate.getDate()).padStart(2, '0');
  const mm = String(prazoDate.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

export function BacklogColunaCard({
  tipo,
  titulo,
  prazo,
  prioridade,
  numeroChamado,
  status,
  origemBadge,
  href,
}: BacklogColunaProps) {
  const borderColor = BORDER_COLOR[status];
  const prazoLabel  = formatarPrazo(prazo, status);
  const badgeClass  = prioridade ? (BADGE_BG[prioridade.toUpperCase()] ?? 'bg-gray-100 text-gray-500') : null;

  return (
    <div
      className="rounded-md bg-white border border-gray-200 px-3 py-2 text-sm shadow-sm transition-all"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      {/* Linha 1: badge prioridade + título (máx 2 linhas) + dot status + link */}
      <div className="flex items-start justify-between gap-1.5 min-w-0">
        <div className="flex items-start gap-1.5 min-w-0 flex-1">
          {tipo === 'sirene' && badgeClass && (
            <span className={`shrink-0 text-[10px] font-semibold px-1 py-0.5 rounded ${badgeClass}`}>
              {prioridade!.toUpperCase()}
            </span>
          )}
          <span
            className="text-gray-800 leading-snug"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {titulo}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-1">
          <span className={`h-2 w-2 rounded-full ${DOT_COR[status]}`} />
          {href && (
            <a
              href={href}
              title="Abrir origem"
              onClick={(e) => e.stopPropagation()}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      {/* Linha 2: badge origem + #número + prazo */}
      <div className={`mt-1 text-xs flex items-center gap-2 flex-wrap ${status === 'atrasado' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
        {origemBadge && (
          <span className="shrink-0 text-[10px] font-medium px-1 py-0.5 rounded bg-gray-100 text-gray-500">
            {origemBadge}
          </span>
        )}
        {numeroChamado && (
          <span className="text-gray-400 font-normal">#{numeroChamado}</span>
        )}
        <span>{prazoLabel}</span>
      </div>
    </div>
  );
}
