'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { finalizarEstudoStep1 } from './actions';

export function FinalizarEstudoButton({ processoId }: { processoId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleFinalizar = async () => {
    if (
      !confirm(
        'Finalizar este estudo Step 1? Ele poderá ser usado no Step 2 (estudo de viabilidade).',
      )
    )
      return;
    setLoading(true);
    const result = await finalizarEstudoStep1(processoId);
    setLoading(false);
    if (result.ok) {
      router.push(`/step-one/${processoId}`);
      router.refresh();
    } else {
      alert(result.error);
    }
  };

  return (
    <button type="button" onClick={handleFinalizar} disabled={loading} className="btn-primary">
      {loading ? 'Finalizando…' : 'Finalizar estudo'}
    </button>
  );
}
