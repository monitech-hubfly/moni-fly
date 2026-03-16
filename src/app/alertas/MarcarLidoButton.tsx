"use client";

import { useRouter } from "next/navigation";
import { marcarAlertaLido } from "./actions";

export function MarcarLidoButton({ alertaId }: { alertaId: string }) {
  const router = useRouter();

  const handleClick = async () => {
    await marcarAlertaLido(alertaId);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="shrink-0 rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
    >
      Marcar como lido
    </button>
  );
}
