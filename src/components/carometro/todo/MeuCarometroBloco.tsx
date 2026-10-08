'use client';

import { useMeuCarometro } from '@/hooks/useMeuCarometro';
import { MeuCarometroCard } from './MeuCarometroCard';
import { SeletorUsuarioAdmin } from './SeletorUsuarioAdmin';

/** Retorna "S41 (04/10 a 10/10)" para a semana ISO atual */
function labelSemana(semana: number): string {
  const hoje = new Date();
  const dow  = (hoje.getDay() + 6) % 7; // 0 = segunda
  const seg  = new Date(hoje); seg.setDate(hoje.getDate() - dow);
  const sex  = new Date(seg);  sex.setDate(seg.getDate() + 4);
  const fmt  = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `S${String(semana).padStart(2, '0')} (${fmt(seg)} a ${fmt(sex)})`;
}

const LABEL_CICLO = 'Resultado (Boné Day)';

export function MeuCarometroBloco() {
  const {
    sirene,
    engajamento,
    indicadores,
    indicadoresPrevia,
    diasSirene,
    diasEngajamento,
    semanasIndicadores,
    semanaAtual,
    ciclo,
    isLoading,
    error,
  } = useMeuCarometro();

  const lPrevia = labelSemana(semanaAtual);

  return (
    <div className="bg-[#F8F7F5] rounded-xl p-4 flex flex-col gap-4">
      {/* SeletorUsuarioAdmin sempre montado — nunca desmonta durante loading */}
      <SeletorUsuarioAdmin />

      {isLoading ? (
        <p className="text-sm text-gray-400 text-center animate-pulse py-4">Carregando Carômetro…</p>
      ) : error ? (
        <p className="text-sm text-red-500 text-center py-4">Erro: {error}</p>
      ) : (
        <>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
            MEU CARÔMETRO — {lPrevia} · clique na bolinha esquerda = detalhes
          </h2>

          <div className="grid grid-cols-3 gap-4">
            {/* Sirene */}
            <MeuCarometroCard
              titulo="🚨 Sirene"
              score={sirene?.score ?? null}
              scoreCiclo={ciclo.sirene}
              labelPrevia={lPrevia}
              labelCiclo={LABEL_CICLO}
              diasDaSemana={diasSirene}
              tipo="sirene"
            />

            {/* Engajamento */}
            <MeuCarometroCard
              titulo="⚡ Engajamento"
              score={engajamento?.score ?? null}
              scoreCiclo={ciclo.engajamento}
              labelPrevia={lPrevia}
              labelCiclo={LABEL_CICLO}
              diasDaSemana={diasEngajamento}
              tipo="engajamento"
            />

            {/* Indicadores */}
            <MeuCarometroCard
              titulo="📈 Indicadores"
              score={indicadoresPrevia?.media ?? null}
              scoreCiclo={ciclo.indicadores}
              labelPrevia={lPrevia}
              labelCiclo={LABEL_CICLO}
              indicadoresPrevia={indicadoresPrevia?.porIndicador ?? []}
              indicadoresResultado={indicadores?.porIndicador ?? []}
              tipo="indicadores"
            />
          </div>

          {/* Legenda carinhas */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-700" />
              😁 ≥90% Verde Escuro
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
              🙂 70–89% Verde Claro
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-600" />
              😐 50–69% Amarelo
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" />
              😟 &lt;50% Vermelho
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300" />
              Sem dados
            </span>
          </div>

          {/* Legenda Tiers */}
          <div className="border-t border-gray-100 pt-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center mb-1.5">
              Crédito parcial por Tier — Sirene &amp; Engajamento
            </p>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-[11px] text-gray-500">
              <span><span className="font-bold text-yellow-700">T1</span> · 1–6d = <span className="font-semibold">75%</span> crédito ao resolver</span>
              <span><span className="font-bold text-red-600">T2</span> · 7–14d = <span className="font-semibold">50%</span> crédito</span>
              <span><span className="font-bold text-purple-700">T3</span> · 15+d = <span className="font-semibold">20%</span> crédito</span>
              <span className="text-gray-400">Em aberto = 0% até resolver</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
