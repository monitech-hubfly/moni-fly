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
  const [texto, setTexto] = useState('');
  const [naoSuficiente, setNaoSuficiente] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  if (!open) return null;

  const handleConfirm = () => {
    const t = texto.trim();
    if (!t) {
      setErroLocal(
        naoSuficiente
          ? 'Informe o motivo para indicar que a resolução não foi suficiente.'
          : 'Informe as informações sobre a conclusão do chamado.',
      );
      return;
    }
    setErroLocal(null);
    onConfirm({ suficiente: !naoSuficiente, texto: t });
  };

  const handleClose = () => {
    setTexto('');
    setNaoSuficiente(false);
    setErroLocal(null);
    onClose();
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
        <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">
          Somente quem abriu o chamado pode concluí-lo. Descreva o resultado ou o motivo da reabertura.
        </p>

        <label className="mt-4 block text-xs font-medium text-[color:var(--moni-text-secondary)]">
          {naoSuficiente ? 'Motivo (resolução não suficiente)' : 'Informações da conclusão'}
          <textarea
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setErroLocal(null);
            }}
            rows={4}
            className="mt-1 w-full resize-none rounded-lg border border-[color:var(--moni-border-default)] px-3 py-2 text-sm text-[color:var(--moni-text-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--moni-navy-400)]"
            placeholder={
              naoSuficiente
                ? 'Por que a resolução não foi suficiente? Você poderá abrir novas atividades.'
                : 'Descreva o que foi resolvido e qualquer informação relevante.'
            }
            disabled={pending}
            autoFocus
          />
        </label>

        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-[color:var(--moni-text-secondary)]">
          <input
            type="checkbox"
            checked={naoSuficiente}
            onChange={(e) => {
              setNaoSuficiente(e.target.checked);
              setErroLocal(null);
            }}
            disabled={pending}
            className="mt-0.5 rounded border-[color:var(--moni-border-default)]"
          />
          <span>
            Resolução <strong>não</strong> foi suficiente — manter em andamento e permitir novas atividades
          </span>
        </label>

        {erroLocal ? <p className="mt-2 text-sm text-red-600">{erroLocal}</p> : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {pending ? 'Salvando…' : naoSuficiente ? 'Reabrir chamado' : 'Confirmar conclusão'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleClose}
            className="rounded-lg border border-[color:var(--moni-border-default)] px-4 py-2 text-sm hover:bg-[var(--moni-surface-50)]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
