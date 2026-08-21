'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GuardaConstrucao } from '@/components/carometro/GuardaConstrucao';
import { isoWeek } from '@/utils/periodos';
import { useDashboardGeral, type AreaDashboard, type DiaDetalhe } from '@/hooks/useDashboardGeral';

// ── Helpers de cor/imagem ─────────────────────────────────────────────────────
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

// ── Carinha (dois tamanhos) ───────────────────────────────────────────────────
function Carinha({ score, label, small = false }: {
  score: number | null; label: string; small?: boolean;
}) {
  const imgCls = small ? 'w-5 h-5' : 'w-7 h-7';
  const txtCls = small ? 'text-[8px]' : 'text-[9px]';
  const lblCls = small ? 'text-[7px]' : 'text-[8px]';
  return (
    <div className="flex flex-col items-center gap-0" style={{ minWidth: small ? 28 : 34 }}>
      <img src={getCarinhaImg(score)} alt="" className={`${imgCls} object-contain`} />
      <span className={`${txtCls} font-medium tabular-nums leading-none ${scoreTextCls(score)}`}>
        {score !== null ? `${score}%` : '—'}
      </span>
      <span className={`${lblCls} text-gray-400 leading-none`}>{label}</span>
    </div>
  );
}

// ── Tipos de coluna ───────────────────────────────────────────────────────────
type ColSemana = { type: 'week'; semana: number };
type ColDia    = { type: 'day';  semana: number; data: string };
type Col = ColSemana | ColDia;

const DIAS_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function fmtDia(data: string) {
  const d = new Date(`${data}T12:00:00`);
  return `${DIAS_LABEL[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}`;
}

function getDiasParaSemana(areas: AreaDashboard[], semana: number): string[] {
  const set = new Set<string>();
  for (const area of areas)
    for (const u of area.usuarios)
      for (const dia of (u.porSemana[semana]?.dias ?? []))
        set.add(dia.data);
  return [...set].sort();
}

// ── Célula: semana agregada (3 emojis normais) ────────────────────────────────
function CelulaAgregada({ s, u, isFutura, ativa }: {
  s: number;
  u: AreaDashboard['usuarios'][0];
  isFutura: boolean;
  ativa: boolean;
}) {
  const sem = u.porSemana[s];
  const temDados = sem && (sem.sireneScore !== null || sem.engajamentoScore !== null || sem.indicadoresScore !== null);
  if (isFutura || !temDados) {
    return <td className="px-1 py-1 text-center text-xs text-gray-300 select-none">—</td>;
  }
  return (
    <td className={`px-1 py-1 text-center select-none ${ativa ? 'bg-blue-50' : ''}`}>
      <div className="flex justify-center gap-0.5">
        <Carinha score={sem.sireneScore}      label="Sir." />
        <Carinha score={sem.engajamentoScore} label="Eng." />
        <Carinha score={sem.indicadoresScore} label="Ind." />
      </div>
    </td>
  );
}

// ── Célula: dia individual (3 emojis pequenos) ────────────────────────────────
function CelulaDia({ data, u }: { data: string; u: AreaDashboard['usuarios'][0] }) {
  const dia: DiaDetalhe | undefined = Object.values(u.porSemana)
    .flatMap(s => s.dias)
    .find(d => d.data === data);
  const temDados = dia && (dia.sireneScore !== null || dia.engajamentoScore !== null || dia.indicadoresScore !== null);
  if (!temDados) {
    return <td className="px-0.5 py-1 text-center text-xs text-gray-300 select-none bg-blue-50/40">—</td>;
  }
  return (
    <td className="px-0.5 py-1 text-center bg-blue-50/40 select-none">
      <div className="flex justify-center gap-0.5">
        <Carinha score={dia!.sireneScore}      label="Sir." small />
        <Carinha score={dia!.engajamentoScore} label="Eng." small />
        <Carinha score={dia!.indicadoresScore} label="Ind." small />
      </div>
    </td>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
function DashboardGeralPageContent() {
  const supabase   = useMemo(() => createClient(), []);
  const [isAdmin,  setIsAdmin]   = useState<boolean | null>(null);
  const [nSemanas, setNSemanas]  = useState(8);
  const [semanaExpandida, setSemanaExpandida] = useState<number | null>(null);

  const { areas, semanas, semanaAtual, isLoading, error } = useDashboardGeral(nSemanas);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data: prof } = await supabase
        .from('profiles').select('role').eq('id', user.id).maybeSingle();
      setIsAdmin((prof as { role?: string } | null)?.role === 'admin');
    })();
  }, [supabase]);

  const colunas: Col[] = useMemo(() => semanas.flatMap((s): Col[] => {
    if (s === semanaExpandida) {
      const dias = getDiasParaSemana(areas, s);
      if (dias.length > 0)
        return dias.map(data => ({ type: 'day' as const, semana: s, data }));
    }
    return [{ type: 'week' as const, semana: s }];
  }), [semanas, semanaExpandida, areas]);

  const ncols = colunas.length + 1;

  const toggleSemana = (s: number) =>
    setSemanaExpandida(prev => prev === s ? null : s);

  if (isAdmin === null) {
    return <div className="flex items-center justify-center h-64 text-sm text-gray-400">Verificando acesso...</div>;
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
            onChange={e => { setNSemanas(Number(e.target.value)); setSemanaExpandida(null); }}
          >
            <option value={4}>Últimas 4 semanas</option>
            <option value={8}>Últimas 8 semanas</option>
            <option value={12}>Últimas 12 semanas</option>
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">Erro: {error}</p>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap border-r border-gray-100 w-44">
                Área / Usuário
              </th>
              {colunas.map((col, i) => {
                if (col.type === 'week') {
                  const isAtual  = col.semana === semanaAtual;
                  const isFutura = col.semana > semanaAtual;
                  const expandida = semanaExpandida === col.semana;
                  return (
                    <th key={`w-${col.semana}`}
                      className={`px-2 py-2 text-center text-xs font-semibold whitespace-nowrap ${isAtual ? 'text-blue-600' : 'text-gray-600'}`}>
                      <button
                        type="button"
                        disabled={isFutura}
                        onClick={() => !isFutura && toggleSemana(col.semana)}
                        className={`flex flex-col items-center gap-0 mx-auto leading-tight ${isFutura ? 'cursor-default opacity-40' : 'cursor-pointer hover:text-blue-500'}`}
                      >
                        <span>S{col.semana}</span>
                        {isAtual && <span className="text-[8px] font-normal text-blue-400">atual</span>}
                        {!isFutura && <span className="text-[8px] text-gray-400 mt-0.5">{expandida ? '▲' : '▼'}</span>}
                      </button>
                    </th>
                  );
                }
                const isFirst = i === 0 || colunas[i - 1].type === 'week' || (colunas[i - 1] as ColDia).semana !== col.semana;
                return (
                  <th key={`d-${col.data}`}
                    className={`px-1 py-2 text-center text-[10px] font-medium text-blue-700 bg-blue-50 whitespace-nowrap ${isFirst ? 'border-l border-blue-200' : ''}`}>
                    {fmtDia(col.data)}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr><td colSpan={ncols} className="px-4 py-10 text-center text-xs text-gray-400">Carregando...</td></tr>
            ) : areas.length === 0 ? (
              <tr><td colSpan={ncols} className="px-4 py-10 text-center text-xs text-gray-400">Nenhuma área com membros ativos encontrada.</td></tr>
            ) : areas.flatMap(area => {
              const rows: React.ReactElement[] = [];

              rows.push(
                <tr key={`area-${area.id}`} className="bg-gray-50 border-b border-gray-100">
                  <td className="sticky left-0 bg-gray-50 z-10 px-4 py-1.5 text-xs font-semibold text-gray-700 whitespace-nowrap border-r border-gray-100"
                    colSpan={ncols}>
                    {area.nome}
                  </td>
                </tr>
              );

              area.usuarios.forEach(u => {
                rows.push(
                  <tr key={`${area.id}-${u.profileId}`} className="border-b border-gray-100 hover:bg-gray-50/40 transition-colors">
                    <td className="sticky left-0 bg-white z-10 px-4 py-1.5 border-r border-gray-100 pl-6">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-600 font-semibold text-[9px] shrink-0">
                          {u.nome.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-600 truncate max-w-[110px]">{u.nome}</span>
                      </div>
                    </td>
                    {colunas.map(col =>
                      col.type === 'week'
                        ? <CelulaAgregada key={`w-${col.semana}`} s={col.semana} u={u} isFutura={col.semana > semanaAtual} ativa={semanaExpandida === col.semana} />
                        : <CelulaDia      key={`d-${col.data}`}   data={col.data} u={u} />
                    )}
                  </tr>
                );
              });

              return rows;
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-500">
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
        <span className="text-gray-400">Sir. = Sirene/Pastelaria · Eng. = Engajamento · Ind. = Indicadores · clique na semana para ver os dias</span>
      </div>
    </div>
  );
}

export default function DashboardGeralPage() {
  return <GuardaConstrucao><DashboardGeralPageContent /></GuardaConstrucao>;
}
