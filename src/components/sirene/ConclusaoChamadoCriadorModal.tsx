'use client';

import { useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: { suficiente: boolean; texto: string }) => void;
  pending?: boolean;
  titulo?: string;
};

export function ConclusaoChamadoCriadorModal({
  open,
  onClose,
  onConfirm,
  pending = false,
  titulo = 'Concluir chamado',
}: Props) {
  const [etapa, setEtapa] = useState<'escolha' | 'nao_suficiente'>('escolha');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  if (!open) return null;

  const handleClose = () => {
    setEtapa('escolha');
    setMotivo('');
    setErro(null);
    onClose();
  };

  const handleSuficiente = () => {
    onConfirm({ suficiente: true, texto: '' });
  };

  const handleConfirmarNaoSuficiente = () => {
    const t = motivo.trim();
    if (!t) {
      setErro('Informe o motivo para registrar a insatisfação.');
      return;
    }
    setErro(null);
    onConfirm({ suficiente: false, texto: t });
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conclusao-chamado-titulo"
      >
        <h3 id="conclusao-chamado-titulo" className="text-base font-semibold text-[color:var(--moni-text-primary)]">
          {titulo}
        </h3>

        {etapa === 'escolha' ? (
          <>
            <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">
              A resolução de cada atividade já foi registrada pelo time. Como você avalia o resultado?
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={handleSuficiente}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {pending ? 'Salvando…' : 'Foi suficiente — concluir'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setEtapa('nao_suficiente')}
                className="w-full rounded-lg border border-[color:var(--moni-border-default)] px-4 py-2.5 text-sm text-[color:var(--moni-text-primary)] hover:bg-[var(--moni-surface-50)] disabled:opacity-50"
              >
                Não foi suficiente
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleClose}
                className="w-full rounded-lg px-4 py-2 text-sm text-[color:var(--moni-text-tertiary)] hover:text-[color:var(--moni-text-secondary)]"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">
              Descreva o que ficou pendente. O chamado será concluído e o time interno poderá dar continuidade.
            </p>
            <label className="mt-4 block text-xs font-medium text-[color:var(--moni-text-secondary)]">
              Motivo
              <textarea
                value={motivo}
                onChange={(e) => { setMotivo(e.target.value); setErro(null); }}
                rows={4}
                className="mt-1 w-full resize-none rounded-lg border border-[color:var(--moni-border-default)] px-3 py-2 text-sm text-[color:var(--moni-text-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--moni-navy-400)]"
                placeholder="O que ficou pendente ou precisa ser retomado?"
                disabled={pending}
                autoFocus
              />
            </label>
            {erro ? <p className="mt-2 text-sm text-red-600">{erro}</p> : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={handleConfirmarNaoSuficiente}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {pending ? 'Salvando…' : 'Confirmar e concluir'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => { setEtapa('escolha'); setErro(null); }}
                className="rounded-lg border border-[color:var(--moni-border-default)] px-4 py-2 text-sm hover:bg-[var(--moni-surface-50)]"
              >
                Voltar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
