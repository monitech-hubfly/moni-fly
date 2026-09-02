'use client';

import { useState, useTransition } from 'react';
import { PericiaSelect } from '@/components/sirene/PericiaSelect';
import { vincularChamadoPericia } from '@/app/sirene/pericias/actions';

type Props = {
  nomeAtividade: string;
  onEscolher: (classificacao: 'pontual' | 'recorrente') => void;
  pending?: boolean;
  /** Quando fornecido e o usuário escolhe "Recorrente", exibe passo 2 de vinculação à perícia. */
  chamadoId?: number;
};

export function ClassificacaoConclusaoModal({ nomeAtividade, onEscolher, pending, chamadoId }: Props) {
  const [passo, setPasso] = useState<'classificacao' | 'pericia'>('classificacao');
  const [periciaVinculada, setPericiaVinculada] = useState<{
    id: number;
    numero: string;
    titulo: string;
    status: string;
    dominio: string;
  } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [vinculando, startVinculo] = useTransition();

  function handleEscolherRecorrente() {
    // Com chamadoId: abre passo 2 (vínculo opcional) sem fechar o modal.
    // Sem chamadoId: conclui direto (pai salva status e desmonta).
    if (chamadoId) {
      setPasso('pericia');
      return;
    }
    onEscolher('recorrente');
  }

  function handlePular() {
    onEscolher('recorrente');
  }

  function handleVincularEFechar() {
    if (!periciaVinculada || !chamadoId) return;
    startVinculo(async () => {
      await vincularChamadoPericia(
        chamadoId,
        periciaVinculada.id,
        motivo.trim() || 'Vinculado ao concluir atividade',
      );
      // Salva status + fecha (pai limpa o estado ao receber onEscolher)
      onEscolher('recorrente');
    });
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {passo === 'classificacao' ? (
          <>
            <h3 className="mb-1 text-base font-semibold text-stone-800">
              Classificar conclusão
            </h3>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Atividade
            </p>
            <p className="mb-5 text-sm text-stone-700 leading-snug">{nomeAtividade}</p>

            <p className="mb-3 text-sm text-stone-600">Esta ocorrência foi:</p>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => onEscolher('pontual')}
                className="rounded-lg border-2 border-stone-200 bg-stone-50 px-4 py-3 text-left transition hover:border-stone-400 hover:bg-stone-100 disabled:opacity-50"
              >
                <span className="block text-sm font-semibold text-stone-800">Pontual</span>
                <span className="block text-[11px] text-stone-500">Ocorrência isolada, não tende a se repetir</span>
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleEscolherRecorrente}
                className="rounded-lg border-2 border-violet-200 bg-violet-50 px-4 py-3 text-left transition hover:border-violet-400 hover:bg-violet-100 disabled:opacity-50"
              >
                <span className="block text-sm font-semibold text-violet-800">Recorrente</span>
                <span className="block text-[11px] text-violet-600">Padrão identificado — deve ser monitorado em Perícias</span>
              </button>
            </div>

            <p className="mt-4 text-[10px] text-stone-400 text-center">
              Obrigatório — o status não será salvo sem esta escolha.
            </p>
          </>
        ) : (
          <>
            <h3 className="mb-1 text-base font-semibold text-stone-800">
              Vincular a uma classificação
            </h3>
            <p className="mb-4 text-sm text-stone-500 leading-snug">
              Selecione a perícia que melhor representa este padrão (opcional).
            </p>

            <PericiaSelect
              onSelect={(id, info) => setPericiaVinculada({ id, ...info })}
              onCriarNova={(dominio) => {
                window.open(
                  `/sirene/pericias?criar=true&dominio=${encodeURIComponent(dominio)}`,
                  '_blank',
                );
              }}
            />

            {periciaVinculada && (
              <div className="mt-3 flex flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                  Motivo (opcional)
                </label>
                <textarea
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-violet-500"
                  rows={2}
                  placeholder="Descreva como este chamado se encaixa nesta classificação…"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                disabled={pending || vinculando}
                onClick={handlePular}
                className="text-sm text-stone-400 hover:text-stone-600 disabled:opacity-50"
              >
                Pular
              </button>
              <button
                type="button"
                disabled={!periciaVinculada || vinculando}
                onClick={handleVincularEFechar}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {vinculando ? 'Vinculando…' : 'Vincular e fechar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
