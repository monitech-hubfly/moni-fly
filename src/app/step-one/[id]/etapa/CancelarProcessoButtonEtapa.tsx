'use client';

import { useRouter } from 'next/navigation';
import { cancelarProcesso } from './actions';

export function CancelarProcessoButtonEtapa({ processoId }: { processoId: string }) {
  const router = useRouter();

  async function handleCancelar() {
    if (!confirm('Tem certeza que deseja cancelar este processo? Esta ação não pode ser desfeita.'))
      return;
    const result = await cancelarProcesso(processoId);
    if (result.ok) {
      router.push('/step-2');
      router.refresh();
    } else {
      alert(result.error);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCancelar}
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
    >
      Cancelar processo
    </button>
  );
}
