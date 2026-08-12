'use client';

import { useState } from 'react';
import type { AtividadeAgenda } from '@/hooks/useAgenda';
import { responderConvite } from '@/lib/actions/agenda-participantes';

type Props = {
  atv: AtividadeAgenda;
  onFechar: () => void;
  onRespondeu: () => void;
};

function formatarData(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

export function AgendaConviteModal({ atv, onFechar, onRespondeu }: Props) {
  const [modo, setModo] = useState<'inicial' | 'proposta'>('inicial');
  const [propostaData, setPropostaData] = useState(atv.data);
  const [propostaInicio, setPropostaInicio] = useState(atv.hora_inicio);
  const [propostaFim, setPropostaFim] = useState(atv.hora_fim ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleResposta = async (status: 'aceito' | 'recusado' | 'proposta_horario') => {
    if (status === 'proposta_horario' && !propostaData) {
      setErro('Informe a data e horário da proposta.');
      return;
    }

    setSalvando(true);
    setErro(null);

    const res = await responderConvite(
      atv.id,
      status,
      status === 'proposta_horario'
        ? { data: propostaData, hora_inicio: propostaInicio, hora_fim: propostaFim }
        : undefined,
    );

    setSalvando(false);

    if (!res.ok) {
      setErro(res.error ?? 'Erro ao responder');
      return;
    }

    onRespondeu();
    onFechar();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[500]"
        onClick={onFechar}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[501] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📨</span>
              <span className="text-sm font-semibold text-gray-800">Convite de agenda</span>
            </div>
            <button
              type="button"
              onClick={onFechar}
              className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {/* Evento */}
          <div className="mx-5 mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100">
            <p className="text-sm font-semibold text-blue-900 leading-tight">{atv.titulo}</p>
            <p className="text-xs text-blue-700 mt-1">{formatarData(atv.data)}</p>
            <p className="text-xs text-blue-600 mt-0.5">
              {atv.hora_inicio}{atv.hora_fim ? ` – ${atv.hora_fim}` : ''}
            </p>
            {atv.organizador_nome && (
              <p className="text-xs text-blue-500 mt-1.5">
                Organizado por <span className="font-medium">{atv.organizador_nome}</span>
              </p>
            )}
          </div>

          {modo === 'inicial' ? (
            <>
              {/* Botões de resposta */}
              <div className="px-5 pb-5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => handleResposta('aceito')}
                  className="w-full py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors"
                >
                  {salvando ? 'Salvando…' : '✓ Aceitar'}
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => handleResposta('recusado')}
                  className="w-full py-2.5 rounded-xl bg-red-100 text-red-600 text-sm font-semibold hover:bg-red-200 disabled:opacity-50 transition-colors border border-red-200"
                >
                  ✕ Recusar
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => setModo('proposta')}
                  className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors border border-gray-200"
                >
                  📅 Propor novo horário
                </button>

                {erro && <p className="text-xs text-red-500 text-center mt-1">{erro}</p>}
              </div>
            </>
          ) : (
            <>
              {/* Formulário de proposta */}
              <div className="px-5 pb-5">
                <p className="text-xs font-semibold text-gray-600 mb-3">Sugerir novo horário</p>

                <div className="flex flex-col gap-2.5">
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Data</label>
                    <input
                      type="date"
                      value={propostaData}
                      onChange={e => setPropostaData(e.target.value)}
                      className="mt-0.5 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Início</label>
                      <input
                        type="time"
                        value={propostaInicio}
                        onChange={e => setPropostaInicio(e.target.value)}
                        className="mt-0.5 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Fim</label>
                      <input
                        type="time"
                        value={propostaFim}
                        onChange={e => setPropostaFim(e.target.value)}
                        className="mt-0.5 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  </div>
                </div>

                {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setModo('inicial')}
                    className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors"
                  >
                    ← Voltar
                  </button>
                  <button
                    type="button"
                    disabled={salvando || !propostaData || !propostaInicio}
                    onClick={() => handleResposta('proposta_horario')}
                    className="flex-1 py-2 rounded-xl bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {salvando ? 'Enviando…' : 'Enviar proposta'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
