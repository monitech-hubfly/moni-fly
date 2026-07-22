'use client';

import { ReactNode, useState } from 'react';
import type { DiaStatus } from '@/hooks/useMeuCarometro';

function getCarinhaImg(score: number | null): string {
  if (score === null) return '/carometro/carometro-emoji-branco.png';
  if (score > 65)  return '/carometro/carometro-emoji-verde-escuro.png';
  if (score >= 35) return '/carometro/carometro-emoji-amarelo.png';
  return '/carometro/carometro-emoji-vermelho.png';
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score > 65)  return 'text-green-700';
  if (score >= 35) return 'text-yellow-600';
  return 'text-red-600';
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

const TOOLTIP_FORMULA: Record<string, string> = {
  sirene: '100 − (atrasados × 20 + semPrazo × 5)',
  engajamento: 'concluídas (2 sem.) / (concluídas + atrasadas 2 sem.) × 100',
  indicadores: 'média dos % de cada indicador',
};

type MeuCarometroCardProps = {
  titulo: string;
  score: number | null;
  diasDaSemana: DiaStatus[];
  tipo: 'sirene' | 'engajamento' | 'indicadores';
  children?: ReactNode;
};

const CARINHA_SIZE = 80;

export function MeuCarometroCard({
  titulo,
  score,
  diasDaSemana,
  tipo,
  children,
}: MeuCarometroCardProps) {
  const [expandido, setExpandido] = useState(false);
  const carinhaImg = getCarinhaImg(score);
  const scoreCls   = scoreColor(score);
  const formula = TOOLTIP_FORMULA[tipo];

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col gap-3">
      <p className="text-center text-sm font-semibold text-gray-700">{titulo}</p>

      <div className="flex items-center justify-center gap-4 py-1">
        <img
          src={carinhaImg}
          alt="carinha"
          style={{ width: CARINHA_SIZE, height: CARINHA_SIZE }}
          className="object-contain shrink-0"
          title={score !== null ? `${score}%` : 'Sem dados'}
        />
        <span className={`text-3xl font-bold tabular-nums leading-none ${scoreCls}`}>
          {score !== null ? `${score.toFixed(1)}%` : '—'}
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
                <div key={dia.data} className="flex flex-col items-center gap-1 group relative">
                  {/* Tooltip com fórmula */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 hidden group-hover:flex flex-col items-center pointer-events-none">
                    <div className="bg-gray-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap max-w-[240px] text-center leading-tight">
                      <span className="font-semibold">{dayLabel(dia.data)}</span>
                      {dia.score !== null ? `: ${dia.score}%` : ': sem dados'}
                      {dia.detalhe && (
                        <>
                          <br />
                          <span className="text-gray-200">{dia.detalhe}</span>
                        </>
                      )}
                      <br />
                      <span className="text-gray-300">{formula}</span>
                    </div>
                    <div className="w-2 h-2 bg-gray-800 rotate-45 -mt-1" />
                  </div>
                  {/* Bolinha 40px com % dentro */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: dotColor(dia.score) }}
                  >
                    <span
                      className="text-xs font-bold leading-none"
                      style={{ color: dia.score !== null ? '#ffffff' : '#6b7280' }}
                    >
                      {dia.score !== null ? `${dia.score}%` : '—'}
                    </span>
                  </div>
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
