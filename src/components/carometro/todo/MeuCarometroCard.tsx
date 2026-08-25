'use client';

import { ReactNode, useState } from 'react';
import type { DiaStatus, SemanaStatusInd } from '@/hooks/useMeuCarometro';

function getCarinhaImg(score: number | null): string {
  if (score === null) return '/carometro/carometro-emoji-verde-escuro.png';
  if (score >= 75) return '/carometro/carometro-emoji-verde-escuro.png';
  if (score >= 60) return '/carometro/carometro-emoji-verde-claro.png';
  if (score >= 30) return '/carometro/carometro-emoji-amarelo.png';
  return '/carometro/carometro-emoji-vermelho.png';
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-green-700';
  if (score >= 75) return 'text-green-700';
  if (score >= 60) return 'text-green-500';
  if (score >= 30) return 'text-yellow-600';
  return 'text-red-600';
}

function dotColor(score: number | null): string {
  if (score === null) return '#9ca3af';
  if (score >= 75) return '#15803d';
  if (score >= 60) return '#22c55e';
  if (score >= 30) return '#ca8a04';
  return '#dc2626';
}

function dayLabel(data: string): string {
  const d = new Date(`${data}T12:00:00`);
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()];
}

// ── Círculos diários (Sirene / Engajamento) ────────────────────────────────
function DiariosCirculos({ dias }: { dias: DiaStatus[] }) {
  const [aberto, setAberto] = useState<string | null>(null);

  const LABEL_MAP: Record<string, string> = {
    // Sirene
    concluidos:             'Concluídos',
    atrasados:              'Atrasados',
    venceHoje:              'Vence hoje',
    futuras:                'Futuras (fora do %)',
    abertos:                'Total abertos',
    semPrazo:               'Sem prazo',
    // Engajamento — atividades
    atividades_agendadas:   'Agendadas esta semana',
    atividades_realizadas:  'Concluídos',
    atividades_atrasadas:   'Ativ. atrasadas',
    // Engajamento — cards
    cards_emDia:            'Cards SLA em dia',
    cards_atrasados:        'Cards atrasados',
    // Engajamento — próximas atividades
    proximas_concluidos:    'Próx. concluídas',
    proximas_venceHoje:     'Próx. vence hoje',
    proximas_atrasadas:     'Próx. atrasadas',
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-around items-end">
        {dias.map(dia => (
          <div key={dia.data} className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setAberto(aberto === dia.data ? null : dia.data)}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
              style={{ backgroundColor: dotColor(dia.score) }}
            >
              <span className="text-[10px] font-bold text-white leading-none">
                {dia.score !== null ? `${dia.score}%` : '—'}
              </span>
            </button>
            <span className="text-[10px] text-gray-400">{dayLabel(dia.data)}</span>
          </div>
        ))}
      </div>
      {aberto && (() => {
        const dia = dias.find(d => d.data === aberto);
        if (!dia) return null;
        return (
          <div className="bg-gray-50 rounded-lg p-2.5 text-xs flex flex-col gap-1.5 border border-gray-100">
            <span className="font-semibold text-gray-600 text-[10px] uppercase tracking-wide">
              {dayLabel(dia.data)} — {dia.score !== null ? `${dia.score}%` : 'Sem dados'}
            </span>
            {dia.detalhe && Object.entries(dia.detalhe)
              .filter(([k]) => k !== 'score' && !k.endsWith('_score'))
              .map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{LABEL_MAP[k] ?? k.replace(/_/g, ' ')}</span>
                  <span className="font-medium tabular-nums">{String(v ?? '—')}</span>
                </div>
              ))}
            {!dia.detalhe && <span className="text-gray-400 text-center">Sem detalhes disponíveis</span>}
          </div>
        );
      })()}
    </div>
  );
}

// ── Círculos semanais (Indicadores) ───────────────────────────────────────
function SemanaisCirculos({ semanas }: { semanas: SemanaStatusInd[] }) {
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-around items-end">
        {semanas.map(sem => (
          <div key={sem.label} className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setAberto(aberto === sem.label ? null : sem.label)}
              className="w-12 h-12 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
              style={{ backgroundColor: dotColor(sem.score) }}
            >
              <span className="text-[10px] font-bold text-white leading-none">
                {sem.score !== null ? `${sem.score}%` : '—'}
              </span>
            </button>
            <span className="text-[11px] text-gray-500 font-medium">{sem.label}</span>
          </div>
        ))}
      </div>
      {aberto && (() => {
        const sem = semanas.find(s => s.label === aberto);
        if (!sem) return null;
        if (sem.indicadores.length === 0) return (
          <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-400 text-center border border-gray-100">
            Sem lançamentos para {aberto}
          </div>
        );
        return (
          <div className="bg-gray-50 rounded-lg p-2.5 text-xs flex flex-col gap-1.5 border border-gray-100">
            <span className="font-semibold text-gray-600 text-[10px] uppercase tracking-wide">
              {sem.label} — {sem.score !== null ? `${sem.score}%` : '—'}
            </span>
            {sem.indicadores.map(ind => (
              <div key={ind.nome} className="flex justify-between gap-2">
                <span className="text-gray-500 truncate flex-1">{ind.nome}</span>
                {ind.percentual !== null ? (
                  <span className="font-semibold tabular-nums" style={{ color: dotColor(ind.percentual) }}>
                    {ind.percentual}%
                  </span>
                ) : (
                  <span
                    className="text-gray-400 cursor-help select-none"
                    title="Nada esperado para essa semana"
                  >
                    —
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ── MeuCarometroCard ──────────────────────────────────────────────────────
type MeuCarometroCardProps = {
  titulo: string;
  score: number | null;
  diasDaSemana?: DiaStatus[];
  semanasIndicadores?: SemanaStatusInd[];
  tipo: 'sirene' | 'engajamento' | 'indicadores';
  children?: ReactNode;
};

export function MeuCarometroCard({
  titulo,
  score,
  diasDaSemana,
  semanasIndicadores,
  tipo,
  children,
}: MeuCarometroCardProps) {
  const [expandido, setExpandido] = useState(false);
  const carinhaImg = getCarinhaImg(score);
  const scoreCls   = scoreColor(score);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col gap-3">
      <p className="text-center text-sm font-semibold text-gray-700">{titulo}</p>

      <div className="flex items-center justify-center gap-3 py-2">
        <img
          src={carinhaImg}
          alt="carinha"
          className="w-14 h-14 object-contain shrink-0"
          style={{ mixBlendMode: 'multiply' }}
          title={score !== null ? `${score}%` : 'Sem dados'}
        />
        <span className={`text-4xl font-bold tabular-nums leading-none ${scoreCls}`}>
          {score !== null ? `${score}%` : '—'}
        </span>
      </div>

      <hr className="border-gray-100" />

      <button
        type="button"
        onClick={() => setExpandido(v => !v)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors select-none"
      >
        <span>{expandido ? '▲' : '▼'}</span>
        <span>{tipo === 'indicadores' ? 'Ver por semana' : 'Ver detalhes'}</span>
      </button>

      {expandido && (
        <div className="flex flex-col gap-3">
          {/* Resumo da semana */}
          {children && (
            <div className="text-xs text-gray-600 flex flex-col gap-1">
              {children}
            </div>
          )}
          {/* Histórico por dia / semana */}
          {tipo !== 'indicadores' && diasDaSemana && diasDaSemana.length > 0 && (
            <DiariosCirculos dias={diasDaSemana} />
          )}
          {tipo === 'indicadores' && semanasIndicadores && semanasIndicadores.length > 0 && (
            <SemanaisCirculos semanas={semanasIndicadores} />
          )}
        </div>
      )}
    </div>
  );
}
