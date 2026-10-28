'use client';

import { PERGUNTA_INTENCAO_SHOWROOM_LOTEADOR } from '@/lib/kanban/loteadores-passagem-waysers';

type Props = {
  open: boolean;
  salvando?: boolean;
  onResponder: (intencaoShowroom: boolean) => void;
  onCancelar: () => void;
};

export function LoteadoresIntencaoShowroomModal({
  open,
  salvando = false,
  onResponder,
  onCancelar,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/50 p-4"
      onClick={salvando ? undefined : onCancelar}
    >
      <div
        className="w-full max-w-md bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intencao-showroom-titulo"
        style={{
          borderRadius: 'var(--moni-radius-lg)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="intencao-showroom-titulo"
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          {PERGUNTA_INTENCAO_SHOWROOM_LOTEADOR}
        </h3>
        <p className="mt-3 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          O card só entra em Passagem IMOB depois desta resposta. Sim vincula o Funil Showroom. Sim ou
          Não vincula um card no Funil IMOB.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={salvando}
            onClick={onCancelar}
            className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              borderRadius: 'var(--moni-radius-md)',
              color: 'var(--moni-text-tertiary)',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => onResponder(false)}
            className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              borderRadius: 'var(--moni-radius-md)',
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              color: 'var(--moni-text-secondary)',
            }}
          >
            Não
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => onResponder(true)}
            className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{
              borderRadius: 'var(--moni-radius-md)',
              background: 'var(--moni-navy-800)',
            }}
          >
            {salvando ? 'Salvando…' : 'Sim'}
          </button>
        </div>
      </div>
    </div>
  );
}
