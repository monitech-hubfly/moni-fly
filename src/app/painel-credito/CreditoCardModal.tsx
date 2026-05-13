'use client';

import { PainelProcessoCardModal } from '@/app/steps-viabilidade/PainelProcessoCardModal';

/** @deprecated Preferir `PainelProcessoCardModal` com `board="credito"`; mantido para imports existentes. */
export function CreditoCardModal({ processoId, onClose }: { processoId: string; onClose: () => void }) {
  return <PainelProcessoCardModal processoId={processoId} onClose={onClose} board="credito" />;
}
