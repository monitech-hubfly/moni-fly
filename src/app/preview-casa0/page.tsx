import type { Metadata } from 'next';
import Casa0Hub from '@/components/casa0-hub';

/**
 * Pré-visualização local do hub Casa 0 — sem autenticação.
 * Não linkar no menu; remover ou proteger antes de produção.
 */
export const metadata: Metadata = {
  title: 'Preview — Casa 0 (desenvolvimento)',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function PreviewCasa0Page() {
  return (
    <div className="px-4 md:px-6">
      <Casa0Hub />
    </div>
  );
}
