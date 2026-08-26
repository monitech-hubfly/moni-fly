'use client';

import { useMeuCarometro } from '@/hooks/useMeuCarometro';
import { MeuCarometroCard } from './MeuCarometroCard';
import { SeletorUsuarioAdmin } from './SeletorUsuarioAdmin';

function engScoreColor(score: number | null): string {
  if (score === null) return '#15803d';
  if (score >= 75) return '#15803d';
  if (score >= 60) return '#22c55e';
  if (score >= 30) return '#ca8a04';
  return '#dc2626';
}
function engScoreLabel(score: number | null): string {
  return score !== null ? `${score}%` : '—';
}

export function MeuCarometroBloco() {
  const {
    sirene,
    engajamento,
    indicadores,
    diasSirene,
    diasEngajamento,
    semanasIndicadores,
    semanaAtual,
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
                    <span className="text-gray-500">Concluídos</span>
                    <span className="font-medium" style={{ color: (sirene.concluidos ?? 0) > 0 ? '#15803d' : undefined }}>
                      {sirene.concluidos ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Atrasados</span>
                    <span className="font-medium" style={{ color: sirene.atrasados > 0 ? '#dc2626' : undefined }}>
                      {sirene.atrasados}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Vence hoje</span>
                    <span className="font-medium">{sirene.venceHoje ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-[10px]">Futuras (fora do %)</span>
                    <span className="font-medium text-gray-400">{sirene.futuras ?? 0}</span>
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
                  {/* Agenda */}
                  <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-semibold text-[10px] uppercase tracking-wide">Agenda</span>
                      <span className="font-bold text-[11px]" style={{ color: engScoreColor(engajamento.atividades.score) }}>
                        {engScoreLabel(engajamento.atividades.score)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Agendadas esta semana</span>
                      <span className="font-medium">{engajamento.atividades.agendadas}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Concluídos</span>
                      <span className="font-medium" style={{ color: engajamento.atividades.realizadas > 0 ? '#15803d' : undefined }}>
                        {engajamento.atividades.realizadas}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Não concluídas</span>
                      <span className="font-medium" style={{ color: engajamento.atividades.atrasadas > 0 ? '#dc2626' : undefined }}>
                        {engajamento.atividades.atrasadas}
                      </span>
                    </div>
                  </div>

                  {/* Cards com SLA */}
                  <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-semibold text-[10px] uppercase tracking-wide">Cards / Kanban</span>
                      <span className="font-bold text-[11px]" style={{ color: engScoreColor(engajamento.cards.score) }}>
                        {engScoreLabel(engajamento.cards.score)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">SLA em dia</span>
                      <span className="font-medium" style={{ color: engajamento.cards.emDia > 0 ? '#15803d' : undefined }}>
                        {engajamento.cards.emDia}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Atrasados</span>
                      <span className="font-medium" style={{ color: engajamento.cards.atrasados > 0 ? '#dc2626' : undefined }}>
                        {engajamento.cards.atrasados}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-[10px]">Bloqueados (trava ativa)</span>
                      <span className="font-medium text-gray-400 text-[10px]">
                        {engajamento.cards.bloqueados}
                      </span>
                    </div>
                  </div>

                  {/* Próximas Atividades */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-semibold text-[10px] uppercase tracking-wide">Próximas Ativ.</span>
                      <span className="font-bold text-[11px]" style={{ color: engScoreColor(engajamento.proximas.score) }}>
                        {engScoreLabel(engajamento.proximas.score)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Concluídos</span>
                      <span className="font-medium" style={{ color: engajamento.proximas.concluidos > 0 ? '#15803d' : undefined }}>
                        {engajamento.proximas.concluidos}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Vence hoje</span>
                      <span className="font-medium">{engajamento.proximas.venceHoje}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Atrasadas</span>
                      <span className="font-medium" style={{ color: engajamento.proximas.atrasadas > 0 ? '#dc2626' : undefined }}>
                        {engajamento.proximas.atrasadas}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </MeuCarometroCard>

            {/* Indicadores */}
            <MeuCarometroCard
              titulo="Indicadores"
              score={indicadores?.media ?? null}
              semanasIndicadores={semanasIndicadores}
              tipo="indicadores"
            />
          </div>

          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-700" />
              ≥75% Verde escuro
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
              60–74% Verde claro
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-600" />
              30–59% Amarelo
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" />
              &lt;30% Vermelho
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
