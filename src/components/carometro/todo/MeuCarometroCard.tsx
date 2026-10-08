'use client';

import Image from 'next/image';
import { memo, ReactNode, useState } from 'react';
import type { DiaStatus, IndicadorItem, SemanaStatusInd } from '@/hooks/useMeuCarometro';

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
function DiariosCirculos({ dias, tipo }: { dias: DiaStatus[]; tipo: 'sirene' | 'engajamento' }) {
  const [aberto, setAberto]   = useState<string | null>(null);
  const [metrica, setMetrica] = useState(false);

  // Detecta se há dados de tier no detalhe para usar layout v2
  function hasTierData(d: DiaStatus): boolean {
    return d.detalhe !== undefined && (
      'concluidos_no_prazo' in d.detalhe || 'filhas_np' in d.detalhe
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-around items-end">
        {dias.map(dia => (
          <div key={dia.data} className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => { setAberto(aberto === dia.data ? null : dia.data); setMetrica(false); }}
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
        const d = dia.detalhe ?? {};

        return (
          <div className="bg-gray-50 rounded-lg p-2.5 text-xs flex flex-col gap-2 border border-gray-100">
            {/* Cabeçalho com score e botão Métrica */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-600 text-[10px] uppercase tracking-wide">
                {dayLabel(dia.data)} — {dia.score !== null ? `${dia.score}%` : 'Sem dados'}
              </span>
              <button
                type="button"
                onClick={() => setMetrica(v => !v)}
                className="text-[9px] text-blue-500 hover:text-blue-700 font-semibold"
              >
                {metrica ? 'ocultar métrica' : 'ver métrica'}
              </button>
            </div>

            {/* Fórmula */}
            {metrica && (
              <p className="text-[10px] text-gray-400 italic border-l-2 border-gray-200 pl-2 leading-relaxed">
                {tipo === 'sirene'
                  ? 'soma(créditos) ÷ (relevantes × 100) × 100 — no prazo=100%, T1=75%, T2=50%, T3=20%, em aberto=0%'
                  : 'soma(créditos filhas concluídas) ÷ (relevantes × 100) × 100 — mesmas faixas de tier'}
              </p>
            )}

            {/* ── Layout v2: breakdown por tier ── */}
            {hasTierData(dia) ? (
              tipo === 'sirene' ? (
                <div className="flex flex-col gap-1">
                  {/* Concluídas */}
                  {(Number(d.concluidos_no_prazo) > 0 || Number(d.concluidos_t1) > 0 || Number(d.concluidos_t2) > 0 || Number(d.concluidos_t3) > 0) && (
                    <div className="flex flex-col gap-0.5">
                      {Number(d.concluidos_no_prazo) > 0 && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-green-700">✓ Concluídas no prazo</span>
                          <span className="font-semibold tabular-nums text-green-700">{Number(d.concluidos_no_prazo)} · 100%</span>
                        </div>
                      )}
                      {Number(d.concluidos_t1) > 0 && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-yellow-700">✓ Concluídas T1 (1–6d)</span>
                          <span className="font-semibold tabular-nums text-yellow-700">{Number(d.concluidos_t1)} · 75%</span>
                        </div>
                      )}
                      {Number(d.concluidos_t2) > 0 && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-red-600">✓ Concluídas T2 (7–14d)</span>
                          <span className="font-semibold tabular-nums text-red-600">{Number(d.concluidos_t2)} · 50%</span>
                        </div>
                      )}
                      {Number(d.concluidos_t3) > 0 && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-purple-700">✓ Concluídas T3 (15+d)</span>
                          <span className="font-semibold tabular-nums text-purple-700">{Number(d.concluidos_t3)} · 20%</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Em aberto/atrasados */}
                  {Number(d.atrasados) > 0 && (
                    <div className="flex justify-between items-center text-[11px] border-t border-gray-100 pt-1 mt-0.5">
                      <span className="text-gray-500">⚠ Em aberto / Atrasados</span>
                      <span className="font-semibold tabular-nums text-gray-500">{Number(d.atrasados)} · 0%</span>
                    </div>
                  )}
                  {/* Sem dados */}
                  {Number(d.relevantes) === 0 && dia.score === null && (
                    <span className="text-gray-400 text-center">Sem dados para este dia</span>
                  )}
                </div>
              ) : (
                /* Engajamento — Metas Filhas */
                <div className="flex flex-col gap-1">
                  {(Number(d.filhas_np) > 0 || Number(d.filhas_t1) > 0 || Number(d.filhas_t2) > 0 || Number(d.filhas_t3) > 0) && (
                    <div className="flex flex-col gap-0.5">
                      {Number(d.filhas_np) > 0 && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-green-700">✓ Filhas no prazo</span>
                          <span className="font-semibold tabular-nums text-green-700">{Number(d.filhas_np)} · 100%</span>
                        </div>
                      )}
                      {Number(d.filhas_t1) > 0 && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-yellow-700">✓ Filhas T1 (1–6d)</span>
                          <span className="font-semibold tabular-nums text-yellow-700">{Number(d.filhas_t1)} · 75%</span>
                        </div>
                      )}
                      {Number(d.filhas_t2) > 0 && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-red-600">✓ Filhas T2 (7–14d)</span>
                          <span className="font-semibold tabular-nums text-red-600">{Number(d.filhas_t2)} · 50%</span>
                        </div>
                      )}
                      {Number(d.filhas_t3) > 0 && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-purple-700">✓ Filhas T3 (15+d)</span>
                          <span className="font-semibold tabular-nums text-purple-700">{Number(d.filhas_t3)} · 20%</span>
                        </div>
                      )}
                    </div>
                  )}
                  {Number(d.filhas_vencidas_abertas) > 0 && (
                    <div className="flex justify-between items-center text-[11px] border-t border-gray-100 pt-1 mt-0.5">
                      <span className="text-gray-500">⚠ Vencidas em aberto</span>
                      <span className="font-semibold tabular-nums text-gray-500">{Number(d.filhas_vencidas_abertas)} · 0%</span>
                    </div>
                  )}
                  {Number(d.filhas_no_prazo) > 0 && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-blue-600">⏱ Pendentes (no prazo)</span>
                      <span className="tabular-nums text-blue-600">{Number(d.filhas_no_prazo)}</span>
                    </div>
                  )}
                  {Number(d.filhas_total) === 0 && (
                    <span className="text-gray-400 text-center">Sem metas filhas neste dia</span>
                  )}
                </div>
              )
            ) : (
              /* Fallback: sem dados de tier (dias históricos sem novo snapshot) */
              <>
                {dia.detalhe && Object.entries(dia.detalhe)
                  .filter(([k]) => k !== 'score' && !k.endsWith('_score'))
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-500">{k.replace(/_/g, ' ')}</span>
                      <span className="font-medium tabular-nums">{String(v ?? '—')}</span>
                    </div>
                  ))}
                {!dia.detalhe && <span className="text-gray-400 text-center">Sem detalhes disponíveis</span>}
              </>
            )}
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

// ── Tabela por Meta Mãe (Indicadores) ────────────────────────────────────────
/**
 * Exibe Prévia e Resultado por Meta Mãe.
 * - Prévia: indicadoresPrevia.porIndicador (Atingível=100%/0% por prazo; Recorrente=score semanal)
 * - Resultado: indicadoresResultado.porIndicador (score da semana de referência)
 */
function MetasMaeTabela({
  previa,
  resultado,
}: {
  previa: IndicadorItem[];
  resultado: IndicadorItem[];
}) {
  if (previa.length === 0) {
    return (
      <p className="text-[11px] text-gray-400 text-center py-2">
        Nenhuma meta de indicador ativa para esta área.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {/* Cabeçalho */}
      <div className="grid grid-cols-[1fr_72px_72px] gap-1 px-2 py-1 text-[9px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
        <span>Meta / Indicador</span>
        <span className="text-center">Prévia</span>
        <span className="text-center">Resultado</span>
      </div>
      {previa.map((ind, i) => {
        const res = resultado[i] ?? null;
        const prevPct = ind.percentual;
        const resPct  = res?.percentual ?? null;
        return (
          <div key={ind.nome} className="grid grid-cols-[1fr_72px_72px] gap-1 px-2 py-1.5 text-[11px] border-b border-gray-50 last:border-0">
            <span className="text-gray-600 truncate leading-snug">{ind.nome}</span>
            <span
              className="text-center font-bold tabular-nums"
              style={{ color: dotColor(prevPct) }}
            >
              {prevPct !== null ? `${prevPct}%` : '—'}
            </span>
            <span
              className="text-center font-bold tabular-nums"
              style={{ color: dotColor(resPct) }}
            >
              {resPct !== null ? `${resPct}%` : '—'}
            </span>
          </div>
        );
      })}
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
  /** Indicadores v2: items de Prévia para a tabela por Meta Mãe */
  indicadoresPrevia?: IndicadorItem[];
  /** Indicadores v2: items de Resultado para a tabela por Meta Mãe */
  indicadoresResultado?: IndicadorItem[];
  tipo: 'sirene' | 'engajamento' | 'indicadores';
  /** Nota exibida ao final do accordion */
  nota?: string;
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
  indicadoresPrevia,
  indicadoresResultado,
  tipo,
  nota,
  children,
}: MeuCarometroCardProps) {
  const [expandido, setExpandido] = useState(false);

  // Bolinha esquerda: Prévia da semana
  const previaImg  = getCarinhaImg(score);
  const previaCls  = scoreColor(score);

  // Bolinha direita: Resultado do ciclo
  const cicloImg   = getCarinhaImg(scoreCiclo ?? null);
  const cicloCls   = scoreColor(scoreCiclo ?? null);

  const hasCiclo = scoreCiclo !== null && scoreCiclo !== undefined;

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
          <Image src={previaImg} alt="carinha" width={64} height={64} className="object-contain" style={{ background: 'transparent' }} />
          <span className={`text-2xl font-bold tabular-nums leading-none ${previaCls}`}>
            {score !== null ? `${score}%` : '—'}
          </span>
          <span className="text-[9px] text-gray-400 mt-0.5">{expandido ? '▲ fechar' : '▼ detalhes'}</span>
        </button>

        {/* DIREITA — Resultado do ciclo (estático) — mesmo padrão visual da esquerda */}
        <div className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border border-gray-100 bg-gray-50 ${hasCiclo ? '' : 'opacity-40'}`}>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide leading-none">
            {labelCiclo ?? 'Ciclo'}
          </span>
          <Image src={cicloImg} alt="carinha ciclo" width={64} height={64} className="object-contain" style={{ background: 'transparent' }} />
          <span className={`text-2xl font-bold tabular-nums leading-none ${cicloCls}`}>
            {hasCiclo ? `${scoreCiclo}%` : '—'}
          </span>
          <span className="text-[9px] text-gray-400 mt-0.5">resultado</span>
        </div>
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
            <DiariosCirculos dias={diasDaSemana} tipo={tipo as 'sirene' | 'engajamento'} />
          )}
          {tipo === 'indicadores' && indicadoresPrevia !== undefined && (
            <MetasMaeTabela
              previa={indicadoresPrevia ?? []}
              resultado={indicadoresResultado ?? []}
            />
          )}
          {/* Fallback: círculos de semanas quando não há dados de Meta Mãe */}
          {tipo === 'indicadores' && indicadoresPrevia === undefined && semanasIndicadores && semanasIndicadores.length > 0 && (
            <SemanaisCirculos semanas={semanasIndicadores} />
          )}
          {nota && (
            <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100 leading-relaxed">
              {nota}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export const MeuCarometroCard = memo(MeuCarometroCardInner);
