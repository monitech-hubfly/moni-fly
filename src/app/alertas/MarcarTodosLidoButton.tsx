'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { marcarTodosLido } from './actions';

type ContagemPrioridade = {
  critico: number;
  importante: number;
  informativo: number;
  total: number;
};

export function MarcarTodosLidoButton({
  categoriaAtiva,
  prioridadeAtiva,
  contagemNaoLidas,
}: {
  categoriaAtiva: string;
  prioridadeAtiva: string;
  contagemNaoLidas: ContagemPrioridade;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pending, setPending] = useState(false);

  const total = contagemNaoLidas.total;
  if (total === 0) return null;

  function mensagemConfirmacao(): string {
    if (prioridadeAtiva !== 'todas') {
      const label = prioridadeAtiva === 'critico' ? 'Críticas' : prioridadeAtiva === 'importante' ? 'Importantes' : 'Informativas';
      return `Marcar ${total} notificações ${label} como lidas?`;
    }
    const partes: string[] = [];
    if (contagemNaoLidas.critico > 0) partes.push(`${contagemNaoLidas.critico} 🔴 Críticas`);
    if (contagemNaoLidas.importante > 0) partes.push(`${contagemNaoLidas.importante} 🟡 Importantes`);
    if (contagemNaoLidas.informativo > 0) partes.push(`${contagemNaoLidas.informativo} ⚪ Informativas`);
    return `Marcar como lidas: ${partes.join(', ')}?`;
  }

  async function handleConfirmar() {
    setPending(true);
    await marcarTodosLido(categoriaAtiva, prioridadeAtiva);
    setPending(false);
    setConfirmando(false);
    router.refresh();
  }

  if (confirmando) {
    return (
      <div className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5">
        <span className="text-xs text-amber-800">{mensagemConfirmacao()}</span>
        <button
          type="button"
          onClick={handleConfirmar}
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
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
    >
      Marcar tudo como lido
    </button>
  );
}
