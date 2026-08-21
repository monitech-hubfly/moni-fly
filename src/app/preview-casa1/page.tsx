import type { Metadata } from 'next';

/**
 * Pré-visualização local da Casa 1 — sem autenticação, sem guard.
 * Não linkar no menu; remover ou proteger antes de produção.
 */
export const metadata: Metadata = {
  title: 'Preview — Casa 1 (desenvolvimento)',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function PreviewCasa1Page() {
  return (
    <div className="min-h-screen bg-stone-50 px-4 py-8 md:px-6">
      <p className="text-xs font-medium text-stone-500">Preview dev — sem AppShell e sem guard de Casa 0</p>
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-stone-600">Estrutura vazia até o hub da Casa 1 existir.</p>
      </div>
    </div>
  );
}
