'use client';

import { useMeuCarometro } from '@/hooks/useMeuCarometro';
import { MeuCarometroCard } from './MeuCarometroCard';
import { SeletorUsuarioAdmin } from './SeletorUsuarioAdmin';

export function MeuCarometroBloco() {
  const {
    sirene,
    engajamento,
    indicadores,
    diasSirene,
    diasEngajamento,
    diasIndicadores,
    semanaAtual,
    isLoading,
    error,
  } = useMeuCarometro();

  if (isLoading) {
    return (
      <div className="bg-[#F8F7F5] rounded-xl p-6">
        <p className="text-sm text-gray-400 text-center animate-pulse">Carregando Carômetro…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#F8F7F5] rounded-xl p-6">
        <p className="text-sm text-red-500 text-center">Erro: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#F8F7F5] rounded-xl p-4 flex flex-col gap-4">
      <SeletorUsuarioAdmin />
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
        MEU CARÔMETRO — S{String(semanaAtual).padStart(2, '0')} · clique nos cards = detalhes
      </h2>

      <div className="grid grid-cols-3 gap-4">
        {/* Sirene */}
        <MeuCarometroCard
          titulo="Sirene"
          score={sirene?.score ?? null}
          diasDaSemana={diasSirene}
          tipo="sirene"
        >
          {sirene && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">Atrasados</span>
                <span className="font-medium" style={{ color: sirene.atrasados > 0 ? '#dc2626' : undefined }}>
                  {sirene.atrasados}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Abertos</span>
                <span className="font-medium">{sirene.abertos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sem prazo</span>
                <span className="font-medium text-gray-400">{sirene.semPrazo}</span>
              </div>
            </>
          )}
        </MeuCarometroCard>

        {/* Engajamento */}
        <MeuCarometroCard
          titulo="Engajamento"
          score={engajamento?.score ?? null}
          diasDaSemana={diasEngajamento}
          tipo="engajamento"
        >
          {engajamento && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">Atividades atrasadas</span>
                <span
                  className="font-medium"
                  style={{ color: engajamento.atividadesAtrasadas > 0 ? '#dc2626' : undefined }}
                >
                  {engajamento.atividadesAtrasadas}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Esta semana</span>
                <span className="font-medium">{engajamento.acumuladoDias}</span>
              </div>
            </>
          )}
        </MeuCarometroCard>

        {/* Indicadores */}
        <MeuCarometroCard
          titulo="Indicadores"
          score={indicadores?.media ?? null}
          diasDaSemana={diasIndicadores}
          tipo="indicadores"
        >
          {indicadores && indicadores.porIndicador.length > 0 ? (
            indicadores.porIndicador.map(ind => (
              <div key={ind.nome} className="flex justify-between gap-2">
                <span className="text-gray-500 truncate flex-1">{ind.nome}</span>
                <span className="font-medium whitespace-nowrap tabular-nums">{ind.percentual}%</span>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-center py-1">Sem lançamentos esta semana</p>
          )}
        </MeuCarometroCard>
      </div>

      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" />
          &lt;35% Vermelho
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-600" />
          35–65% Amarelo
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-700" />
          &gt;65% Verde
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300" />
          Sem dados
        </span>
      </div>
    </div>
  );
}
