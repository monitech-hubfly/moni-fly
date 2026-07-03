'use client';

type Props = {
  nomeAtividade: string;
  onEscolher: (classificacao: 'pontual' | 'recorrente') => void;
  pending?: boolean;
};

export function ClassificacaoConclusaoModal({ nomeAtividade, onEscolher, pending }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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
            onClick={() => onEscolher('recorrente')}
            className="rounded-lg border-2 border-violet-200 bg-violet-50 px-4 py-3 text-left transition hover:border-violet-400 hover:bg-violet-100 disabled:opacity-50"
          >
            <span className="block text-sm font-semibold text-violet-800">Recorrente</span>
            <span className="block text-[11px] text-violet-600">Padrão identificado — deve ser monitorado em Perícias</span>
          </button>
        </div>

        <p className="mt-4 text-[10px] text-stone-400 text-center">
          Obrigatório — o status não será salvo sem esta escolha.
        </p>
      </div>
    </div>
  );
}
