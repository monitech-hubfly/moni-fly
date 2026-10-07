'use client';

import Image from 'next/image';
import { memo, ReactNode, useState } from 'react';
import type { DiaStatus, SemanaStatusInd } from '@/hooks/useMeuCarometro';

function getCarinhaImg(score: number | null): string {
  if (score === null) return '/carometro/carometro-emoji-branco.png';
  if (score >= 90) return '/carometro/carometro-emoji-verde-escuro.png';
  if (score >= 70) return '/carometro/carometro-emoji-verde-claro.png';
  if (score >= 50) return '/carometro/carometro-emoji-amarelo.png';
  return '/carometro/carometro-emoji-vermelho.png';
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 90) return 'text-green-700';
  if (score >= 70) return 'text-green-500';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function dotColor(score: number | null): string {
  if (score === null) return '#d1d5db';
  if (score >= 90) return '#15803d';
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#ca8a04';
  return '#dc2626';
}

function scoreEmoji(score: number | null): string {
  if (score === null) return '—';
  if (score >= 90) return '😁';
  if (score >= 70) return '🙂';
  if (score >= 50) return '😐';
  return '😟';
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
    concluidos:            'Concluídos',
    atrasados:             'Atrasados',
    venceHoje:             'Vence hoje',
    futuras:               'Futuras (fora do %)',
    abertos:               'Total abertos',
    semPrazo:              'Sem prazo',
    // Engajamento — atividades
    atividades_agendadas:  'Agendadas esta semana',
    atividades_realizadas: 'Concluídas',
    atividades_atrasadas:  'Ativ. atrasadas',
    // Engajamento — cards
    cards_emDia:           'Cards SLA em dia',
    cards_atrasados:       'Cards atrasados',
    cards_bloqueados:      'Cards com trava',
    // Engajamento — próximas atividades
    proximas_concluidos:   'Próx. concluídas',
    proximas_venceHoje:    'Próx. vence hoje',
    proximas_atrasadas:    'Próx. atrasadas',
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
              <span className="text-[10px] font-bold leading-none" style={{ color: dia.score !== null ? '#ffffff' : '#6b7280' }}>
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
  /** Prévia: score da semana atual (bolinha esquerda, clicável) */
  score: number | null;
  /** Resultado do ciclo: score acumulado do mês (bolinha direita, estática) */
  scoreCiclo?: number | null;
  /** Label da bolinha esquerda */
  labelPrevia?: string;
  /** Label da bolinha direita */
  labelCiclo?: string;
  diasDaSemana?: DiaStatus[];
  semanasIndicadores?: SemanaStatusInd[];
  tipo: 'sirene' | 'engajamento' | 'indicadores';
  children?: ReactNode;
};

function MeuCarometroCardInner({
  titulo,
  score,
  scoreCiclo,
  labelPrevia,
  labelCiclo,
  diasDaSemana,
  semanasIndicadores,
  tipo,
  children,
}: MeuCarometroCardProps) {
  const [expandido, setExpandido] = useState(false);

  // Bolinha esquerda: Prévia da semana
  const previaImg  = getCarinhaImg(score);
  const previaCls  = scoreColor(score);

  // Bolinha direita: Resultado do ciclo
  const cicloColor = dotColor(scoreCiclo ?? null);
  const cicloEmoji = scoreEmoji(scoreCiclo ?? null);

  const hasCiclo = scoreCiclo !== undefined && scoreCiclo !== null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col gap-3">
      <p className="text-center text-sm font-semibold text-gray-700">{titulo}</p>

      {/* ── Duas bolinhas: Prévia (esq, clicável) + Resultado Ciclo (dir) ── */}
      <div className="flex gap-2 items-stretch">
        {/* ESQUERDA — Prévia semanal (abre accordion) */}
        <button
          type="button"
          onClick={() => setExpandido(v => !v)}
          className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
          title="Clique para ver detalhes"
        >
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide leading-none">
            {labelPrevia ?? (tipo === 'indicadores' ? 'Prévia' : 'Semana atual')}
          </span>
          <Image src={previaImg} alt="carinha" width={48} height={48} className="object-contain" style={{ background: 'transparent' }} />
          <span className={`text-2xl font-bold tabular-nums leading-none ${previaCls}`}>
            {score !== null ? `${score}%` : '—'}
          </span>
          <span className="text-[9px] text-gray-400 mt-0.5">{expandido ? '▲ fechar' : '▼ detalhes'}</span>
        </button>

        {/* DIREITA — Resultado do ciclo (estático) */}
        {hasCiclo && (
          <div className="flex flex-col items-center gap-1 py-2 px-3 rounded-lg border border-gray-100 bg-gray-50 min-w-[72px]">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide leading-none">
              {labelCiclo ?? 'Ciclo'}
            </span>
            <span className="text-2xl" style={{ lineHeight: 1.2 }}>{cicloEmoji}</span>
            <span className="text-xl font-bold tabular-nums leading-none" style={{ color: cicloColor }}>
              {scoreCiclo !== null ? `${scoreCiclo}%` : '—'}
            </span>
            <span className="text-[9px] text-gray-400 mt-0.5">resultado</span>
          </div>
        )}
      </div>

      {/* ── Accordion de detalhes ── */}
      {expandido && (
        <div className="flex flex-col gap-3 border-t border-gray-100 pt-2">
          {children && (
            <div className="text-xs text-gray-600 flex flex-col gap-1">
              {children}
            </div>
          )}
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

export const MeuCarometroCard = memo(MeuCarometroCardInner);
