'use client';

export type StatusPrazo = 'atrasado' | 'esta_semana' | 'futuro' | 'sem_prazo';

type BacklogColunaProps = {
  tipo: 'sirene' | 'atividade' | 'kanban';
  titulo: string;
  prazo: string | null;
  prioridade?: string | null;
  numeroChamado?: string | null;
  status: StatusPrazo;
  onClick?: () => void;
};

const BORDER_COLOR: Record<StatusPrazo, string> = {
  atrasado:    '#dc2626',
  esta_semana: '#f59e0b',
  futuro:      '#6b7280',
  sem_prazo:   '#9ca3af',
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
  onClick,
}: BacklogColunaProps) {
  const borderColor = BORDER_COLOR[status];
  const prazoLabel  = formatarPrazo(prazo, status);
  const badgeClass  = prioridade ? (BADGE_BG[prioridade.toUpperCase()] ?? 'bg-gray-100 text-gray-500') : null;

  return (
    <div
      className="rounded-md bg-white border border-gray-200 px-3 py-2 text-sm shadow-sm cursor-pointer hover:shadow-md hover:bg-gray-50 transition-all"
      style={{ borderLeft: `3px solid ${borderColor}` }}
      onClick={onClick}
    >
      {/* Linha 1: badge prioridade + título (máx 2 linhas) */}
      <div className="flex items-start gap-1.5 min-w-0">
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
      {/* Linha 2: #número (se houver) + prazo */}
      <div className={`mt-1 text-xs flex items-center gap-2 ${status === 'atrasado' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
        {numeroChamado && (
          <span className="text-gray-400 font-normal">#{numeroChamado}</span>
        )}
        <span>{prazoLabel}</span>
      </div>
    </div>
  );
}
