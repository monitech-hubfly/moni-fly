'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { marcarAlertaLido, marcarAlertasPorTopicoLidos } from './actions';

type Props = { alertaId: string; alertCount?: number; topicoId?: string };

export function MarcarLidoButton({ alertaId, alertCount, topicoId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  async function handleClick() {
    if (alertCount && alertCount > 1 && topicoId && !confirmando) {
      setConfirmando(true);
      return;
    }
    setPending(true);
    if (alertCount && alertCount > 1 && topicoId) {
      await marcarAlertasPorTopicoLidos(topicoId);
    } else {
      await marcarAlertaLido(alertaId);
    }
    setPending(false);
    setConfirmando(false);
    router.refresh();
  }

  return confirmando ? (
    <div className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5">
      <span className="text-xs text-amber-800">Marcar {alertCount} notificações como lidas?</span>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded bg-amber-500 px-2 py-0.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Marcando…' : 'Confirmar'}
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        disabled={pending}
        className="text-xs text-amber-700 hover:underline"
      >
        Cancelar
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-50"
    >
      {pending ? 'Marcando…' : 'Marcar como lido'}
    </button>
  );
}
