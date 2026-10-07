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
    semanasIndicadores,
    semanaAtual,
    ciclo,
    isLoading,
    error,
  } = useMeuCarometro();

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
            MEU CARÔMETRO — S{String(semanaAtual).padStart(2, '0')} · clique na Prévia = detalhes
          </h2>

          <div className="grid grid-cols-3 gap-4">
            {/* Sirene */}
            <MeuCarometroCard
              titulo="🚨 Sirene"
              score={sirene?.score ?? null}
              scoreCiclo={ciclo.sirene}
              labelPrevia={`S${String(semanaAtual).padStart(2, '0')} — prévia`}
              labelCiclo="Ciclo — resultado"
              diasDaSemana={diasSirene}
              tipo="sirene"
            >
              {sirene && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Em aberto (atrasados)</span>
                    <span className="font-medium" style={{ color: sirene.atrasados > 0 ? '#dc2626' : undefined }}>
                      {sirene.atrasados}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total abertos</span>
                    <span className="font-medium">{sirene.abertos}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sem prazo</span>
                    <span className="font-medium text-gray-400">{sirene.semPrazo}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                    Sirene nunca reseta — acumulação contínua. Crédito parcial por Tier ao resolver com atraso.
                  </p>
                </>
              )}
            </MeuCarometroCard>

            {/* Engajamento */}
            <MeuCarometroCard
              titulo="⚡ Engajamento"
              score={engajamento?.score ?? null}
              scoreCiclo={ciclo.engajamento}
              labelPrevia={`S${String(semanaAtual).padStart(2, '0')} — prévia`}
              labelCiclo="Ciclo — resultado"
              diasDaSemana={diasEngajamento}
              tipo="engajamento"
            >
              {engajamento && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ativ. atrasadas</span>
                    <span
                      className="font-medium"
                      style={{ color: engajamento.atividades.atrasadas > 0 ? '#dc2626' : undefined }}
                    >
                      {engajamento.atividades.atrasadas}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ativ. planejadas</span>
                    <span className="font-medium">{engajamento.atividades.agendadas}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cards atrasados</span>
                    <span
                      className="font-medium"
                      style={{ color: engajamento.cards.atrasados > 0 ? '#dc2626' : undefined }}
                    >
                      {engajamento.cards.atrasados}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cards abertos</span>
                    <span className="font-medium">{engajamento.cards.comSLA}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                    Fecha toda sexta · zera a cada ciclo mensal.
                  </p>
                </>
              )}
            </MeuCarometroCard>

            {/* Indicadores */}
            <MeuCarometroCard
              titulo="📈 Indicadores"
              score={indicadores?.media ?? null}
              scoreCiclo={ciclo.indicadores}
              labelPrevia="Prévia — semana"
              labelCiclo="Ciclo — resultado"
              semanasIndicadores={semanasIndicadores}
              tipo="indicadores"
            />
          </div>

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
        </>
      )}
    </div>
  );
}
