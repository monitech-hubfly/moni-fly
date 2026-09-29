'use client';

import { memo } from 'react';

type PastelariaToastProps = {
  message: string | null;
  type?: 'ok' | 'err';
};

function PastelariaToastInner({ message, type = 'ok' }: PastelariaToastProps) {
  if (!message) return null;
  return (
    <div
      className={type === 'err' ? 'pastelaria-toast pastelaria-toast--err' : 'gantt-toast-sucesso'}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
export const PastelariaToast = memo(PastelariaToastInner);
