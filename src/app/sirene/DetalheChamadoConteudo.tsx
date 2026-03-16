'use client';

import { useState } from 'react';
import { ModalRedirecionarHDM } from './ModalRedirecionarHDM';
import type { Chamado } from '@/types/sirene';
import type { SireneUserContext } from '@/lib/sirene';

type Props = {
  chamado: Chamado;
  userContext: SireneUserContext;
  podeActuarComoBombeiro: boolean;
  podePreencherTemaMapeamento: boolean;
  mostrarControlesBombeiro: boolean;
  mostrarRedirecionarHDM: boolean;
};

export function DetalheChamadoConteudo({
  chamado,
  podePreencherTemaMapeamento,
  mostrarControlesBombeiro,
  mostrarRedirecionarHDM,
}: Props) {
  const [modalRedirecionar, setModalRedirecionar] = useState(false);

  return (
    <>
      <div className="mt-8 space-y-6">
        {mostrarRedirecionarHDM && (
          <section className="rounded-xl border border-stone-700 bg-stone-800/80 p-4">
            <h2 className="text-sm font-semibold text-stone-200">Ações Bombeiro</h2>
            <button
              type="button"
              onClick={() => setModalRedirecionar(true)}
              className="mt-2 rounded-lg border border-[#1e3a5f] bg-[#1e3a5f]/20 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-[#1e3a5f]/30"
            >
              Redirecionar para HDM
            </button>
          </section>
        )}

        {mostrarControlesBombeiro && (
          <section className="rounded-xl border border-stone-700 bg-stone-800/80 p-4">
            <h2 className="text-sm font-semibold text-stone-200">Resolução e tópicos</h2>
            <p className="mt-1 text-sm text-stone-400">
              Controles de resolução pontual, prioridade e aprovação de tópicos (em implementação).
            </p>
          </section>
        )}

        <section className="rounded-xl border border-stone-700 bg-stone-800/80 p-4">
          <h2 className="text-sm font-semibold text-stone-200">
            Fechamento — Tema e mapeamento de perícia
          </h2>
          {podePreencherTemaMapeamento ? (
            <p className="mt-1 text-sm text-stone-300">
              Preenchimento exclusivo do Bombeiro. Campos: parecer final, tema, mapeamento (em
              implementação).
            </p>
          ) : (
            <p className="mt-1 text-sm italic text-stone-500">
              Apenas o Bombeiro pode preencher tema e mapeamento de perícia.
            </p>
          )}
          {chamado.parecer_final && (
            <div className="mt-2 rounded bg-stone-700/80 p-2 text-sm text-stone-200">
              <strong>Parecer:</strong> {chamado.parecer_final}
            </div>
          )}
          {chamado.tema && (
            <p className="mt-1 text-sm text-stone-300">
              <strong>Tema:</strong> {chamado.tema}
            </p>
          )}
          {chamado.mapeamento_pericia && (
            <p className="mt-1 text-sm text-stone-300">
              <strong>Mapeamento:</strong> {chamado.mapeamento_pericia}
            </p>
          )}
        </section>
      </div>

      {modalRedirecionar && (
        <ModalRedirecionarHDM
          chamadoId={chamado.id}
          onClose={() => setModalRedirecionar(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </>
  );
}
