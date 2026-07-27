'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GuardaConstrucao } from '@/components/carometro/GuardaConstrucao';
import { isoWeek } from '@/utils/periodos';
import { useDashboardGeral, DiaDetalhe } from '@/hooks/useDashboardGeral';

// ── Helpers de imagem/cor ─────────────────────────────────────────────────────
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

// ── Mini-carinha (usada dentro das células e no detalhe) ──────────────────────
function MiniCarinha({ score, label }: { score: number | null; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[36px]">
      <img src={getCarinhaImg(score)} alt="" className="w-7 h-7 object-contain" />
      <span className={`text-[9px] font-medium tabular-nums leading-none ${scoreTextCls(score)}`}>
        {score !== null ? `${score}%` : '—'}
      </span>
      <span className="text-[8px] text-gray-400 leading-none">{label}</span>
    </div>
  );
}

// ── Célula de semana com 3 emojis ─────────────────────────────────────────────
function CelulaTresCategorias({
  sireneScore, atividadesScore, cardsScore,
  isFutura, ativa, onClick,
}: {
  sireneScore: number | null;
  atividadesScore: number | null;
  cardsScore: number | null;
  isFutura: boolean;
  ativa: boolean;
  onClick: () => void;
}) {
  if (isFutura) {
    return <td className="px-2 py-2 text-center text-xs text-gray-300 select-none">—</td>;
  }
  const temDados = sireneScore !== null || atividadesScore !== null || cardsScore !== null;
  if (!temDados) {
    return <td className="px-2 py-2 text-center text-xs text-gray-300 select-none">—</td>;
  }
  return (
    <td
      className={`px-1 py-1 text-center cursor-pointer transition-colors select-none ${ativa ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
      onClick={onClick}
    >
      <div className="flex justify-center gap-1">
        <MiniCarinha score={sireneScore}     label="Sir." />
        <MiniCarinha score={atividadesScore} label="Atv." />
        <MiniCarinha score={cardsScore}      label="Card" />
      </div>
    </td>
  );
}

// ── Linha de detalhe (dias expandidos) ───────────────────────────────────────
const DIAS_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function LinhaDetalhe({ dias, ncols }: { dias: DiaDetalhe[]; ncols: number }) {
  return (
    <tr>
      <td colSpan={ncols} className="px-4 py-3 bg-blue-50 border-b border-blue-100">
        {dias.length === 0 ? (
          <p className="text-xs text-gray-400">Sem dados registrados para esta semana.</p>
        ) : (
          <div className="flex gap-5 flex-wrap">
            {dias.map(dia => {
              const d     = new Date(`${dia.data}T12:00:00`);
              const label = DIAS_LABEL[d.getDay()];
              const dd    = String(d.getDate()).padStart(2, '0');
              return (
                <div key={dia.data} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500 font-medium">{label} {dd}</span>
                  <div className="flex gap-2">
                    <MiniCarinha score={dia.sireneScore}     label="Sir." />
                    <MiniCarinha score={dia.atividadesScore} label="Atv." />
                    <MiniCarinha score={dia.cardsScore}      label="Card" />
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

  // "areaId-profileId-semana" do slot expandido
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

  const toggleExpand = (areaId: string, profileId: string, semana: number) => {
    const key = `${areaId}-${profileId}-${semana}`;
    setExpandido(prev => prev === key ? null : key);
  };

  const ncols = semanas.length + 1; // Área/Usuário + N semanas (sem Acumulado)

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
        <table className="w-full text-sm border-collapse" style={{ minWidth: `${180 + semanas.length * 130}px` }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap border-r border-gray-100 w-44">
                Área / Usuário
              </th>
              {semanas.map(s => (
                <th key={s} className={`px-3 py-3 text-center text-xs font-semibold whitespace-nowrap ${s === semanaAtual ? 'text-blue-600' : 'text-gray-600'}`}>
                  S{s}
                  {s === semanaAtual && <span className="block text-[8px] font-normal text-blue-400">atual</span>}
                </th>
              ))}
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
                  Nenhuma área com dados encontrada.
                </td>
              </tr>
            ) : (
              areas.flatMap(area => {
                const rows: React.ReactElement[] = [];

                // Cabeçalho da área
                rows.push(
                  <tr key={`area-${area.id}`} className="bg-gray-50 border-b border-gray-200">
                    <td
                      className="sticky left-0 bg-gray-50 z-10 px-4 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap border-r border-gray-100"
                      colSpan={ncols}
                    >
                      {area.nome}
                    </td>
                  </tr>
                );

                // Uma linha por usuário
                area.usuarios.forEach(usuario => {
                  const expandKey = `${area.id}-${usuario.profileId}`;

                  rows.push(
                    <tr key={`${area.id}-${usuario.profileId}`} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="sticky left-0 bg-white z-10 px-4 py-2 text-xs text-gray-600 whitespace-nowrap border-r border-gray-100 pl-6">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-600 font-semibold text-[9px] shrink-0">
                            {usuario.nome.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate max-w-[110px]">{usuario.nome}</span>
                        </div>
                      </td>
                      {semanas.map(s => (
                        <CelulaTresCategorias
                          key={s}
                          sireneScore={usuario.porSemana[s]?.sireneScore ?? null}
                          atividadesScore={usuario.porSemana[s]?.atividadesScore ?? null}
                          cardsScore={usuario.porSemana[s]?.cardsScore ?? null}
                          isFutura={s > semanaAtual}
                          ativa={expandido === `${expandKey}-${s}`}
                          onClick={() => !(s > semanaAtual) && toggleExpand(area.id, usuario.profileId, s)}
                        />
                      ))}
                    </tr>
                  );

                  // Linha de detalhe (se expandida)
                  if (expandido?.startsWith(`${expandKey}-`)) {
                    const semExp = Number(expandido.split('-').pop());
                    const diasExp = usuario.porSemana[semExp]?.dias ?? [];
                    rows.push(
                      <LinhaDetalhe key={`${expandKey}-detail`} dias={diasExp} ncols={ncols} />
                    );
                  }
                });

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
        <span className="ml-2 text-gray-400">Sir. = Sirene/Pastelaria · Atv. = Atividades Planejadas · Card = Cards/Kanban</span>
      </div>
    </div>
  );
}

export default function DashboardGeralPage() {
  return <GuardaConstrucao><DashboardGeralPageContent /></GuardaConstrucao>;
}
