'use client';

import { useRouter } from 'next/navigation';
import { marcarTodosLido } from './actions';

export function MarcarTodosLidoButton({ categoriaAtiva }: { categoriaAtiva: string }) {
  const router = useRouter();

  const handleClick = async () => {
    await marcarTodosLido(categoriaAtiva);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
    >
      Marcar tudo como lido
    </button>
  );
}
