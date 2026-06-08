'use client';

import { Loader2 } from 'lucide-react';
import { MapaInterativoSecao } from '@/components/step-one/MapaInterativoSecao';
import { usePracaDadosCidadeChecklist } from '@/components/kanban-shared/usePracaDadosCidadeChecklist';

type Props = {
  processoId: string;
  itemLabel: string;
  obrigatorio?: boolean;
};

export function MapaPracaChecklist({ processoId, itemLabel, obrigatorio }: Props) {
  const { dados, carregando } = usePracaDadosCidadeChecklist(processoId);

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
        <Loader2 size={14} className="animate-spin" />
        Carregando {itemLabel.toLowerCase()}…
      </div>
    );
  }

  if (!dados?.ok) {
    return (
      <div>
        <p className="mb-1 text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {itemLabel}
          {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
        </p>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {dados?.error ?? 'Processo Step One não vinculado a este card.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
        {itemLabel}
        {obrigatorio ? <span className="ml-1 text-red-500">*</span> : null}
      </p>
      <MapaInterativoSecao cidade={dados.cidade} estado={dados.estado} showHeading={false} />
    </div>
  );
}
