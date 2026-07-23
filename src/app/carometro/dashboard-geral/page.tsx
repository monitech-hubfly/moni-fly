'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GuardaConstrucao } from '@/components/carometro/GuardaConstrucao';
import { isoWeek } from '@/utils/periodos';
import { useDashboardGeral, DiaDetalhe } from '@/hooks/useDashboardGeral';

// ── Carinha img ───────────────────────────────────────────────────────────────
function getCarinhaImg(score: number | null): string {
  if (score === null) return '/carometro/carometro-emoji-branco.png';
  if (score > 65)  return '/carometro/carometro-emoji-verde-escuro.png';
  if (score >= 35) return '/carometro/carometro-emoji-amarelo.png';
  return '/carometro/carometro-emoji-vermelho.png';
}

function scoreTextCls(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score > 65)  return 'text-green-700';
  if (score >= 35) return 'text-yellow-600';
  return 'text-red-600';
}

// ── Célula de semana ──────────────────────────────────────────────────────────
function CelulaScore({ score, isFutura, ativa, onClick }: {
  score: number | null; isFutura: boolean; ativa: boolean; onClick: () => void;
}) {
  if (isFutura) {
    return <td className="px-2 py-2 text-center text-xs text-gray-300 select-none">—</td>;
  }
  return (
    <td
      className={`px-2 py-1 text-center cursor-pointer transition-colors select-none ${ativa ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
      onClick={onClick}
    >
      <div className="flex flex-col items-center gap-0.5">
        <img src={getCarinhaImg(score)} alt="" className="w-8 h-8 object-contain" />
        <span className={`text-[10px] font-medium tabular-nums ${scoreTextCls(score)}`}>
          {score !== null ? `${score}%` : '—'}
        </span>
      </div>
    </td>
  );
}

// ── Linha de detalhe (expandida) ──────────────────────────────────────────────
const DIAS_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function LinhaDetalhe({ dias, ncols }: { dias: DiaDetalhe[]; ncols: number }) {
  return (
    <tr>
      <td colSpan={ncols} className="px-4 py-3 bg-blue-50 border-b border-blue-100">
        {dias.length === 0 ? (
          <p className="text-xs text-gray-400">Sem dados registrados para esta semana.</p>
        ) : (
          <div className="flex gap-4 flex-wrap">
            {dias.map(dia => {
              const d     = new Date(`${dia.data}T12:00:00`);
              const label = DIAS_LABEL[d.getDay()];
              const dd    = String(d.getDate()).padStart(2, '0');
              return (
                <div key={dia.data} className="flex flex-col items-center gap-1 min-w-[52px]">
                  <img src={getCarinhaImg(dia.score)} alt="" className="w-8 h-8 object-contain" />
                  <span className={`text-[10px] font-semibold tabular-nums ${scoreTextCls(dia.score)}`}>
                    {dia.score !== null ? `${dia.score}%` : '—'}
                  </span>
                  <span className="text-[10px] text-gray-500">{label} {dd}</span>
                  <div className="flex flex-col items-start gap-px text-[9px] text-gray-400">
                    {dia.sirene       !== null && <span>Sirene {dia.sirene}%</span>}
                    {dia.engajamento  !== null && <span>Engaj. {dia.engajamento}%</span>}
                    {dia.indicadores  !== null && <span>Indic. {dia.indicadores}%</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
function DashboardGeralPageContent() {
  const supabase  = useMemo(() => createClient(), []);
  const [isAdmin, setIsAdmin]   = useState<boolean | null>(null);
  const [nSemanas, setNSemanas] = useState(8);

  // "areaId-semana" do slot expandido
  const [expandido, setExpandido] = useState<string | null>(null);

  const { areas, semanas, semanaAtual, isLoading, error } = useDashboardGeral(nSemanas);

  // Admin check
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data: prof } = await supabase
        .from('profiles').select('role').eq('id', user.id).maybeSingle();
      setIsAdmin((prof as { role?: string } | null)?.role === 'admin');
    })();
  }, [supabase]);

  const toggleExpand = (areaId: string, semana: number) => {
    const key = `${areaId}-${semana}`;
    setExpandido(prev => prev === key ? null : key);
  };

  const ncols = semanas.length + 2; // Área + N semanas + Acumulado

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        Verificando acesso...
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <span className="text-2xl">🔒</span>
        <p className="text-sm text-gray-500 font-medium">Acesso restrito — apenas administradores.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Dashboard Geral</h1>
          <p className="text-xs text-gray-500 mt-0.5">Semana atual: S{semanaAtual}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Período:</label>
          <select
            className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={nSemanas}
            onChange={e => { setNSemanas(Number(e.target.value)); setExpandido(null); }}
          >
            <option value={4}>Últimas 4 semanas</option>
            <option value={8}>Últimas 8 semanas</option>
            <option value={12}>Últimas 12 semanas</option>
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">Erro: {error}</p>}

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
        <table className="w-full text-sm border-collapse" style={{ minWidth: `${160 + semanas.length * 80 + 80}px` }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap border-r border-gray-100 w-40">
                Área
              </th>
              {semanas.map(s => (
                <th key={s} className={`px-3 py-3 text-center text-xs font-semibold whitespace-nowrap ${s === semanaAtual ? 'text-blue-600' : 'text-gray-600'}`}>
                  S{s}
                  {s === semanaAtual && <span className="block text-[8px] font-normal text-blue-400">atual</span>}
                </th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 whitespace-nowrap border-l border-gray-100 w-24">
                Acumulado
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={ncols} className="px-4 py-10 text-center text-xs text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : areas.length === 0 ? (
              <tr>
                <td colSpan={ncols} className="px-4 py-10 text-center text-xs text-gray-400">
                  Nenhuma área encontrada.
                </td>
              </tr>
            ) : (
              areas.flatMap(area => {
                const rows: React.ReactElement[] = [];

                // Linha principal da área
                rows.push(
                  <tr key={area.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="sticky left-0 bg-white z-10 px-4 py-2 text-xs font-medium text-gray-700 whitespace-nowrap border-r border-gray-100">
                      {area.nome}
                    </td>
                    {semanas.map(s => (
                      <CelulaScore
                        key={s}
                        score={area.porSemana[s]?.score ?? null}
                        isFutura={s > semanaAtual}
                        ativa={expandido === `${area.id}-${s}`}
                        onClick={() => !( s > semanaAtual) && toggleExpand(area.id, s)}
                      />
                    ))}
                    <td className="px-3 py-2 text-center border-l border-gray-100">
                      <div className="flex flex-col items-center gap-0.5">
                        <img src={getCarinhaImg(area.scoreAcumulado)} alt="" className="w-7 h-7 object-contain" />
                        <span className={`text-[10px] font-semibold tabular-nums ${scoreTextCls(area.scoreAcumulado)}`}>
                          {area.scoreAcumulado !== null ? `${area.scoreAcumulado}%` : '—'}
                        </span>
                      </div>
                    </td>
                  </tr>,
                );

                // Linha de detalhe (se expandida)
                if (expandido?.startsWith(`${area.id}-`)) {
                  const semExp = Number(expandido.split('-').slice(1).join('-'));
                  const diasExp = area.porSemana[semExp]?.dias ?? [];
                  rows.push(
                    <LinhaDetalhe key={`${area.id}-detail`} dias={diasExp} ncols={ncols} />,
                  );
                }

                return rows;
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 text-[10px] text-gray-500">
        {[
          { img: '/carometro/carometro-emoji-verde-escuro.png', label: '> 65%' },
          { img: '/carometro/carometro-emoji-amarelo.png',      label: '35–65%' },
          { img: '/carometro/carometro-emoji-vermelho.png',     label: '< 35%' },
          { img: '/carometro/carometro-emoji-branco.png',       label: 'Sem dados' },
        ].map(({ img, label }) => (
          <div key={label} className="flex items-center gap-1">
            <img src={img} alt="" className="w-4 h-4 object-contain" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardGeralPage() {
  return <GuardaConstrucao><DashboardGeralPageContent /></GuardaConstrucao>;
}
