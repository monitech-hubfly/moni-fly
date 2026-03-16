'use client';

import { useRouter } from 'next/navigation';
import { avancarParaProximoStep } from './actions';

export function IrParaStep3Button({ processoId }: { processoId: string }) {
  const router = useRouter();

  async function handleAvancar() {
    const result = await avancarParaProximoStep(processoId, 3);
    if (result.ok) {
      router.push('/step-3');
      router.refresh();
    } else {
      alert(result.error ?? 'Erro ao avançar.');
    }
  }

  return (
    <button type="button" onClick={handleAvancar} className="btn-primary">
      Concluir Step 2 e ir para Step 3 →
    </button>
  );
}
