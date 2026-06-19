'use client';

import { ReactNode, useState } from 'react';
import type { DiaStatus } from '@/hooks/useMeuCarometro';

type ScoreVisual = { emoji: string; color: string };

function scoreVisual(score: number | null): ScoreVisual {
  if (score === null) return { emoji: '😶', color: '#9ca3af' };
  if (score > 65) return { emoji: '😊', color: '#16a34a' };
  if (score >= 35) return { emoji: '😐', color: '#ca8a04' };
  return { emoji: '😟', color: '#dc2626' };
}

function dotColor(score: number | null): string {
  if (score === null) return '#d1d5db';
  if (score > 65) return '#16a34a';
  if (score >= 35) return '#ca8a04';
  return '#dc2626';
}

function dayLabel(data: string): string {
  const d = new Date(`${data}T12:00:00`);
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()];
}

type MeuCarometroCardProps = {
  titulo: string;
  score: number | null;
  diasDaSemana: DiaStatus[];
  tipo: 'sirene' | 'engajamento' | 'indicadores';
  children?: ReactNode;
};

export function MeuCarometroCard({
  titulo,
  score,
  diasDaSemana,
  children,
}: MeuCarometroCardProps) {
  const [expandido, setExpandido] = useState(false);
  const { emoji, color } = scoreVisual(score);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col gap-3">
      <p className="text-center text-sm font-semibold text-gray-700">{titulo}</p>

      <div className="flex items-center justify-between px-2">
        <span className="text-3xl leading-none" title={score !== null ? `${score}%` : 'Sem dados'}>
          {emoji}
        </span>
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
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
        <span>Ver por dia</span>
      </button>

      {expandido && (
        <div className="flex flex-col gap-3">
          {diasDaSemana.length > 0 && (
            <div className="flex justify-around items-end">
              {diasDaSemana.map(dia => (
                <div
                  key={dia.data}
                  className="flex flex-col items-center gap-1"
                  title={`${dayLabel(dia.data)}: ${dia.score !== null ? `${dia.score}%` : 'sem dados'}`}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: dotColor(dia.score) }}
                  />
                  <span className="text-[10px] text-gray-400">{dayLabel(dia.data)}</span>
                </div>
              ))}
            </div>
          )}
          {children && (
            <div className="text-xs text-gray-600 flex flex-col gap-1 pt-1 border-t border-gray-50">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
